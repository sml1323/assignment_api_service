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
