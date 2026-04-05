"""Pydantic schemas for request/response validation"""

from datetime import datetime
from pydantic import BaseModel, Field


# --- Event ---

class EventCreate(BaseModel):
    title: str = Field(..., max_length=200, examples=["김민수의 졸업을 축하해요!"])
    event_type: str = Field(..., pattern="^(graduation|retirement|birthday|wedding|other)$")
    recipient_name: str = Field(..., max_length=100, examples=["김민수"])
    organizer_name: str = Field(..., max_length=100, examples=["이영희"])


class EventResponse(BaseModel):
    id: str
    title: str
    event_type: str
    recipient_name: str
    organizer_name: str
    share_code: str
    admin_token: str | None = None  # only returned on creation
    status: str
    sweetbook_book_uid: str | None = None
    sweetbook_order_uid: str | None = None
    created_at: datetime
    contribution_count: int = 0

    model_config = {"from_attributes": True}


class EventPublicResponse(BaseModel):
    """Public view (no admin_token)"""
    id: str
    title: str
    event_type: str
    recipient_name: str
    status: str
    created_at: datetime
    contribution_count: int = 0

    model_config = {"from_attributes": True}


# --- Contribution ---

class ContributionCreate(BaseModel):
    contributor_name: str = Field(..., max_length=100)
    message: str = Field(..., min_length=1)


class ContributionResponse(BaseModel):
    id: str
    contributor_name: str
    message: str
    image_filename: str | None = None
    image_url: str | None = None
    page_order: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Order ---

class OrderRequest(BaseModel):
    recipient_name: str = Field(..., max_length=100)
    recipient_phone: str = Field(..., max_length=20)
    postal_code: str = Field(..., max_length=10)
    address1: str = Field(..., max_length=200)
    address2: str | None = Field(None, max_length=200)
    memo: str | None = Field(None, max_length=200)
