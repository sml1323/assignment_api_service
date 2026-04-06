"""KakaoTalk '나에게 보내기' 알림 — TripBook 주문 상태 알림용.

upbit_websocket 프로젝트의 kakao.py를 TripBook용으로 적응.
Webhook 수신, finalize, order 시점에 호출됩니다.
"""

import json
import logging
import os

import requests

logger = logging.getLogger("tripbook.kakao")

KAKAO_REST_API_KEY = os.getenv("KAKAO_REST_API_KEY", "")
_access_token = os.getenv("KAKAO_ACCESS_TOKEN", "")
_refresh_token_value = os.getenv("KAKAO_REFRESH_TOKEN", "")

TRIPBOOK_URL = os.getenv("TRIPBOOK_URL", "http://localhost:8000")

STATUS_EMOJI = {
    "finalized": "📖",
    "ordered": "📦",
    "PAID": "💳",
    "PDF_READY": "📄",
    "CONFIRMED": "✅",
    "IN_PRODUCTION": "🖨️",
    "PRODUCTION_COMPLETE": "📋",
    "SHIPPED": "🚚",
    "DELIVERED": "🎉",
}


def _send_memo(access_token: str, text: str, link_url: str = "") -> bool | None:
    """카카오톡 나에게 보내기. 성공=True, 401=None, 실패=False."""
    url = "https://kapi.kakao.com/v2/api/talk/memo/default/send"
    headers = {"Authorization": f"Bearer {access_token}"}
    template = {
        "object_type": "text",
        "text": text[:200],
        "link": {
            "web_url": link_url or TRIPBOOK_URL,
            "mobile_web_url": link_url or TRIPBOOK_URL,
        },
        "button_title": "TripBook 열기",
    }
    try:
        resp = requests.post(
            url,
            headers=headers,
            data={"template_object": json.dumps(template)},
            timeout=10,
        )
        if resp.status_code == 401:
            return None
        resp.raise_for_status()
        return True
    except requests.exceptions.HTTPError:
        logger.error("Kakao 전송 실패: %s", resp.text)
        return False
    except Exception as e:
        logger.error("Kakao 전송 오류: %s", e)
        return False


def _refresh_access_token() -> str | None:
    """access_token 만료 시 refresh_token으로 갱신."""
    global _refresh_token_value
    if not _refresh_token_value or not KAKAO_REST_API_KEY:
        return None

    url = "https://kauth.kakao.com/oauth/token"
    data = {
        "grant_type": "refresh_token",
        "client_id": KAKAO_REST_API_KEY,
        "refresh_token": _refresh_token_value,
    }
    try:
        resp = requests.post(url, data=data, timeout=10)
        resp.raise_for_status()
        body = resp.json()
        new_access = body.get("access_token")
        if "refresh_token" in body:
            _refresh_token_value = body["refresh_token"]
            logger.info("Kakao refresh_token 갱신됨")
        logger.info("Kakao access_token 갱신 성공")
        return new_access
    except Exception as e:
        logger.error("Kakao 토큰 갱신 실패: %s", e)
        return None


def _send_with_retry(text: str, link_url: str = "") -> bool:
    """토큰 갱신 포함 전송. 설정 없으면 graceful skip."""
    global _access_token

    if not _access_token:
        logger.debug("Kakao 설정 없음. 스킵.")
        return False

    result = _send_memo(_access_token, text, link_url)
    if result is True:
        return True

    if result is None:
        new_token = _refresh_access_token()
        if new_token:
            _access_token = new_token
            retry = _send_memo(_access_token, text, link_url)
            if retry is True:
                logger.info("Kakao 알림 전송 (토큰 갱신 후)")
                return True

    logger.warning("Kakao 알림 실패")
    return False


def notify_book_finalized(trip_title: str, trip_id: str, page_count: int) -> bool:
    """포토북 확정 알림."""
    emoji = STATUS_EMOJI.get("finalized", "📖")
    text = (
        f"{emoji} 포토북 확정!\n\n"
        f"{trip_title}\n"
        f"{page_count}페이지 · A4 소프트커버\n"
        f"주문 준비 완료"
    )
    link = f"{TRIPBOOK_URL}/trip/{trip_id}/admin"
    return _send_with_retry(text, link)


def notify_order_created(trip_title: str, trip_id: str, order_uid: str) -> bool:
    """주문 생성 알림."""
    emoji = STATUS_EMOJI.get("ordered", "📦")
    text = (
        f"{emoji} 주문 완료!\n\n"
        f"{trip_title}\n"
        f"주문번호: {order_uid}\n"
        f"인쇄 준비 중"
    )
    link = f"{TRIPBOOK_URL}/trip/{trip_id}/admin"
    return _send_with_retry(text, link)


def notify_order_status(trip_title: str, trip_id: str, status: str, status_display: str = "") -> bool:
    """Webhook 수신 — 주문 상태 변경 알림."""
    emoji = STATUS_EMOJI.get(status, "📋")
    display = status_display or status
    text = (
        f"{emoji} 주문 상태 변경\n\n"
        f"{trip_title}\n"
        f"상태: {display}"
    )
    link = f"{TRIPBOOK_URL}/trip/{trip_id}/admin"
    return _send_with_retry(text, link)
