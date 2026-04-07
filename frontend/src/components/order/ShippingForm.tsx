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

  const handleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (isValid) onSubmit(form);
  };

  const inputClass = `w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800
    placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400
    transition-all duration-150`;

  const fields: { key: keyof ShippingData; label: string; placeholder: string; required?: boolean; type?: string }[] = [
    { key: 'recipientName', label: '받는 사람', placeholder: '홍길동', required: true },
    { key: 'recipientPhone', label: '연락처', placeholder: '010-1234-5678', required: true, type: 'tel' },
    { key: 'postalCode', label: '우편번호', placeholder: '06100', required: true },
    { key: 'address1', label: '주소', placeholder: '서울특별시 강남구 테헤란로 123', required: true },
    { key: 'address2', label: '상세주소', placeholder: '4층' },
    { key: 'memo', label: '배송 메모', placeholder: '부재 시 경비실' },
  ];

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">배송 정보</p>

      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-500">
            {f.label} {f.required && '*'}
          </label>
          <input
            type={'type' in f ? f.type : 'text'}
            value={form[f.key]}
            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            placeholder={f.placeholder}
            className={inputClass}
          />
        </div>
      ))}

      {submitLabel && (
        <button
          type="submit"
          disabled={!isValid || loading || disabled}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:scale-[0.98]
                     text-white font-semibold rounded-xl transition-all duration-150
                     disabled:bg-gray-200 disabled:text-gray-400 disabled:scale-100"
        >
          {loading ? '처리 중...' : submitLabel}
        </button>
      )}
    </form>
  );
}
