from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class LivenessChallengeResponse(BaseModel):
    challenge_id: str
    actions: List[str]
    current_action: str
    step: int
    total_steps: int
    expires_in_seconds: int
    instructions: str

class LivenessVerifyRequest(BaseModel):
    challenge_id: str
    image_data: str = Field(..., description="Base64 frame from live camera feed")

class LivenessVerifyResponse(BaseModel):
    success: bool
    status: Optional[str] = None
    step_passed: bool = False
    completed: bool = False
    action_verified: Optional[str] = None
    next_action: Optional[str] = None
    step: Optional[int] = None
    total_steps: Optional[int] = None
    instructions: Optional[str] = None
    receipt_token: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    message: str
