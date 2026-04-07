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
        const results = await Promise.allSettled([
          getEstimate(tripId, adminToken),
          getCreditBalance(adminToken),
        ]);
        if (results[0].status === 'fulfilled') setEstimate(results[0].value);
        else setError(results[0].reason?.message || '견적 조회 실패');
        if (results[1].status === 'fulfilled') setBalance(results[1].value);
      } else if (t.status === 'ordered') {
        const results = await Promise.allSettled([
          getOrderStatus(tripId, adminToken),
          getCreditBalance(adminToken),
        ]);
        if (results[0].status === 'fulfilled') setOrderDetail(results[0].value);
        if (results[1].status === 'fulfilled') setBalance(results[1].value);
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
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-red-500">여행을 찾을 수 없습니다</p>
      </div>
    );
  }

  if (trip.status !== 'finalized' && trip.status !== 'ordered') {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">📖</span>
          </div>
          <p className="text-sm text-gray-500">포토북을 먼저 확정해주세요</p>
          <button
            onClick={() => navigate(`/trip/${tripId}/admin?token=${adminToken}`)}
            className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium
                       hover:bg-orange-600 active:scale-[0.98] transition-all duration-150"
          >
            대시보드로 이동
          </button>
        </div>
      </div>
    );
  }

  const sufficient = estimate && balance ? balance.balance >= estimate.paidCreditAmount : true;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-5 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(`/trip/${tripId}/admin?token=${adminToken}`)}
            className="text-gray-300 hover:text-gray-500 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-800">
            {trip.status === 'ordered' ? '주문 현황' : '주문하기'}
          </h1>
          <div className="w-5" />
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 py-5 space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-2xl">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

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

        {trip.status === 'ordered' && orderDetail && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
              <div className="w-14 h-14 bg-violet-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📦</span>
              </div>
              <h2 className="text-lg font-semibold text-gray-800">주문 완료</h2>
              <p className="text-xs text-gray-400 font-mono mt-1">{trip.sweetbook_order_uid}</p>
            </div>

            <OrderTimeline orderStatus={orderDetail.orderStatus || 20} />

            {editingShipping ? (
              <ShippingForm
                initial={orderDetail.shipping}
                onSubmit={handleShippingUpdate}
                submitLabel="배송지 변경"
              />
            ) : (
              orderDetail.shipping && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">배송 정보</p>
                  <div className="space-y-1.5 text-sm text-gray-600">
                    <p className="font-medium text-gray-800">{orderDetail.shipping.recipientName} | {orderDetail.shipping.recipientPhone}</p>
                    <p>{orderDetail.shipping.address1}</p>
                    {orderDetail.shipping.address2 && <p>{orderDetail.shipping.address2}</p>}
                    {orderDetail.shipping.memo && (
                      <p className="text-gray-400 text-xs mt-2">메모: {orderDetail.shipping.memo}</p>
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
