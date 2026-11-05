from __future__ import annotations

import json
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from models import AuditLog


class AuditService:
    def __init__(self, db: Session):
        self.db = db

    def log(
        self,
        *,
        actor_id: Optional[int],
        action: str,
        target_type: str,
        target_id: Optional[int] = None,
        details: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        record = AuditLog(
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=None if details is None else json.dumps(details, ensure_ascii=False),
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def list_logs(
        self,
        *,
        actor_id: Optional[int] = None,
        action: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
        sort_desc: bool = True,
    ):
        query = self.db.query(AuditLog)
        if actor_id is not None:
            query = query.filter(AuditLog.actor_id == actor_id)
        if action:
            query = query.filter(AuditLog.action == action)
        total = query.count()
        order_by = AuditLog.created_at.desc() if sort_desc else AuditLog.created_at.asc()
        items = (
            query.order_by(order_by)
            .offset(max(0, int(skip)))
            .limit(max(1, int(limit)))
            .all()
        )
        return total, items
