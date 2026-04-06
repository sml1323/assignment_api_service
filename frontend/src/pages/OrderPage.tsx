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
            <div className="bg-white rounded-xl p-6 shadow-sm text-center">
              <p className="text-4xl mb-2">📦</p>
              <h2 className="text-lg font-medium text-gray-800">주문 완료</h2>
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
