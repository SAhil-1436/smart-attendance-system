from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Smart Attendance Management System"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security
    SECRET_KEY: str = "production-grade-super-secret-jwt-signing-key-change-in-env-file-98234710"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Default Admin Credentials
    DEFAULT_ADMIN_USERNAME: str = "admin"
    DEFAULT_ADMIN_PASSWORD: str = "Admin@123"
    DEFAULT_ADMIN_EMAIL: str = "admin@college.edu"
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./smart_attendance.db"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:8000"
    ]

    # Face Recognition & CV Defaults
    FACE_SIMILARITY_THRESHOLD: float = 0.65
    FACE_MIN_SIZE: int = 100
    FACE_LAPLACIAN_VAR_THRESHOLD: float = 80.0
    LIVENESS_EAR_THRESHOLD: float = 0.20
    LIVENESS_YAW_THRESHOLD: float = 15.0
    LIVENESS_TIMEOUT_SECONDS: int = 20

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="allow")

settings = Settings()
