"""인증 — 간단한 username/password + 카카오 OAuth"""

import bcrypt
from fastapi import APIRouter, Depends, Header, Query, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy.orm import Session

from ..database import SessionLocal, get_db
from ..models import Trip, User
from ..schemas import AuthRequest, AuthResponse
from ..services.kakao import get_login_url, exchange_code_for_token
from ..services.audit import log_action

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


@router.get("/kakao/login")
def kakao_login(trip_id: str = Query(...), admin_token: str = Query(...)):
    """카카오 로그인 시작 — 카카오 인증 페이지로 리다이렉트."""
    url = get_login_url(trip_id, admin_token)
    return RedirectResponse(url)


@router.get("/kakao/callback")
def kakao_callback(code: str = Query(...), state: str = Query("")):
    """카카오 인가 코드 콜백 — 토큰 교환 + Trip에 저장."""
    # state에서 trip_id:admin_token 복원
    parts = state.split(":", 1)
    if len(parts) != 2:
        raise HTTPException(400, "잘못된 state 파라미터")

    trip_id, admin_token = parts

    # 토큰 교환
    token_data = exchange_code_for_token(code)
    if not token_data or "access_token" not in token_data:
        raise HTTPException(400, "카카오 토큰 발급 실패")

    access_token = token_data["access_token"]
    refresh_token = token_data.get("refresh_token", "")

    # Trip에 저장
    db = SessionLocal()
    try:
        trip = db.query(Trip).filter(Trip.id == trip_id).first()
        if not trip or trip.admin_token != admin_token:
            raise HTTPException(403, "권한이 없습니다")

        trip.kakao_access_token = access_token
        trip.kakao_refresh_token = refresh_token
        log_action(db, "kakao.connected", "admin", trip_id=trip.id)
        db.commit()

        # 성공 페이지 → 대시보드로 돌아가기
        return HTMLResponse(f"""
        <html>
        <body style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#FFF7ED;">
            <div style="text-align:center;">
                <p style="font-size:48px;">✅</p>
                <h2>카카오톡 알림 연결 완료!</h2>
                <p style="color:#888;">포토북 확정/주문 시 카카오톡으로 알림을 받습니다.</p>
                <a href="/trip/{trip_id}/admin?token={admin_token}"
                   style="display:inline-block;margin-top:16px;padding:12px 24px;background:#F97316;color:white;border-radius:12px;text-decoration:none;">
                    대시보드로 돌아가기
                </a>
            </div>
        </body>
        </html>
        """)
    finally:
        db.close()
