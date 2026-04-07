import type { EstimateResponse } from '../../lib/api';

interface Props {
  estimate: EstimateResponse | null;
  loading: boolean;
}

export default function EstimateSection({ estimate, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
        <div className="h-3 bg-gray-100 rounded w-16 mb-4" />
        <div className="space-y-2.5">
          <div className="h-3 bg-gray-100 rounded" />
          <div className="h-3 bg-gray-100 rounded" />
          <div className="h-3 bg-gray-100 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!estimate) return null;

  const item = estimate.items[0];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">견적</p>

      {item && (
        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <p className="text-sm font-medium text-gray-800">{item.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{item.pageCount}p x {item.quantity}부</p>
        </div>
      )}

      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">상품금액</span>
          <span className="text-gray-700 tabular-nums">{estimate.productAmount.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">배송비</span>
          <span className="text-gray-700 tabular-nums">{estimate.shippingFee.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">합계 (세전)</span>
          <span className="text-gray-700 tabular-nums">{estimate.totalAmount.toLocaleString()}원</span>
        </div>
        <div className="border-t border-gray-100 pt-2.5 flex justify-between font-semibold">
          <span className="text-gray-800">결제금액 (VAT 포함)</span>
          <span className="text-orange-600 tabular-nums">{estimate.paidCreditAmount.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  );
}
