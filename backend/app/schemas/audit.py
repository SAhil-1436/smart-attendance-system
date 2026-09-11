from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List

class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    ip_address: Optional[str] = None
    details_json: Optional[str] = None
    created_at: datetime

class AuditLogListResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[AuditLogResponse]
