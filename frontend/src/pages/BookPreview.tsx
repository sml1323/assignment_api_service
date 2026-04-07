import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDays, getTrip, getTripByShare } from '../lib/api';
import type { Page, Trip, TripDay } from '../lib/api';

// 미리보기 페이지 타입
type PreviewPage =
  | { type: 'cover' }
  | { type: 'toc'; days: TripDay[] }
  | { type: 'divider'; day: TripDay }
  | { type: 'photo'; page: Page; dayTitle: string }
  | { type: 'back' };

function buildPreviewPages(days: TripDay[]): PreviewPage[] {
  const result: PreviewPage[] = [{ type: 'cover' }];

  if (days.length > 0) {
    result.push({ type: 'toc', days });
  }

  for (const day of days) {
    if (day.pages.length === 0) continue;
    result.push({ type: 'divider', day });
    for (const page of day.pages) {
      result.push({ type: 'photo', page, dayTitle: day.title || `Day ${day.day_number}` });
    }
  }

  result.push({ type: 'back' });
  return result;
}

export default function BookPreview() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<TripDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);

  const adminToken = localStorage.getItem(`trip_admin_${tripId}`) || '';
  const shareToken = sessionStorage.getItem('share_token') || '';
  const token = adminToken || shareToken;
  const isAdmin = !!adminToken;

  useEffect(() => {
    if (!tripId || !token) return;
    const tripPromise = isAdmin
      ? getTrip(tripId, adminToken)
      : getTripByShare(shareToken).then(t => t as Trip);
    Promise.allSettled([
      tripPromise,
      getDays(tripId, token, isAdmin),
    ]).then(([tRes, dRes]) => {
      if (tRes.status === 'fulfilled') setTrip(tRes.value);
      if (dRes.status === 'fulfilled') setDays(dRes.value.days);
    }).finally(() => setLoading(false));
  }, [tripId]);

  const previewPages = buildPreviewPages(days);
  const totalPages = previewPages.length;
  const page = previewPages[currentPage];

  const goPrev = () => setCurrentPage((p) => Math.max(0, p - 1));
  const goNext = () => setCurrentPage((p) => Math.min(totalPages - 1, p + 1));

  // 키보드 네비게이션
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [totalPages]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-800">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">미리보기 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => navigate(-1)}
          className="text-white/70 hover:text-white text-sm transition-colors"
        >
          ← 돌아가기
        </button>
        <span className="text-white/40 text-xs">
          {currentPage + 1} / {totalPages}
        </span>
      </div>

      {/* Page Content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-4">
        <div className="w-full max-w-md aspect-[3/4] bg-white rounded-lg shadow-2xl overflow-hidden relative">
          {page?.type === 'cover' && <CoverPage trip={trip} />}
          {page?.type === 'toc' && <TocPage days={page.days} />}
          {page?.type === 'divider' && <DividerPage day={page.day} />}
          {page?.type === 'photo' && <PhotoPage page={page.page} dayTitle={page.dayTitle} />}
          {page?.type === 'back' && <BackCoverPage />}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-6 pb-6">
        <button
          onClick={goPrev}
          disabled={currentPage === 0}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:hover:bg-white/10
                     text-white flex items-center justify-center transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Page dots (compact) */}
        <div className="flex gap-1.5 items-center max-w-[200px] overflow-hidden">
          {previewPages.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`flex-shrink-0 rounded-full transition-all ${
                i === currentPage
                  ? 'w-2.5 h-2.5 bg-orange-400'
                  : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>

        <button
          onClick={goNext}
          disabled={currentPage === totalPages - 1}
          className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 disabled:hover:bg-white/10
                     text-white flex items-center justify-center transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// --- Page Components ---

function CoverPage({ trip }: { trip: Trip | null }) {
  if (trip?.cover_image) {
    return (
      <div className="w-full h-full relative">
        <img src={trip.cover_image} alt="표지" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
          <h1 className="text-3xl font-display font-bold mb-1">{trip.title}</h1>
          <p className="text-sm opacity-80">{trip.destination}</p>
          {trip.start_date && trip.end_date && (
            <p className="text-xs opacity-60 mt-1">{trip.start_date} — {trip.end_date}</p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="w-full h-full bg-gradient-to-br from-orange-400 to-rose-500 flex flex-col items-center justify-center p-8 text-white">
      <h1 className="text-4xl font-display font-bold mb-3 text-center">{trip?.title || 'CeleBook'}</h1>
      <p className="text-lg opacity-80">{trip?.destination || '함께 만드는 여행의 추억'}</p>
    </div>
  );
}

function TocPage({ days }: { days: TripDay[] }) {
  return (
    <div className="w-full h-full flex flex-col p-8">
      <h2 className="text-lg font-display font-bold text-gray-700 mb-5 pb-3 border-b border-gray-200">목차</h2>
      <div className="flex-1 space-y-4 overflow-hidden">
        {days.map((day) => (
          <div key={day.id}>
            <p className="text-sm font-semibold text-gray-800">
              Day {day.day_number} — {day.title}
            </p>
            {day.pages.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5 ml-1">{day.pages.length}장의 사진</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DividerPage({ day }: { day: TripDay }) {
  const dayDate = day.date ? new Date(day.date + 'T00:00:00') : null;
  const monthNum = dayDate ? String(dayDate.getMonth() + 1).padStart(2, '0') : '';
  const dayNum = dayDate ? String(dayDate.getDate()).padStart(2, '0') : '';

  return (
    <div className="w-full h-full bg-white flex flex-col items-start justify-center px-12">
      <p className="text-5xl font-display text-gray-200 mb-4 tracking-tight">
        {monthNum}.{dayNum}
      </p>
      <h2 className="text-2xl font-display font-bold text-gray-800 leading-snug mb-5">
        {day.title || `Day ${day.day_number}`}
      </h2>
      {day.description && (
        <p className="text-sm text-gray-500 leading-relaxed max-w-[85%]">
          {day.description}
        </p>
      )}
    </div>
  );
}

function PhotoPage({ page, dayTitle }: { page: Page; dayTitle: string }) {
  return (
    <div className="w-full h-full flex flex-col">
      {/* Day label + subtitle */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex-shrink-0">
        <p className="text-[11px] font-medium text-gray-500">
          {page.subtitle || dayTitle}
        </p>
      </div>

      {/* Photo — fixed aspect ratio, no overflow */}
      <div className="relative flex-1 min-h-0 bg-gray-100">
        <img
          src={page.photo_url}
          alt={page.caption || ''}
          className="absolute inset-0 w-full h-full object-contain"
        />
        {/* Overlay zones */}
        {page.zones
          .filter((z) => z.zone_number <= 2 && z.message)
          .map((zone) => {
            const color = zone.message!.color || '#FFFFFF';
            return (
              <div
                key={zone.id}
                className="absolute max-w-[45%] px-2"
                style={{
                  left: `${zone.message!.position_x}%`,
                  top: `${zone.message!.position_y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <p
                  className="text-xs leading-tight font-medium"
                  style={{ color, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
                >
                  {zone.message!.content}
                </p>
                <p
                  className="text-[10px] mt-0.5"
                  style={{ color, opacity: 0.7, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                >
                  — {zone.message!.author_name}
                </p>
              </div>
            );
          })}
      </div>

      {/* Bottom zones */}
      <div className="px-4 py-3 bg-white border-t border-gray-100 flex-shrink-0">
        {page.zones.filter((z) => z.zone_number > 2 && z.message).length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {page.zones
              .filter((z) => z.zone_number > 2 && z.message)
              .map((zone) => (
                <div key={zone.id}>
                  <p className="text-xs text-gray-600 leading-relaxed">{zone.message!.content}</p>
                  <p className="text-[10px] text-gray-400 text-right mt-1">— {zone.message!.author_name}</p>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-xs text-gray-300 text-center py-1">
            아직 작성된 추억이 없습니다
          </p>
        )}
      </div>
    </div>
  );
}

function BackCoverPage() {
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-center p-8 text-white">
      <p className="text-sm opacity-50 mb-2">Powered by</p>
      <p className="text-2xl font-display">CeleBook</p>
      <p className="text-xs opacity-40 mt-4">함께 만드는 여행의 추억</p>
    </div>
  );
}
