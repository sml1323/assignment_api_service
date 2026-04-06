"""KakaoTalk 알림 — OAuth 로그인 + 나에게 보내기.

사용자가 카카오 로그인하면 access_token을 Trip에 저장.
finalize/order/webhook 시 해당 토큰으로 사용자 카톡에 발송.
"""

import json
import logging
import os
from urllib.parse import urlencode

import requests

logger = logging.getLogger("tripbook.kakao")

def _env(key: str, default: str = "") -> str:
    """런타임에 환경변수 읽기 (.env 로드 타이밍 이슈 방지)."""
    return os.getenv(key, default)


KAKAO_REDIRECT_URI_DEFAULT = "http://localhost:8000/api/auth/kakao/callback"

STATUS_EMOJI = {
    "finalized": "📖",
    "ordered": "📦",
    "PAID": "💳",
    "PDF_READY": "📄",
    "CONFIRMED": "✅",
    "IN_PRODUCTION": "🖨️",
    "SHIPPED": "🚚",
    "DELIVERED": "🎉",
}


# --- OAuth ---

def get_login_url(trip_id: str, admin_token: str) -> str:
    """카카오 로그인 URL 생성. state에 trip_id+admin_token을 넣어서 콜백에서 복원."""
    params = {
        "client_id": _env("KAKAO_REST_API_KEY"),
        "redirect_uri": _env("KAKAO_REDIRECT_URI", KAKAO_REDIRECT_URI_DEFAULT),
        "response_type": "code",
        "scope": "talk_message",
        "state": f"{trip_id}:{admin_token}",
    }
    return "https://kauth.kakao.com/oauth/authorize?" + urlencode(params)


def exchange_code_for_token(code: str) -> dict | None:
    """인가 코드 → access_token + refresh_token 교환."""
    data = {
        "grant_type": "authorization_code",
        "client_id": _env("KAKAO_REST_API_KEY"),
        "redirect_uri": _env("KAKAO_REDIRECT_URI", KAKAO_REDIRECT_URI_DEFAULT),
        "code": code,
    }
    secret = _env("KAKAO_CLIENT_SECRET")
    if secret:
        data["client_secret"] = secret

    try:
        resp = requests.post("https://kauth.kakao.com/oauth/token", data=data, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error("Kakao 토큰 교환 실패: %s", e)
        return None


def refresh_access_token(refresh_token: str) -> dict | None:
    """refresh_token으로 access_token 갱신."""
    data = {
        "grant_type": "refresh_token",
        "client_id": _env("KAKAO_REST_API_KEY"),
        "refresh_token": refresh_token,
    }
    secret = _env("KAKAO_CLIENT_SECRET")
    if secret:
        data["client_secret"] = secret

    try:
        resp = requests.post("https://kauth.kakao.com/oauth/token", data=data, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.error("Kakao 토큰 갱신 실패: %s", e)
        return None


# --- 메시지 발송 ---

def _send_memo(access_token: str, text: str, link_url: str = "") -> bool | None:
    """카카오톡 나에게 보내기. True=성공, None=401(토큰만료), False=실패."""
    url = "https://kapi.kakao.com/v2/api/talk/memo/default/send"
    headers = {"Authorization": f"Bearer {access_token}"}
    template = {
        "object_type": "text",
        "text": text[:200],
        "link": {
            "web_url": link_url or _env("TRIPBOOK_URL", "http://localhost:8000"),
            "mobile_web_url": link_url or _env("TRIPBOOK_URL", "http://localhost:8000"),
        },
        "button_title": "TripBook 열기",
    }
    try:
        resp = requests.post(
            url, headers=headers,
            data={"template_object": json.dumps(template, ensure_ascii=False)},
            timeout=10,
        )
        if resp.status_code == 401:
            return None
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error("Kakao 전송 실패: %s", e)
        return False


def send_with_refresh(access_token: str, refresh_token: str, text: str, link_url: str = "") -> tuple[bool, str, str]:
    """발송 시도 + 401이면 토큰 갱신 후 재시도. (성공여부, 최신access, 최신refresh) 반환."""
    if not access_token:
        return False, access_token, refresh_token

    result = _send_memo(access_token, text, link_url)
    if result is True:
        return True, access_token, refresh_token

    if result is None and refresh_token:
        token_data = refresh_access_token(refresh_token)
        if token_data:
            new_access = token_data.get("access_token", access_token)
            new_refresh = token_data.get("refresh_token", refresh_token)
            retry = _send_memo(new_access, text, link_url)
            if retry is True:
                return True, new_access, new_refresh
            return False, new_access, new_refresh

    return False, access_token, refresh_token


# --- TripBook 알림 함수 ---

def notify_book_finalized(trip_title: str, trip_id: str, page_count: int,
                          access_token: str = "", refresh_token: str = "") -> tuple[bool, str, str]:
    emoji = STATUS_EMOJI.get("finalized", "📖")
    text = f"{emoji} 포토북 확정!\n\n{trip_title}\n{page_count}페이지 · A4 소프트커버\n주문 준비 완료"
    link = f"{_env('TRIPBOOK_URL', 'http://localhost:8000')}/trip/{trip_id}/admin"
    return send_with_refresh(access_token, refresh_token, text, link)


def notify_order_created(trip_title: str, trip_id: str, order_uid: str,
                         access_token: str = "", refresh_token: str = "") -> tuple[bool, str, str]:
    emoji = STATUS_EMOJI.get("ordered", "📦")
    text = f"{emoji} 주문 완료!\n\n{trip_title}\n주문번호: {order_uid}\n인쇄 준비 중"
    link = f"{_env('TRIPBOOK_URL', 'http://localhost:8000')}/trip/{trip_id}/admin"
    return send_with_refresh(access_token, refresh_token, text, link)


def notify_order_status(trip_title: str, trip_id: str, status: str, status_display: str = "",
                        access_token: str = "", refresh_token: str = "") -> tuple[bool, str, str]:
    emoji = STATUS_EMOJI.get(status, "📋")
    display = status_display or status
    text = f"{emoji} 주문 상태 변경\n\n{trip_title}\n상태: {display}"
    link = f"{_env('TRIPBOOK_URL', 'http://localhost:8000')}/trip/{trip_id}/admin"
    return send_with_refresh(access_token, refresh_token, text, link)
