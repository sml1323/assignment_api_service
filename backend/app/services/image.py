"""Image processing — validation, resize, Pillow text composite"""

import os
import uuid
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_DIMENSION = 2400  # A4 print needs higher res than web


def validate_and_save(file_bytes: bytes, original_filename: str, subdir: str = "") -> str:
    """Validate image, resize, save to disk. Returns saved filename."""
    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError("파일 크기가 10MB를 초과합니다.")

    ext = Path(original_filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError("지원하지 않는 파일 형식입니다. JPG, PNG, WebP만 가능합니다.")

    try:
        img = Image.open(__import__("io").BytesIO(file_bytes))
    except Exception:
        raise ValueError("손상된 이미지 파일입니다.")

    img = ImageOps.exif_transpose(img)

    w, h = img.size
    if max(w, h) > MAX_DIMENSION:
        ratio = MAX_DIMENSION / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    save_dir = UPLOAD_DIR / subdir if subdir else UPLOAD_DIR
    save_dir.mkdir(parents=True, exist_ok=True)

    saved_name = f"{uuid.uuid4().hex}{ext}"
    save_path = save_dir / saved_name
    img.save(save_path, quality=90)

    return saved_name


def compose_photo_with_text(
    photo_path: str,
    overlay_texts: list[dict],
    output_dir: str = "",
) -> str:
    """Pillow로 사진 위에 텍스트를 합성한 이미지 생성.

    Args:
        photo_path: 원본 사진 경로
        overlay_texts: [{"text": "...", "author": "...", "color": "#FFF", "position_x": 75, "position_y": 15}, ...]
        output_dir: 저장 디렉토리 (UPLOAD_DIR 하위)

    Returns: 합성 이미지 파일 경로
    """
    img = Image.open(photo_path).convert("RGB")
    draw = ImageDraw.Draw(img)
    w, h = img.size

    try:
        font_size = max(16, int(h * 0.03))
        author_size = max(12, int(h * 0.02))
        font = ImageFont.truetype("/System/Library/Fonts/AppleSDGothicNeo.ttc", font_size)
        author_font = ImageFont.truetype("/System/Library/Fonts/AppleSDGothicNeo.ttc", author_size)
    except (OSError, IOError):
        font = ImageFont.load_default()
        author_font = font

    for item in overlay_texts:
        px = int(w * item.get("position_x", 50) / 100)
        py = int(h * item.get("position_y", 50) / 100)
        color = item.get("color", "#FFFFFF")
        text = item.get("text", "")
        author = item.get("author", "")

        # Draw text with shadow for readability
        shadow_color = "black"
        for dx, dy in [(-1, -1), (-1, 1), (1, -1), (1, 1), (0, -2), (0, 2), (-2, 0), (2, 0)]:
            draw.text((px + dx, py + dy), text, fill=shadow_color, font=font)
        draw.text((px, py), text, fill=color, font=font)

        if author:
            author_text = f"— {author}"
            ay = py + font_size + 4
            for dx, dy in [(-1, -1), (-1, 1), (1, -1), (1, 1)]:
                draw.text((px + dx, ay + dy), author_text, fill=shadow_color, font=author_font)
            draw.text((px, ay), author_text, fill=color, font=author_font)

    # Save composite
    save_dir = UPLOAD_DIR / output_dir if output_dir else UPLOAD_DIR
    save_dir.mkdir(parents=True, exist_ok=True)
    output_name = f"composite_{uuid.uuid4().hex}.jpg"
    output_path = save_dir / output_name
    if img.mode == "RGBA":
        img = img.convert("RGB")
    img.save(str(output_path), quality=90)

    return str(output_path)


def get_upload_path(filename: str, subdir: str = "") -> Path:
    if subdir:
        return UPLOAD_DIR / subdir / filename
    return UPLOAD_DIR / filename
