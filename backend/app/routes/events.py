"""Event routes — CRUD + Sweetbook API integration"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Event, Contribution
from ..schemas import EventCreate, EventResponse, EventPublicResponse, OrderRequest
from ..services import sweetbook

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post("", response_model=EventResponse)
def create_event(body: EventCreate, db: Session = Depends(get_db)):
    event = Event(
        title=body.title,
        event_type=body.event_type,
        recipient_name=body.recipient_name,
        organizer_name=body.organizer_name,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return EventResponse(
        **{c.name: getattr(event, c.name) for c in event.__table__.columns},
        contribution_count=0,
    )


@router.get("/{share_code}", response_model=EventPublicResponse)
def get_event(share_code: str, db: Session = Depends(get_db)):
    event = db.query(Event).options(joinedload(Event.contributions)).filter(Event.share_code == share_code).first()
    if not event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
    return EventPublicResponse(
        **{c.name: getattr(event, c.name) for c in event.__table__.columns},
        contribution_count=len(event.contributions),
    )


@router.get("/{share_code}/admin", response_model=EventResponse)
def get_event_admin(share_code: str, token: str = Query(...), db: Session = Depends(get_db)):
    event = db.query(Event).options(joinedload(Event.contributions)).filter(Event.share_code == share_code).first()
    if not event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
    if event.admin_token != token:
        raise HTTPException(status_code=401, detail="권한이 없습니다.")
    return EventResponse(
        **{c.name: getattr(event, c.name) for c in event.__table__.columns},
        contribution_count=len(event.contributions),
    )


@router.post("/{share_code}/book")
def create_book(share_code: str, token: str = Query(...), db: Session = Depends(get_db)):
    """Create a Sweetbook book from all contributions."""
    event = db.query(Event).options(joinedload(Event.contributions)).filter(Event.share_code == share_code).first()
    if not event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
    if event.admin_token != token:
        raise HTTPException(status_code=401, detail="권한이 없습니다.")
    if not event.contributions:
        raise HTTPException(status_code=400, detail="기여가 없습니다. 최소 1개의 메시지가 필요합니다.")
    if event.sweetbook_book_uid:
        raise HTTPException(status_code=400, detail="이미 책이 생성되었습니다.")

    try:
        book_uid = sweetbook.create_book(event.title)

        # Upload photos and insert content pages
        from ..services.image import get_upload_path
        for contrib in event.contributions:
            if contrib.image_filename:
                photo_path = str(get_upload_path(contrib.image_filename))
                sweetbook.upload_photo(book_uid, photo_path)
                sweetbook.insert_content(
                    book_uid,
                    template_uid="CONTENT_TEMPLATE_UID",
                    parameters={
                        "photo": contrib.image_filename,
                        "text": f"{contrib.contributor_name}: {contrib.message}",
                    },
                )
            else:
                sweetbook.insert_content(
                    book_uid,
                    template_uid="CONTENT_TEMPLATE_UID",
                    parameters={
                        "text": f"{contrib.contributor_name}: {contrib.message}",
                    },
                )

        sweetbook.finalize_book(book_uid)
        event.sweetbook_book_uid = book_uid
        event.status = "reviewing"
        db.commit()

        return {"success": True, "book_uid": book_uid}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"책 생성 중 오류가 발생했습니다: {str(e)}")


@router.post("/{share_code}/order")
def create_order(share_code: str, body: OrderRequest, token: str = Query(...), db: Session = Depends(get_db)):
    """Place an order for the book."""
    event = db.query(Event).filter(Event.share_code == share_code).first()
    if not event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
    if event.admin_token != token:
        raise HTTPException(status_code=401, detail="권한이 없습니다.")
    if not event.sweetbook_book_uid:
        raise HTTPException(status_code=400, detail="먼저 책을 생성해주세요.")
    if event.sweetbook_order_uid:
        raise HTTPException(status_code=400, detail="이미 주문이 완료되었습니다.")

    try:
        shipping = {
            "recipientName": body.recipient_name,
            "recipientPhone": body.recipient_phone,
            "postalCode": body.postal_code,
            "address1": body.address1,
        }
        if body.address2:
            shipping["address2"] = body.address2
        if body.memo:
            shipping["memo"] = body.memo

        result = sweetbook.create_order(event.sweetbook_book_uid, shipping)
        order_uid = result["data"]["orderUid"]

        event.sweetbook_order_uid = order_uid
        event.status = "ordered"
        db.commit()

        return {"success": True, "order_uid": order_uid, "data": result["data"]}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"주문 중 오류가 발생했습니다: {str(e)}")


@router.get("/{share_code}/estimate")
def estimate_order(share_code: str, token: str = Query(...), db: Session = Depends(get_db)):
    """Get price estimate for the book."""
    event = db.query(Event).filter(Event.share_code == share_code).first()
    if not event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
    if event.admin_token != token:
        raise HTTPException(status_code=401, detail="권한이 없습니다.")
    if not event.sweetbook_book_uid:
        raise HTTPException(status_code=400, detail="먼저 책을 생성해주세요.")

    try:
        result = sweetbook.estimate_order(event.sweetbook_book_uid)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"견적 조회 중 오류가 발생했습니다: {str(e)}")
