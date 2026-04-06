# TripBook 추가 기능 설계 — Webhook, Audit Log, 주문 UI, 존 타임아웃, 플로우 다이어그램

Date: 2026-04-06
Status: Approved

## 1. Webhook 연동

### 모델: WebhookLog
```
WebhookLog
├── id (PK, UUID)
├── event_id (UNIQUE — idempotency key)
├── event_type (string, e.g. "order.status_changed")
├── payload (TEXT — raw JSON)
├── status ("received" | "processed" | "failed")
├── error_message (TEXT, nullable)
├── retry_count (int, default 0)
├── created_at (datetime)
└── processed_at (datetime, nullable)
```

### 엔드포인트: POST /api/webhooks/sweetbook
1. Body + X-Webhook-Signature + X-Webhook-Timestamp 수신
2. WEBHOOK_SECRET 있으면 SDK `verify_signature()` 호출
3. event_id로 WebhookLog 조회 — 이미 있으면 `{"status": "already_processed"}` 반환
4. WebhookLog 생성 (status="received")
5. event_type별 처리:
   - `order.status_changed`: Trip.sweetbook_order_uid 매칭 → AuditLog 기록
   - `order.shipped`: AuditLog 기록
6. 성공 → status="processed", 실패 → status="failed" + error_message

### 조회: GET /api/webhooks/logs
- 디버깅/모니터링용. 최근 N건 반환.

## 2. Audit Log

### 모델: AuditLog
```
AuditLog
├── id (PK, UUID)
├── trip_id (FK, nullable)
├── action (string — "trip.create", "message.write", "book.finalize", etc.)
├── actor (string — "admin", participant name, "webhook")
├── target (string, nullable — page_id, zone_id, order_uid)
├── detail (TEXT — JSON)
└── created_at (datetime)
```

### 헬퍼: services/audit.py
```python
def log_action(db, action, actor, trip_id=None, target=None, detail=None):
    # AuditLog 생성 + db.flush() (commit은 caller)
```

### 기록 지점
- routes/trips.py: trip.create, trip.status_change
- routes/pages.py: page.upload, page.reorder
- routes/messages.py: message.write, message.update, message.delete
- routes/books.py: book.finalize, order.create
- routes/webhooks.py: webhook 수신 이벤트

### 조회: GET /api/trips/:id/audit
- admin_token 필요. 해당 trip의 전체 타임라인.

## 3. 주문 상태 추적 UI

### TripAdmin 주문 탭 고도화
- 주문 요약 카드: Book UID, 페이지 수, 사양(A4 소프트커버), 견적 금액
- 상태 타임라인 바: PAID → PDF_READY → CONFIRMED → IN_PRODUCTION → SHIPPED → DELIVERED
- 현재 단계 강조, 완료 단계 체크마크
- Sweetbook API 실시간 조회 (GET /api/trips/:id/order 활용)

### 프론트엔드
- `TripAdmin.tsx` 주문 탭 내에 OrderStatusTimeline 컴포넌트 인라인.
- api.ts에 getAuditLog() 추가.

## 4. API 플로우 다이어그램

README.md에 추가:
```
[사진 업로드] → [Pillow 합성] → [photos.upload] → [covers.create] → [contents.insert]
                                                                          ↓
                                                                    [finalize]
                                                                          ↓
                                                                    [orders.create]
                                                                          ↓
                                                                  [Webhook 수신] → [AuditLog]
```

## 5. 존 선점 타임아웃

### 로직
- `POST /api/zones/:id/message` 에서 선점 체크 시:
  - claimed_by가 있고 + message가 없고 + claimed_at이 10분 이상 경과 → 자동 해제
- Message 모델에 `updated_at` 필드 추가 (수정 시 갱신)

### UI
- Contribute.tsx: 메시지 옆에 "N분 전" 표시
- 10분 타임아웃 안내 문구

## 파일 변경 목록

| 파일 | 변경 내용 |
|------|---------|
| models.py | WebhookLog, AuditLog 추가 + Message.updated_at |
| services/audit.py | 신규 — log_action 헬퍼 |
| routes/webhooks.py | 신규 — webhook 수신 + 로그 조회 |
| routes/trips.py | audit log 호출 추가 |
| routes/messages.py | audit log + 타임아웃 체크 + updated_at |
| routes/books.py | audit log 추가 |
| routes/pages.py | audit log 추가 |
| main.py | webhook router 등록 |
| schemas.py | AuditLogResponse 추가 |
| TripAdmin.tsx | 주문 타임라인 + audit 로그 UI |
| Contribute.tsx | 수정 시간 표시 |
| api.ts | getAuditLog, getWebhookLogs 추가 |
| README.md | 플로우 다이어그램 + Webhook 설명 |
