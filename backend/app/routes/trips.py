"""Trip routes — create, get, share, status transitions"""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Trip, Zone
from ..schemas import TripCreate, TripAdminResponse, TripShareResponse, StatusUpdate

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
def create_trip(body: TripCreate, db: Session = Depends(get_db)):
    trip = Trip(
        title=body.title,
        destination=body.destination,
        start_date=body.start_date,
        end_date=body.end_date,
    )
    db.add(trip)
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
    trip.status = body.status
    db.commit()
    return {"status": trip.status}
