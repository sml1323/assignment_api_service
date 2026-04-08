"""Image processing — validation, resize, Pillow text composite"""

import os
import uuid
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

FONT_PATHS = [
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",  # macOS
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",  # Debian/Ubuntu fonts-noto-cjk
    "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",  # Alternative path
]


def _load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_PATHS:
        try:
            return ImageFont.truetype(path, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


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

    font_size = max(16, int(h * 0.03))
    author_size = max(12, int(h * 0.02))
    font = _load_font(font_size)
    author_font = _load_font(author_size)

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

    return _save_composite(img, output_dir)


def compose_photo_with_bottom_text(
    photo_path: str,
    overlay_texts: list[dict],
    bottom_text: str,
    output_dir: str = "",
) -> str:
    """Pillow로 사진 위 오버레이 + 하단 텍스트를 합성한 이미지 생성.

    사진 아래에 흰색 영역을 추가하고 bottom_text를 렌더링합니다.
    """
    img = Image.open(photo_path).convert("RGB")
    draw = ImageDraw.Draw(img)
    w, h = img.size

    font_size = max(16, int(h * 0.03))
    author_size = max(12, int(h * 0.02))
    font = _load_font(font_size)
    author_font = _load_font(author_size)

    # Overlay texts on photo
    for item in overlay_texts:
        px = int(w * item.get("position_x", 50) / 100)
        py = int(h * item.get("position_y", 50) / 100)
        color = item.get("color", "#FFFFFF")
        text = item.get("text", "")
        author = item.get("author", "")

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

    # Add bottom text area
    if bottom_text.strip():
        bottom_font_size = max(14, int(h * 0.025))
        bottom_font = _load_font(bottom_font_size)

        padding = int(w * 0.05)
        line_height = bottom_font_size + 6
        lines = bottom_text.split("\n")
        # Wrap long lines
        wrapped_lines = []
        for line in lines:
            if not line.strip():
                wrapped_lines.append("")
                continue
            words = line
            # Simple character-based wrapping
            max_chars = max(10, int(w * 0.9 / (bottom_font_size * 0.6)))
            while len(words) > max_chars:
                wrapped_lines.append(words[:max_chars])
                words = words[max_chars:]
            wrapped_lines.append(words)

        text_area_height = len(wrapped_lines) * line_height + padding * 2
        new_img = Image.new("RGB", (w, h + text_area_height), "white")
        new_img.paste(img, (0, 0))
        bottom_draw = ImageDraw.Draw(new_img)

        y = h + padding
        for line in wrapped_lines:
            bottom_draw.text((padding, y), line, fill="#333333", font=bottom_font)
            y += line_height

        img = new_img

    return _save_composite(img, output_dir)


def _save_composite(img: Image.Image, output_dir: str) -> str:
    """Save composite image to disk."""
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
