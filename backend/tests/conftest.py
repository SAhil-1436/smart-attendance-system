import pytest
from app.core.rate_limiter import rate_limiter

@pytest.fixture(autouse=True)
async def reset_rate_limiter_between_tests():
    """Resets sliding window rate limiter state between all test runs for test isolation."""
    await rate_limiter.reset()
    yield
    await rate_limiter.reset()
