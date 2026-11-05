from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db
from auth import get_current_active_user
from models import User, UserRole
from services.audit_service import AuditService
from schemas import AuditLogList

router = APIRouter()


@router.get("/logs", response_model=AuditLogList)
def list_audit_logs(
    *,
    actor_id: Optional[int] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions",
        )
    service = AuditService(db)
    total, items = service.list_logs(
        actor_id=actor_id,
        action=action,
        skip=skip,
        limit=limit,
    )
    return {"total": total, "items": items}
