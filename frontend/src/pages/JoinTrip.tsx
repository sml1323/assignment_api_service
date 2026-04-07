import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getTripByShare } from '../lib/api';
import type { Trip } from '../lib/api';

export default function JoinTrip() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    getTripByShare(token)
      .then(setTrip)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleJoin = () => {
    if (!name.trim()) {
      setError('이름을 입력해주세요');
      return;
    }
    if (!trip || !token) return;

    sessionStorage.setItem('share_token', token);
    sessionStorage.setItem('participant_name', name.trim());
    navigate(`/trip/${trip.id}/contribute`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">😢</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-800">
            {error || '여행을 찾을 수 없습니다'}
          </h2>
          <p className="text-sm text-gray-400">공유 링크가 올바른지 확인해주세요</p>
        </div>
      </div>
    );
  }

  if (trip.status !== 'collecting') {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">📖</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-800">마감된 여행</h2>
          <p className="text-sm text-gray-400">
            {trip.title} 포토북은 이미 확정되었습니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="space-y-2">
          <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">🏝️</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-gray-800 tracking-tight">
            {trip.title}
          </h1>
          <p className="text-sm text-gray-400">
            {trip.destination}
            {trip.start_date && trip.end_date && (
              <span> · {trip.start_date} ~ {trip.end_date}</span>
            )}
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 p-6 space-y-5">
          <p className="text-sm text-gray-500 leading-relaxed">
            여행의 추억을 함께 남겨주세요!<br />
            각 페이지의 빈 영역에 메시지를 작성할 수 있습니다.
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider text-left">
              이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="이름을 입력해주세요"
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800
                placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400
                transition-all duration-150"
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            onClick={handleJoin}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:scale-[0.98]
                       text-white font-semibold rounded-xl transition-all duration-150"
          >
            참여하기
          </button>
        </div>
      </div>
    </div>
  );
}
