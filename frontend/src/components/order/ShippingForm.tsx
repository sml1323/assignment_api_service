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
