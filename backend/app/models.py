"""SQLAlchemy models — Trip, Page, Zone, Message"""

import uuid
import secrets
import string
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from .database import Base


def generate_uuid():
    return str(uuid.uuid4())


def generate_token():
    chars = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(12))


class User(Base):
    """사용자 — 간단한 username/password 인증"""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    token = Column(String, unique=True, nullable=False, default=generate_token)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    trips = relationship("Trip", back_populates="owner")


class Trip(Base):
    """여행 — 포토북의 최상위 단위"""
    __tablename__ = "trips"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    title = Column(String(200), nullable=False)
    destination = Column(String(200), nullable=False)
    start_date = Column(String(10), nullable=True)  # YYYY-MM-DD
    end_date = Column(String(10), nullable=True)
    cover_image = Column(String, nullable=True)  # 표지 사진 파일명
    admin_token = Column(String, unique=True, nullable=False, default=generate_token)
    share_token = Column(String, unique=True, nullable=False, default=generate_token)
    status = Column(String(20), nullable=False, default="draft")
    # draft → collecting → finalized → ordered
    sweetbook_book_uid = Column(String, nullable=True)
    sweetbook_order_uid = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="trips")
    pages = relationship("Page", back_populates="trip", order_by="Page.page_number")
    days = relationship("TripDay", back_populates="trip", order_by="TripDay.day_number")


class TripDay(Base):
    """여행 Day — Trip 내 날짜별 구분 단위"""
    __tablename__ = "trip_days"

    id = Column(String, primary_key=True, default=generate_uuid)
    trip_id = Column(String, ForeignKey("trips.id"), nullable=False)
    day_number = Column(Integer, nullable=False)  # 1, 2, 3, ...
    title = Column(String(200), nullable=True)     # "제주 첫째 날" 등
    date = Column(String(10), nullable=True)       # "2026-04-03" (계산됨)
    description = Column(Text, nullable=True)       # Day 간지에 표시할 설명
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    trip = relationship("Trip", back_populates="days")
    pages = relationship("Page", back_populates="trip_day", order_by="Page.day_order")


class Page(Base):
    """페이지 — 여행 사진 1장 = 1페이지"""
    __tablename__ = "pages"

    id = Column(String, primary_key=True, default=generate_uuid)
    trip_id = Column(String, ForeignKey("trips.id"), nullable=False)
    trip_day_id = Column(String, ForeignKey("trip_days.id"), nullable=True)
    page_number = Column(Integer, nullable=False)
    day_order = Column(Integer, nullable=True)  # Day 내에서의 순서 (1, 2, 3...)
    photo_url = Column(String, nullable=False)  # backend/uploads/ 상대경로
    caption = Column(String(200), nullable=True)  # 주최자 캡션
    subtitle = Column(String(100), nullable=True)  # AI 생성 소제목
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    trip = relationship("Trip", back_populates="pages")
    trip_day = relationship("TripDay", back_populates="pages")
    zones = relationship("Zone", back_populates="page", order_by="Zone.zone_number")


class Zone(Base):
    """존 — 페이지 내 기여 영역 (4-6개/페이지)"""
    __tablename__ = "zones"

    id = Column(String, primary_key=True, default=generate_uuid)
    page_id = Column(String, ForeignKey("pages.id"), nullable=False)
    zone_number = Column(Integer, nullable=False)  # 1-6
    claimed_by = Column(String(100), nullable=True)
    claimed_at = Column(DateTime, nullable=True)
    max_length = Column(Integer, nullable=False, default=100)

    page = relationship("Page", back_populates="zones")
    message = relationship("Message", back_populates="zone", uselist=False)


class Message(Base):
    """메시지 — 참여자의 텍스트 기여"""
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    zone_id = Column(String, ForeignKey("zones.id"), nullable=False)
    author_name = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    color = Column(String(7), nullable=False, default="#FFFFFF")  # hex color
    position_x = Column(Integer, nullable=False, default=50)  # 0-100 percent
    position_y = Column(Integer, nullable=False, default=50)  # 0-100 percent
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=True)

    zone = relationship("Zone", back_populates="message")


class WebhookLog(Base):
    """Webhook 수신 로그 — idempotency + DLQ"""
    __tablename__ = "webhook_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    event_id = Column(String, unique=True, nullable=False)
    event_type = Column(String(50), nullable=False)
    payload = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="received")
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    processed_at = Column(DateTime, nullable=True)


class AuditLog(Base):
    """감사 로그 — 주요 액션 추적"""
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    trip_id = Column(String, ForeignKey("trips.id"), nullable=True)
    action = Column(String(50), nullable=False)
    actor = Column(String(100), nullable=False)
    target = Column(String(200), nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
