import time
import asyncio
from typing import Dict, List, Tuple, Callable
from collections import defaultdict
from fastapi import Request, Response, HTTPException, status
import logging

logger = logging.getLogger("smart_attendance.rate_limiter")

class SlidingWindowRateLimiter:
    """
    High-performance in-memory sliding window rate limiter.
    Provides sub-millisecond rate check without requiring Redis or external network services.
    """
    def __init__(self):
        self._history: Dict[str, List[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def check(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int, int]:
        """
        Evaluates whether a request with `key` is permitted under the sliding window.
        Returns: (is_allowed: bool, remaining_requests: int, retry_after_seconds: int)
        """
        now = time.time()
        cutoff = now - window_seconds

        async with self._lock:
            timestamps = self._history[key]
            # Evict timestamps outside the sliding window
            while timestamps and timestamps[0] <= cutoff:
                timestamps.pop(0)

            if len(timestamps) >= max_requests:
                oldest = timestamps[0]
                retry_after = max(1, int(window_seconds - (now - oldest)) + 1)
                return False, 0, retry_after

            timestamps.append(now)
            remaining = max_requests - len(timestamps)
            return True, remaining, 0

    async def reset(self):
        """Clears all rate limit history (useful for test isolation)."""
        async with self._lock:
            self._history.clear()

    def limit(self, max_requests: int, window_seconds: int, scope: str = "api") -> Callable:
        """
        FastAPI Dependency Factory.
        Enforces rate limits based on client IP / Authorization subject.
        """
        async def dependency(request: Request, response: Response):
            # Extract client IP
            forwarded = request.headers.get("X-Forwarded-For")
            if forwarded:
                client_ip = forwarded.split(",")[0].strip()
            elif request.client:
                client_ip = request.client.host
            else:
                client_ip = "127.0.0.1"

            rate_key = f"{scope}:{client_ip}"
            is_allowed, remaining, retry_after = await self.check(rate_key, max_requests, window_seconds)

            rl_headers = {
                "X-RateLimit-Limit": str(max_requests),
                "X-RateLimit-Remaining": str(remaining)
            }
            request.state.rate_limit_headers = rl_headers
            response.headers["X-RateLimit-Limit"] = str(max_requests)
            response.headers["X-RateLimit-Remaining"] = str(remaining)

            if not is_allowed:
                response.headers["Retry-After"] = str(retry_after)
                logger.warning(f"Rate limit exceeded for {rate_key}. Retrying in {retry_after}s.")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many requests. Rate limit is {max_requests} requests per {window_seconds}s. Please retry in {retry_after}s.",
                    headers={"Retry-After": str(retry_after), "X-RateLimit-Remaining": "0"}
                )

        return dependency


# Global rate limiter instance
rate_limiter = SlidingWindowRateLimiter()

# Pre-configured endpoint guards
rate_limit_auth = rate_limiter.limit(max_requests=10, window_seconds=60, scope="auth_login")
rate_limit_enroll = rate_limiter.limit(max_requests=15, window_seconds=60, scope="face_enroll")
rate_limit_attendance = rate_limiter.limit(max_requests=60, window_seconds=60, scope="attendance_mark")
rate_limit_liveness = rate_limiter.limit(max_requests=30, window_seconds=60, scope="liveness_challenge")
