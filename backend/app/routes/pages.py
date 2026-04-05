"""Page routes — upload photos, manage pages"""

import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Trip, Page, Zone
from ..schemas import PageResponse

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

    db.commit()
    db.refresh(page)
    return page


@router.post("/trips/{trip_id}/pages/bulk")
def add_pages_bulk(
    trip_id: str,
    photos: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """사진 일괄 업로드 — 한 번에 여러 사진을 페이지로 변환"""
    trip = require_admin(trip_id, db, x_admin_token)

    current_count = db.query(Page).filter(Page.trip_id == trip_id).count()
    if current_count + len(photos) > MAX_PAGES:
        raise HTTPException(422, f"페이지 수가 최대({MAX_PAGES})를 초과합니다")

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
            page_number=page_num,
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
