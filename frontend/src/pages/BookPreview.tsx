import { useState, useEffect, useRef, forwardRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import HTMLFlipBook from 'react-pageflip';
import { getPages } from '../lib/api';
import type { Page } from '../lib/api';

const PageComponent = forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  ({ children }, ref) => (
    <div ref={ref} className="bg-white shadow-lg">
      {children}
    </div>
  )
);
PageComponent.displayName = 'PageComponent';

export default function BookPreview() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const bookRef = useRef<any>(null);

  const adminToken = localStorage.getItem(`trip_admin_${tripId}`) || '';
  const shareToken = sessionStorage.getItem('share_token') || '';
  const token = adminToken || shareToken;
  const isAdmin = !!adminToken;

  useEffect(() => {
    if (!tripId || !token) return;
    getPages(tripId, token, isAdmin)
      .then(setPages)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">미리보기 로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center py-8">
      <div className="mb-4">
        <button
          onClick={() => navigate(-1)}
          className="text-white/70 hover:text-white text-sm"
        >
          ← 돌아가기
        </button>
      </div>

      {/* @ts-ignore - react-pageflip types */}
      <HTMLFlipBook
        ref={bookRef}
        width={360}
        height={500}
        size="stretch"
        minWidth={280}
        maxWidth={500}
        minHeight={400}
        maxHeight={700}
        showCover={true}
        maxShadowOpacity={0.5}
        className="shadow-2xl"
        style={{}}
        startPage={0}
        drawShadow={true}
        flippingTime={800}
        usePortrait={true}
        startZIndex={0}
        autoSize={true}
        clickEventForward={true}
        useMouseEvents={true}
        swipeDistance={30}
        showPageCorners={true}
        disableFlipByClick={false}
        mobileScrollSupport={true}
      >
        {/* Cover */}
        <PageComponent>
          <div className="w-full h-full bg-gradient-to-br from-orange-400 to-rose-500 flex flex-col items-center justify-center p-8 text-white">
            <h1 className="text-3xl font-serif font-bold mb-2 text-center">TripBook</h1>
            <p className="text-lg opacity-80">여행의 추억</p>
          </div>
        </PageComponent>

        {/* Table of Contents */}
        <PageComponent>
          <div className="w-full h-full flex flex-col p-6">
            <h2 className="text-lg font-serif font-bold text-gray-700 mb-4 border-b pb-2">목차</h2>
            <div className="flex-1 space-y-2 overflow-hidden">
              {pages.map((page, i) => (
                <div key={page.id} className="flex items-baseline gap-2">
                  <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
                  <span className="flex-1 text-sm text-gray-600 truncate">
                    {page.subtitle || page.caption || `Page ${page.page_number}`}
                  </span>
                  <span className="text-xs text-gray-300 flex-shrink-0">
                    {page.zones.filter(z => z.message).length > 0 && (
                      `${page.zones.filter(z => z.message).length}명`
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </PageComponent>

        {/* Pages */}
        {pages.map((page) => (
          <PageComponent key={page.id}>
            <div className="w-full h-full flex flex-col">
              {/* Subtitle */}
              {page.subtitle && (
                <div className="px-4 py-2 bg-gray-50 border-b">
                  <p className="text-xs font-medium text-gray-500">{page.subtitle}</p>
                </div>
              )}

              {/* Photo + Overlay */}
              <div className="relative flex-1">
                <img
                  src={page.photo_url}
                  alt={page.caption || ''}
                  className="w-full h-full object-cover"
                />
                {/* Overlay zones — positioned with saved coordinates */}
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
                          className="text-[10px] leading-tight font-medium"
                          style={{ color, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                        >
                          {zone.message!.content}
                        </p>
                        <p
                          className="text-[8px] mt-0.5"
                          style={{ color, opacity: 0.7, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                        >
                          — {zone.message!.author_name}
                        </p>
                      </div>
                    );
                  })}
              </div>

              {/* Bottom zones */}
              <div className="px-3 py-2 bg-white border-t grid grid-cols-2 gap-2">
                {page.zones
                  .filter((z) => z.zone_number > 2 && z.message)
                  .map((zone) => (
                    <div key={zone.id}>
                      <p className="text-[10px] text-gray-600 leading-tight">
                        {zone.message!.content}
                      </p>
                      <p className="text-[8px] text-gray-400 text-right mt-0.5">
                        — {zone.message!.author_name}
                      </p>
                    </div>
                  ))}
                {page.zones.filter((z) => z.zone_number > 2 && z.message).length === 0 && (
                  <p className="text-[10px] text-gray-300 col-span-2 text-center py-2">
                    아직 작성된 추억이 없습니다
                  </p>
                )}
              </div>
            </div>
          </PageComponent>
        ))}

        {/* Back Cover */}
        <PageComponent>
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex flex-col items-center justify-center p-8 text-white">
            <p className="text-sm opacity-50 mb-2">Powered by</p>
            <p className="text-xl font-serif">TripBook</p>
            <p className="text-xs opacity-40 mt-4">함께 만드는 여행의 추억</p>
          </div>
        </PageComponent>
      </HTMLFlipBook>

      <div className="mt-4 text-white/50 text-sm">
        ← 페이지를 넘겨보세요 →
      </div>
    </div>
  );
}
