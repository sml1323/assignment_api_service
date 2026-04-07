"""Page routes — upload photos, manage pages"""

import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Trip, TripDay, Page, Zone
from ..schemas import PageResponse, MovePageRequest
from ..services.audit import log_action

router = APIRouter(prefix="/api", tags=["pages"])

UPLOADS_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)

ZONES_PER_PAGE = 4
MAX_PAGES = 130


def require_admin(trip_id: str, db: Session, admin_token: str) -> Trip:
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(404, "여행을 찾을 수 없습니다")
    if trip.admin_token != admin_token:
        raise HTTPException(403, "관리자 권한이 없습니다")
    return trip


@router.post("/trips/{trip_id}/pages", response_model=PageResponse)
def add_page(
    trip_id: str,
    photo: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    subtitle: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    trip = require_admin(trip_id, db, x_admin_token)

    current_count = db.query(Page).filter(Page.trip_id == trip_id).count()
    if current_count >= MAX_PAGES:
        raise HTTPException(422, f"페이지 수가 최대({MAX_PAGES})를 초과합니다")

    # Save photo
    trip_dir = UPLOADS_DIR / trip_id
    trip_dir.mkdir(exist_ok=True)
    filename = f"page_{current_count + 1}_{photo.filename}"
    filepath = trip_dir / filename
    with open(filepath, "wb") as f:
        shutil.copyfileobj(photo.file, f)

    photo_url = f"/uploads/{trip_id}/{filename}"

    page = Page(
        trip_id=trip_id,
        page_number=current_count + 1,
        photo_url=photo_url,
        caption=caption,
        subtitle=subtitle,
    )
    db.add(page)
    db.flush()

    # Create zones for this page
    for zone_num in range(1, ZONES_PER_PAGE + 1):
        zone = Zone(page_id=page.id, zone_number=zone_num)
        db.add(zone)

    log_action(db, "page.upload", "admin", trip_id=trip_id, target=page.id)
    db.commit()
    db.refresh(page)
    return page


@router.post("/trips/{trip_id}/pages/bulk")
def add_pages_bulk(
    trip_id: str,
    photos: list[UploadFile] = File(...),
    trip_day_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """사진 일괄 업로드 — Day에 배치 (trip_day_id 필수 권장)"""
    trip = require_admin(trip_id, db, x_admin_token)

    if trip.status not in ("draft", "collecting"):
        raise HTTPException(422, "확정된 여행에는 사진을 추가할 수 없습니다")

    # Day 검증
    target_day = None
    if trip_day_id:
        target_day = db.query(TripDay).filter(
            TripDay.id == trip_day_id, TripDay.trip_id == trip_id
        ).first()
        if not target_day:
            raise HTTPException(404, "Day를 찾을 수 없습니다")

    current_count = db.query(Page).filter(Page.trip_id == trip_id).count()
    if current_count + len(photos) > MAX_PAGES:
        raise HTTPException(422, f"페이지 수가 최대({MAX_PAGES})를 초과합니다")

    # Day 내 현재 최대 day_order
    current_day_order = 0
    if target_day:
        max_order = db.query(Page.day_order).filter(
            Page.trip_day_id == trip_day_id
        ).order_by(Page.day_order.desc()).first()
        if max_order and max_order[0]:
            current_day_order = max_order[0]

    trip_dir = UPLOADS_DIR / trip_id
    trip_dir.mkdir(exist_ok=True)

    created_pages = []
    for i, photo in enumerate(photos):
        page_num = current_count + i + 1
        filename = f"page_{page_num}_{photo.filename}"
        filepath = trip_dir / filename
        with open(filepath, "wb") as f:
            shutil.copyfileobj(photo.file, f)

        photo_url = f"/uploads/{trip_id}/{filename}"
        page = Page(
            trip_id=trip_id,
            trip_day_id=trip_day_id,
            page_number=page_num,
            day_order=current_day_order + i + 1 if target_day else None,
            photo_url=photo_url,
        )
        db.add(page)
        db.flush()

        for zone_num in range(1, ZONES_PER_PAGE + 1):
            zone = Zone(page_id=page.id, zone_number=zone_num)
            db.add(zone)

        created_pages.append({"id": page.id, "page_number": page_num, "photo_url": photo_url})

    db.commit()
    return {"created": len(created_pages), "pages": created_pages}


@router.get("/trips/{trip_id}/pages", response_model=list[PageResponse])
def get_pages(
    trip_id: str,
    db: Session = Depends(get_db),
    x_admin_token: str | None = Header(None),
    x_share_token: str | None = Header(None),
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(404, "여행을 찾을 수 없습니다")

    # Either admin or share token required
    if trip.admin_token != x_admin_token and trip.share_token != x_share_token:
        raise HTTPException(403, "접근 권한이 없습니다")

    pages = db.query(Page).filter(Page.trip_id == trip_id).order_by(Page.page_number).all()
    return pages


@router.patch("/trips/{trip_id}/pages/reorder")
def reorder_pages(
    trip_id: str,
    body: dict,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """페이지 순서 변경. body: {"page_ids": ["id1", "id2", ...]}"""
    trip = require_admin(trip_id, db, x_admin_token)
    page_ids = body.get("page_ids", [])
    if not page_ids:
        raise HTTPException(422, "page_ids가 필요합니다")

    pages = db.query(Page).filter(Page.trip_id == trip_id).all()
    page_map = {p.id: p for p in pages}

    for i, pid in enumerate(page_ids):
        if pid in page_map:
            page_map[pid].page_number = i + 1

    log_action(db, "page.reorder", "admin", trip_id=trip_id, detail={"order": page_ids})
    db.commit()
    return {"ok": True, "order": page_ids}


@router.put("/pages/{page_id}")
def update_page(
    page_id: str,
    caption: str | None = None,
    subtitle: str | None = None,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    page = db.query(Page).filter(Page.id == page_id).first()
    if not page:
        raise HTTPException(404, "페이지를 찾을 수 없습니다")

    trip = db.query(Trip).filter(Trip.id == page.trip_id).first()
    if trip.admin_token != x_admin_token:
        raise HTTPException(403, "관리자 권한이 없습니다")

    if caption is not None:
        page.caption = caption
    if subtitle is not None:
        page.subtitle = subtitle

    db.commit()
    return {"ok": True}


@router.patch("/pages/{page_id}/move")
def move_page(
    page_id: str,
    body: MovePageRequest,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """사진을 다른 Day로 이동"""
    page = db.query(Page).filter(Page.id == page_id).first()
    if not page:
        raise HTTPException(404, "페이지를 찾을 수 없습니다")

    trip = db.query(Trip).filter(Trip.id == page.trip_id).first()
    if trip.admin_token != x_admin_token:
        raise HTTPException(403, "관리자 권한이 없습니다")

    if trip.status not in ("draft", "collecting"):
        raise HTTPException(422, "확정된 여행의 사진은 이동할 수 없습니다")

    # 대상 Day 검증
    target_day = db.query(TripDay).filter(
        TripDay.id == body.target_day_id, TripDay.trip_id == trip.id
    ).first()
    if not target_day:
        raise HTTPException(404, "대상 Day를 찾을 수 없습니다")

    # 원래 Day에서 제거 후 day_order 재정렬
    if page.trip_day_id:
        old_siblings = (
            db.query(Page)
            .filter(Page.trip_day_id == page.trip_day_id, Page.id != page.id)
            .order_by(Page.day_order)
            .all()
        )
        for idx, sibling in enumerate(old_siblings):
            sibling.day_order = idx + 1

    # 대상 Day에 삽입
    target_pages = (
        db.query(Page)
        .filter(Page.trip_day_id == body.target_day_id)
        .order_by(Page.day_order)
        .all()
    )

    if body.position is not None and 1 <= body.position <= len(target_pages) + 1:
        insert_pos = body.position
    else:
        insert_pos = len(target_pages) + 1

    page.trip_day_id = body.target_day_id
    page.day_order = insert_pos

    # 기존 페이지들 밀기
    for p in target_pages:
        if p.day_order and p.day_order >= insert_pos:
            p.day_order += 1

    log_action(db, "page.move", "admin", trip_id=trip.id, target=page_id,
               detail={"to_day": target_day.day_number, "position": insert_pos})
    db.commit()
    return {"ok": True, "day_id": body.target_day_id, "day_order": insert_pos}
