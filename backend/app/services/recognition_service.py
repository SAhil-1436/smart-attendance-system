from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
import numpy as np
import logging
from typing import Optional, List, Tuple

from app.cv.face_engine import face_engine
from app.cv.embedding_cache import embedding_cache
from app.models.student import Student
from app.models.face_embedding import FaceEmbedding
from app.models.setting import SystemSetting
from app.core.config import settings
from app.schemas.recognition import (
    RecognizeRequest, 
    RecognizeResponse, 
    RecognizedStudentInfo
)

logger = logging.getLogger("smart_attendance.recognition_service")

class RecognitionService:

    @staticmethod
    async def get_similarity_threshold(db: AsyncSession, custom_threshold: Optional[float] = None) -> float:
        if custom_threshold is not None and 0.0 <= custom_threshold <= 1.0:
            return float(custom_threshold)
        
        stmt = select(SystemSetting).where(SystemSetting.key == "face_similarity_threshold")
        res = await db.execute(stmt)
        setting = res.scalar_one_or_none()
        if setting:
            try:
                return float(setting.value)
            except ValueError:
                pass
        return float(settings.FACE_SIMILARITY_THRESHOLD)

    @staticmethod
    async def recognize_face(
        db: AsyncSession,
        payload: RecognizeRequest
    ) -> RecognizeResponse:
        threshold = await RecognitionService.get_similarity_threshold(db, payload.threshold)

        # 1. Decode frame
        try:
            image = face_engine.decode_image(payload.image_data)
        except ValueError as e:
            return RecognizeResponse(
                face_detected=False,
                num_faces=0,
                is_recognized=False,
                similarity_score=0.0,
                threshold_used=threshold,
                message=f"Image decoding failed: {str(e)}"
            )

        # 2. Detect faces
        faces = face_engine.detect_faces(image)
        if len(faces) == 0:
            return RecognizeResponse(
                face_detected=False,
                num_faces=0,
                is_recognized=False,
                similarity_score=0.0,
                threshold_used=threshold,
                message="No face detected in frame. Please face the camera directly."
            )

        if len(faces) > 1:
            return RecognizeResponse(
                face_detected=True,
                num_faces=len(faces),
                is_recognized=False,
                similarity_score=0.0,
                threshold_used=threshold,
                message=f"Multiple faces ({len(faces)}) detected. Attendance requires exactly one person in view."
            )

        face = faces[0]
        bbox = face["bbox"]

        # 3. Quality evaluation
        quality = face_engine.evaluate_face_quality(image, bbox)
        if not quality.is_valid:
            return RecognizeResponse(
                face_detected=True,
                num_faces=1,
                is_recognized=False,
                bbox=bbox,
                similarity_score=0.0,
                threshold_used=threshold,
                message=f"Low image quality: {quality.reason}"
            )

        # 4. Generate 128-d normalized embedding
        query_embedding = face_engine.extract_embedding(image, face["raw"])

        # 5. Retrieve cached candidate pool (or load on cache miss)
        matrix, metadata = await embedding_cache.get_or_load(
            db=db,
            course_id=payload.course_id,
            semester=payload.semester,
            section=payload.section
        )

        if matrix is None or len(metadata) == 0:
            return RecognizeResponse(
                face_detected=True,
                num_faces=1,
                is_recognized=False,
                bbox=bbox,
                similarity_score=0.0,
                threshold_used=threshold,
                message="No registered students found matching class criteria."
            )

        # 6. Ultra-fast vectorized matrix dot product across all registered embeddings
        # Matrix shape: (M, 128), query_embedding shape: (128,) -> scores shape: (M,)
        scores = np.dot(matrix, query_embedding)
        best_idx = int(np.argmax(scores))
        best_similarity = float(np.clip(scores[best_idx], 0.0, 1.0))
        best_meta = metadata[best_idx]

        # 7. Threshold verification
        if best_similarity >= threshold:
            confidence = "HIGH" if best_similarity >= 0.75 else "MEDIUM"
            student_info = RecognizedStudentInfo(
                id=best_meta["id"],
                student_id=best_meta["student_id"],
                name=best_meta["name"],
                email=best_meta["email"],
                department_name=best_meta["department_name"],
                course_name=best_meta["course_name"],
                semester=best_meta["semester"],
                section=best_meta["section"]
            )
            return RecognizeResponse(
                face_detected=True,
                num_faces=1,
                is_recognized=True,
                bbox=bbox,
                similarity_score=round(best_similarity, 3),
                threshold_used=threshold,
                confidence_level=confidence,
                student=student_info,
                message=f"Identified {best_meta['name']} ({best_meta['student_id']}) with {confidence} confidence ({best_similarity*100:.1f}%)."
            )
        else:
            return RecognizeResponse(
                face_detected=True,
                num_faces=1,
                is_recognized=False,
                bbox=bbox,
                similarity_score=round(best_similarity, 3),
                threshold_used=threshold,
                confidence_level="LOW",
                student=None,  # NEVER expose identity if confidence is below threshold!
                message=f"Unknown person or similarity ({best_similarity*100:.1f}%) is below configured threshold ({threshold*100:.1f}%)."
            )
