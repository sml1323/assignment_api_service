# Complete Order Flow Design

> BookPrintAPI SDK의 미구현 기능들을 전부 통합하여 완전한 주문 플로우를 구현한다.

## 배경

현재 celebook 프로젝트는 주문 생성(`POST /order`)과 상태 조회(`GET /order`)만 구현되어 있다.
SDK에서 제공하는 충전금 조회, 주문 취소, 배송지 변경, 견적 조회 등이 백엔드/프론트엔드에 연동되지 않았다.

## 범위

### 추가할 백엔드 API (5개)

| 메서드 | 엔드포인트 | 설명 |
|--------|-----------|------|
| GET | `/api/trips/{trip_id}/estimate` | 견적 조회 (가격 확인) |
| GET | `/api/credits/balance` | 충전금 잔액 조회 |
| GET | `/api/credits/transactions` | 충전금 거래 내역 |
| POST | `/api/trips/{trip_id}/order/cancel` | 주문 취소 |
| PUT | `/api/trips/{trip_id}/order/shipping` | 배송지 변경 |

### 기존 API 개선

- `POST /api/trips/{trip_id}/order`: ApiError 캐치 강화 (402 충전금 부족, 400 검증 실패)

### 프론트엔드

기존 `OrderPage.tsx`를 확장하여 통합 주문 페이지로 리팩토링.

## Pydantic 스키마 추가 (schemas.py)

기존 프로젝트가 Pydantic BaseModel 기반이므로 동일 패턴으로 추가:

```python
# --- Estimate ---
class EstimateItem(BaseModel):
    bookUid: str
    title: str
    pageCount: int
    quantity: int
    unitPrice: int

class EstimateResponse(BaseModel):
    items: list[EstimateItem]
    productAmount: int
    shippingFee: int
    totalAmount: int
    paidCreditAmount: int
    creditBalance: int
    creditSufficient: bool

# --- Credits ---
class CreditBalanceResponse(BaseModel):
    balance: int
    currency: str
    env: str

# --- Order Cancel ---
class OrderCancelRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500)

# --- Shipping Update ---
class ShippingUpdate(BaseModel):
    recipientName: str | None = None
    recipientPhone: str | None = None
    postalCode: str | None = None
    address1: str | None = None
    address2: str | None = None
    memo: str | None = None
```

## 백엔드 API 상세

### GET /api/trips/{trip_id}/estimate

Trip의 `sweetbook_book_uid`로 `client.orders.estimate()` 호출.

**요청**: query param `quantity` (기본값 1)

**응답**:
```json
{
  "items": [{"bookUid": "bk_xxx", "title": "...", "pageCount": 26, "quantity": 1, "unitPrice": 20300}],
  "productAmount": 20300,
  "shippingFee": 3000,
  "totalAmount": 23300,
  "paidCreditAmount": 25630,
  "creditBalance": 401000,
  "creditSufficient": true
}
```

**에러**: 404 (Trip 없음 또는 finalized 아님)

### GET /api/credits/balance

`client.credits.get_balance()` 호출.

**응답**:
```json
{
  "balance": 401000,
  "currency": "KRW",
  "env": "sandbox"
}
```

### GET /api/credits/transactions

`client.credits.get_transactions()` 호출.

**요청**: query params `limit` (기본 20), `offset` (기본 0)

**응답**: SDK 응답 그대로 전달

### POST /api/trips/{trip_id}/order/cancel

**요청**:
```json
{
  "reason": "주문 취소합니다"
}
```

**프로세스**:
1. Trip 조회 + sweetbook_order_uid 검증
2. `client.orders.get()`으로 현재 상태 확인
3. PAID(20) 또는 PDF_READY(25)가 아니면 409 반환
4. `client.orders.cancel(order_uid, reason)` 호출
5. Trip.status를 `finalized`로 롤백
6. Trip.sweetbook_order_uid를 null로 클리어
7. AuditLog 기록 + 카카오톡 알림

**에러**: 409 (취소 불가 상태)

### PUT /api/trips/{trip_id}/order/shipping

**요청** (변경할 필드만):
```json
{
  "recipientName": "홍길동",
  "recipientPhone": "010-9999-8888",
  "postalCode": "06100",
  "address1": "서울특별시...",
  "address2": "5층",
  "memo": "문 앞"
}
```

**프로세스**:
1. Trip 조회 + sweetbook_order_uid 검증
2. `client.orders.get()`으로 현재 상태 확인
3. IN_PRODUCTION(40) 이상이면 409 반환
4. `client.orders.update_shipping(order_uid, **fields)` 호출
5. AuditLog 기록

**에러**: 409 (변경 불가 상태)

### 기존 POST /api/trips/{trip_id}/order 개선

에러 처리 추가:
```python
try:
    result = create_order(book_uid, shipping, quantity)
except ApiError as e:
    if e.status_code == 402:
        raise HTTPException(402, detail="충전금이 부족합니다")
    elif e.status_code == 400:
        raise HTTPException(400, detail=e.details)
    raise HTTPException(500, detail="주문 처리 중 오류가 발생했습니다")
```

## 프론트엔드 상세

### OrderPage 상태 분기

```
if trip.status === "finalized"  → 주문 전 뷰
if trip.status === "ordered"    → 주문 후 뷰
else                            → 리다이렉트 (아직 finalize 안 됨)
```

### 주문 전 뷰 (PreOrderView)

**구성**:
1. **EstimateSection**: 포토북 정보 + 견적 (상품금액, 배송비, VAT, 결제금액)
2. **ShippingForm**: 배송 정보 입력 (받는 사람, 연락처, 우편번호, 주소, 상세주소, 메모)
3. **CreditBalance**: 충전금 잔액 + 결제 후 예상 잔액 + 부족 시 경고
4. **주문 버튼**: 잔액 충분할 때만 활성

**데이터 로딩**: 페이지 진입 시 estimate + balance 병렬 요청

### 주문 후 뷰 (PostOrderView)

**구성**:
1. **주문 완료 헤더**: 주문번호 + 결제금액
2. **OrderTimeline**: 주문 상태 타임라인 (PAID → ... → DELIVERED)
3. **배송 정보 표시**: 현재 배송 정보 + [배송지 변경] 버튼 (발송 전만)
4. **CreditBalance**: 현재 잔액
5. **OrderActions**: [주문 취소] 버튼 (PAID/PDF_READY만)

**배송지 변경**: 버튼 클릭 시 ShippingForm이 수정 모드로 전환

**주문 취소**: confirm 다이얼로그 → 취소 → finalized 상태로 돌아감 (PreOrderView)

### 컴포넌트 구조

```
frontend/src/pages/OrderPage.tsx          (메인 - 상태 분기)
frontend/src/components/order/
  ├── EstimateSection.tsx                  (견적 표시)
  ├── ShippingForm.tsx                     (배송 정보 입력/수정)
  ├── CreditBalance.tsx                    (충전금 잔액)
  ├── OrderTimeline.tsx                    (상태 타임라인)
  └── OrderActions.tsx                     (취소/변경 버튼)
```

### API 함수 추가 (api.ts)

```typescript
getEstimate(tripId: number, quantity?: number): Promise<EstimateResponse>
getCreditBalance(): Promise<CreditBalanceResponse>
getCreditTransactions(limit?: number, offset?: number): Promise<TransactionsResponse>
cancelOrder(tripId: number, reason: string): Promise<void>
updateShipping(tripId: number, shipping: Partial<ShippingInfo>): Promise<void>
```

## Trip 상태 전이

```
finalized ──(POST /order)──→ ordered
ordered   ──(POST /order/cancel)──→ finalized  (충전금 자동 반환)
ordered   ──(webhook)──→ ordered (주문 내부 상태만 변경)
```

## 에러 처리 전략

| 상황 | HTTP 코드 | 사용자 메시지 |
|------|----------|-------------|
| 충전금 부족 | 402 | "충전금이 부족합니다. 충전 후 다시 시도해주세요." |
| 취소 불가 상태 | 409 | "현재 상태에서는 취소할 수 없습니다." |
| 배송지 변경 불가 | 409 | "발송 후에는 변경할 수 없습니다." |
| Trip 미발견 | 404 | "여행을 찾을 수 없습니다." |
| 주문 미존재 | 404 | "주문 정보가 없습니다." |
| API 오류 | 500 | "일시적 오류가 발생했습니다. 다시 시도해주세요." |
