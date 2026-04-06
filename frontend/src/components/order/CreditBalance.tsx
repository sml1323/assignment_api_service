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
