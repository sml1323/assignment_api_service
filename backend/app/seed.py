"""TripBook 더미 데이터 시딩

Usage:
    python -m backend.app.seed

"제주도 3박4일 여행" 시나리오를 생성합니다.
주최자 1명 + 참여자 3명, 8페이지, 페이지당 1-2개 메시지.
실행 즉시 서비스를 확인할 수 있습니다.
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timezone

project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
os.chdir(project_root)

from dotenv import load_dotenv
load_dotenv(project_root / ".env")

from PIL import Image, ImageDraw, ImageFont

import bcrypt

from backend.app.database import SessionLocal, engine, Base
from backend.app.models import Trip, TripDay, Page, Zone, Message, User
from backend.app.services.image import UPLOAD_DIR


DUMMY_IMAGE_DIR = project_root / "dummy-data" / "images"

JEJU_PHOTOS = [
    {"subtitle": "공항에서 출발!", "caption": "드디어 제주도!", "color": "#45B7D1", "image": "airport_selfie.jpg"},
    {"subtitle": "바다 앞에서", "caption": "바람이 시원해", "color": "#96CEB4", "image": "ocean_friends.jpg"},
    {"subtitle": "카페에서 건배", "caption": "칵테일 타임", "color": "#FF6B6B", "image": "cafe_cheers.jpg"},
    {"subtitle": "들판에서 점프!", "caption": "자유다!", "color": "#4ECDC4", "image": "field_jump.jpg"},
    {"subtitle": "숙소에서 야식", "caption": "파자마 파티", "color": "#FFEAA7", "image": "hotel_night.jpg"},
    {"subtitle": "공항에서 귀환", "caption": "또 오자, 제주!", "color": "#85C1E9", "image": "airport_return.jpg"},
]

MESSAGES = [
    # (page_index, zone_number, author_name, content, color, pos_x, pos_y)
    (0, 1, "영희", "공항에서 셀카 찍자마자 신났던 기억!", "#FFD700", 72, 20),
    (0, 3, "철수", "비행기에서 본 제주 바다가 진짜 예뻤어", "#FFFFFF", 50, 50),
    (1, 1, "민정", "바람 불어서 머리 날리는 것도 좋았어", "#7FDBFF", 70, 15),
    (1, 2, "영희", "여기서 단체사진 찍은 거 기억나? ㅋㅋ", "#2ECC40", 30, 80),
    (2, 1, "철수", "칵테일 색깔이 진짜 예뻤어!", "#FFD700", 25, 25),
    (2, 3, "민정", "카페 분위기 최고였어 또 가고 싶다", "#FFFFFF", 50, 50),
    (3, 1, "영희", "점프샷 타이밍 맞추느라 10번은 뛴 듯 😂", "#FF6B6B", 75, 25),
    (3, 3, "철수", "여기 들판이 진짜 넓어서 뛰어다니기 좋았어", "#FFFFFF", 50, 50),
    (4, 1, "민정", "파자마 파티가 제일 재밌었어!", "#2ECC40", 70, 20),
    (4, 3, "영희", "과자 다 먹고 새벽까지 수다 떨었지", "#FFFFFF", 50, 50),
    (5, 1, "철수", "벌써 돌아가다니... 다음에 또 오자!", "#7FDBFF", 30, 20),
    (5, 3, "민정", "최고의 여행이었어. 우리 우정 영원해 ❤️", "#FFFFFF", 50, 50),
]


def generate_dummy_photo(filename: str, text: str, color: str, size=(1200, 900)):
    """Generate a dummy travel photo with text."""
    img = Image.new("RGB", size, color)
    draw = ImageDraw.Draw(img)

    try:
        font = ImageFont.truetype("/System/Library/Fonts/AppleSDGothicNeo.ttc", 48)
        small = ImageFont.truetype("/System/Library/Fonts/AppleSDGothicNeo.ttc", 24)
    except (OSError, IOError):
        font = ImageFont.load_default()
        small = font

    # Center text
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((size[0] - tw) // 2, (size[1] - th) // 2), text, fill="white", font=font)

    # Watermark
    draw.text((20, size[1] - 40), "TripBook Demo Photo", fill=(255, 255, 255, 128), font=small)

    img.save(str(filename), quality=90)


def seed():
    """Seed database with 제주도 여행 dummy data."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        existing = db.query(Trip).count()
        if existing > 0:
            print(f"이미 {existing}개의 여행이 있습니다. 시딩을 건너뜁니다.")
            print("초기화하려면: rm tripbook.db && python -m backend.app.seed")
            return

        # Create demo user
        demo_pw = bcrypt.hashpw("demo1234".encode(), bcrypt.gensalt()).decode()
        user = User(username="demo", password_hash=demo_pw)
        db.add(user)
        db.flush()
        print(f"👤 데모 계정: demo / demo1234")

        # Create trip
        trip = Trip(
            title="제주도 2박3일",
            destination="제주도",
            start_date="2026-04-01",
            end_date="2026-04-03",
            user_id=user.id,
        )
        db.add(trip)
        db.flush()

        # Change status to collecting
        trip.status = "collecting"

        # Create TripDays (3일 — 2박3일)
        day_dates = ["2026-04-01", "2026-04-02", "2026-04-03"]
        day_titles = ["출발 + 바다", "카페 + 들판", "숙소 + 귀환"]
        trip_days = []
        for i, (d_date, d_title) in enumerate(zip(day_dates, day_titles)):
            td = TripDay(
                trip_id=trip.id,
                day_number=i + 1,
                date=d_date,
                title=d_title,
            )
            db.add(td)
            db.flush()
            trip_days.append(td)

        print(f"🏝️  여행 생성: {trip.title} ({len(trip_days)}일)")
        print(f"   ID: {trip.id}")
        print(f"   Admin Token: {trip.admin_token}")
        print(f"   Share Token: {trip.share_token}")

        # 사진별 Day 배치 (2장씩, 6장 / 3 Days)
        photo_to_day = [0, 0, 1, 1, 2, 2]

        # Create pages with photos
        trip_dir = UPLOAD_DIR / trip.id
        trip_dir.mkdir(parents=True, exist_ok=True)

        pages = []
        day_order_counters = [0, 0, 0]
        for i, photo_data in enumerate(JEJU_PHOTOS):
            filename = f"page_{i+1}_jeju.jpg"
            filepath = trip_dir / filename

            real_image = DUMMY_IMAGE_DIR / photo_data.get("image", "") if photo_data.get("image") else None
            if real_image and real_image.exists():
                import shutil
                shutil.copy2(str(real_image), str(filepath))
            else:
                generate_dummy_photo(
                    str(filepath),
                    photo_data["caption"],
                    photo_data["color"],
                )

            day_idx = photo_to_day[i]
            day_order_counters[day_idx] += 1

            page = Page(
                trip_id=trip.id,
                trip_day_id=trip_days[day_idx].id,
                page_number=i + 1,
                day_order=day_order_counters[day_idx],
                photo_url=f"/uploads/{trip.id}/{filename}",
                caption=photo_data["caption"],
                subtitle=photo_data["subtitle"],
            )
            db.add(page)
            db.flush()

            # Create 4 zones per page
            zones = []
            for zone_num in range(1, 5):
                zone = Zone(page_id=page.id, zone_number=zone_num)
                db.add(zone)
                db.flush()
                zones.append(zone)

            pages.append((page, zones))
            print(f"  📷 {photo_data['subtitle']} — {photo_data['caption']}")

        # Add messages
        for page_idx, zone_num, author, content, color, px, py in MESSAGES:
            if page_idx >= len(pages):
                continue
            page, zones = pages[page_idx]
            zone = next((z for z in zones if z.zone_number == zone_num), None)
            if not zone:
                continue

            zone.claimed_by = author
            zone.claimed_at = datetime.now(timezone.utc)

            message = Message(
                zone_id=zone.id,
                author_name=author,
                content=content,
                color=color,
                position_x=px,
                position_y=py,
            )
            db.add(message)

        # 첫 번째 사진을 표지로 설정
        if pages:
            trip.cover_image = pages[0][0].photo_url
            print(f"  🖼️  표지 설정: {pages[0][0].photo_url}")

        db.commit()

        print(f"\n✅ 시딩 완료!")
        print(f"   {len(JEJU_PHOTOS)}개 페이지, {len(MESSAGES)}개 메시지")
        print(f"\n=== 접속 정보 ===")
        print(f"   주최자 대시보드: http://localhost:5173/trip/{trip.id}/admin?token={trip.admin_token}")
        print(f"   참여자 링크:     http://localhost:5173/join/{trip.share_token}")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
