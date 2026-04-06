"""Credits routes — 충전금 잔액/거래내역 조회/Sandbox 충전"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from bookprintapi import ApiError

from ..services.sweetbook import get_balance, get_transactions, get_client

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


class SandboxChargeRequest(BaseModel):
    amount: int = Field(..., ge=1000, le=1000000)
    memo: str | None = None


@router.post("/sandbox-charge")
def sandbox_charge(body: SandboxChargeRequest):
    """Sandbox 테스트 충전금 충전"""
    try:
        client = get_client()
        result = client.credits.sandbox_charge(body.amount, memo=body.memo)
        return result.get("data", result)
    except ApiError as e:
        raise HTTPException(e.status_code or 500, detail=str(e))
