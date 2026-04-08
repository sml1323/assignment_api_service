# Sweetbook Book Print API 워크플로우 매핑

CeleBook 코드베이스에서 Sweetbook Book Print API 9단계 워크플로우가 어떻게 구현되어 있는지 정리한 문서.

---

## 개요

| 항목 | 값 |
|------|-----|
| 판형 | `PHOTOBOOK_A4_SC` (A4 소프트커버, 210x297mm, 24-130 페이지) |
| 패턴 | **시나리오 B — 서버 자동 생성** (템플릿 하드코딩, 사용자 편집 UI 없음) |
| SDK | `bookprintapi-python-sdk` (번들 포함, `BOOKPRINT_SDK_PATH` 환경변수로 경로 지정) |
| 이미지 처리 | Pillow로 오버레이 텍스트 + 하단 텍스트를 사진에 합성 후 업로드 |

### 사용 템플릿 UID

| 용도 | UID | 파라미터 |
|------|-----|----------|
| 표지 | `7CO28K1SttwL` | `coverPhoto`, `subtitle`, `dateRange` |
| 사진 내지 | `5ADDkCtrodEJ` | `dayLabel`, `photo` |
| Day 간지 (일기장) | `3mjKd8kcaVzT` | `monthNum`, `dayNum`, `diaryText` |
| 빈 내지 (패딩) | `5NxuQPBMyuTm` | 없음 |
| 월 헤더 (선언만) | `50f9kmXxelPG` | `monthYearLabel` (현재 미사용) |
| 날짜 갤러리 (선언만) | `4UJiQc6ZJzvX` | `monthYearLabel`, `photos[]` (현재 미사용) |

---

## Step 1. 판형 조회 (GET /book-specs)

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /book-specs` |
| CeleBook 구현 | 동적 조회 없음 - **하드코딩** |
| 코드 위치 | `backend/app/services/sweetbook.py:22` |
| SDK 메서드 | 해당 없음 (SDK에 book-specs 클라이언트 없음) |

### 구현 상세

판형을 API로 조회하지 않고 상수로 고정:

```python
BOOK_SPEC = "PHOTOBOOK_A4_SC"
```

### 설계 결정

- A4 소프트커버 단일 상품만 지원하므로 런타임 조회 불필요
- SDK에도 `BookSpecsClient`가 존재하지 않아, API 문서 기반으로 UID를 확인한 후 하드코딩

---

## Step 2. 템플릿 조회 (GET /templates)

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `GET /templates` |
| CeleBook 구현 | 동적 조회 없음 - **하드코딩** |
| 코드 위치 | `backend/app/services/sweetbook.py:23-28` |
| SDK 메서드 | 해당 없음 (SDK에 templates 클라이언트 없음) |

### 구현 상세

Sandbox API를 통해 사전 확인한 템플릿 UID 6개를 상수로 선언:

```python
COVER_TEMPLATE = "7CO28K1SttwL"          # 표지
CONTENT_PHOTO_TEMPLATE = "5ADDkCtrodEJ"  # 사진 내지
CONTENT_B_TEMPLATE = "3mjKd8kcaVzT"      # Day 간지 (일기장)
BLANK_TEMPLATE = "5NxuQPBMyuTm"          # 빈 내지 (패딩)
MONTH_HEADER_TEMPLATE = "50f9kmXxelPG"   # 월 헤더 (미사용)
CONTENT_DATE_TEMPLATE = "4UJiQc6ZJzvX"   # 날짜 갤러리 (미사용)
```

### 설계 결정

- 시나리오 B (서버 자동 생성) 패턴이므로 사용자가 템플릿을 선택하지 않음
- 템플릿은 Sandbox API 탐색 후 최적 조합을 결정하여 코드에 고정
- `MONTH_HEADER_TEMPLATE`과 `CONTENT_DATE_TEMPLATE`은 선언만 되어 있고 `build_tripbook`에서 사용하지 않음

---

## Step 3. 책 생성 (POST /books)

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `POST /Books` |
| CeleBook 구현 | `build_tripbook()` 내부에서 호출 |
| 코드 위치 | `backend/app/services/sweetbook.py:75-79` |
| SDK 메서드 | `client.books.create()` |
| SDK 코드 | `bookprintapi-python-sdk/bookprintapi/books.py:29-44` |

### 구현 상세

```python
result = client.books.create(
    book_spec_uid=BOOK_SPEC,       # "PHOTOBOOK_A4_SC"
    title=trip.title,               # Trip 모델의 제목
    creation_type="TEST",           # Sandbox 테스트 모드
)
book_uid = result["data"]["bookUid"]
```

### 설계 결정

- `creation_type="TEST"` 고정 (Sandbox 환경 전용, 프로덕션 전환 시 `"NORMAL"`로 변경 필요)
- `external_ref` 미사용 (Trip ID를 외부 참조로 연결하지 않음)
- 반환된 `bookUid`를 이후 모든 API 호출의 식별자로 사용

### 호출 시점

`POST /api/trips/{trip_id}/finalize` 엔드포인트에서 호출 (`backend/app/routes/books.py:31-119`).
여행 상태가 `collecting`일 때만 실행 가능.

---

## Step 4. 사진 업로드 (POST /books/{id}/photos)

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `POST /Books/{bookUid}/photos` |
| CeleBook 구현 | `build_tripbook()` 내부에서 루프 호출 |
| 코드 위치 | `backend/app/services/sweetbook.py:83-86` |
| SDK 메서드 | `client.photos.upload()` |
| SDK 코드 | `bookprintapi-python-sdk/bookprintapi/photos.py:19-30` |

### 구현 상세

```python
for page_id, (page, composite_path, _) in pages_with_messages.items():
    upload_result = client.photos.upload(book_uid, composite_path)
    photo_names[page_id] = upload_result["data"]["fileName"]
```

### Pillow 합성 파이프라인 (업로드 전처리)

사진 업로드 전에 Pillow로 텍스트를 합성한 이미지를 생성한다.
합성은 `backend/app/routes/books.py:63-98`에서 수행.

| 처리 단계 | 코드 위치 | 설명 |
|-----------|----------|------|
| 오버레이 존 수집 | `books.py:69-78` | Zone 1-2의 메시지를 `overlay_texts` 리스트로 수집 |
| 하단 존 수집 | `books.py:92-96` | Zone 3-4의 메시지를 `bottom_text` 문자열로 결합 |
| Pillow 합성 | `image.py:101-181` | `compose_photo_with_bottom_text()` 호출 |
| 오버레이 렌더링 | `image.py:125-142` | 사진 위에 그림자 + 텍스트 (위치/색상 지정) |
| 하단 영역 추가 | `image.py:145-179` | 사진 아래 흰색 영역 확장 + 텍스트 렌더링 |
| 저장 | `image.py:184-194` | `composite_{uuid}.jpg`로 저장 (quality=90) |

### 이미지 사전 처리 (`image.py:17-48`)

- 최대 파일 크기: 10MB
- 지원 형식: JPG, PNG, WebP
- 최대 해상도: 2400px (A4 인쇄 품질 고려)
- EXIF 자동 회전, RGBA/P 모드를 RGB로 변환

### 설계 결정

- 순차 업로드 (병렬 아님) - `upload_multiple()` SDK 메서드가 있으나 미사용
- 합성된 이미지를 업로드하므로 Sweetbook 측에서는 일반 사진으로 인식
- 표지용 사진도 동일한 업로드 경로 사용 (`sweetbook.py:91`)

---

## Step 5. 표지 추가 (POST /books/{id}/cover)

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `POST /Books/{bookUid}/cover` |
| CeleBook 구현 | `build_tripbook()` 내부에서 호출 |
| 코드 위치 | `backend/app/services/sweetbook.py:89-111` |
| SDK 메서드 | `client.covers.create()` |
| SDK 코드 | `bookprintapi-python-sdk/bookprintapi/covers.py:19-46` |

### 구현 상세

```python
client.covers.create(
    book_uid,
    template_uid=COVER_TEMPLATE,        # "7CO28K1SttwL"
    parameters={
        "coverPhoto": cover_photo_name,  # 업로드된 사진 fileName
        "subtitle": trip.destination or "",
        "dateRange": date_range,          # "2026-04-01 - 2026-04-05" 형식
    },
)
```

### 표지 사진 선택 로직

1. `trip.cover_image`가 존재하면 해당 이미지를 업로드하여 사용 (`sweetbook.py:89-91`)
2. 없으면 첫 번째 Day의 첫 번째 사진을 폴백으로 사용 (`sweetbook.py:94-99`)

### 파라미터 매핑

| 템플릿 파라미터 | 데이터 소스 | 예시 |
|----------------|-----------|------|
| `coverPhoto` | 업로드된 사진의 `fileName` | `"abc123.jpg"` |
| `subtitle` | `trip.destination` | `"제주도"` |
| `dateRange` | `trip.start_date` + `trip.end_date` | `"2026-04-01 - 2026-04-05"` |

### 설계 결정

- `files` 파라미터(직접 파일 업로드) 미사용 -- Step 4에서 미리 업로드한 `fileName`을 참조
- SDK의 `covers.create()`는 multipart form으로 전송 (JSON이 아님)

---

## Step 6. 내지 추가 (POST /books/{id}/contents)

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `POST /Books/{bookUid}/contents` |
| CeleBook 구현 | `build_tripbook()` 내부에서 Day별 루프 호출 |
| 코드 위치 | `backend/app/services/sweetbook.py:116-171` |
| SDK 메서드 | `client.contents.insert()` |
| SDK 코드 | `bookprintapi-python-sdk/bookprintapi/contents.py:19-54` |

### 페이지 구성 순서

Day 기반 앨범 구조로, 사진이 있는 Day만 순회:

```
[Day 1 간지] → [Day 1 사진 1] → [Day 1 사진 2] → ...
[Day 2 간지] → [Day 2 사진 1] → ...
[빈 페이지 패딩] → ...
```

### 6a. Day 간지 페이지 (`sweetbook.py:122-138`)

```python
client.contents.insert(
    book_uid,
    template_uid=CONTENT_B_TEMPLATE,    # "3mjKd8kcaVzT" (일기장 템플릿)
    parameters={
        "monthNum": month_num,           # "04"
        "dayNum": day_num,               # "08"
        "diaryText": day.description or day.title or f"Day {day.day_number}",
    },
    break_before="page",
)
```

| 템플릿 파라미터 | 데이터 소스 | 예시 |
|----------------|-----------|------|
| `monthNum` | `day.date` 파싱 (MM) | `"04"` |
| `dayNum` | `day.date` 파싱 (DD) | `"08"` |
| `diaryText` | `day.description` > `day.title` > `f"Day {N}"` (폴백 체인) | `"한라산 등반"` |

### 6b. 사진 페이지 (`sweetbook.py:142-158`)

```python
client.contents.insert(
    book_uid,
    template_uid=CONTENT_PHOTO_TEMPLATE,  # "5ADDkCtrodEJ"
    parameters={
        "dayLabel": page.subtitle or day.title or f"Day {day.day_number}",
        "photo": photo_name,               # 업로드된 사진 fileName
    },
    break_before="page",
)
```

| 템플릿 파라미터 | 데이터 소스 | 예시 |
|----------------|-----------|------|
| `dayLabel` | `page.subtitle` > `day.title` > `f"Day {N}"` (폴백 체인) | `"성산일출봉"` |
| `photo` | Step 4에서 업로드한 `fileName` | `"composite_abc123.jpg"` |

### 6c. 하단 텍스트 처리 (`sweetbook.py:160`)

하단 존 텍스트(Zone 3-4)는 별도 페이지로 삽입하지 않는다.
Pillow에서 사진 하단에 합성되므로 (`compose_photo_with_bottom_text`) 추가 API 호출 불필요.

### 6d. 패딩 (`sweetbook.py:162-171`)

```python
target = max(MIN_PAGES, page_count + (page_count % 2))
while page_count < target:
    client.contents.insert(
        book_uid,
        template_uid=BLANK_TEMPLATE,     # "5NxuQPBMyuTm"
        parameters={},
        break_before="page",
    )
    page_count += 1
```

**패딩 공식**: `target = max(24, page_count + (page_count % 2))`

- 최소 24페이지 보장 (`PHOTOBOOK_A4_SC` 규격 요구사항)
- 홀수 페이지일 경우 +1로 짝수 맞춤

### 설계 결정

- 모든 내지에 `break_before="page"` 적용 (각 콘텐츠가 새 페이지에서 시작)
- `files` 파라미터 미사용 (사전 업로드된 `fileName` 참조)
- 사진 없는 Day는 간지 삽입 자체를 건너뜀 (`sweetbook.py:119`)
- `MONTH_HEADER_TEMPLATE`과 `CONTENT_DATE_TEMPLATE`은 코드에 선언만 있고 실제 삽입에 사용하지 않음

---

## Step 7. 최종화 (POST /books/{id}/finalization)

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `POST /Books/{bookUid}/finalization` |
| CeleBook 구현 | `build_tripbook()` 마지막 단계 |
| 코드 위치 | `backend/app/services/sweetbook.py:174` |
| SDK 메서드 | `client.books.finalize()` |
| SDK 코드 | `bookprintapi-python-sdk/bookprintapi/books.py:50-52` |

### 구현 상세

```python
client.books.finalize(book_uid)
```

### 호출 후 처리 (`books.py:110-113`)

```python
trip.sweetbook_book_uid = result["book_uid"]
trip.status = "finalized"
log_action(db, "book.finalize", ...)
db.commit()
```

### 설계 결정

- 최종화 후 내용 수정 불가 (Sweetbook API 제약)
- Trip 상태를 `collecting` -> `finalized`로 변경
- 감사 로그에 `book_uid`와 `page_count` 기록

---

## Step 8. 주문 생성 (POST /orders + estimate)

| 항목 | 내용 |
|------|------|
| API 엔드포인트 (견적) | `POST /orders/estimate` |
| API 엔드포인트 (주문) | `POST /orders` |
| CeleBook 구현 | 별도 엔드포인트로 분리 |
| 코드 위치 (견적) | `backend/app/routes/books.py:122-142`, `backend/app/services/sweetbook.py:179-181` |
| 코드 위치 (주문) | `backend/app/routes/books.py:145-192`, `backend/app/services/sweetbook.py:184-189` |
| SDK 메서드 | `client.orders.estimate()`, `client.orders.create()` |
| SDK 코드 | `bookprintapi-python-sdk/bookprintapi/orders.py:16-36` |

### 8a. 견적 조회 (`GET /api/trips/{trip_id}/estimate`)

```python
def estimate_order(book_uid: str, quantity: int = 1) -> dict:
    client = get_client()
    return client.orders.estimate([{"bookUid": book_uid, "quantity": quantity}])
```

- `finalized` 또는 `ordered` 상태에서만 조회 가능
- 충전금 차감 없음

### 8b. 주문 생성 (`POST /api/trips/{trip_id}/order`)

```python
def create_order(book_uid: str, shipping: dict, quantity: int = 1) -> dict:
    client = get_client()
    return client.orders.create(
        items=[{"bookUid": book_uid, "quantity": quantity}],
        shipping=shipping,
    )
```

**주문 흐름**:
1. 견적 조회 (`estimate_order`) -- 예상 금액 확인
2. 주문 생성 (`create_order`) -- 충전금 즉시 차감
3. 402 에러 시 Sandbox 자동 충전 후 재시도 (`books.py:169-176`)

### Sandbox 자동 충전 로직 (`books.py:169-176`)

```python
if e.status_code == 402:
    needed = estimate.get("data", {}).get("paidCreditAmount", 100000)
    client = get_client()
    client.credits.sandbox_charge(needed + 50000, memo="자동 충전 (잔액 부족)")
    result = create_order(...)
```

- 필요 금액 + 50,000원 여유분을 자동 충전
- Sandbox 환경 전용 (프로덕션에서는 사전 충전 필요)

### 부가 기능

| 기능 | 엔드포인트 | 코드 위치 | SDK 메서드 |
|------|-----------|----------|-----------|
| 주문 상태 조회 | `GET /api/trips/{trip_id}/order` | `books.py:195-208` | `client.orders.get()` |
| 주문 취소 | `POST /api/trips/{trip_id}/order/cancel` | `books.py:211-241` | `client.orders.cancel()` |
| 배송지 변경 | `PUT /api/trips/{trip_id}/order/shipping` | `books.py:244-276` | `client.orders.update_shipping()` |

### 주문 취소 조건

- `orderStatus` 20 (PAID) 또는 25 (PDF_READY)일 때만 취소 가능
- 취소 시 Trip 상태를 `finalized`로 복원, `sweetbook_order_uid`를 `None`으로 초기화

### 설계 결정

- 견적과 주문을 별도 API 엔드포인트로 분리 (프론트엔드에서 가격 확인 후 주문 진행)
- `external_ref` 미사용
- 배송지 변경은 `orderStatus` 40 (IN_PRODUCTION) 미만에서만 가능

---

## Step 9. 웹훅 연동 (Webhook)

| 항목 | 내용 |
|------|------|
| API 엔드포인트 | `POST /api/webhooks/sweetbook` (수신용) |
| CeleBook 구현 | FastAPI 라우트로 수신 + 로그 저장 |
| 코드 위치 | `backend/app/routes/webhooks.py:21-84` |
| SDK 메서드 | `bookprintapi.webhook.verify_signature()` |
| SDK 코드 | `bookprintapi-python-sdk/bookprintapi/webhook.py:11-87` |

### 서명 검증 (`webhooks.py:26-37`)

```python
from bookprintapi.webhook import verify_signature

sig = request.headers.get("X-Webhook-Signature", "")
ts = request.headers.get("X-Webhook-Timestamp", "")
if not verify_signature(body, sig, ts, WEBHOOK_SECRET):
    raise HTTPException(401, "Invalid webhook signature")
```

- HMAC-SHA256 서명 검증 (`"{timestamp}.{payload}"` 형식)
- `WEBHOOK_SECRET` 환경변수 설정 시에만 검증 활성화
- 타임스탬프 허용 오차: 300초 (5분)

### 멱등성 처리 (`webhooks.py:49-52`)

```python
if event_id:
    existing = db.query(WebhookLog).filter(WebhookLog.event_id == event_id).first()
    if existing:
        return {"status": "already_processed", "event_id": event_id}
```

- `eventId` 기반 중복 처리 방지
- `WebhookLog` 모델에 기록

### 이벤트 처리 (`webhooks.py:62-70`)

처리 대상 이벤트 타입:
- `order.status_changed` -- 주문 상태 변경
- `order.shipped` -- 발송 완료

처리 내용:
- `orderUid`로 해당 Trip 조회 (`Trip.sweetbook_order_uid` 매칭)
- 감사 로그에 이벤트 기록 (`log_action`)

### DLQ 패턴 (`webhooks.py:73-76`)

- 처리 실패 시 `WebhookLog.status = "failed"`, `error_message` 기록
- `retry_count` 증가 (재처리 대비)

### 로그 조회 (`webhooks.py:87-99`)

- `GET /api/webhooks/logs` -- 최근 웹훅 로그 50건 조회

### 설계 결정

- Trip 상태를 웹훅에서 자동 변경하지 않음 (감사 로그만 기록)
- `WEBHOOK_SECRET` 미설정 시 서명 검증 건너뜀 (개발 편의)
- `SessionLocal()` 직접 사용 (FastAPI의 `Depends(get_db)` 대신 수동 세션 관리)

---

## 충전금 관리 (보조)

| 항목 | 내용 |
|------|------|
| 코드 위치 | `backend/app/routes/credits.py`, `backend/app/services/sweetbook.py:221-228` |
| 엔드포인트 | `/api/credits/balance`, `/api/credits/transactions`, `/api/credits/sandbox-charge` |

주문 플로우의 전제 조건으로, 충전금 잔액/거래내역 조회 및 Sandbox 충전 기능 제공.

---

## 전체 흐름 요약

```
[프론트엔드: 확정 버튼 클릭]
        │
        ▼
POST /api/trips/{id}/finalize  (books.py:31)
        │
        ├── 1. Pillow 합성 (image.py)
        │     오버레이 존(1-2) + 하단 존(3-4) → 사진에 베이크
        │
        ├── 2. build_tripbook() (sweetbook.py:54)
        │     ├── Step 3: client.books.create()        → book_uid 획득
        │     ├── Step 4: client.photos.upload() x N   → fileName 수집
        │     ├── Step 5: client.covers.create()       → 표지 설정
        │     ├── Step 6a: contents.insert() Day 간지  → CONTENT_B_TEMPLATE
        │     ├── Step 6b: contents.insert() 사진      → CONTENT_PHOTO_TEMPLATE
        │     ├── Step 6d: contents.insert() 패딩      → BLANK_TEMPLATE
        │     └── Step 7: client.books.finalize()      → 확정
        │
        └── 3. Trip 상태 → "finalized", book_uid 저장

[프론트엔드: 주문 버튼 클릭]
        │
        ├── GET /api/trips/{id}/estimate  (books.py:122)
        │     └── Step 8a: client.orders.estimate()
        │
        └── POST /api/trips/{id}/order  (books.py:145)
              └── Step 8b: client.orders.create()
                    (402 시 sandbox_charge 후 재시도)

[Sweetbook 서버 → CeleBook]
        │
        └── POST /api/webhooks/sweetbook  (webhooks.py:21)
              └── Step 9: 서명 검증 → 멱등성 체크 → 로그 기록
```

---

## 주의사항 및 프로덕션 전환 체크리스트

| 항목 | 현재 상태 | 프로덕션 전환 시 |
|------|----------|----------------|
| `creation_type` | `"TEST"` | `"NORMAL"`로 변경 |
| `BOOKPRINT_ENV` | `sandbox` | `live`로 변경 |
| Sandbox 자동 충전 | 활성화 | 제거 또는 비활성화 |
| `WEBHOOK_SECRET` | 선택적 | 필수 설정 |
| 이미지 해상도 | 2400px | A4 인쇄 기준 충분 (300dpi 기준 약 2480px) |
| `external_ref` | 미사용 | Trip ID 연결 권장 |
