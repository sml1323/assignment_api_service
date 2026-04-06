const STEPS = [
  { code: 20, label: '결제 완료', icon: '💳' },
  { code: 25, label: 'PDF 준비', icon: '📄' },
  { code: 30, label: '제작 확정', icon: '✅' },
  { code: 40, label: '인쇄 중', icon: '🖨️' },
  { code: 50, label: '인쇄 완료', icon: '📦' },
  { code: 60, label: '발송 완료', icon: '🚚' },
  { code: 70, label: '배송 완료', icon: '🎉' },
];

interface Props {
  orderStatus: number;
}

export default function OrderTimeline({ orderStatus }: Props) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h2 className="text-sm font-medium text-gray-700 mb-4">주문 상태</h2>
      <div className="space-y-3">
        {STEPS.map((step) => {
          const isDone = step.code <= orderStatus;
          const isCurrent = step.code === orderStatus;
          return (
            <div key={step.code} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  isDone
                    ? 'bg-green-100 text-green-600'
                    : 'bg-gray-100 text-gray-400'
                } ${isCurrent ? 'ring-2 ring-green-400' : ''}`}
              >
                {step.icon}
              </div>
              <span
                className={`text-sm ${
                  isCurrent ? 'font-medium text-gray-800' : isDone ? 'text-gray-600' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
              {isCurrent && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
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
