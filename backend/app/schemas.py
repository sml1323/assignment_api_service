"""Pydantic schemas for request/response validation"""

from pydantic import BaseModel, Field
from datetime import datetime


# --- Trip ---

class TripCreate(BaseModel):
    title: str = Field(..., max_length=200)
    destination: str = Field(..., max_length=200)
    start_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")


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
    day_order: int | None = None
    photo_url: str
    caption: str | None
    subtitle: str | None
    zones: list["ZoneResponse"] = []

    model_config = {"from_attributes": True}


# --- TripDay ---

class TripDayResponse(BaseModel):
    id: str
    day_number: int
    title: str | None
    date: str | None
    description: str | None
    pages: list[PageResponse] = []

    model_config = {"from_attributes": True}


class TripDayUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)
    description: str | None = None


class MovePageRequest(BaseModel):
    target_day_id: str
    position: int | None = None  # null = 맨 뒤에 추가


class CoverRequest(BaseModel):
    page_id: str | None = None  # 기존 페이지 사진을 표지로


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


# --- Auth ---

class AuthRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=4, max_length=100)


class AuthResponse(BaseModel):
    user_id: str
    username: str
    token: str


# --- Estimate ---

class EstimateItem(BaseModel):
    bookUid: str
    title: str
    pageCount: int
    quantity: int
    unitPrice: int


class EstimateResponse(BaseModel):
    items: list[EstimateItem]
    productAmount: int
    shippingFee: int
    totalAmount: int
    paidCreditAmount: int
    creditBalance: int
    creditSufficient: bool


# --- Credits ---

class CreditBalanceResponse(BaseModel):
    balance: int
    currency: str
    env: str


# --- Order Cancel ---

class OrderCancelRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)


# --- Shipping Update ---

class ShippingUpdate(BaseModel):
    recipientName: str | None = None
    recipientPhone: str | None = None
    postalCode: str | None = None
    address1: str | None = None
    address2: str | None = None
    memo: str | None = None
