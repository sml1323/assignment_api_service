"""Book routes — Sweetbook API integration (finalize + order)"""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Trip, Page, Zone, Message
from ..schemas import OrderCreate, OrderCancelRequest, ShippingUpdate
from ..services.sweetbook import (
    build_tripbook, estimate_order, create_order, get_order,
    cancel_order, update_order_shipping,
)
from bookprintapi import ApiError
from ..services.image import compose_photo_with_text, UPLOAD_DIR
from ..services.audit import log_action
from ..services.kakao import notify_book_finalized, notify_order_created

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
    log_action(db, "book.finalize", "admin", trip_id=trip.id, target=result["book_uid"], detail={"page_count": result["page_count"]})
    db.commit()

    # 카카오톡 알림 (사용자 토큰으로)
    if trip.kakao_access_token:
        ok, new_at, new_rt = notify_book_finalized(
            trip.title, trip.id, result["page_count"],
            trip.kakao_access_token, trip.kakao_refresh_token or "",
        )
        if new_at != trip.kakao_access_token or new_rt != (trip.kakao_refresh_token or ""):
            trip.kakao_access_token = new_at
            trip.kakao_refresh_token = new_rt
            db.commit()

    return {
        "book_uid": result["book_uid"],
        "page_count": result["page_count"],
        "status": "finalized",
    }


@router.get("/{trip_id}/estimate")
def get_estimate(
    trip_id: str,
    quantity: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """견적 조회 (주문 전 가격 확인)"""
    trip = require_admin(trip_id, db, x_admin_token)

    if trip.status not in ("finalized", "ordered"):
        raise HTTPException(422, "finalized 또는 ordered 상태에서만 견적을 조회할 수 있습니다")

    if not trip.sweetbook_book_uid:
        raise HTTPException(422, "포토북이 아직 생성되지 않았습니다")

    try:
        result = estimate_order(trip.sweetbook_book_uid, quantity)
        return result.get("data", result)
    except ApiError as e:
        raise HTTPException(e.status_code or 500, detail=str(e))


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
    try:
        result = create_order(trip.sweetbook_book_uid, shipping, body.quantity)
    except ApiError as e:
        if e.status_code == 402:
            raise HTTPException(402, detail="충전금이 부족합니다. 충전 후 다시 시도해주세요.")
        elif e.status_code == 400:
            raise HTTPException(400, detail=e.details if e.details else str(e))
        raise HTTPException(500, detail="주문 처리 중 오류가 발생했습니다")

    trip.sweetbook_order_uid = result["data"]["orderUid"]
    trip.status = "ordered"
    log_action(db, "order.create", "admin", trip_id=trip.id, target=result["data"]["orderUid"])
    db.commit()

    if trip.kakao_access_token:
        ok, new_at, new_rt = notify_order_created(
            trip.title, trip.id, result["data"]["orderUid"],
            trip.kakao_access_token, trip.kakao_refresh_token or "",
        )
        if new_at != trip.kakao_access_token:
            trip.kakao_access_token = new_at
            trip.kakao_refresh_token = new_rt
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


@router.post("/{trip_id}/order/cancel")
def cancel_trip_order(
    trip_id: str,
    body: OrderCancelRequest,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """주문 취소 (PAID/PDF_READY 상태만)"""
    trip = require_admin(trip_id, db, x_admin_token)

    if not trip.sweetbook_order_uid:
        raise HTTPException(404, "주문 정보가 없습니다")

    # 현재 주문 상태 확인
    order_detail = get_order(trip.sweetbook_order_uid)
    order_status = order_detail.get("data", {}).get("orderStatus", 0)

    if order_status not in (20, 25):  # PAID, PDF_READY
        raise HTTPException(409, "현재 상태에서는 취소할 수 없습니다 (결제완료/PDF준비 상태만 취소 가능)")

    try:
        cancel_order(trip.sweetbook_order_uid, body.reason)
    except ApiError as e:
        raise HTTPException(e.status_code or 500, detail=str(e))

    trip.status = "finalized"
    trip.sweetbook_order_uid = None
    log_action(db, "order.cancel", "admin", trip_id=trip.id, detail={"reason": body.reason})
    db.commit()

    return {"status": "cancelled", "trip_status": "finalized"}


@router.put("/{trip_id}/order/shipping")
def update_trip_shipping(
    trip_id: str,
    body: ShippingUpdate,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """배송지 변경 (발송 전만 가능)"""
    trip = require_admin(trip_id, db, x_admin_token)

    if not trip.sweetbook_order_uid:
        raise HTTPException(404, "주문 정보가 없습니다")

    # 현재 주문 상태 확인
    order_detail = get_order(trip.sweetbook_order_uid)
    order_status = order_detail.get("data", {}).get("orderStatus", 0)

    if order_status >= 40:  # IN_PRODUCTION 이상
        raise HTTPException(409, "발송 후에는 배송지를 변경할 수 없습니다")

    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(422, "변경할 항목이 없습니다")

    try:
        result = update_order_shipping(trip.sweetbook_order_uid, fields)
    except ApiError as e:
        raise HTTPException(e.status_code or 500, detail=str(e))

    log_action(db, "order.shipping_update", "admin", trip_id=trip.id, detail=fields)
    db.commit()

    return {"status": "updated", "fields": list(fields.keys())}
