from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
import logging

logger = logging.getLogger("smart_attendance.security_middleware")

MAX_PAYLOAD_BYTES = 15 * 1024 * 1024  # 15 MB (ample for multi-image base64 face enrollment)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Enforces security headers across all incoming HTTP requests to protect against
    clickjacking, MIME confusion, XSS, and unauthorized hardware probing.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(self), microphone=()"

        if hasattr(request.state, "rate_limit_headers"):
            for k, v in request.state.rate_limit_headers.items():
                response.headers[k] = v

        return response


class PayloadLimitMiddleware(BaseHTTPMiddleware):
    """
    Prevents denial-of-service and memory exhaustion attacks by enforcing strict
    request body size bounds (max 15MB).
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                length = int(content_length)
                if length > MAX_PAYLOAD_BYTES:
                    logger.warning(f"Rejected oversized request body ({length} bytes) from {request.client.host if request.client else 'unknown'}.")
                    return JSONResponse(
                        status_code=413,
                        content={"detail": f"Payload too large. Maximum allowed size is {MAX_PAYLOAD_BYTES // (1024*1024)}MB."}
                    )
            except ValueError:
                pass

        return await call_next(request)
