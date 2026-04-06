import { useState } from 'react';

interface Props {
  orderStatus: number;
  onCancel: () => Promise<void>;
  onEditShipping: () => void;
}

export default function OrderActions({ orderStatus, onCancel, onEditShipping }: Props) {
  const [cancelling, setCancelling] = useState(false);

  const canCancel = orderStatus === 20 || orderStatus === 25;
  const canEditShipping = orderStatus < 40;

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
