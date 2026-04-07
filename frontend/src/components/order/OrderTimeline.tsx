const STEPS = [
  { code: 20, label: '결제 완료', icon: '💳' },
  { code: 25, label: 'PDF 준비', icon: '📄' },
  { code: 30, label: '제작 확정', icon: '✅' },
  { code: 40, label: '인쇄 중', icon: '🖨️' },
  { code: 50, label: '인쇄 완료', icon: '📦' },
  { code: 60, label: '발송', icon: '🚚' },
  { code: 70, label: '배송 완료', icon: '🎉' },
];

interface Props {
  orderStatus: number;
}

export default function OrderTimeline({ orderStatus }: Props) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">주문 상태</p>
      <div className="space-y-4">
        {STEPS.map((step) => {
          const isDone = step.code <= orderStatus;
          const isCurrent = step.code === orderStatus;
          return (
            <div key={step.code} className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0
                  ${isDone ? 'bg-emerald-50' : 'bg-gray-50'}
                  ${isCurrent ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}`}
              >
                {step.icon}
              </div>
              <span
                className={`text-sm flex-1 ${
                  isCurrent ? 'font-medium text-gray-800' : isDone ? 'text-gray-600' : 'text-gray-300'
                }`}
              >
                {step.label}
              </span>
              {isCurrent && (
                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">
                  현재
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
