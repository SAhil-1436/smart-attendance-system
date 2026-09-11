from sqlalchemy import Column, Integer, LargeBinary, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    embedding_vector = Column(LargeBinary, nullable=False)  # Serialized float32 NumPy array
    sample_index = Column(Integer, nullable=False, default=0)
    quality_score = Column(Float, nullable=False)  # Laplacian sharpness / quality metric
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    student = relationship("Student", back_populates="face_embeddings")

    __table_args__ = (
        Index("ix_face_embedding_student_sample", "student_id", "sample_index"),
    )
