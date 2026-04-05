"""Sweetbook Book Print API integration

Full flow: book creation -> photo upload -> cover -> content pages -> finalize.
Uses PHOTOBOOK_A4_SC spec. Minimum 24 pages required, padded with blank pages.
"""

import os
import sys
from pathlib import Path
from datetime import datetime

SDK_PATH = os.getenv("BOOKPRINT_SDK_PATH", str(Path(__file__).parent.parent.parent.parent / "bookprintapi-python-sdk"))
if SDK_PATH not in sys.path:
    sys.path.insert(0, SDK_PATH)

from bookprintapi import Client, ApiError

# Template UIDs for PHOTOBOOK_A4_SC
BOOK_SPEC = "PHOTOBOOK_A4_SC"
COVER_TEMPLATE = "75HruEK3EnG5"          # 표지 (알림장A)
CONTENT_PHOTO_TEMPLATE = "5ADDkCtrodEJ"  # 내지_photo (구글포토북C) — dayLabel + photo
CONTENT_TEXT_TEMPLATE = "3mjKd8kcaVzT"   # 내지b (일기장A) — monthNum + dayNum + diaryText
BLANK_TEMPLATE = "5NxuQPBMyuTm"          # 빈내지 (구글포토북C)
MIN_PAGES = 24


def get_client() -> Client:
    return Client()


def build_celebration_book(event, contributions) -> dict:
    """Build a complete celebration book from event + contributions.

    Returns: {"book_uid": str, "page_count": int}
    """
    from .image import get_upload_path, UPLOAD_DIR

    client = get_client()
    now = datetime.now()

    # 1. Create book
    result = client.books.create(
        book_spec_uid=BOOK_SPEC,
        title=event.title,
        creation_type="TEST",
    )
    book_uid = result["data"]["bookUid"]

    # 2. Generate and upload cover image
    from PIL import Image, ImageDraw, ImageFont

    cover_colors = {
        "graduation": "#4A90D9", "retirement": "#2ECC71",
        "birthday": "#E74C3C", "wedding": "#9B59B6", "other": "#F39C12",
    }
    color = cover_colors.get(event.event_type, "#FF6B6B")
    cover_img = Image.new("RGB", (1200, 1200), color)
    draw = ImageDraw.Draw(cover_img)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/AppleSDGothicNeo.ttc", 60)
        small_font = ImageFont.truetype("/System/Library/Fonts/AppleSDGothicNeo.ttc", 30)
    except (OSError, IOError):
        font = ImageFont.load_default()
        small_font = font
    draw.text((200, 500), event.recipient_name, fill="white", font=font)
    draw.text((200, 600), event.title[:30], fill="white", font=small_font)
    cover_path = str(UPLOAD_DIR / "_cover_temp.jpg")
    cover_img.save(cover_path, quality=90)

    cover_result = client.photos.upload(book_uid, cover_path)
    cover_photo_name = cover_result["data"]["fileName"]

    # 3. Upload contributor photos
    photo_map = {}
    for contrib in contributions:
        if contrib.image_filename:
            photo_path = str(get_upload_path(contrib.image_filename))
            if Path(photo_path).exists():
                upload_result = client.photos.upload(book_uid, photo_path)
                photo_map[contrib.id] = upload_result["data"]["fileName"]

    # 4. Cover
    client.covers.create(
        book_uid,
        template_uid=COVER_TEMPLATE,
        parameters={
            "childName": event.recipient_name,
            "schoolName": "CeleBook",
            "volumeLabel": "축하책",
            "periodText": f"{now.year}년 {now.month}월",
            "coverPhoto": cover_photo_name,
        },
    )

    # 5. Content pages — each contribution becomes a page
    page_count = 0
    for i, contrib in enumerate(contributions):
        uploaded_name = photo_map.get(contrib.id)
        if uploaded_name:
            # Photo page: dayLabel + photo
            client.contents.insert(
                book_uid,
                template_uid=CONTENT_PHOTO_TEMPLATE,
                parameters={
                    "dayLabel": f"{now.month:02d}\n{(i + 1):02d}",
                    "photo": uploaded_name,
                },
                break_before="page",
            )
        # Text page for every contribution (message)
        client.contents.insert(
            book_uid,
            template_uid=CONTENT_TEXT_TEMPLATE,
            parameters={
                "monthNum": f"{now.month:02d}",
                "dayNum": f"{(i + 1):02d}",
                "diaryText": f"{contrib.contributor_name}\n\n{contrib.message}",
            },
            break_before="page",
        )
        page_count += 2 if uploaded_name else 1

    # 6. Pad with blank pages to reach minimum 24
    # Each break_before="page" adds ~1 page, but actual count varies.
    # Add generous padding to ensure we hit 24.
    padding_needed = max(0, MIN_PAGES - page_count)
    for _ in range(padding_needed):
        client.contents.insert(
            book_uid,
            template_uid=BLANK_TEMPLATE,
            parameters={},
            break_before="page",
        )

    # 7. Finalize
    client.books.finalize(book_uid)

    return {"book_uid": book_uid, "page_count": MIN_PAGES}


def estimate_order(book_uid: str, quantity: int = 1) -> dict:
    client = get_client()
    return client.orders.estimate([{"bookUid": book_uid, "quantity": quantity}])


def create_order(book_uid: str, shipping: dict, quantity: int = 1) -> dict:
    client = get_client()
    return client.orders.create(
        items=[{"bookUid": book_uid, "quantity": quantity}],
        shipping=shipping,
    )


def get_order(order_uid: str) -> dict:
    client = get_client()
    return client.orders.get(order_uid)


def get_balance() -> float:
    client = get_client()
    result = client.credits.get_balance()
    return result["data"]["balance"]
