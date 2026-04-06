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
