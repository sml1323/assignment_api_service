# TripBook 추가 기능 5종 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Webhook 연동, Audit Log, 주문 상태 UI, 존 선점 타임아웃, API 플로우 다이어그램 추가

**Architecture:** 기존 FastAPI + SQLAlchemy 위에 WebhookLog/AuditLog 모델 추가. Webhook은 SDK의 verify_signature 활용. Audit은 얇은 헬퍼 함수로 기존 라우트에 삽입. 프론트엔드는 TripAdmin 주문 탭만 고도화.

**Tech Stack:** FastAPI, SQLAlchemy, Pillow, React, TypeScript, Tailwind, Sweetbook Python SDK

---

### Task 1: 모델 추가 (WebhookLog + AuditLog + Message.updated_at)

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/schemas.py`

- [ ] **Step 1: models.py에 WebhookLog, AuditLog 추가 + Message.updated_at**

`backend/app/models.py` 끝에 추가:

```python
class WebhookLog(Base):
    """Webhook 수신 로그 — idempotency + DLQ"""
    __tablename__ = "webhook_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    event_id = Column(String, unique=True, nullable=False)
    event_type = Column(String(50), nullable=False)
    payload = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="received")
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    processed_at = Column(DateTime, nullable=True)


class AuditLog(Base):
    """감사 로그 — 주요 액션 추적"""
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    trip_id = Column(String, ForeignKey("trips.id"), nullable=True)
    action = Column(String(50), nullable=False)
    actor = Column(String(100), nullable=False)
    target = Column(String(200), nullable=True)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
```

Message 클래스에 `updated_at` 추가:

```python
    updated_at = Column(DateTime, nullable=True)
```

- [ ] **Step 2: schemas.py에 AuditLogResponse + MessageResponse.updated_at 추가**

`backend/app/schemas.py`에 추가:

```python
class AuditLogResponse(BaseModel):
    id: str
    trip_id: str | None
    action: str
    actor: str
    target: str | None
    detail: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
```

MessageResponse에 `updated_at: datetime | None = None` 추가.

- [ ] **Step 3: DB 리셋 후 테이블 생성 확인**

```bash
rm -f tripbook.db tripbook.db-wal tripbook.db-shm
python -c "from backend.app.database import engine, Base; from backend.app.models import *; Base.metadata.create_all(bind=engine); print('OK')"
```

- [ ] **Step 4: 커밋**

```bash
git add backend/app/models.py backend/app/schemas.py
git commit -m "feat: add WebhookLog, AuditLog models + Message.updated_at"
```

---

### Task 2: Audit Log 헬퍼 서비스

**Files:**
- Create: `backend/app/services/audit.py`

- [ ] **Step 1: audit.py 생성**

```python
"""Audit logging service"""

import json
from sqlalchemy.orm import Session
from ..models import AuditLog


def log_action(
    db: Session,
    action: str,
    actor: str,
    trip_id: str | None = None,
    target: str | None = None,
    detail: dict | str | None = None,
):
    entry = AuditLog(
        trip_id=trip_id,
        action=action,
        actor=actor,
        target=target,
        detail=json.dumps(detail, ensure_ascii=False) if isinstance(detail, dict) else detail,
    )
    db.add(entry)
    db.flush()
```

- [ ] **Step 2: 커밋**

```bash
git add backend/app/services/audit.py
git commit -m "feat: add audit log helper service"
```

---

### Task 3: 기존 라우트에 Audit Log 삽입

**Files:**
- Modify: `backend/app/routes/trips.py`
- Modify: `backend/app/routes/messages.py`
- Modify: `backend/app/routes/books.py`
- Modify: `backend/app/routes/pages.py`

- [ ] **Step 1: trips.py — trip.create, trip.status_change 기록**

import 추가: `from ..services.audit import log_action`

`create_trip` 함수: `db.add(trip)` 후 `db.flush()` + `log_action(db, "trip.create", "admin", trip_id=trip.id, detail={"title": trip.title})` 추가. 그 다음 `db.commit()`.

`update_status` 함수: `trip.status = body.status` 전에 `old = trip.status` 저장, 변경 후 `log_action(db, "trip.status_change", "admin", trip_id=trip.id, detail={"from": old, "to": body.status})` 추가.

- [ ] **Step 2: messages.py — message.write, message.update, message.delete 기록**

import 추가: `from ..services.audit import log_action`

`claim_and_write`: `db.add(message)` 후 `log_action(db, "message.write", body.author_name, trip_id=trip.id, target=zone.id, detail={"content": body.content[:50]})` 추가.

`update_message`: 변경 후 `log_action(db, "message.update", message.author_name, trip_id=trip.id, target=message.id)` 추가.

`delete_message`: 삭제 전 `log_action(db, "message.delete", "admin", trip_id=trip.id, target=message.id, detail={"author": message.author_name})` 추가.

또한 `claim_and_write`에 존 선점 타임아웃 로직 추가 (Task 5와 합침):
```python
# 10분 타임아웃 체크: 선점됨 + 메시지 없음 + 10분 경과 → 자동 해제
if zone.claimed_by is not None:
    has_msg = zone.message is not None
    if not has_msg and zone.claimed_at:
        elapsed = (datetime.now(timezone.utc) - zone.claimed_at).total_seconds()
        if elapsed > 600:  # 10분
            zone.claimed_by = None
            zone.claimed_at = None
            # 이제 선점 가능
        else:
            raise HTTPException(409, f"이미 {zone.claimed_by}님이 선점한 존입니다")
    else:
        raise HTTPException(409, f"이미 {zone.claimed_by}님이 선점한 존입니다")
```

`update_message`에 `updated_at` 갱신:
```python
message.updated_at = datetime.now(timezone.utc)
```

- [ ] **Step 3: books.py — book.finalize, order.create 기록**

import 추가: `from ..services.audit import log_action`

`finalize_book`: `trip.status = "finalized"` 후 `log_action(db, "book.finalize", "admin", trip_id=trip.id, target=result["book_uid"], detail={"page_count": result["page_count"]})` 추가.

`place_order`: `trip.status = "ordered"` 후 `log_action(db, "order.create", "admin", trip_id=trip.id, target=result["data"]["orderUid"])` 추가.

- [ ] **Step 4: pages.py — page.upload 기록**

import 추가: `from ..services.audit import log_action`

`add_page`: `db.commit()` 전에 `log_action(db, "page.upload", "admin", trip_id=trip_id, target=page.id)` 추가.

`reorder_pages`: `db.commit()` 전에 `log_action(db, "page.reorder", "admin", trip_id=trip_id, detail={"order": page_ids})` 추가.

- [ ] **Step 5: 커밋**

```bash
git add backend/app/routes/trips.py backend/app/routes/messages.py backend/app/routes/books.py backend/app/routes/pages.py
git commit -m "feat: add audit logging to all routes + zone timeout"
```

---

### Task 4: Webhook 엔드포인트

**Files:**
- Create: `backend/app/routes/webhooks.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: webhooks.py 생성**

```python
"""Webhook routes — Sweetbook 주문 상태 변경 수신
서명 검증 + Idempotency + DLQ 패턴
"""

import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException

from ..database import SessionLocal
from ..models import Trip, WebhookLog
from ..services.audit import log_action

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "")


@router.post("/sweetbook")
async def handle_sweetbook_webhook(request: Request):
    body = await request.body()
    body_str = body.decode("utf-8")

    # 1. 서명 검증
    if WEBHOOK_SECRET:
        sig = request.headers.get("X-Webhook-Signature", "")
        ts = request.headers.get("X-Webhook-Timestamp", "")
        try:
            import sys
            sdk_path = os.getenv("BOOKPRINT_SDK_PATH", "bookprintapi-python-sdk")
            if sdk_path not in sys.path:
                sys.path.insert(0, sdk_path)
            from bookprintapi.webhook import verify_signature
            if not verify_signature(body, sig, ts, WEBHOOK_SECRET):
                raise HTTPException(401, "Invalid webhook signature")
        except ValueError as e:
            raise HTTPException(401, str(e))

    try:
        payload = json.loads(body_str)
    except json.JSONDecodeError:
        raise HTTPException(400, "Invalid JSON")

    event_id = payload.get("eventId") or payload.get("event_id") or ""
    event_type = payload.get("eventType") or payload.get("event_type") or "unknown"

    db = SessionLocal()
    try:
        # 2. Idempotency
        if event_id:
            existing = db.query(WebhookLog).filter(WebhookLog.event_id == event_id).first()
            if existing:
                return {"status": "already_processed", "event_id": event_id}

        log = WebhookLog(
            event_id=event_id or f"auto_{datetime.now(timezone.utc).isoformat()}",
            event_type=event_type,
            payload=body_str,
        )
        db.add(log)
        db.flush()

        # 3. 처리
        try:
            if event_type in ("order.status_changed", "order.shipped"):
                order_uid = payload.get("data", {}).get("orderUid", "")
                if order_uid:
                    trip = db.query(Trip).filter(Trip.sweetbook_order_uid == order_uid).first()
                    if trip:
                        log_action(db, f"webhook.{event_type}", "webhook",
                                   trip_id=trip.id, target=order_uid,
                                   detail=payload.get("data", {}))
            log.status = "processed"
            log.processed_at = datetime.now(timezone.utc)
        except Exception as e:
            log.status = "failed"
            log.error_message = str(e)
            log.retry_count += 1

        db.commit()
        return {"status": log.status, "event_id": event_id}
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Webhook error: {e}")
    finally:
        db.close()


@router.get("/logs")
def get_webhook_logs(limit: int = 50):
    db = SessionLocal()
    try:
        logs = db.query(WebhookLog).order_by(WebhookLog.created_at.desc()).limit(limit).all()
        return [{
            "id": l.id, "event_id": l.event_id, "event_type": l.event_type,
            "status": l.status, "error_message": l.error_message,
            "retry_count": l.retry_count,
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "processed_at": l.processed_at.isoformat() if l.processed_at else None,
        } for l in logs]
    finally:
        db.close()
```

- [ ] **Step 2: main.py에 webhook router 등록**

`from .routes import trips, pages, messages, books` 를 `from .routes import trips, pages, messages, books, webhooks` 로 변경.

`app.include_router(books.router)` 아래에 `app.include_router(webhooks.router)` 추가.

- [ ] **Step 3: Audit Log 조회 엔드포인트를 trips.py에 추가**

`backend/app/routes/trips.py`에 추가:

```python
from ..models import Trip, Zone, AuditLog
from ..schemas import TripCreate, TripAdminResponse, TripShareResponse, StatusUpdate, AuditLogResponse

@router.get("/{trip_id}/audit", response_model=list[AuditLogResponse])
def get_audit_log(
    trip_id: str,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    trip = get_trip_with_auth(trip_id, db, x_admin_token)
    logs = db.query(AuditLog).filter(AuditLog.trip_id == trip_id).order_by(AuditLog.created_at.desc()).limit(100).all()
    return logs
```

- [ ] **Step 4: 커밋**

```bash
git add backend/app/routes/webhooks.py backend/app/main.py backend/app/routes/trips.py
git commit -m "feat: add webhook endpoint + audit log query"
```

---

### Task 5: 프론트엔드 — 주문 상태 추적 UI + Audit 타임라인 + 수정시간

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/pages/TripAdmin.tsx`
- Modify: `frontend/src/pages/Contribute.tsx`

- [ ] **Step 1: api.ts에 getAuditLog 추가**

```typescript
export interface AuditEntry {
  id: string;
  trip_id: string | null;
  action: string;
  actor: string;
  target: string | null;
  detail: string | null;
  created_at: string;
}

export async function getAuditLog(
  tripId: string,
  adminToken: string,
): Promise<AuditEntry[]> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/audit`, {
    headers: adminHeaders(adminToken),
  });
  return handleResponse(res);
}
```

Message 인터페이스에 `updated_at: string | null;` 추가.

- [ ] **Step 2: TripAdmin.tsx 주문 탭에 상태 타임라인 추가**

주문 탭 (`tab === 'order'`) 내용을 교체. `finalized` 상태일 때:
- 주문 요약 카드 (Book UID, 사양: A4 소프트커버, 페이지 수)
- "주문하기" 버튼

`ordered` 상태일 때:
- 주문 상태 타임라인 바 (PAID → PDF_READY → CONFIRMED → IN_PRODUCTION → SHIPPED → DELIVERED)
- 현재 단계 강조 표시
- Audit log 타임라인 (최근 10건)

상태 타임라인 컴포넌트 (인라인):
```typescript
const ORDER_STEPS = [
  { code: 20, label: '결제 완료' },
  { code: 25, label: 'PDF 생성' },
  { code: 30, label: '제작 확정' },
  { code: 40, label: '인쇄 중' },
  { code: 50, label: '인쇄 완료' },
  { code: 60, label: '발송' },
  { code: 70, label: '배송 완료' },
];
```

- [ ] **Step 3: Contribute.tsx에 수정 시간 표시**

메시지에 `updated_at`이 있으면 "N분 전 수정" 표시:
```typescript
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  return `${hr}시간 전`;
}
```

오버레이 존 메시지 옆에 `updated_at`이 있으면 작은 글씨로 시간 표시.

- [ ] **Step 4: 프론트엔드 빌드**

```bash
cd frontend && npm run build && cd ..
```

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/lib/api.ts frontend/src/pages/TripAdmin.tsx frontend/src/pages/Contribute.tsx
git commit -m "feat: order status timeline + audit log UI + time ago display"
```

---

### Task 6: README API 플로우 다이어그램

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README에 플로우 다이어그램 + Webhook/Audit 설명 추가**

"사용한 API 목록" 섹션 앞에 "API 연동 플로우" 섹션 추가:

```
## API 연동 플로우

### 포토북 생성 → 주문 흐름

┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐
│ 사진 업로드 │───→│ Pillow   │───→│ photos.upload│───→│ covers   │
│ (주최자)   │    │ 텍스트합성 │    │ (Sweetbook)  │    │ .create  │
└──────────┘    └──────────┘    └──────────────┘    └────┬─────┘
                                                         │
                ┌──────────────┐    ┌──────────┐         │
                │ contents     │←───│ 내지 구성  │←────────┘
                │ .insert      │    │ (페이지별) │
                └──────┬───────┘    └──────────┘
                       │
                ┌──────▼───────┐    ┌──────────┐    ┌──────────┐
                │ finalize     │───→│ orders   │───→│ Webhook  │
                │ (책 확정)     │    │ .create  │    │ 상태 수신 │
                └──────────────┘    └──────────┘    └────┬─────┘
                                                         │
                                                    ┌────▼─────┐
                                                    │ AuditLog │
                                                    │ (DB 기록) │
                                                    └──────────┘
```

"기술 스택" 섹션에 Webhook, Audit Log 설명 추가.

- [ ] **Step 2: 커밋 + 푸시**

```bash
git add README.md
git commit -m "docs: add API flow diagram + webhook/audit description"
git push origin main
```

---

### Task 7: 시드 데이터 재생성 + 통합 테스트

**Files:**
- Modify: `backend/app/seed.py`

- [ ] **Step 1: seed.py가 새 모델과 호환되는지 확인**

DB 리셋 + 시드 실행:
```bash
rm -f tripbook.db tripbook.db-wal tripbook.db-shm
python -m backend.app.seed
```

- [ ] **Step 2: 서버 실행 + API 검증**

```bash
uvicorn backend.app.main:app --port 8000 &
sleep 2

# Audit log 확인 (시드에서 생성된 로그)
TRIP_ID=$(python -c "from backend.app.database import SessionLocal; from backend.app.models import Trip; db=SessionLocal(); t=db.query(Trip).first(); print(t.id); db.close()")
ADMIN_TOKEN=$(python -c "from backend.app.database import SessionLocal; from backend.app.models import Trip; db=SessionLocal(); t=db.query(Trip).first(); print(t.admin_token); db.close()")

curl -s http://localhost:8000/api/trips/$TRIP_ID/audit -H "X-Admin-Token: $ADMIN_TOKEN" | python -m json.tool

# Webhook 테스트 (서명 없이)
curl -s -X POST http://localhost:8000/api/webhooks/sweetbook \
  -H "Content-Type: application/json" \
  -d '{"eventId":"test-001","eventType":"order.status_changed","data":{"orderUid":"or_test","orderStatus":"SHIPPED"}}' | python -m json.tool

# Webhook 로그 확인
curl -s http://localhost:8000/api/webhooks/logs | python -m json.tool

# Idempotency 테스트 (같은 eventId로 재전송)
curl -s -X POST http://localhost:8000/api/webhooks/sweetbook \
  -H "Content-Type: application/json" \
  -d '{"eventId":"test-001","eventType":"order.status_changed","data":{}}' | python -m json.tool
# 기대: {"status": "already_processed"}
```

- [ ] **Step 3: 최종 커밋 + 푸시**

```bash
git add -A
git commit -m "feat: complete webhook + audit log + order UI + zone timeout"
git push origin main
```
