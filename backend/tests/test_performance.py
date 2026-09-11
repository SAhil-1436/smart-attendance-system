import pytest
import time
import numpy as np
from httpx import AsyncClient, ASGITransport
from sqlalchemy import text
from app.main import app
from app.core.database import AsyncSessionLocal
from app.cv.face_engine import face_engine
from app.cv.embedding_cache import embedding_cache

@pytest.mark.asyncio
async def test_vectorized_simd_dot_product_benchmark():
    """
    Benchmarks vectorized matrix-vector dot product (np.dot) against 1,000 enrolled faces (3,000 samples).
    Verifies that Apple Accelerate / BLAS SIMD matrix matching executes in < 5ms.
    """
    num_samples = 3000
    embedding_dim = 128

    # Generate 3,000 random unit-normalized embeddings
    raw_matrix = np.random.randn(num_samples, embedding_dim).astype(np.float32)
    norms = np.linalg.norm(raw_matrix, axis=1, keepdims=True)
    candidate_matrix = raw_matrix / norms

    # Query embedding
    raw_query = np.random.randn(embedding_dim).astype(np.float32)
    query = raw_query / np.linalg.norm(raw_query)

    # Benchmark 100 iterations of full matrix dot product
    start = time.perf_counter()
    for _ in range(100):
        scores = np.dot(candidate_matrix, query)
        best_idx = np.argmax(scores)
        best_score = scores[best_idx]
    elapsed_total = time.perf_counter() - start
    avg_ms = (elapsed_total / 100) * 1000.0

    print(f"\n[BENCHMARK] 3,000 candidate embeddings vectorized SIMD matching: {avg_ms:.3f} ms per frame")
    # Must comfortably be under 5ms (usually ~0.05ms - 0.2ms)
    assert avg_ms < 5.0
    assert len(scores) == num_samples

@pytest.mark.asyncio
async def test_embedding_cache_hit_and_invalidation():
    """Verifies that EmbeddingCache eliminates redundant DB queries and invalidates on changes."""
    await embedding_cache.clear()
    assert embedding_cache.hits == 0
    assert embedding_cache.misses == 0

    async with AsyncSessionLocal() as db:
        # First call: Cache miss (loads from DB)
        mat1, meta1 = await embedding_cache.get_or_load(db, course_id=1, semester=6, section="A")
        assert embedding_cache.misses == 1
        assert embedding_cache.hits == 0

        # Second call: Cache hit (0 DB queries)
        mat2, meta2 = await embedding_cache.get_or_load(db, course_id=1, semester=6, section="A")
        assert embedding_cache.misses == 1
        assert embedding_cache.hits == 1
        assert len(meta1) == len(meta2)

        stats = embedding_cache.stats()
        assert stats["hits"] == 1
        assert stats["misses"] == 1
        assert stats["hit_ratio_percent"] == 50.0

        # Invalidate cache
        await embedding_cache.invalidate(course_id=1, semester=6, section="A")
        stats_after = embedding_cache.stats()
        assert stats_after["cached_pools"] == 0

from app.core.init_db import init_db

@pytest.mark.asyncio
async def test_database_performance_indexes_exist():
    """Verifies that critical composite performance indices are active in SQLite."""
    await init_db()
    async with AsyncSessionLocal() as db:
        res = await db.execute(text("PRAGMA index_list('attendance_records')"))
        indexes = [row[1] for row in res.fetchall()]
        
        # Check newly added composite indices
        assert "ix_attendance_query" in indexes
        assert "ix_attendance_student_marked" in indexes
        assert "ix_attendance_status_marked" in indexes
        assert any("autoindex" in idx or "uq_session_student_attendance" in idx for idx in indexes)

        res_sess = await db.execute(text("PRAGMA index_list('attendance_sessions')"))
        sess_indexes = [row[1] for row in res_sess.fetchall()]
        assert "ix_session_filter" in sess_indexes
        assert "ix_session_status_date" in sess_indexes

@pytest.mark.asyncio
async def test_end_to_end_recognition_pipeline_latency():
    """
    Measures end-to-end latency for decoding, detection, quality filter,
    embedding extraction, and cached vectorized similarity matching.
    """
    # Create synthetic frame with sharp face
    img = np.full((320, 320, 3), 160, dtype=np.uint8)
    import cv2
    cv2.circle(img, (160, 150), 60, (220, 200, 180), -1)
    cv2.circle(img, (140, 130), 8, (50, 40, 30), -1)
    cv2.circle(img, (180, 130), 8, (50, 40, 30), -1)
    cv2.ellipse(img, (160, 180), (25, 12), 0, 0, 180, (40, 30, 120), -1)
    _, buf = cv2.imencode(".jpg", img)
    import base64
    b64_frame = base64.b64encode(buf.tobytes()).decode("utf-8")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Faculty login
        login_res = await ac.post("/api/v1/auth/login", json={"username": "dr.sharma", "password": "Faculty@123"})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Measure recognize endpoint latency
        start = time.perf_counter()
        resp = await ac.post("/api/v1/attendance/recognize", headers=headers, json={
            "image_data": b64_frame,
            "course_id": 1,
            "semester": 5,
            "section": "A"
        })
        elapsed_ms = (time.perf_counter() - start) * 1000.0

        print(f"\n[LATENCY] Full API Face Recognition Request: {elapsed_ms:.2f} ms")
        assert resp.status_code == 200
        # Pipeline must be responsive for real-time kiosk operation (< 300ms on CPU)
        assert elapsed_ms < 300.0
