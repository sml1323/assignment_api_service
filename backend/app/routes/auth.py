"""인증 — 간단한 username/password"""

import bcrypt
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Trip, User
from ..schemas import AuthRequest, AuthResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def get_current_user(db: Session, token: str) -> User:
    user = db.query(User).filter(User.token == token).first()
    if not user:
        raise HTTPException(401, "인증이 필요합니다")
    return user


@router.post("/register")
def register(body: AuthRequest, db: Session = Depends(get_db)):
    """회원가입"""
    existing = db.query(User).filter(User.username == body.username).first()
    if existing:
        raise HTTPException(409, "이미 사용 중인 아이디입니다")

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(user_id=user.id, username=user.username, token=user.token)


@router.post("/login")
def login(body: AuthRequest, db: Session = Depends(get_db)):
    """로그인"""
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "아이디 또는 비밀번호가 일치하지 않습니다")
    return AuthResponse(user_id=user.id, username=user.username, token=user.token)


@router.get("/me")
def get_me(
    db: Session = Depends(get_db),
    x_user_token: str = Header(...),
):
    """내 정보"""
    user = get_current_user(db, x_user_token)
    return {"user_id": user.id, "username": user.username}


@router.get("/my/trips")
def my_trips(
    db: Session = Depends(get_db),
    x_user_token: str = Header(...),
):
    """내 여행 목록"""
    user = get_current_user(db, x_user_token)
    trips = db.query(Trip).filter(Trip.user_id == user.id).order_by(Trip.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "title": t.title,
            "destination": t.destination,
            "status": t.status,
            "created_at": t.created_at,
            "page_count": len(t.pages),
            "admin_token": t.admin_token,
            "sweetbook_book_uid": t.sweetbook_book_uid,
            "sweetbook_order_uid": t.sweetbook_order_uid,
        }
        for t in trips
    ]
