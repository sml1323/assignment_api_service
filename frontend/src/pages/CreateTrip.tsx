import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTrip } from '../lib/api';

export default function CreateTrip() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    destination: '',
    start_date: '',
    end_date: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!form.title || !form.destination) {
      setError('여행 제목과 목적지를 입력해주세요');
      return;
    }
    if (!form.start_date || !form.end_date) {
      setError('출발일과 도착일을 입력해주세요');
      return;
    }
    if (form.end_date < form.start_date) {
      setError('도착일은 출발일 이후여야 합니다');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const trip = await createTrip(form);
      localStorage.setItem(`trip_admin_${trip.id}`, trip.admin_token!);
      navigate(`/trip/${trip.id}/admin?token=${trip.admin_token}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = `w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800
    placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400
    transition-all duration-150`;

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-md w-full space-y-8">
        <div>
          <button
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-gray-600 text-sm transition-colors mb-6 block"
          >
            ← 홈으로
          </button>
          <h1 className="text-3xl font-display font-bold text-gray-800 tracking-tight">
            새 여행 만들기
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            여행 정보를 입력하고 포토북을 시작하세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
              여행 제목 *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="예: 제주도 3박4일"
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
              목적지 *
            </label>
            <input
              type="text"
              value={form.destination}
              onChange={(e) => setForm({ ...form, destination: e.target.value })}
              placeholder="예: 제주도"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                출발일 *
              </label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider">
                도착일 *
              </label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className={inputClass}
                required
              />
            </div>
          </div>

          {/* Day count preview */}
          {form.start_date && form.end_date && form.end_date >= form.start_date && (() => {
            const start = new Date(form.start_date);
            const end = new Date(form.end_date);
            const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            const numDays = nights + 1;
            return (
              <div className="bg-orange-50 rounded-xl px-4 py-3 text-sm text-orange-700">
                {nights}박 {numDays}일 · Day 1~{numDays} 자동 생성
              </div>
            );
          })()}

          {error && <p className="text-sm text-red-500 px-1">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 active:scale-[0.98]
                       text-white text-base font-semibold rounded-xl transition-all duration-150
                       disabled:bg-gray-200 disabled:text-gray-400 disabled:scale-100"
          >
            {loading ? '생성 중...' : '여행 만들기'}
          </button>
        </form>
      </div>
    </div>
  );
}
