"""Book routes — Sweetbook API integration (finalize + order)"""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Trip, Page, Zone, Message
from ..schemas import OrderCreate
from ..services.sweetbook import build_tripbook, estimate_order, create_order, get_order
from ..services.image import compose_photo_with_text, UPLOAD_DIR

router = APIRouter(prefix="/api/trips", tags=["books"])


def require_admin(trip_id: str, db: Session, admin_token: str) -> Trip:
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(404, "여행을 찾을 수 없습니다")
    if trip.admin_token != admin_token:
        raise HTTPException(403, "관리자 권한이 없습니다")
    return trip


@router.post("/{trip_id}/finalize")
def finalize_book(
    trip_id: str,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """Books API로 포토북 생성 + 확정.

    1. 각 페이지의 오버레이 존 텍스트를 사진에 Pillow 합성
    2. Sweetbook API로 책 생성 → 사진 업로드 → 표지/내지 구성 → 확정
    """
    trip = require_admin(trip_id, db, x_admin_token)

    if trip.status != "collecting":
        raise HTTPException(422, "collecting 상태에서만 확정할 수 있습니다")

    pages = db.query(Page).filter(Page.trip_id == trip_id).order_by(Page.page_number).all()
    if not pages:
        raise HTTPException(422, "페이지가 없습니다")

    # Build composite photos and collect bottom text
    pages_data = []
    for page in pages:
        zones = db.query(Zone).filter(Zone.page_id == page.id).order_by(Zone.zone_number).all()

        # Overlay zones (1-2): bake into photo via Pillow
        overlay_texts = []
        for z in zones:
            if z.zone_number <= 2 and z.message:
                overlay_texts.append({
                    "text": z.message.content,
                    "author": z.message.author_name,
                    "color": z.message.color,
                    "position_x": z.message.position_x,
                    "position_y": z.message.position_y,
                })

        # Get original photo path
        photo_rel = page.photo_url.lstrip("/")
        photo_path = str(Path(__file__).parent.parent.parent / photo_rel)

        if overlay_texts:
            composite_path = compose_photo_with_text(
                photo_path, overlay_texts, output_dir=f"{trip_id}/composites"
            )
        else:
            composite_path = photo_path

        # Bottom zones (3-4): collect as text
        bottom_parts = []
        for z in zones:
            if z.zone_number > 2 and z.message:
                bottom_parts.append(f"{z.message.author_name}: {z.message.content}")
        bottom_text = "\n\n".join(bottom_parts) if bottom_parts else ""

        pages_data.append((page, composite_path, bottom_text))

    # Cover image
    cover_path = None
    if trip.cover_image:
        cover_rel = trip.cover_image.lstrip("/")
        cp = Path(__file__).parent.parent.parent / cover_rel
        if cp.exists():
            cover_path = str(cp)

    result = build_tripbook(trip, pages_data, cover_path)

    trip.sweetbook_book_uid = result["book_uid"]
    trip.status = "finalized"
    db.commit()

    return {
        "book_uid": result["book_uid"],
        "page_count": result["page_count"],
        "status": "finalized",
    }


@router.post("/{trip_id}/order")
def place_order(
    trip_id: str,
    body: OrderCreate,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """Orders API로 주문 생성"""
    trip = require_admin(trip_id, db, x_admin_token)

    if trip.status != "finalized":
        raise HTTPException(422, "finalized 상태에서만 주문할 수 있습니다")

    if not trip.sweetbook_book_uid:
        raise HTTPException(422, "포토북이 아직 생성되지 않았습니다")

    # Estimate first
    estimate = estimate_order(trip.sweetbook_book_uid, body.quantity)

    # Create order
    shipping = body.shipping.model_dump()
    result = create_order(trip.sweetbook_book_uid, shipping, body.quantity)

    trip.sweetbook_order_uid = result["data"]["orderUid"]
    trip.status = "ordered"
    db.commit()

    return {
        "order_uid": result["data"]["orderUid"],
        "status": "ordered",
        "estimate": estimate.get("data", {}),
    }


@router.get("/{trip_id}/order")
def get_order_status(
    trip_id: str,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """주문 상태 조회 (Sweetbook API 실시간)"""
    trip = require_admin(trip_id, db, x_admin_token)

    if not trip.sweetbook_order_uid:
        raise HTTPException(404, "주문 정보가 없습니다")

    result = get_order(trip.sweetbook_order_uid)
    return result.get("data", {})
