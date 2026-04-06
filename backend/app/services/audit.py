"""Audit logging service"""

import json
from sqlalchemy.orm import Session
from ..models import AuditLog


def log_action(
    db: Session,
    action: str,
    actor: str,
    trip_id: str | None = None,
    target: str | None = None,
    detail: dict | str | None = None,
):
    entry = AuditLog(
        trip_id=trip_id,
        action=action,
        actor=actor,
        target=target,
        detail=json.dumps(detail, ensure_ascii=False) if isinstance(detail, dict) else detail,
    )
    db.add(entry)
    db.flush()
