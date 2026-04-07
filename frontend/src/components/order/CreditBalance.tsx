import type { CreditBalance as CreditBalanceType } from '../../lib/api';

interface Props {
  balance: CreditBalanceType | null;
  paidAmount?: number;
  loading: boolean;
}

export default function CreditBalance({ balance, paidAmount, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
        <div className="h-3 bg-gray-100 rounded w-16 mb-3" />
        <div className="h-5 bg-gray-100 rounded w-28" />
      </div>
    );
  }

  if (!balance) return null;

  const sufficient = paidAmount == null || balance.balance >= paidAmount;
  const afterBalance = paidAmount != null ? balance.balance - paidAmount : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">충전금</p>

      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">현재 잔액</span>
          <span className="text-gray-700 font-medium tabular-nums">{balance.balance.toLocaleString()}원</span>
        </div>

        {afterBalance != null && (
          <div className="flex justify-between">
            <span className="text-gray-400">결제 후 잔액</span>
            <span className={`tabular-nums ${sufficient ? 'text-gray-700' : 'text-red-500 font-medium'}`}>
              {afterBalance.toLocaleString()}원
            </span>
          </div>
        )}
      </div>

      {!sufficient && (
        <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
          <p className="text-sm text-red-500">
            충전금이 부족합니다. 충전 후 다시 시도해주세요.
          </p>
        </div>
      )}

      {balance.env === 'sandbox' && (
        <span className="inline-block mt-2 px-2 py-0.5 bg-gray-50 text-gray-400 text-[10px] font-medium rounded-full uppercase tracking-wider">
          Sandbox
        </span>
      )}
    </div>
  );
}
