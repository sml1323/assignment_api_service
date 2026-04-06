# Complete Order Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BookPrintAPI SDK의 미사용 기능(충전금 조회, 견적, 주문 취소, 배송지 변경)을 백엔드 API + 프론트엔드 통합 주문 페이지로 완전히 구현한다.

**Architecture:** 백엔드는 기존 FastAPI 패턴(router + service + Pydantic schema)을 따라 5개 엔드포인트를 추가한다. 프론트엔드는 기존 OrderPage.tsx를 주문 전/후 상태 분기로 리팩토링하고, 5개 하위 컴포넌트로 분리한다.

**Tech Stack:** FastAPI, Pydantic, bookprintapi SDK, React 19, TypeScript, Tailwind CSS

---

## File Map

### Backend (수정)
- `backend/app/services/sweetbook.py` — SDK 서비스 함수 4개 추가 (cancel_order, update_order_shipping, get_balance, get_transactions)
- `backend/app/schemas.py` — Pydantic 스키마 6개 추가
- `backend/app/routes/books.py` — 주문 라우트 3개 추가 (estimate, cancel, shipping) + 기존 order 에러 처리 개선

### Backend (생성)
- `backend/app/routes/credits.py` — 충전금 라우터 (balance, transactions)

### Frontend (수정)
- `frontend/src/lib/api.ts` — API 함수 5개 + 타입 3개 추가
- `frontend/src/pages/OrderPage.tsx` — 전체 리팩토링 (Pre/Post order 분기)

### Frontend (생성)
- `frontend/src/components/order/EstimateSection.tsx` — 견적 표시
- `frontend/src/components/order/ShippingForm.tsx` — 배송 정보 입력/수정
- `frontend/src/components/order/CreditBalance.tsx` — 충전금 잔액
- `frontend/src/components/order/OrderTimeline.tsx` — 주문 상태 타임라인
- `frontend/src/components/order/OrderActions.tsx` — 취소/배송지변경 버튼

---

### Task 1: Backend 서비스 함수 추가

**Files:**
- Modify: `backend/app/services/sweetbook.py`

- [ ] **Step 1: sweetbook.py에 4개 서비스 함수 추가**

파일 끝(`get_order` 함수 뒤)에 다음 코드 추가:

```python
def cancel_order(order_uid: str, reason: str) -> dict:
    client = get_client()
    return client.orders.cancel(order_uid, reason)


def update_order_shipping(order_uid: str, fields: dict) -> dict:
    """배송지 변경. fields는 camelCase dict (ShippingUpdate.model_dump(exclude_none=True))"""
    client = get_client()
    # SDK는 snake_case kwargs → camelCase 변환을 내부 처리
    key_map = {
        "recipientName": "recipient_name",
        "recipientPhone": "recipient_phone",
        "postalCode": "postal_code",
        "address1": "address1",
        "address2": "address2",
        "memo": "shipping_memo",
    }
    kwargs = {}
    for camel, snake in key_map.items():
        if camel in fields:
            kwargs[snake] = fields[camel]
    return client.orders.update_shipping(order_uid, **kwargs)


def get_balance() -> dict:
    client = get_client()
    return client.credits.get_balance()


def get_transactions(limit: int = 20, offset: int = 0) -> dict:
    client = get_client()
    return client.credits.get_transactions(limit=limit, offset=offset)
```

- [ ] **Step 2: 커밋**

```bash
git add backend/app/services/sweetbook.py
git commit -m "feat: add cancel/shipping/credits service functions to sweetbook"
```

---

### Task 2: Pydantic 스키마 추가

**Files:**
- Modify: `backend/app/schemas.py`

- [ ] **Step 1: schemas.py 끝에 주문/충전금 스키마 추가**

`OrderCreate` 클래스 뒤에 추가:

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

- [ ] **Step 2: 커밋**

```bash
git add backend/app/schemas.py
git commit -m "feat: add Pydantic schemas for estimate, credits, cancel, shipping update"
```

---

### Task 3: Credits 라우터 생성

**Files:**
- Create: `backend/app/routes/credits.py`
- Modify: `backend/app/main.py` (라우터 등록)

- [ ] **Step 1: credits.py 라우터 생성**

```python
"""Credits routes — 충전금 잔액/거래내역 조회"""

from fastapi import APIRouter, Query
from bookprintapi import ApiError

from ..services.sweetbook import get_balance, get_transactions

router = APIRouter(prefix="/api/credits", tags=["credits"])


@router.get("/balance")
def credit_balance():
    """충전금 잔액 조회"""
    result = get_balance()
    return result.get("data", result)


@router.get("/transactions")
def credit_transactions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    """충전금 거래 내역 조회"""
    result = get_transactions(limit=limit, offset=offset)
    return result.get("data", result)
```

- [ ] **Step 2: main.py에 credits 라우터 등록**

`backend/app/main.py`에서 기존 라우터 등록 패턴을 따라 추가. 기존에 `from .routes.books import router as books_router` 같은 패턴이 있을 것이므로:

```python
from .routes.credits import router as credits_router
# ...
app.include_router(credits_router)
```

- [ ] **Step 3: 커밋**

```bash
git add backend/app/routes/credits.py backend/app/main.py
git commit -m "feat: add credits balance and transactions API endpoints"
```

---

### Task 4: 주문 라우트 추가 + 에러 처리 개선

**Files:**
- Modify: `backend/app/routes/books.py`

- [ ] **Step 1: imports 업데이트**

`books.py` 상단 imports를 업데이트:

```python
from fastapi import APIRouter, Depends, HTTPException, Header, Query
```

schemas import에 추가:

```python
from ..schemas import OrderCreate, OrderCancelRequest, ShippingUpdate
```

services import에 추가:

```python
from ..services.sweetbook import (
    build_tripbook, estimate_order, create_order, get_order,
    cancel_order, update_order_shipping,
)
from bookprintapi import ApiError
```

- [ ] **Step 2: GET /{trip_id}/estimate 엔드포인트 추가**

기존 `place_order` 함수 위에 추가:

```python
@router.get("/{trip_id}/estimate")
def get_estimate(
    trip_id: str,
    quantity: int = Query(1, ge=1),
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """견적 조회 (주문 전 가격 확인)"""
    trip = require_admin(trip_id, db, x_admin_token)

    if trip.status not in ("finalized", "ordered"):
        raise HTTPException(422, "finalized 또는 ordered 상태에서만 견적을 조회할 수 있습니다")

    if not trip.sweetbook_book_uid:
        raise HTTPException(422, "포토북이 아직 생성되지 않았습니다")

    try:
        result = estimate_order(trip.sweetbook_book_uid, quantity)
        return result.get("data", result)
    except ApiError as e:
        raise HTTPException(e.status_code or 500, detail=str(e))
```

- [ ] **Step 3: 기존 place_order 에러 처리 개선**

기존 `place_order` 함수의 `create_order` 호출 부분을 try/except로 감싸기:

```python
    # Create order
    shipping = body.shipping.model_dump()
    try:
        result = create_order(trip.sweetbook_book_uid, shipping, body.quantity)
    except ApiError as e:
        if e.status_code == 402:
            raise HTTPException(402, detail="충전금이 부족합니다. 충전 후 다시 시도해주세요.")
        elif e.status_code == 400:
            raise HTTPException(400, detail=e.details if e.details else str(e))
        raise HTTPException(500, detail="주문 처리 중 오류가 발생했습니다")
```

- [ ] **Step 4: POST /{trip_id}/order/cancel 엔드포인트 추가**

파일 끝(`get_order_status` 뒤)에 추가:

```python
@router.post("/{trip_id}/order/cancel")
def cancel_trip_order(
    trip_id: str,
    body: OrderCancelRequest,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """주문 취소 (PAID/PDF_READY 상태만)"""
    trip = require_admin(trip_id, db, x_admin_token)

    if not trip.sweetbook_order_uid:
        raise HTTPException(404, "주문 정보가 없습니다")

    # 현재 주문 상태 확인
    order_detail = get_order(trip.sweetbook_order_uid)
    order_status = order_detail.get("data", {}).get("orderStatus", 0)

    if order_status not in (20, 25):  # PAID, PDF_READY
        raise HTTPException(409, "현재 상태에서는 취소할 수 없습니다 (결제완료/PDF준비 상태만 취소 가능)")

    try:
        cancel_order(trip.sweetbook_order_uid, body.reason)
    except ApiError as e:
        raise HTTPException(e.status_code or 500, detail=str(e))

    trip.status = "finalized"
    trip.sweetbook_order_uid = None
    log_action(db, "order.cancel", "admin", trip_id=trip.id, detail={"reason": body.reason})
    db.commit()

    return {"status": "cancelled", "trip_status": "finalized"}
```

- [ ] **Step 5: PUT /{trip_id}/order/shipping 엔드포인트 추가**

```python
@router.put("/{trip_id}/order/shipping")
def update_trip_shipping(
    trip_id: str,
    body: ShippingUpdate,
    db: Session = Depends(get_db),
    x_admin_token: str = Header(...),
):
    """배송지 변경 (발송 전만 가능)"""
    trip = require_admin(trip_id, db, x_admin_token)

    if not trip.sweetbook_order_uid:
        raise HTTPException(404, "주문 정보가 없습니다")

    # 현재 주문 상태 확인
    order_detail = get_order(trip.sweetbook_order_uid)
    order_status = order_detail.get("data", {}).get("orderStatus", 0)

    if order_status >= 40:  # IN_PRODUCTION 이상
        raise HTTPException(409, "발송 후에는 배송지를 변경할 수 없습니다")

    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(422, "변경할 항목이 없습니다")

    try:
        result = update_order_shipping(trip.sweetbook_order_uid, fields)
    except ApiError as e:
        raise HTTPException(e.status_code or 500, detail=str(e))

    log_action(db, "order.shipping_update", "admin", trip_id=trip.id, detail=fields)
    db.commit()

    return {"status": "updated", "fields": list(fields.keys())}
```

- [ ] **Step 6: 커밋**

```bash
git add backend/app/routes/books.py
git commit -m "feat: add estimate, cancel, shipping update endpoints + improve error handling"
```

---

### Task 5: Frontend API 함수 + 타입 추가

**Files:**
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: 타입 추가**

`api.ts` 상단 Types 섹션에 추가:

```typescript
export interface EstimateItem {
  bookUid: string;
  title: string;
  pageCount: number;
  quantity: number;
  unitPrice: number;
}

export interface EstimateResponse {
  items: EstimateItem[];
  productAmount: number;
  shippingFee: number;
  totalAmount: number;
  paidCreditAmount: number;
  creditBalance: number;
  creditSufficient: boolean;
}

export interface CreditBalance {
  balance: number;
  currency: string;
  env: string;
}
```

- [ ] **Step 2: API 함수 추가**

`api.ts`의 `// --- Book / Order ---` 섹션 끝에 추가:

```typescript
export async function getEstimate(
  tripId: string,
  adminToken: string,
  quantity: number = 1,
): Promise<EstimateResponse> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/estimate?quantity=${quantity}`, {
    headers: adminHeaders(adminToken),
  });
  return handleResponse(res);
}

export async function getCreditBalance(adminToken: string): Promise<CreditBalance> {
  const res = await fetch(`${BASE}/api/credits/balance`, {
    headers: adminHeaders(adminToken),
  });
  return handleResponse(res);
}

export async function cancelOrder(
  tripId: string,
  adminToken: string,
  reason: string,
): Promise<{ status: string; trip_status: string }> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/order/cancel`, {
    method: 'POST',
    headers: { ...adminHeaders(adminToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  return handleResponse(res);
}

export async function updateShipping(
  tripId: string,
  adminToken: string,
  shipping: Partial<{
    recipientName: string;
    recipientPhone: string;
    postalCode: string;
    address1: string;
    address2: string;
    memo: string;
  }>,
): Promise<{ status: string; fields: string[] }> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/order/shipping`, {
    method: 'PUT',
    headers: { ...adminHeaders(adminToken), 'Content-Type': 'application/json' },
    body: JSON.stringify(shipping),
  });
  return handleResponse(res);
}
```

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add estimate, credits, cancel, shipping API functions"
```

---

### Task 6: Frontend 주문 컴포넌트 생성

**Files:**
- Create: `frontend/src/components/order/EstimateSection.tsx`
- Create: `frontend/src/components/order/ShippingForm.tsx`
- Create: `frontend/src/components/order/CreditBalance.tsx`
- Create: `frontend/src/components/order/OrderTimeline.tsx`
- Create: `frontend/src/components/order/OrderActions.tsx`

- [ ] **Step 1: EstimateSection.tsx 생성**

```tsx
import type { EstimateResponse } from '../../lib/api';

interface Props {
  estimate: EstimateResponse | null;
  loading: boolean;
}

export default function EstimateSection({ estimate, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-4" />
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded" />
          <div className="h-3 bg-gray-200 rounded" />
          <div className="h-3 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (!estimate) return null;

  const item = estimate.items[0];

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h2 className="text-sm font-medium text-gray-700 mb-4">견적</h2>

      {item && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-800">{item.title}</p>
          <p className="text-xs text-gray-500">{item.pageCount}p x {item.quantity}부</p>
        </div>
      )}

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">상품금액</span>
          <span className="text-gray-700">{estimate.productAmount.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">배송비</span>
          <span className="text-gray-700">{estimate.shippingFee.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">합계 (세전)</span>
          <span className="text-gray-700">{estimate.totalAmount.toLocaleString()}원</span>
        </div>
        <div className="border-t pt-2 flex justify-between font-medium">
          <span className="text-gray-800">결제금액 (VAT 포함)</span>
          <span className="text-purple-600">{estimate.paidCreditAmount.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ShippingForm.tsx 생성**

```tsx
import { useState } from 'react';

export interface ShippingData {
  recipientName: string;
  recipientPhone: string;
  postalCode: string;
  address1: string;
  address2: string;
  memo: string;
}

interface Props {
  initial?: Partial<ShippingData>;
  onSubmit: (data: ShippingData) => void;
  submitLabel?: string;
  loading?: boolean;
  disabled?: boolean;
}

export default function ShippingForm({ initial, onSubmit, submitLabel, loading, disabled }: Props) {
  const [form, setForm] = useState<ShippingData>({
    recipientName: initial?.recipientName || '',
    recipientPhone: initial?.recipientPhone || '',
    postalCode: initial?.postalCode || '',
    address1: initial?.address1 || '',
    address2: initial?.address2 || '',
    memo: initial?.memo || '',
  });

  const isValid = form.recipientName && form.recipientPhone && form.postalCode && form.address1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) onSubmit(form);
  };

  const inputClass =
    'w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-300 outline-none';

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
      <h2 className="text-sm font-medium text-gray-700">배송 정보</h2>

      <div>
        <label className="block text-sm text-gray-600 mb-1">받는 사람 *</label>
        <input
          type="text"
          value={form.recipientName}
          onChange={(e) => setForm({ ...form, recipientName: e.target.value })}
          placeholder="홍길동"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">연락처 *</label>
        <input
          type="tel"
          value={form.recipientPhone}
          onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })}
          placeholder="010-1234-5678"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">우편번호 *</label>
        <input
          type="text"
          value={form.postalCode}
          onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
          placeholder="06100"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">주소 *</label>
        <input
          type="text"
          value={form.address1}
          onChange={(e) => setForm({ ...form, address1: e.target.value })}
          placeholder="서울특별시 강남구 테헤란로 123"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">상세주소</label>
        <input
          type="text"
          value={form.address2}
          onChange={(e) => setForm({ ...form, address2: e.target.value })}
          placeholder="4층"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">배송 메모</label>
        <input
          type="text"
          value={form.memo}
          onChange={(e) => setForm({ ...form, memo: e.target.value })}
          placeholder="부재 시 경비실"
          className={inputClass}
        />
      </div>

      {submitLabel && (
        <button
          type="submit"
          disabled={!isValid || loading || disabled}
          className="w-full py-4 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white text-lg font-medium rounded-xl transition-colors"
        >
          {loading ? '처리 중...' : submitLabel}
        </button>
      )}
    </form>
  );
}
```

- [ ] **Step 3: CreditBalance.tsx 생성**

```tsx
import type { CreditBalance as CreditBalanceType } from '../../lib/api';

interface Props {
  balance: CreditBalanceType | null;
  paidAmount?: number;
  loading: boolean;
}

export default function CreditBalance({ balance, paidAmount, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-20 mb-3" />
        <div className="h-6 bg-gray-200 rounded w-32" />
      </div>
    );
  }

  if (!balance) return null;

  const sufficient = paidAmount == null || balance.balance >= paidAmount;
  const afterBalance = paidAmount != null ? balance.balance - paidAmount : null;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h2 className="text-sm font-medium text-gray-700 mb-3">충전금</h2>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">현재 잔액</span>
          <span className="text-gray-700 font-medium">{balance.balance.toLocaleString()}원</span>
        </div>

        {afterBalance != null && (
          <div className="flex justify-between">
            <span className="text-gray-500">결제 후 잔액</span>
            <span className={sufficient ? 'text-gray-700' : 'text-red-500 font-medium'}>
              {afterBalance.toLocaleString()}원
            </span>
          </div>
        )}
      </div>

      {!sufficient && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">
            충전금이 부족합니다. 충전 후 다시 시도해주세요.
          </p>
        </div>
      )}

      {balance.env === 'sandbox' && (
        <p className="mt-2 text-xs text-gray-400">Sandbox 환경</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: OrderTimeline.tsx 생성**

```tsx
const STEPS = [
  { code: 20, label: '결제 완료', icon: '💳' },
  { code: 25, label: 'PDF 준비', icon: '📄' },
  { code: 30, label: '제작 확정', icon: '✅' },
  { code: 40, label: '인쇄 중', icon: '🖨️' },
  { code: 50, label: '인쇄 완료', icon: '📦' },
  { code: 60, label: '발송 완료', icon: '🚚' },
  { code: 70, label: '배송 완료', icon: '🎉' },
];

interface Props {
  orderStatus: number;
}

export default function OrderTimeline({ orderStatus }: Props) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h2 className="text-sm font-medium text-gray-700 mb-4">주문 상태</h2>
      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const isDone = step.code <= orderStatus;
          const isCurrent = step.code === orderStatus;
          return (
            <div key={step.code} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  isDone
                    ? 'bg-green-100 text-green-600'
                    : 'bg-gray-100 text-gray-400'
                } ${isCurrent ? 'ring-2 ring-green-400' : ''}`}
              >
                {step.icon}
              </div>
              <span
                className={`text-sm ${
                  isCurrent ? 'font-medium text-gray-800' : isDone ? 'text-gray-600' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
              {isCurrent && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  현재
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: OrderActions.tsx 생성**

```tsx
import { useState } from 'react';

interface Props {
  orderStatus: number;
  onCancel: () => Promise<void>;
  onEditShipping: () => void;
}

export default function OrderActions({ orderStatus, onCancel, onEditShipping }: Props) {
  const [cancelling, setCancelling] = useState(false);

  const canCancel = orderStatus === 20 || orderStatus === 25; // PAID or PDF_READY
  const canEditShipping = orderStatus < 40; // IN_PRODUCTION 미만

  const handleCancel = async () => {
    if (!window.confirm('정말 주문을 취소하시겠습니까? 충전금이 반환됩니다.')) return;
    setCancelling(true);
    try {
      await onCancel();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-3">
      {canEditShipping && (
        <button
          onClick={onEditShipping}
          className="w-full py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
        >
          배송지 변경
        </button>
      )}
      {canCancel && (
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="w-full py-3 border border-red-300 text-red-600 rounded-xl font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {cancelling ? '취소 처리 중...' : '주문 취소'}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/components/order/
git commit -m "feat: add order components (estimate, shipping, credits, timeline, actions)"
```

---

### Task 7: OrderPage 리팩토링

**Files:**
- Modify: `frontend/src/pages/OrderPage.tsx`

- [ ] **Step 1: OrderPage.tsx 전체 리팩토링**

기존 내용을 전부 교체:

```tsx
import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  getTrip,
  getEstimate,
  getCreditBalance,
  placeOrder,
  getOrderStatus,
  cancelOrder,
  updateShipping,
} from '../lib/api';
import type { Trip, EstimateResponse, CreditBalance as CreditBalanceType } from '../lib/api';
import EstimateSection from '../components/order/EstimateSection';
import ShippingForm from '../components/order/ShippingForm';
import type { ShippingData } from '../components/order/ShippingForm';
import CreditBalanceDisplay from '../components/order/CreditBalance';
import OrderTimeline from '../components/order/OrderTimeline';
import OrderActions from '../components/order/OrderActions';

export default function OrderPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const adminToken =
    searchParams.get('token') || localStorage.getItem(`trip_admin_${tripId}`) || '';

  const [trip, setTrip] = useState<Trip | null>(null);
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [balance, setBalance] = useState<CreditBalanceType | null>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState('');
  const [editingShipping, setEditingShipping] = useState(false);

  const loadData = async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const t = await getTrip(tripId, adminToken);
      setTrip(t);

      if (t.status === 'finalized') {
        const [est, bal] = await Promise.all([
          getEstimate(tripId, adminToken),
          getCreditBalance(adminToken),
        ]);
        setEstimate(est);
        setBalance(bal);
      } else if (t.status === 'ordered') {
        const [od, bal] = await Promise.all([
          getOrderStatus(tripId, adminToken),
          getCreditBalance(adminToken),
        ]);
        setOrderDetail(od);
        setBalance(bal);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tripId, adminToken]);

  const handleOrder = async (shipping: ShippingData) => {
    if (!tripId) return;
    setOrdering(true);
    setError('');
    try {
      await placeOrder(tripId, adminToken, { shipping });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setOrdering(false);
    }
  };

  const handleCancel = async () => {
    if (!tripId) return;
    const reason = window.prompt('취소 사유를 입력해주세요:');
    if (!reason) return;
    try {
      await cancelOrder(tripId, adminToken, reason);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleShippingUpdate = async (shipping: ShippingData) => {
    if (!tripId) return;
    try {
      await updateShipping(tripId, adminToken, shipping);
      setEditingShipping(false);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">불러오는 중...</p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-500">여행을 찾을 수 없습니다</p>
      </div>
    );
  }

  // 아직 finalize 안 된 상태
  if (trip.status !== 'finalized' && trip.status !== 'ordered') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-4xl">📖</p>
          <p className="text-gray-600">포토북을 먼저 확정해주세요</p>
          <button
            onClick={() => navigate(`/trip/${tripId}/admin?token=${adminToken}`)}
            className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    );
  }

  const sufficient = estimate && balance ? balance.balance >= estimate.paidCreditAmount : true;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/trip/${tripId}/admin?token=${adminToken}`)}
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← 대시보드
          </button>
          <h1 className="text-lg font-serif font-bold text-gray-800">
            {trip.status === 'ordered' ? '주문 현황' : '주문하기'}
          </h1>
          <div className="w-16" />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* --- Pre-Order View --- */}
        {trip.status === 'finalized' && (
          <>
            <EstimateSection estimate={estimate} loading={false} />

            <ShippingForm
              onSubmit={handleOrder}
              submitLabel={sufficient ? '주문하기' : '충전금 부족'}
              loading={ordering}
              disabled={!sufficient}
            />

            <CreditBalanceDisplay
              balance={balance}
              paidAmount={estimate?.paidCreditAmount}
              loading={false}
            />
          </>
        )}

        {/* --- Post-Order View --- */}
        {trip.status === 'ordered' && orderDetail && (
          <>
            {/* Order header */}
            <div className="bg-white rounded-xl p-6 shadow-sm text-center">
              <p className="text-4xl mb-2">📦</p>
              <h2 className="text-lg font-medium text-gray-800">주문 완료</h2>
              <p className="text-xs text-gray-400 font-mono mt-1">{trip.sweetbook_order_uid}</p>
            </div>

            <OrderTimeline orderStatus={orderDetail.orderStatus || 20} />

            {/* Shipping info / edit */}
            {editingShipping ? (
              <ShippingForm
                initial={orderDetail.shipping}
                onSubmit={handleShippingUpdate}
                submitLabel="배송지 변경"
              />
            ) : (
              orderDetail.shipping && (
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h2 className="text-sm font-medium text-gray-700 mb-3">배송 정보</h2>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>{orderDetail.shipping.recipientName} | {orderDetail.shipping.recipientPhone}</p>
                    <p>{orderDetail.shipping.address1}</p>
                    {orderDetail.shipping.address2 && <p>{orderDetail.shipping.address2}</p>}
                    {orderDetail.shipping.memo && (
                      <p className="text-gray-400">메모: {orderDetail.shipping.memo}</p>
                    )}
                  </div>
                </div>
              )
            )}

            <CreditBalanceDisplay balance={balance} loading={false} />

            <OrderActions
              orderStatus={orderDetail.orderStatus || 20}
              onCancel={handleCancel}
              onEditShipping={() => setEditingShipping(!editingShipping)}
            />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/src/pages/OrderPage.tsx
git commit -m "feat: refactor OrderPage with pre/post order views, estimate, credits, cancel, shipping"
```

---

### Task 8: main.py 라우터 등록 확인 + 최종 테스트

**Files:**
- Modify: `backend/app/main.py` (Task 3에서 이미 수정했으나 확인)

- [ ] **Step 1: main.py에 credits 라우터가 등록되었는지 확인**

`backend/app/main.py`를 열어 `credits_router`가 `app.include_router()`에 포함되어 있는지 확인. 없으면 추가.

- [ ] **Step 2: 백엔드 서버 실행 확인**

```bash
cd /Users/imseungmin/work/assignment/celebook/backend
python -m uvicorn app.main:app --reload --port 8000
```

Expected: 서버 시작, import 에러 없음

- [ ] **Step 3: 프론트엔드 빌드 확인**

```bash
cd /Users/imseungmin/work/assignment/celebook/frontend
npm run build
```

Expected: 빌드 성공, TypeScript 에러 없음

- [ ] **Step 4: 최종 커밋**

```bash
git add -A
git commit -m "feat: complete order flow - estimate, credits, cancel, shipping update"
```
