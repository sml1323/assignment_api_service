"""Image validation and resizing"""

import os
import uuid
from pathlib import Path

from PIL import Image, ImageOps

UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_DIMENSION = 1200  # resize long edge to this


def validate_and_save(file_bytes: bytes, original_filename: str) -> str:
    """Validate image, resize, save to disk. Returns saved filename."""
    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError("파일 크기가 10MB를 초과합니다.")

    ext = Path(original_filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"지원하지 않는 파일 형식입니다. JPG, PNG, WebP만 가능합니다.")

    try:
        img = Image.open(__import__("io").BytesIO(file_bytes))
    except Exception:
        raise ValueError("손상된 이미지 파일입니다.")

    # Fix EXIF rotation
    img = ImageOps.exif_transpose(img)

    # Resize if long edge > MAX_DIMENSION
    w, h = img.size
    if max(w, h) > MAX_DIMENSION:
        ratio = MAX_DIMENSION / max(w, h)
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

    # Convert to RGB if necessary (e.g., RGBA PNG)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    # Save with unique filename
    saved_name = f"{uuid.uuid4().hex}{ext}"
    save_path = UPLOAD_DIR / saved_name
    img.save(save_path, quality=85)

    return saved_name


def get_upload_path(filename: str) -> Path:
    return UPLOAD_DIR / filename
