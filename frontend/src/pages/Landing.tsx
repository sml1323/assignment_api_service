import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyTrips } from '../lib/api';
import type { MyTrip } from '../lib/api';

export default function Landing() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username');
  const userToken = localStorage.getItem('user_token');
  const [myTrips, setMyTrips] = useState<MyTrip[]>([]);

  useEffect(() => {
    if (userToken) {
      getMyTrips().then(setMyTrips).catch(() => {});
    }
  }, [userToken]);

  const handleLogout = () => {
    localStorage.removeItem('user_token');
    localStorage.removeItem('username');
    window.location.reload();
  };

  const statusLabels: Record<string, string> = {
    draft: '초안',
    collecting: '참여 수집 중',
    finalized: '확정됨',
    ordered: '주문 완료',
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    collecting: 'bg-green-100 text-green-700',
    finalized: 'bg-blue-100 text-blue-700',
    ordered: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Header with auth */}
        <div className="space-y-2">
          <h1 className="text-5xl font-serif font-bold text-gray-800">
            CeleBook
          </h1>
          <p className="text-xl text-gray-500 font-light">
            함께 만드는 여행의 추억
          </p>
          {username ? (
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-sm text-gray-600">{username}님</span>
              <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 underline">
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-orange-500 hover:text-orange-600 mt-2"
            >
              로그인 / 회원가입
            </button>
          )}
        </div>

        {/* My Trips (logged in) */}
        {username && myTrips.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-gray-700 text-left">내 여행</h2>
            {myTrips.map((trip) => (
              <button
                key={trip.id}
                onClick={() => navigate(`/trip/${trip.id}/admin?token=${trip.admin_token}`)}
                className="w-full bg-white/80 backdrop-blur rounded-xl p-4 text-left hover:bg-white transition-colors shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-800">{trip.title}</p>
                    <p className="text-xs text-gray-500">{trip.destination} · {trip.page_count}페이지</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${statusColors[trip.status] || 'bg-gray-100 text-gray-600'}`}>
                    {statusLabels[trip.status] || trip.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Features */}
        {!username && (
          <div className="space-y-4 text-left bg-white/70 rounded-2xl p-6 backdrop-blur">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📷</span>
              <div>
                <p className="font-medium text-gray-800">사진 업로드</p>
                <p className="text-sm text-gray-500">여행 사진을 한 번에 올리면 자동으로 페이지가 구성됩니다</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">🔗</span>
              <div>
                <p className="font-medium text-gray-800">링크 공유</p>
                <p className="text-sm text-gray-500">공유 링크로 친구들을 초대하면 각 페이지에 추억을 남길 수 있어요</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">📖</span>
              <div>
                <p className="font-medium text-gray-800">포토북 주문</p>
                <p className="text-sm text-gray-500">완성된 포토북을 실물 책으로 인쇄해서 받아보세요</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/create')}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white text-lg font-medium rounded-xl transition-colors shadow-lg shadow-orange-200"
        >
          여행 포토북 만들기
        </button>
      </div>
    </div>
  );
}
