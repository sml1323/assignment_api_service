"""Trip routes — create, get, share, status transitions, Day management, cover"""

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header
from typing import Optional
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Trip, TripDay, Page, User, Zone, AuditLog
from ..schemas import (
    TripCreate, TripAdminResponse, TripShareResponse, StatusUpdate,
    AuditLogResponse, TripDayResponse, TripDayUpdate, CoverRequest,
)
from ..services.audit import log_action

router = APIRouter(prefix="/api/trips", tags=["trips"])

VALID_TRANSITIONS = {
    "draft": ["collecting"],
    "collecting": ["finalized"],
    "finalized": ["ordered"],
    "ordered": [],
}


def get_trip_with_auth(trip_id: str, db: Session, admin_token: str) -> Trip:
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(404, "여행을 찾을 수 없습니다")
    if trip.admin_token != admin_token:
        raise HTTPException(403, "관리자 권한이 없습니다")
    return trip


def build_trip_response(trip: Trip, db: Session, include_admin: bool = False) -> dict:
    page_count = len(trip.pages)
    total_zones = db.query(Zone).join(Zone.page).filter(
        Zone.page.has(trip_id=trip.id)
    ).count()
    claimed_zones = db.query(Zone).join(Zone.page).filter(
        Zone.page.has(trip_id=trip.id),
        Zone.claimed_by.isnot(None),
    ).count()

    data = {
        "id": trip.id,
        "title": trip.title,
        "destination": trip.destination,
        "start_date": trip.start_date,
        "end_date": trip.end_date,
        "cover_image": trip.cover_image,
        "status": trip.status,
        "share_token": trip.share_token,
        "created_at": trip.created_at,
        "page_count": page_count,
        "zone_stats": {"total": total_zones, "claimed": claimed_zones},
    }
    if include_admin:
        data["admin_token"] = trip.admin_token
        data["sweetbook_book_uid"] = trip.sweetbook_book_uid
        data["sweetbook_order_uid"] = trip.sweetbook_order_uid
    return data


@router.post("", response_model=TripAdminResponse)
def create_trip(
    body: TripCreate,
    db: Session = Depends(get_db),
    x_user_token: Optional[str] = Header(None),
):
    # 로그인 상태면 user_id 연결
    user_id = None
    if x_user_token:
        user = db.query(User).filter(User.token == x_user_token).first()
        if user:
            user_id = user.id

    # 날짜 유효성 검증
    try:
        start = datetime.strptime(body.start_date, "%Y-%m-%d")
        end = datetime.strptime(body.end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(422, "날짜 형식이 올바르지 않습니다 (YYYY-MM-DD)")

    if end < start:
        raise HTTPException(422, "도착일은 출발일 이후여야 합니다")

    num_days = (end - start).days + 1
    if num_days > 30:
        raise HTTPException(422, "여행 기간은 최대 30일까지입니다")

    trip = Trip(
        title=body.title,
        destination=body.destination,
        start_date=body.start_date,
        end_date=body.end_date,
        user_id=user_id,
    )
    db.add(trip)
    db.flush()

    # Day 자동 생성
    for i in range(num_days):
        day_date = start + timedelta(days=i)
        trip_day = TripDay(
            trip_id=trip.id,
            day_number=i + 1,
            date=day_date.strftime("%Y-%m-%d"),
            title=f"Day {i + 1}",
        )
        db.add(trip_day)

    log_action(db, "trip.create", "admin", trip_id=trip.id, detail={
        "title": trip.title, "destination": trip.destination, "days": num_days,
    })
    db.commit()
    db.refresh(trip)
    return build_trip_response(trip, db, include_admin=True)


@router.get("/{trip_id}", response_model=TripAdminResponse)
def get_trip(
    trip_id: str,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    trip = get_trip_with_auth(trip_id, db, x_admin_token)
    return build_trip_response(trip, db, include_admin=True)


@router.get("/share/{token}", response_model=TripShareResponse)
def get_trip_by_share(token: str, db: Session = Depends(get_db)):
    trip = db.query(Trip).filter(Trip.share_token == token).first()
    if not trip:
        raise HTTPException(404, "공유 링크가 유효하지 않습니다")
    return trip


@router.patch("/{trip_id}/status")
def update_status(
    trip_id: str,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    trip = get_trip_with_auth(trip_id, db, x_admin_token)
    allowed = VALID_TRANSITIONS.get(trip.status, [])
    if body.status not in allowed:
        raise HTTPException(
            422,
            f"'{trip.status}' → '{body.status}' 전환은 허용되지 않습니다. 가능: {allowed}",
        )
    old_status = trip.status
    trip.status = body.status
    log_action(db, "trip.status_change", "admin", trip_id=trip.id, detail={"from": old_status, "to": body.status})
    db.commit()
    return {"status": trip.status}


@router.get("/{trip_id}/audit", response_model=list[AuditLogResponse])
def get_audit_log(
    trip_id: str,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """관리자용 감사 로그 타임라인"""
    trip = get_trip_with_auth(trip_id, db, x_admin_token)
    logs = db.query(AuditLog).filter(AuditLog.trip_id == trip_id).order_by(AuditLog.created_at.desc()).limit(100).all()
    return logs


# --- Day endpoints ---

@router.get("/{trip_id}/days")
def get_days(
    trip_id: str,
    db: Session = Depends(get_db),
    x_admin_token: str | None = Header(None),
    x_share_token: str | None = Header(None),
):
    """Day 목록 + 페이지 중첩 조회 (selectinload로 N+1 방지)"""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(404, "여행을 찾을 수 없습니다")
    if trip.admin_token != x_admin_token and trip.share_token != x_share_token:
        raise HTTPException(403, "접근 권한이 없습니다")

    days = (
        db.query(TripDay)
        .filter(TripDay.trip_id == trip_id)
        .options(
            selectinload(TripDay.pages).selectinload(Page.zones)
        )
        .order_by(TripDay.day_number)
        .all()
    )
    return {
        "days": [TripDayResponse.model_validate(d) for d in days],
    }


@router.patch("/{trip_id}/days/{day_id}")
def update_day(
    trip_id: str,
    day_id: str,
    body: TripDayUpdate,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """Day 제목/설명 수정"""
    trip = get_trip_with_auth(trip_id, db, x_admin_token)
    if trip.status not in ("draft", "collecting"):
        raise HTTPException(422, "확정된 여행의 Day는 수정할 수 없습니다")

    day = db.query(TripDay).filter(TripDay.id == day_id, TripDay.trip_id == trip_id).first()
    if not day:
        raise HTTPException(404, "Day를 찾을 수 없습니다")

    if body.title is not None:
        day.title = body.title
    if body.description is not None:
        day.description = body.description

    log_action(db, "day.update", "admin", trip_id=trip_id, target=day_id)
    db.commit()
    return {"ok": True, "day_id": day_id}


# --- Cover endpoint ---

@router.patch("/{trip_id}/cover")
def set_cover(
    trip_id: str,
    body: CoverRequest,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """표지 사진 지정 (기존 페이지 사진 선택)"""
    trip = get_trip_with_auth(trip_id, db, x_admin_token)
    if trip.status not in ("draft", "collecting"):
        raise HTTPException(422, "확정된 여행의 표지는 변경할 수 없습니다")

    if body.page_id:
        page = db.query(Page).filter(Page.id == body.page_id, Page.trip_id == trip_id).first()
        if not page:
            raise HTTPException(404, "페이지를 찾을 수 없습니다")
        trip.cover_image = page.photo_url
    else:
        raise HTTPException(422, "page_id가 필요합니다")

    log_action(db, "cover.set", "admin", trip_id=trip_id, target=body.page_id)
    db.commit()
    return {"ok": True, "cover_image": trip.cover_image}
