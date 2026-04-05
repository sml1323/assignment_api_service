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
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-6xl mb-4">😢</p>
          <h2 className="text-xl font-medium text-gray-800 mb-2">
            {error || '여행을 찾을 수 없습니다'}
          </h2>
          <p className="text-gray-500">공유 링크가 올바른지 확인해주세요</p>
        </div>
      </div>
    );
  }

  if (trip.status !== 'collecting') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-6xl mb-4">📖</p>
          <h2 className="text-xl font-medium text-gray-800 mb-2">
            이 여행은 마감되었습니다
          </h2>
          <p className="text-gray-500">
            {trip.title} 포토북은 이미 확정되었습니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div>
          <p className="text-6xl mb-4">🏝️</p>
          <h1 className="text-3xl font-serif font-bold text-gray-800">
            {trip.title}
          </h1>
          <p className="text-gray-500 mt-2">
            {trip.destination}
            {trip.start_date && trip.end_date && (
              <span> · {trip.start_date} ~ {trip.end_date}</span>
            )}
          </p>
        </div>

        <div className="bg-white/70 backdrop-blur rounded-2xl p-6 space-y-4">
          <p className="text-gray-600">
            여행의 추억을 함께 남겨주세요!<br />
            각 페이지의 빈 영역에 메시지를 작성할 수 있습니다.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
              이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              placeholder="이름을 입력해주세요"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-300 focus:border-orange-400 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleJoin}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors"
          >
            참여하기
          </button>
        </div>
      </div>
    </div>
  );
}
