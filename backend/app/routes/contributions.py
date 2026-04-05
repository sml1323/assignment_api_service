"""Contribution routes — submit messages + photos"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Event, Contribution
from ..schemas import ContributionResponse
from ..services.image import validate_and_save

router = APIRouter(prefix="/api/events/{share_code}/contributions", tags=["contributions"])


@router.get("", response_model=list[ContributionResponse])
def list_contributions(share_code: str, db: Session = Depends(get_db)):
    event = db.query(Event).options(joinedload(Event.contributions)).filter(Event.share_code == share_code).first()
    if not event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")

    results = []
    for c in event.contributions:
        resp = ContributionResponse(
            id=c.id,
            contributor_name=c.contributor_name,
            message=c.message,
            image_filename=c.image_filename,
            image_url=f"/uploads/{c.image_filename}" if c.image_filename else None,
            page_order=c.page_order,
            created_at=c.created_at,
        )
        results.append(resp)
    return results


@router.post("", response_model=ContributionResponse)
async def create_contribution(
    share_code: str,
    contributor_name: str = Form(...),
    message: str = Form(...),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.share_code == share_code).first()
    if not event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다.")
    if event.status in ("ordered", "completed"):
        raise HTTPException(status_code=400, detail="이미 제작 완료된 책입니다. 더 이상 메시지를 추가할 수 없습니다.")

    image_filename = None
    if image and image.filename:
        file_bytes = await image.read()
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="빈 파일입니다.")
        try:
            image_filename = validate_and_save(file_bytes, image.filename)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    # Auto-increment page_order
    max_order = db.query(Contribution).filter(Contribution.event_id == event.id).count()

    contribution = Contribution(
        event_id=event.id,
        contributor_name=contributor_name,
        message=message,
        image_filename=image_filename,
        page_order=max_order + 1,
    )
    db.add(contribution)
    db.commit()
    db.refresh(contribution)

    return ContributionResponse(
        id=contribution.id,
        contributor_name=contribution.contributor_name,
        message=contribution.message,
        image_filename=contribution.image_filename,
        image_url=f"/uploads/{contribution.image_filename}" if contribution.image_filename else None,
        page_order=contribution.page_order,
        created_at=contribution.created_at,
    )
