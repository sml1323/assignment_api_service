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
    """Build a complete trip photobook with Day-based structure.

    Day 기반 앨범 구조:
    1. 표지 (cover) — 콘텐츠 페이지에 포함 안 됨
    2. Day별 순회 (사진이 있는 Day만):
       a. Day 간지 페이지 (CONTENT_B 템플릿)
       b. 사진 페이지들 (day_order 순)
       c. 텍스트 페이지 (bottom zone 메시지가 있는 경우)
    3. 패딩: target = max(24, ceil_to_even(page_count))

    Args:
        trip: Trip model instance (with days relationship loaded)
        pages_with_messages: dict of {page_id: (Page, composite_photo_path, bottom_text)}
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
    for page_id, (page, composite_path, _) in pages_with_messages.items():
        upload_result = client.photos.upload(book_uid, composite_path)
        photo_names[page_id] = upload_result["data"]["fileName"]

    # 3. Cover
    if cover_path and Path(cover_path).exists():
        cover_upload = client.photos.upload(book_uid, cover_path)
        cover_photo_name = cover_upload["data"]["fileName"]
    else:
        # 첫 번째 Day의 첫 번째 사진을 표지로
        first_page_id = None
        for day in sorted(trip.days, key=lambda d: d.day_number):
            if day.pages:
                first_page_id = sorted(day.pages, key=lambda p: p.day_order or 0)[0].id
                break
        cover_photo_name = photo_names.get(first_page_id, "") if first_page_id else ""

    date_range = f"{trip.start_date} - {trip.end_date}" if trip.start_date and trip.end_date else trip.start_date or ""

    client.covers.create(
        book_uid,
        template_uid=COVER_TEMPLATE,
        parameters={
            "coverPhoto": cover_photo_name,
            "subtitle": trip.destination or "",
            "dateRange": date_range,
        },
    )

    page_count = 0

    # 4. Day별 순회
    for day in sorted(trip.days, key=lambda d: d.day_number):
        day_pages = sorted(day.pages, key=lambda p: p.day_order or 0)
        if not day_pages:
            continue  # 사진 없는 Day는 간지 삽입 생략

        # 4a. Day 간지 페이지
        try:
            day_date_parts = day.date.split("-") if day.date else []
            month_num = day_date_parts[1] if len(day_date_parts) > 1 else "01"
            day_num = day_date_parts[2] if len(day_date_parts) > 2 else "01"
        except (IndexError, ValueError):
            month_num, day_num = "01", "01"

        client.contents.insert(
            book_uid,
            template_uid=CONTENT_B_TEMPLATE,
            parameters={
                "monthNum": month_num,
                "dayNum": day_num,
                "diaryText": day.description or day.title or f"Day {day.day_number}",
            },
            break_before="page",
        )
        page_count += 1

        # 4b. 사진 페이지들
        for page in day_pages:
            page_data = pages_with_messages.get(page.id)
            if not page_data:
                continue
            _, _, bottom_text = page_data
            photo_name = photo_names.get(page.id, "")

            client.contents.insert(
                book_uid,
                template_uid=CONTENT_PHOTO_TEMPLATE,
                parameters={
                    "dayLabel": page.subtitle or day.title or f"Day {day.day_number}",
                    "photo": photo_name,
                },
                break_before="page",
            )
            page_count += 1

            # 4c. 하단 텍스트는 Pillow에서 사진에 합성됨 (별도 페이지 불필요)

    # 5. 패딩: target = max(24, ceil_to_even(page_count))
    target = max(MIN_PAGES, page_count + (page_count % 2))
    while page_count < target:
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


def cancel_order(order_uid: str, reason: str) -> dict:
    client = get_client()
    return client.orders.cancel(order_uid, reason)


def update_order_shipping(order_uid: str, fields: dict) -> dict:
    """배송지 변경. fields는 camelCase dict (ShippingUpdate.model_dump(exclude_none=True))"""
    client = get_client()
    # SDK는 snake_case kwargs → camelCase 변환을 내부 처리
    key_map = {
        "recipientName": "recipient_name",
        "recipientPhone": "recipient_phone",
        "postalCode": "postal_code",
        "address1": "address1",
        "address2": "address2",
        "memo": "shipping_memo",
    }
    kwargs = {}
    for camel, snake in key_map.items():
        if camel in fields:
            kwargs[snake] = fields[camel]
    return client.orders.update_shipping(order_uid, **kwargs)


def get_balance() -> dict:
    client = get_client()
    return client.credits.get_balance()


def get_transactions(limit: int = 20, offset: int = 0) -> dict:
    client = get_client()
    return client.credits.get_transactions(limit=limit, offset=offset)
