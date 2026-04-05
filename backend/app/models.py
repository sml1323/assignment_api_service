"""SQLAlchemy models — Event + Contribution only"""

import uuid
import secrets
import string
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship

from .database import Base


def generate_uuid():
    return str(uuid.uuid4())


def generate_share_code():
    chars = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(chars) for _ in range(8))


class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String(200), nullable=False)
    event_type = Column(String(20), nullable=False)  # graduation, retirement, birthday, wedding, other
    recipient_name = Column(String(100), nullable=False)
    organizer_name = Column(String(100), nullable=False)
    share_code = Column(String(8), unique=True, nullable=False, default=generate_share_code)
    admin_token = Column(String, nullable=False, default=generate_uuid)
    status = Column(String(20), nullable=False, default="collecting")
    # Sweetbook API IDs (stored directly, no separate Book/Order models)
    sweetbook_book_uid = Column(String, nullable=True)
    sweetbook_order_uid = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    contributions = relationship("Contribution", back_populates="event", order_by="Contribution.page_order")


class Contribution(Base):
    __tablename__ = "contributions"

    id = Column(String, primary_key=True, default=generate_uuid)
    event_id = Column(String, ForeignKey("events.id"), nullable=False)
    contributor_name = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    image_filename = Column(String, nullable=True)
    page_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    event = relationship("Event", back_populates="contributions")
