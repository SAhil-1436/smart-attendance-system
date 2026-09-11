from fastapi import APIRouter, Depends
from app.core.dependencies import get_faculty_or_admin
from app.core.rate_limiter import rate_limit_liveness
from app.models.user import User
from app.schemas.liveness import (
    LivenessChallengeResponse, 
    LivenessVerifyRequest, 
    LivenessVerifyResponse
)
from app.cv.liveness import liveness_engine

router = APIRouter(prefix="/attendance/liveness", tags=["Liveness & Anti-Spoofing"])

@router.post("/challenge", response_model=LivenessChallengeResponse, dependencies=[Depends(rate_limit_liveness)])
async def create_liveness_challenge(
    current_user: User = Depends(get_faculty_or_admin)
):
    """
    Initiates a new challenge-response liveness verification session with randomized actions
    (e.g., Turn Left, Turn Right, Blink, Smile) and a 25-second expiration token.
    """
    challenge_data = liveness_engine.create_challenge()
    return LivenessChallengeResponse(**challenge_data)

@router.post("/verify-step", response_model=LivenessVerifyResponse)
async def verify_liveness_step(
    payload: LivenessVerifyRequest,
    current_user: User = Depends(get_faculty_or_admin)
):
    """
    Evaluates a live webcam frame against the current challenge action.
    When all steps pass, returns a signed, single-use liveness receipt token.
    """
    result = liveness_engine.verify_action(payload.challenge_id, payload.image_data)
    return LivenessVerifyResponse(**result)
