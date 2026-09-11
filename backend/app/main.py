from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, timezone
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.database import get_db, engine, Base
from app.core.init_db import init_db
from app.core.security_middleware import SecurityHeadersMiddleware, PayloadLimitMiddleware
from app.api.v1.api_router import api_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("smart_attendance")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing application and database...")
    await init_db()
    logger.info("Database initialized.")
    yield
    logger.info("Shutting down application...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# Security Middlewares
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(PayloadLimitMiddleware)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


import os
from fastapi import Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Check candidate paths for frontend build
frontend_dist_candidates = [
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist"),
    os.path.join(os.getcwd(), "frontend", "dist"),
    os.path.join(os.getcwd(), "dist"),
]
dist_dir = None
for candidate in frontend_dist_candidates:
    if os.path.isdir(candidate) and os.path.exists(os.path.join(candidate, "index.html")):
        dist_dir = candidate
        break

if dist_dir:
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="static_assets")

# Mount API v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root(request: Request):
    accept = request.headers.get("accept", "")
    if dist_dir and "text/html" in accept:
        index_path = os.path.join(dist_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": f"{settings.API_V1_STR}/docs"
    }

@app.get(f"{settings.API_V1_STR}/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    db_status = "unhealthy"
    try:
        result = await db.execute(text("SELECT 1"))
        if result.scalar() == 1:
            db_status = "healthy"
    except Exception as e:
        logger.error(f"Healthcheck database error: {e}")
        db_status = f"error: {str(e)}"

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": settings.VERSION,
    }

if dist_dir:
    @app.get("/{full_path:path}")
    async def serve_spa_fallback(full_path: str):
        # Exclude API endpoints and OpenAPI docs from SPA fallback
        if (
            full_path.startswith("api") 
            or full_path.startswith("docs") 
            or full_path.startswith("redoc") 
            or full_path.startswith("openapi.json")
        ):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        file_path = os.path.join(dist_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        
        index_path = os.path.join(dist_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Frontend index.html not found")

