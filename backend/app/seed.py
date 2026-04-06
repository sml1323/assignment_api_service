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
from backend.app.models import Trip, Page, Zone, Message, User
from backend.app.services.image import UPLOAD_DIR


DUMMY_IMAGE_DIR = project_root / "dummy-data" / "images"

JEJU_PHOTOS = [
    {"subtitle": "Day 1 — 제주공항 도착", "caption": "드디어 제주도!", "color": "#45B7D1", "image": "IMG_1564.JPG"},
    {"subtitle": "Day 1 — 한라산 등반", "caption": "한라산 백록담", "color": "#96CEB4", "image": "IMG_1567.jpg"},
    {"subtitle": "Day 2 — 성산일출봉", "caption": "일출의 감동", "color": "#FF6B6B", "image": "IMG_1568.jpg"},
    {"subtitle": "Day 2 — 섭지코지", "caption": "바다와 바람", "color": "#4ECDC4", "image": "IMG_1569.jpg"},
    {"subtitle": "Day 3 — 우도", "caption": "에메랄드빛 바다", "color": "#FFEAA7", "image": "IMG_1570.jpg"},
    {"subtitle": "Day 3 — 흑돼지 맛집", "caption": "제주 흑돼지!", "color": "#DDA0DD"},
    {"subtitle": "Day 4 — 카페 투어", "caption": "감성 카페", "color": "#F7DC6F"},
    {"subtitle": "Day 4 — 공항 귀환", "caption": "또 오자, 제주!", "color": "#85C1E9"},
]

MESSAGES = [
    # (page_index, zone_number, author_name, content, color, pos_x, pos_y)
    (0, 1, "영희", "공항에서 렌트카 타자마자 신났던 기억! 🚗", "#FFD700", 72, 20),
    (0, 3, "철수", "비행기에서 본 제주 바다가 진짜 예뻤어", "#FFFFFF", 50, 50),
    (1, 1, "민정", "한라산 올라갈 때 다리 아팠지만 정상 뷰가 최고였어", "#7FDBFF", 70, 15),
    (1, 2, "영희", "백록담에서 단체사진 찍은 거 기억나? ㅋㅋ", "#2ECC40", 30, 80),
    (1, 3, "철수", "중간에 포기하고 싶었는데 같이 올라가서 다행이야", "#FFFFFF", 50, 50),
    (2, 1, "철수", "새벽 4시에 일어나서 힘들었지만 일출 보고 감동", "#FFD700", 25, 25),
    (2, 3, "민정", "여기서 영희가 감동받아서 울었잖아 ㅎㅎ", "#FFFFFF", 50, 50),
    (3, 2, "영희", "바람 엄청 불었는데 머리 다 날려서 사진 망했어 😂", "#FF6B6B", 75, 75),
    (3, 4, "민정", "섭지코지 걷는 내내 힐링이었어 또 가고 싶다", "#FFFFFF", 50, 50),
    (4, 1, "민정", "우도 자전거 탈 때가 제일 재밌었어!", "#2ECC40", 70, 20),
    (4, 3, "영희", "땅콩 아이스크림은 꼭 먹어야 해 진짜 맛있어", "#FFFFFF", 50, 50),
    (5, 1, "철수", "흑돼지 3인분 시켰는데 다 먹었지 ㅋㅋㅋ", "#FF851B", 25, 15),
    (5, 2, "영희", "소주 4병 마신 건 비밀로 하자...", "#FFAFD8", 75, 80),
    (6, 1, "민정", "카페 뷰가 진짜 미쳤어 사진 100장은 찍은 듯", "#FFD700", 70, 25),
    (7, 1, "영희", "다음엔 겨울에 가자! 눈 오는 한라산 보고 싶어", "#7FDBFF", 30, 20),
    (7, 3, "철수", "최고의 여행이었어. 다음에 또 가자!", "#FFFFFF", 50, 50),
    (7, 4, "민정", "우리 넷이서 가는 여행은 항상 최고야 ❤️", "#FFFFFF", 50, 50),
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
            title="제주도 3박4일",
            destination="제주도",
            start_date="2026-04-01",
            end_date="2026-04-04",
            user_id=user.id,
        )
        db.add(trip)
        db.flush()

        # Change status to collecting
        trip.status = "collecting"

        print(f"🏝️  여행 생성: {trip.title}")
        print(f"   ID: {trip.id}")
        print(f"   Admin Token: {trip.admin_token}")
        print(f"   Share Token: {trip.share_token}")

        # Create pages with photos
        trip_dir = UPLOAD_DIR / trip.id
        trip_dir.mkdir(parents=True, exist_ok=True)

        pages = []
        for i, photo_data in enumerate(JEJU_PHOTOS):
            filename = f"page_{i+1}_jeju.jpg"
            filepath = trip_dir / filename

            # 실제 더미 이미지가 있으면 복사, 없으면 생성
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

            page = Page(
                trip_id=trip.id,
                page_number=i + 1,
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
