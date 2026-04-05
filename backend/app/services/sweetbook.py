"""Sweetbook Book Print API integration — TripBook

PHOTOBOOK_A4_SC (A4 소프트커버 포토북, 210x297mm, 24-130 pages)
Templates confirmed via Sandbox API query.
"""

import os
import sys
from pathlib import Path

SDK_PATH = os.getenv(
    "BOOKPRINT_SDK_PATH",
    str(Path(__file__).parent.parent.parent.parent / "bookprintapi-python-sdk"),
)
if SDK_PATH not in sys.path:
    sys.path.insert(0, SDK_PATH)

from bookprintapi import Client, ApiError

# Confirmed Template UIDs (PHOTOBOOK_A4_SC)
# 구글포토북 + 일기장 테마 혼합 (API 문서 탐색 후 최적화)
BOOK_SPEC = "PHOTOBOOK_A4_SC"
COVER_TEMPLATE = "7CO28K1SttwL"          # 표지 A4 (구글포토북C) — coverPhoto + subtitle + dateRange
MONTH_HEADER_TEMPLATE = "50f9kmXxelPG"   # 내지_monthHeader A4 (구글포토북C) — monthYearLabel
CONTENT_PHOTO_TEMPLATE = "5ADDkCtrodEJ"  # 내지_photo A4 (구글포토북C) — dayLabel + photo
CONTENT_DATE_TEMPLATE = "4UJiQc6ZJzvX"   # 내지_dateA A4 (구글포토북A) — monthYearLabel + photos[] (rowGallery)
CONTENT_B_TEMPLATE = "3mjKd8kcaVzT"      # 내지b A4 (일기장A) — monthNum + dayNum + diaryText
BLANK_TEMPLATE = "5NxuQPBMyuTm"          # 빈내지 A4 (구글포토북C, 필수 파라미터 없음)
MIN_PAGES = 24


MONTH_NAMES = {
    1: "JANUARY", 2: "FEBRUARY", 3: "MARCH", 4: "APRIL",
    5: "MAY", 6: "JUNE", 7: "JULY", 8: "AUGUST",
    9: "SEPTEMBER", 10: "OCTOBER", 11: "NOVEMBER", 12: "DECEMBER",
}


def _format_month_label(date_str: str) -> str:
    """'2026-04-01' → 'APRIL 2026'"""
    try:
        parts = date_str.split("-")
        year = parts[0]
        month = int(parts[1])
        return f"{MONTH_NAMES.get(month, 'JANUARY')} {year}"
    except (IndexError, ValueError):
        return "2026"


def get_client() -> Client:
    return Client()


def build_tripbook(trip, pages_with_messages, cover_path: str | None = None) -> dict:
    """Build a complete trip photobook.

    Args:
        trip: Trip model instance
        pages_with_messages: list of (Page, composite_photo_path, bottom_text)
        cover_path: path to cover image file

    Returns: {"book_uid": str, "page_count": int}
    """
    client = get_client()

    # 1. Create book
    result = client.books.create(
        book_spec_uid=BOOK_SPEC,
        title=trip.title,
        creation_type="TEST",
    )
    book_uid = result["data"]["bookUid"]

    # 2. Upload all photos
    photo_names = {}
    for page, composite_path, _ in pages_with_messages:
        upload_result = client.photos.upload(book_uid, composite_path)
        photo_names[page.id] = upload_result["data"]["fileName"]

    # 3. Cover (구글포토북C 테마)
    if cover_path and Path(cover_path).exists():
        cover_upload = client.photos.upload(book_uid, cover_path)
        cover_photo_name = cover_upload["data"]["fileName"]
    else:
        first_page = pages_with_messages[0] if pages_with_messages else None
        cover_photo_name = photo_names.get(first_page[0].id, "") if first_page else ""

    page_count = 0

    date_range = ""
    if trip.start_date and trip.end_date:
        date_range = f"{trip.start_date} - {trip.end_date}"
    elif trip.start_date:
        date_range = trip.start_date

    client.covers.create(
        book_uid,
        template_uid=COVER_TEMPLATE,
        parameters={
            "coverPhoto": cover_photo_name,
            "subtitle": trip.destination or "",
            "dateRange": date_range,
        },
    )

    # 3.5. Month header as section divider
    if trip.start_date:
        month_label = _format_month_label(trip.start_date)
        client.contents.insert(
            book_uid,
            template_uid=MONTH_HEADER_TEMPLATE,
            parameters={"monthYearLabel": month_label},
            break_before="page",
        )
        page_count += 1

    # 4. Content pages
    for page, _, bottom_text in pages_with_messages:
        photo_name = photo_names.get(page.id, "")

        # Photo page (with composite overlay text baked in)
        client.contents.insert(
            book_uid,
            template_uid=CONTENT_PHOTO_TEMPLATE,
            parameters={
                "dayLabel": page.subtitle or f"Page {page.page_number}",
                "photo": photo_name,
            },
            break_before="page",
        )
        page_count += 1

        # Text page for bottom zone messages
        if bottom_text:
            date_parts = (trip.start_date or "01-01").split("-")
            month = date_parts[1] if len(date_parts) > 1 else "01"
            day = str(page.page_number).zfill(2)
            client.contents.insert(
                book_uid,
                template_uid=CONTENT_B_TEMPLATE,
                parameters={
                    "monthNum": month,
                    "dayNum": day,
                    "diaryText": bottom_text,
                },
                break_before="page",
            )
            page_count += 1

    # 5. Pad to minimum 24 pages
    while page_count < MIN_PAGES:
        client.contents.insert(
            book_uid,
            template_uid=BLANK_TEMPLATE,
            parameters={},
            break_before="page",
        )
        page_count += 1

    # 6. Finalize
    client.books.finalize(book_uid)

    return {"book_uid": book_uid, "page_count": page_count}


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
