"""Pydantic schemas for request/response validation"""

from pydantic import BaseModel, Field
from datetime import datetime


# --- Trip ---

class TripCreate(BaseModel):
    title: str = Field(..., max_length=200)
    destination: str = Field(..., max_length=200)
    start_date: str | None = None
    end_date: str | None = None


class TripResponse(BaseModel):
    id: str
    title: str
    destination: str
    start_date: str | None
    end_date: str | None
    cover_image: str | None
    status: str
    share_token: str
    created_at: datetime
    page_count: int = 0
    zone_stats: dict = {}

    model_config = {"from_attributes": True}


class TripAdminResponse(TripResponse):
    admin_token: str
    sweetbook_book_uid: str | None = None
    sweetbook_order_uid: str | None = None


class TripShareResponse(BaseModel):
    id: str
    title: str
    destination: str
    start_date: str | None
    end_date: str | None
    status: str

    model_config = {"from_attributes": True}


class StatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(collecting|finalized|ordered)$")


# --- Page ---

class PageResponse(BaseModel):
    id: str
    page_number: int
    photo_url: str
    caption: str | None
    subtitle: str | None
    zones: list["ZoneResponse"] = []

    model_config = {"from_attributes": True}


# --- Zone ---

class ZoneResponse(BaseModel):
    id: str
    zone_number: int
    claimed_by: str | None
    max_length: int
    message: "MessageResponse | None" = None

    model_config = {"from_attributes": True}


# --- Message ---

class MessageCreate(BaseModel):
    author_name: str = Field(..., max_length=100)
    content: str = Field(..., min_length=1, max_length=500)
    color: str = Field("#FFFFFF", pattern=r"^#[0-9A-Fa-f]{6}$")
    position_x: int = Field(50, ge=0, le=100)
    position_y: int = Field(50, ge=0, le=100)


class MessageUpdate(BaseModel):
    content: str | None = Field(None, min_length=1, max_length=500)
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")
    position_x: int | None = Field(None, ge=0, le=100)
    position_y: int | None = Field(None, ge=0, le=100)


class MessageResponse(BaseModel):
    id: str
    author_name: str
    content: str
    color: str
    position_x: int
    position_y: int
    created_at: datetime
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


# --- Audit ---

class AuditLogResponse(BaseModel):
    id: str
    trip_id: str | None
    action: str
    actor: str
    target: str | None
    detail: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Order ---

class ShippingInfo(BaseModel):
    recipientName: str
    recipientPhone: str
    postalCode: str
    address1: str
    address2: str | None = None
    memo: str | None = None


class OrderCreate(BaseModel):
    shipping: ShippingInfo
    quantity: int = 1
