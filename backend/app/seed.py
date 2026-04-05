"""Dummy data seeding script

Usage:
    python -m backend.app.seed

Creates sample events with contributions so the service can be
demonstrated immediately after startup.
"""

import os
import sys
from pathlib import Path

# Ensure project root is in path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
os.chdir(project_root)

from dotenv import load_dotenv
load_dotenv(project_root / ".env")

from PIL import Image, ImageDraw, ImageFont

from backend.app.database import SessionLocal, engine, Base
from backend.app.models import Event, Contribution
from backend.app.services.image import UPLOAD_DIR


# --- Dummy image generation ---

COLORS = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
    "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
]


def generate_dummy_image(filename: str, text: str, color: str, size=(800, 800)):
    """Generate a simple colored image with text overlay."""
    img = Image.new("RGB", size, color)
    draw = ImageDraw.Draw(img)

    # Draw text centered
    try:
        font = ImageFont.truetype("/System/Library/Fonts/AppleSDGothicNeo.ttc", 40)
    except (OSError, IOError):
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size[0] - tw) // 2
    y = (size[1] - th) // 2
    draw.text((x, y), text, fill="white", font=font)

    path = UPLOAD_DIR / filename
    img.save(path, quality=85)
    return filename


# --- Seed data ---

SEED_EVENTS = [
    {
        "title": "김민수의 졸업을 축하해요! 🎓",
        "event_type": "graduation",
        "recipient_name": "김민수",
        "organizer_name": "이영희",
        "contributions": [
            {
                "contributor_name": "박철수",
                "message": "민수야 졸업 축하해! 4년 동안 정말 열심히 했어. 앞으로의 여정도 항상 응원할게. 우리 졸업하고도 자주 만나자!",
                "has_image": True,
                "image_text": "졸업 축하!",
            },
            {
                "contributor_name": "정수진",
                "message": "민수 오빠~ 드디어 졸업이네! 학교 다닐 때 과제 도와줘서 정말 고마웠어. 사회생활도 잘 할 거라 믿어!",
                "has_image": False,
            },
            {
                "contributor_name": "최동현",
                "message": "민수 졸업 축하한다! 같이 밤새 프로젝트 하던 때가 엊그제 같은데 벌써 졸업이라니. 우리 MT 갔을 때 사진 보내줄게 ㅋㅋ",
                "has_image": True,
                "image_text": "MT 추억",
            },
            {
                "contributor_name": "한지영",
                "message": "민수야, 항상 밝은 에너지로 주변 사람들을 즐겁게 해줘서 고마워. 졸업 후에도 그 모습 잃지 마! 축하해 🎉",
                "has_image": False,
            },
            {
                "contributor_name": "김태호",
                "message": "형, 졸업 축하드립니다! 후배들한테 항상 잘 해주셔서 감사했어요. 나중에 밥 한번 사주세요 ㅎㅎ",
                "has_image": True,
                "image_text": "선후배 사이",
            },
        ],
    },
    {
        "title": "이사장님의 정년퇴직을 축하합니다",
        "event_type": "retirement",
        "recipient_name": "이사장님",
        "organizer_name": "총무팀 김과장",
        "contributions": [
            {
                "contributor_name": "영업팀 박대리",
                "message": "사장님, 30년간 회사를 이끌어주셔서 감사합니다. 항상 직원들을 먼저 생각해주신 모습 잊지 못할 거예요. 건강하시고 행복한 제2의 인생 시작하세요!",
                "has_image": True,
                "image_text": "감사합니다",
            },
            {
                "contributor_name": "개발팀 최차장",
                "message": "사장님 덕분에 회사가 여기까지 올 수 있었습니다. 퇴직 후에도 가끔 회사에 놀러 오세요. 커피 한잔 대접하겠습니다.",
                "has_image": False,
            },
            {
                "contributor_name": "인사팀 정과장",
                "message": "항상 따뜻한 리더십으로 직원들에게 영감을 주셨습니다. 은퇴 후 여행 계획 들었는데, 정말 부러워요! 건강 조심하세요.",
                "has_image": True,
                "image_text": "은퇴 축하",
            },
        ],
    },
    {
        "title": "서연이의 5번째 생일 파티 🎂",
        "event_type": "birthday",
        "recipient_name": "서연",
        "organizer_name": "서연 엄마",
        "contributions": [
            {
                "contributor_name": "서연 아빠",
                "message": "우리 서연이 벌써 다섯 살! 매일매일 자라는 모습에 아빠는 행복해. 세상에서 제일 예쁜 우리 딸, 생일 축하해 ❤️",
                "has_image": True,
                "image_text": "생일 축하",
            },
            {
                "contributor_name": "할머니",
                "message": "우리 손녀 서연이~ 할머니가 세상에서 제일 사랑해. 건강하게 쑥쑥 자라렴. 생일 축하한다!",
                "has_image": False,
            },
            {
                "contributor_name": "어린이집 선생님",
                "message": "서연이는 어린이집에서 제일 밝은 아이예요. 친구들에게도 항상 양보하고, 정말 착한 아이입니다. 생일 축하해요, 서연아! 🎈",
                "has_image": True,
                "image_text": "어린이집",
            },
            {
                "contributor_name": "이모",
                "message": "서연아~ 이모가 생일 선물 준비했어! 다음에 만나면 줄게. 이모 만나면 또 같이 공주 놀이 하자 ㅎㅎ 사랑해!",
                "has_image": False,
            },
        ],
    },
]


def seed():
    """Seed database with dummy data."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check if already seeded
        existing = db.query(Event).count()
        if existing > 0:
            print(f"이미 {existing}개의 이벤트가 있습니다. 시딩을 건너뜁니다.")
            return

        UPLOAD_DIR.mkdir(exist_ok=True)

        for i, event_data in enumerate(SEED_EVENTS):
            event = Event(
                title=event_data["title"],
                event_type=event_data["event_type"],
                recipient_name=event_data["recipient_name"],
                organizer_name=event_data["organizer_name"],
            )
            db.add(event)
            db.flush()  # get event.id

            for j, contrib_data in enumerate(event_data["contributions"]):
                image_filename = None
                if contrib_data.get("has_image"):
                    fname = f"dummy_{i}_{j}.jpg"
                    color = COLORS[(i * 5 + j) % len(COLORS)]
                    generate_dummy_image(fname, contrib_data.get("image_text", ""), color)
                    image_filename = fname

                contribution = Contribution(
                    event_id=event.id,
                    contributor_name=contrib_data["contributor_name"],
                    message=contrib_data["message"],
                    image_filename=image_filename,
                    page_order=j + 1,
                )
                db.add(contribution)

            print(f"  ✓ {event_data['title']} ({len(event_data['contributions'])}개 메시지)")

        db.commit()
        print(f"\n총 {len(SEED_EVENTS)}개 이벤트, 더미 데이터 시딩 완료!")
        print("\n=== 테스트용 이벤트 정보 ===")

        events = db.query(Event).all()
        for ev in events:
            print(f"\n📖 {ev.title}")
            print(f"   공유 링크: /contribute/{ev.share_code}")
            print(f"   대시보드:  /dashboard/{ev.share_code}?token={ev.admin_token}")

    finally:
        db.close()


if __name__ == "__main__":
    seed()
