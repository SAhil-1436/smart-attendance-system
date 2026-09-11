import time
import asyncio
import numpy as np
import logging
from typing import Optional, Dict, List, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.models.student import Student
from app.models.face_embedding import FaceEmbedding

logger = logging.getLogger("smart_attendance.embedding_cache")

class CachedPool:
    def __init__(self, matrix: np.ndarray, metadata: List[Dict[str, Any]], created_at: float):
        self.matrix = matrix          # Shape: (M, 128), float32 normalized embeddings
        self.metadata = metadata      # List of length M matching matrix rows
        self.created_at = created_at

class EmbeddingCacheManager:
    """
    High-performance in-memory cache for active attendance sessions.
    Pre-stacks 128-d face embeddings into continuous float32 NumPy matrices
    for sub-millisecond vectorized SIMD/BLAS matrix-vector dot products (np.dot).
    Eliminates redundant database disk reads during real-time kiosk operation.
    """
    def __init__(self, ttl_seconds: int = 300):
        self.ttl = ttl_seconds
        self._pools: Dict[str, CachedPool] = {}
        self._lock = asyncio.Lock()
        self.hits: int = 0
        self.misses: int = 0

    def _make_key(self, course_id: Optional[int], semester: Optional[int], section: Optional[str]) -> str:
        c = str(course_id) if course_id is not None else "*"
        s = str(semester) if semester is not None else "*"
        sec = section.upper() if section else "*"
        return f"{c}:{s}:{sec}"

    async def get_or_load(
        self,
        db: AsyncSession,
        course_id: Optional[int] = None,
        semester: Optional[int] = None,
        section: Optional[str] = None
    ) -> Tuple[Optional[np.ndarray], List[Dict[str, Any]]]:
        """
        Retrieves stacked embeddings matrix and aligned metadata from cache,
        or loads and compiles them from the database on cache miss.
        """
        key = self._make_key(course_id, semester, section)
        now = time.time()

        async with self._lock:
            cached = self._pools.get(key)
            if cached and (now - cached.created_at) < self.ttl:
                self.hits += 1
                return cached.matrix, cached.metadata

            self.misses += 1

        # Cache miss - load from DB
        conditions = [
            Student.is_active == True,
            Student.face_registered == True
        ]
        if course_id is not None:
            conditions.append(Student.course_id == course_id)
        if semester is not None:
            conditions.append(Student.semester == semester)
        if section:
            conditions.append(Student.section == section.upper())

        stmt = (
            select(Student)
            .options(
                selectinload(Student.face_embeddings),
                selectinload(Student.department),
                selectinload(Student.course)
            )
            .where(and_(*conditions))
        )
        res = await db.execute(stmt)
        students = res.scalars().all()

        vectors: List[np.ndarray] = []
        metadata: List[Dict[str, Any]] = []

        for student in students:
            if not student.face_embeddings:
                continue

            dept_name = student.department.name if student.department else None
            course_name = student.course.name if student.course else None

            for emb_record in student.face_embeddings:
                vec = np.frombuffer(emb_record.embedding_vector, dtype=np.float32)
                # Ensure unit normalization for pure cosine dot products
                norm = np.linalg.norm(vec)
                if norm > 1e-6:
                    vec = vec / norm
                vectors.append(vec)
                metadata.append({
                    "id": student.id,
                    "student_id": student.student_id,
                    "name": student.name,
                    "email": student.email,
                    "department_name": dept_name,
                    "course_name": course_name,
                    "semester": student.semester,
                    "section": student.section,
                    "sample_index": emb_record.sample_index,
                    "student_obj": student
                })

        if vectors:
            matrix = np.vstack(vectors).astype(np.float32)
        else:
            matrix = None

        pool = CachedPool(matrix=matrix, metadata=metadata, created_at=now)

        async with self._lock:
            self._pools[key] = pool

        logger.debug(f"Compiled embedding cache pool for '{key}': {len(metadata)} vectors.")
        return matrix, metadata

    async def invalidate(self, course_id: Optional[int] = None, semester: Optional[int] = None, section: Optional[str] = None):
        """Invalidates matching cache entries or clears all if wildcard."""
        async with self._lock:
            if course_id is None and semester is None and section is None:
                self._pools.clear()
            else:
                key = self._make_key(course_id, semester, section)
                self._pools.pop(key, None)
                # Also clear wildcard key if present
                self._pools.pop("*:*:*", None)

    async def clear(self):
        """Clears entire in-memory cache."""
        async with self._lock:
            self._pools.clear()
            self.hits = 0
            self.misses = 0

    def stats(self) -> Dict[str, Any]:
        total_requests = self.hits + self.misses
        hit_ratio = (self.hits / total_requests * 100.0) if total_requests > 0 else 0.0
        return {
            "cached_pools": len(self._pools),
            "hits": self.hits,
            "misses": self.misses,
            "hit_ratio_percent": round(hit_ratio, 2)
        }

# Global embedding cache singleton
embedding_cache = EmbeddingCacheManager(ttl_seconds=300)
