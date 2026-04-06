"""Message routes — zone claim + message creation (atomic)"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Trip, Page, Zone, Message
from ..schemas import MessageCreate, MessageUpdate, MessageResponse
from ..services.audit import log_action

router = APIRouter(prefix="/api", tags=["messages"])


@router.post("/zones/{zone_id}/message", response_model=MessageResponse)
def claim_and_write(
    zone_id: str,
    body: MessageCreate,
    db: Session = Depends(get_db),
    x_share_token: str = Header(...),
):
    """존 선점 + 메시지 작성 (원자적 트랜잭션)"""
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(404, "존을 찾을 수 없습니다")

    page = db.query(Page).filter(Page.id == zone.page_id).first()
    trip = db.query(Trip).filter(Trip.id == page.trip_id).first()

    if trip.share_token != x_share_token:
        raise HTTPException(403, "접근 권한이 없습니다")

    if trip.status != "collecting":
        raise HTTPException(422, "현재 메시지를 작성할 수 없는 상태입니다")

    if zone.claimed_by is not None:
        has_msg = zone.message is not None
        if not has_msg and zone.claimed_at:
            elapsed = (datetime.now(timezone.utc) - zone.claimed_at).total_seconds()
            if elapsed > 600:  # 10 min timeout
                zone.claimed_by = None
                zone.claimed_at = None
            else:
                raise HTTPException(409, f"이미 {zone.claimed_by}님이 선점한 존입니다")
        else:
            raise HTTPException(409, f"이미 {zone.claimed_by}님이 선점한 존입니다")

    if len(body.content) > zone.max_length:
        raise HTTPException(422, f"메시지가 최대 길이({zone.max_length}자)를 초과합니다")

    # Atomic: claim zone + create message
    zone.claimed_by = body.author_name
    zone.claimed_at = datetime.now(timezone.utc)

    message = Message(
        zone_id=zone.id,
        author_name=body.author_name,
        content=body.content,
        color=body.color,
        position_x=body.position_x,
        position_y=body.position_y,
    )
    db.add(message)
    log_action(db, "message.write", body.author_name, trip_id=trip.id, target=zone.id, detail={"content": body.content[:50]})
    db.commit()
    db.refresh(message)
    return message


@router.put("/messages/{message_id}", response_model=MessageResponse)
def update_message(
    message_id: str,
    body: MessageUpdate,
    db: Session = Depends(get_db),
    x_share_token: str | None = Header(None),
    x_admin_token: str | None = Header(None),
):
    """메시지 수정 (작성자 본인 또는 관리자)"""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(404, "메시지를 찾을 수 없습니다")

    zone = db.query(Zone).filter(Zone.id == message.zone_id).first()
    page = db.query(Page).filter(Page.id == zone.page_id).first()
    trip = db.query(Trip).filter(Trip.id == page.trip_id).first()

    # Auth: share_token (participant) or admin_token
    if trip.admin_token != x_admin_token and trip.share_token != x_share_token:
        raise HTTPException(403, "접근 권한이 없습니다")

    if body.content is not None:
        message.content = body.content
    if body.color is not None:
        message.color = body.color
    if body.position_x is not None:
        message.position_x = body.position_x
    if body.position_y is not None:
        message.position_y = body.position_y

    message.updated_at = datetime.now(timezone.utc)
    log_action(db, "message.update", message.author_name, trip_id=trip.id, target=message.id)
    db.commit()
    db.refresh(message)
    return message


@router.delete("/messages/{message_id}")
def delete_message(
    message_id: str,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """메시지 삭제 + 존 해제 (관리자 전용)"""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(404, "메시지를 찾을 수 없습니다")

    zone = db.query(Zone).filter(Zone.id == message.zone_id).first()
    page = db.query(Page).filter(Page.id == zone.page_id).first()
    trip = db.query(Trip).filter(Trip.id == page.trip_id).first()

    if trip.admin_token != x_admin_token:
        raise HTTPException(403, "관리자 권한이 없습니다")

    # Release zone
    zone.claimed_by = None
    zone.claimed_at = None

    log_action(db, "message.delete", "admin", trip_id=trip.id, target=message.id, detail={"author": message.author_name})
    db.delete(message)
    db.commit()
    return {"ok": True}
