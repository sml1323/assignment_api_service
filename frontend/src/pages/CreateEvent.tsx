import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createEvent } from '../lib/api';

const EVENT_TYPES = [
  { value: 'graduation', label: '🎓 졸업', color: 'bg-blue-100' },
  { value: 'retirement', label: '🏖️ 은퇴', color: 'bg-green-100' },
  { value: 'birthday', label: '🎂 생일', color: 'bg-pink-100' },
  { value: 'wedding', label: '💍 결혼', color: 'bg-purple-100' },
  { value: 'other', label: '🎉 기타', color: 'bg-yellow-100' },
];

export default function CreateEvent() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    event_type: 'graduation',
    recipient_name: '',
    organizer_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ share_code: string; admin_token: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const event = await createEvent(form);
      setResult({ share_code: event.share_code, admin_token: event.admin_token! });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const contributeUrl = result ? `${window.location.origin}/contribute/${result.share_code}` : '';
  const dashboardUrl = result ? `/dashboard/${result.share_code}?token=${result.admin_token}` : '';

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">이벤트가 생성되었어요!</h1>
          <p className="text-gray-500 mb-6">아래 링크를 친구들에게 공유하세요</p>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-500 mb-1">친구 공유 링크</p>
            <p className="text-sm font-mono text-blue-600 break-all">{contributeUrl}</p>
            <button
              onClick={() => navigator.clipboard.writeText(contributeUrl)}
              className="mt-2 px-4 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition cursor-pointer"
            >
              링크 복사
            </button>
          </div>

          <button
            onClick={() => navigate(dashboardUrl)}
            className="w-full py-3 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition cursor-pointer"
          >
            관리자 대시보드로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">📖 CeleBook</h1>
          <p className="text-gray-500 mt-2">소중한 사람에게 축하의 마음을 책으로 전하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이벤트 유형</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm({ ...form, event_type: t.value })}
                  className={`px-3 py-1.5 rounded-full text-sm transition cursor-pointer ${
                    form.event_type === t.value
                      ? 'bg-rose-500 text-white'
                      : `${t.color} text-gray-700 hover:opacity-80`
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">누구를 축하하나요?</label>
            <input
              type="text"
              value={form.recipient_name}
              onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
              placeholder="예: 김민수"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-300 focus:border-rose-400 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이벤트 제목</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="예: 김민수의 졸업을 축하해요!"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-300 focus:border-rose-400 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">주최자 이름</label>
            <input
              type="text"
              value={form.organizer_name}
              onChange={(e) => setForm({ ...form, organizer_name: e.target.value })}
              placeholder="예: 이영희"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-300 focus:border-rose-400 outline-none"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? '생성 중...' : '축하책 만들기'}
          </button>
        </form>
      </div>
    </div>
  );
}
