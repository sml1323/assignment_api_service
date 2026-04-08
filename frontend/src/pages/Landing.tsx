import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyTrips } from '../lib/api';
import type { MyTrip } from '../lib/api';

const statusLabels: Record<string, string> = {
  draft: '초안',
  collecting: '수집 중',
  finalized: '확정됨',
  ordered: '주문 완료',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  collecting: 'bg-emerald-50 text-emerald-600',
  finalized: 'bg-blue-50 text-blue-600',
  ordered: 'bg-violet-50 text-violet-600',
};

export default function Landing() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username');
  const userToken = localStorage.getItem('user_token');
  const [myTrips, setMyTrips] = useState<MyTrip[]>([]);

  useEffect(() => {
    if (userToken) {
      getMyTrips().then(setMyTrips).catch(() => {
        // 토큰이 만료/무효 → 자동 로그아웃
        localStorage.removeItem('user_token');
        localStorage.removeItem('username');
        window.location.reload();
      });
    }
  }, [userToken]);

  const handleLogout = () => {
    localStorage.removeItem('user_token');
    localStorage.removeItem('username');
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5">
      <div className="max-w-md w-full space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-display font-bold text-gray-800 tracking-tight">
            CeleBook
          </h1>
          <p className="text-lg text-gray-400 font-light">
            함께 만드는 여행의 추억
          </p>
          {username ? (
            <div className="flex items-center justify-center gap-3 pt-1">
              <span className="text-sm text-gray-500">{username}님</span>
              <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-orange-500 hover:text-orange-600 transition-colors pt-1"
            >
              로그인 / 회원가입
            </button>
          )}
        </div>

        {/* My Trips */}
        {username && myTrips.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-1">내 여행</p>
            {myTrips.map((trip) => (
              <button
                key={trip.id}
                onClick={() => navigate(`/trip/${trip.id}/admin?token=${trip.admin_token}`)}
                className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left
                           hover:shadow-md transition-all duration-200 group"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 group-hover:text-orange-600 transition-colors truncate">
                      {trip.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{trip.destination} · {trip.page_count}p</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-3 ${statusColors[trip.status] || 'bg-gray-100 text-gray-500'}`}>
                    {statusLabels[trip.status] || trip.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Features */}
        {!username && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-white/50 p-6 space-y-5">
            {[
              { icon: '📷', title: '사진 업로드', desc: '여행 사진을 올리면 자동으로 페이지가 구성됩니다' },
              { icon: '🔗', title: '링크 공유', desc: '친구들을 초대하면 각 페이지에 추억을 남길 수 있어요' },
              { icon: '📖', title: '포토북 주문', desc: '완성된 포토북을 실물 책으로 인쇄해서 받아보세요' },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <span className="text-2xl flex-shrink-0 mt-0.5">{f.icon}</span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{f.title}</p>
                  <p className="text-sm text-gray-400 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => navigate('/create')}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 active:scale-[0.98]
                     text-white text-base font-semibold rounded-xl
                     transition-all duration-150 shadow-lg shadow-orange-500/20"
        >
          여행 포토북 만들기
        </button>
      </div>
    </div>
  );
}
