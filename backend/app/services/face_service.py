from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from fastapi import HTTPException, status
import numpy as np
import json
import logging
from typing import List

from app.cv.face_engine import face_engine
from app.cv.embedding_cache import embedding_cache
from app.models.student import Student
from app.models.face_embedding import FaceEmbedding
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.face import (
    FaceValidationResponse, 
    FaceEnrollRequest, 
    FaceEnrollResponse, 
    FaceStatusResponse
)

logger = logging.getLogger("smart_attendance.face_service")

class FaceService:

    @staticmethod
    def validate_frame(image_data: str) -> FaceValidationResponse:
        try:
            image = face_engine.decode_image(image_data)
            faces = face_engine.detect_faces(image)

            if len(faces) == 0:
                return FaceValidationResponse(
                    valid=False,
                    face_detected=False,
                    num_faces=0,
                    message="No face detected. Please position your face inside the frame."
                )

            if len(faces) > 1:
                return FaceValidationResponse(
                    valid=False,
                    face_detected=True,
                    num_faces=len(faces),
                    message=f"Multiple faces detected ({len(faces)}). Only one person should be in view."
                )

            face = faces[0]
            bbox = face["bbox"]
            confidence = face["confidence"]

            quality = face_engine.evaluate_face_quality(image, bbox)

            return FaceValidationResponse(
                valid=quality.is_valid,
                face_detected=True,
                num_faces=1,
                bbox=bbox,
                confidence=confidence,
                quality_score=quality.quality_score,
                sharpness=quality.sharpness,
                brightness=quality.brightness,
                message=quality.reason
            )
        except Exception as e:
            logger.error(f"Face validation error: {e}")
            return FaceValidationResponse(
                valid=False,
                face_detected=False,
                num_faces=0,
                message=f"Image processing error: {str(e)}"
            )

    @staticmethod
    async def enroll_student_faces(
        db: AsyncSession,
        student_id: int,
        payload: FaceEnrollRequest,
        current_user: User
    ) -> FaceEnrollResponse:
        student = await db.get(Student, student_id)
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Student ID {student_id} not found.")

        embeddings_list: List[np.ndarray] = []
        quality_scores: List[float] = []

        for idx, img_b64 in enumerate(payload.images):
            try:
                img = face_engine.decode_image(img_b64)
            except ValueError as ve:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Sample {idx+1}: {str(ve)}")

            faces = face_engine.detect_faces(img)
            if len(faces) == 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Sample {idx+1}: No face detected. Please recapture."
                )
            if len(faces) > 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Sample {idx+1}: Multiple faces detected ({len(faces)})."
                )

            face = faces[0]
            quality = face_engine.evaluate_face_quality(img, face["bbox"])
            if not quality.is_valid:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Sample {idx+1} rejected: {quality.reason}"
                )

            emb = face_engine.extract_embedding(img, face["raw"])
            embeddings_list.append(emb)
            quality_scores.append(quality.quality_score)

        # Cross-sample consistency check (ensure same person in all samples)
        for i in range(len(embeddings_list)):
            for j in range(i + 1, len(embeddings_list)):
                sim = face_engine.compute_similarity(embeddings_list[i], embeddings_list[j])
                if sim < 0.50:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Sample {i+1} and Sample {j+1} do not match the same person (similarity {sim:.2f} < 0.50). Please recapture all samples."
                    )

        # Remove existing embeddings for student
        await db.execute(delete(FaceEmbedding).where(FaceEmbedding.student_id == student_id))

        # Insert new embeddings
        for idx, (emb, q_score) in enumerate(zip(embeddings_list, quality_scores)):
            db_emb = FaceEmbedding(
                student_id=student_id,
                embedding_vector=emb.tobytes(),
                sample_index=idx,
                quality_score=q_score
            )
            db.add(db_emb)

        student.face_registered = True

        avg_quality = float(np.mean(quality_scores))
        audit = AuditLog(
            user_id=current_user.id,
            action="FACE_ENROLL",
            entity_type="Student",
            entity_id=str(student_id),
            details_json=json.dumps({
                "student_id": student.student_id,
                "samples_count": len(embeddings_list),
                "average_quality": round(avg_quality, 2)
            })
        )
        db.add(audit)
        await db.commit()

        # Invalidate active session embedding cache
        await embedding_cache.invalidate(student.course_id, student.semester, student.section)

        return FaceEnrollResponse(
            success=True,
            student_id=student.id,
            student_name=student.name,
            samples_registered=len(embeddings_list),
            average_quality=round(avg_quality, 2),
            message=f"Successfully enrolled {len(embeddings_list)} face samples for {student.name}."
        )

    @staticmethod
    async def get_student_face_status(db: AsyncSession, student_id: int) -> FaceStatusResponse:
        student = await db.get(Student, student_id)
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Student ID {student_id} not found.")

        stmt = select(
            func.count(FaceEmbedding.id), 
            func.avg(FaceEmbedding.quality_score),
            func.max(FaceEmbedding.created_at)
        ).where(FaceEmbedding.student_id == student_id)
        
        result = await db.execute(stmt)
        count, avg_q, max_date = result.first()

        return FaceStatusResponse(
            student_id=student.id,
            face_registered=student.face_registered,
            sample_count=count or 0,
            average_quality=round(float(avg_q or 0.0), 2),
            registered_at=max_date
        )

    @staticmethod
    async def reset_student_face(db: AsyncSession, student_id: int, current_user: User):
        student = await db.get(Student, student_id)
        if not student:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Student ID {student_id} not found.")

        await db.execute(delete(FaceEmbedding).where(FaceEmbedding.student_id == student_id))
        student.face_registered = False

        audit = AuditLog(
            user_id=current_user.id,
            action="FACE_RESET",
            entity_type="Student",
            entity_id=str(student_id),
            details_json=json.dumps({"student_id": student.student_id})
        )
        db.add(audit)
        await db.commit()

        await embedding_cache.invalidate(student.course_id, student.semester, student.section)
        return {"message": f"Biometric data for student {student.name} has been reset."}
