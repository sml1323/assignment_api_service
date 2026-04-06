"""카카오 OAuth 로그인 — 사용자별 토큰 발급 + Trip에 저장"""

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Trip
from ..services.kakao import get_login_url, exchange_code_for_token
from ..services.audit import log_action

router = APIRouter(prefix="/api/auth", tags=["auth"])


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
