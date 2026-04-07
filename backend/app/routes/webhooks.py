"""Webhook routes — Sweetbook 주문 상태 변경 수신
서명 검증 + Idempotency + DLQ 패턴
"""

import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException

from ..database import SessionLocal
from ..models import Trip, WebhookLog
from ..services.audit import log_action

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")


@router.post("/sweetbook")
async def handle_sweetbook_webhook(request: Request):
    body = await request.body()
    body_str = body.decode("utf-8")

    if WEBHOOK_SECRET:
        sig = request.headers.get("X-Webhook-Signature", "")
        ts = request.headers.get("X-Webhook-Timestamp", "")
        try:
            import sys
            sdk_path = os.getenv("BOOKPRINT_SDK_PATH", "bookprintapi-python-sdk")
            if sdk_path not in sys.path:
                sys.path.insert(0, sdk_path)
            from bookprintapi.webhook import verify_signature
            if not verify_signature(body, sig, ts, WEBHOOK_SECRET):
                raise HTTPException(401, "Invalid webhook signature")
        except ValueError as e:
            raise HTTPException(401, str(e))

    try:
        payload = json.loads(body_str)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON")

    event_id = payload.get("eventId") or payload.get("event_id") or ""
    event_type = payload.get("eventType") or payload.get("event_type") or "unknown"

    db = SessionLocal()
    try:
        if event_id:
            existing = db.query(WebhookLog).filter(WebhookLog.event_id == event_id).first()
            if existing:
                return {"status": "already_processed", "event_id": event_id}

        log_entry = WebhookLog(
            event_id=event_id or f"auto_{datetime.now(timezone.utc).isoformat()}",
            event_type=event_type,
            payload=body_str,
        )
        db.add(log_entry)
        db.flush()

        try:
            if event_type in ("order.status_changed", "order.shipped"):
                order_uid = payload.get("data", {}).get("orderUid", "")
                if order_uid:
                    trip = db.query(Trip).filter(Trip.sweetbook_order_uid == order_uid).first()
                    if trip:
                        log_action(db, f"webhook.{event_type}", "webhook",
                                   trip_id=trip.id, target=order_uid,
                                   detail=payload.get("data", {}))
            log_entry.status = "processed"
            log_entry.processed_at = datetime.now(timezone.utc)
        except Exception as e:
            log_entry.status = "failed"
            log_entry.error_message = str(e)
            log_entry.retry_count += 1

        db.commit()
        return {"status": log_entry.status, "event_id": event_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Webhook error: {e}")
    finally:
        db.close()


@router.get("/logs")
def get_webhook_logs(limit: int = 50):
    db = SessionLocal()
    try:
        logs = db.query(WebhookLog).order_by(WebhookLog.created_at.desc()).limit(limit).all()
        return [{
            "id": l.id, "event_id": l.event_id, "event_type": l.event_type,
            "status": l.status, "error_message": l.error_message,
            "retry_count": l.retry_count,
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "processed_at": l.processed_at.isoformat() if l.processed_at else None,
        } for l in logs]
    finally:
        db.close()
