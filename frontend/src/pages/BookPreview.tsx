import { useState, useEffect, useRef, forwardRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import HTMLFlipBook from 'react-pageflip';
import { getEventAdmin, getContributions, type Event, type Contribution } from '../lib/api';

const COVER_COLORS: Record<string, string> = {
  graduation: '#4A90D9',
  retirement: '#2ECC71',
  birthday: '#E74C3C',
  wedding: '#9B59B6',
  other: '#F39C12',
};

const EVENT_EMOJI: Record<string, string> = {
  graduation: '🎓', retirement: '🏖️', birthday: '🎂', wedding: '💍', other: '🎉',
};

// react-pageflip requires forwardRef components
const CoverPage = forwardRef<HTMLDivElement, { event: Event; contributors: Contribution[] }>(
  ({ event, contributors }, ref) => (
    <div ref={ref} className="w-full h-full flex flex-col items-center justify-center p-8 text-white"
      style={{ background: `linear-gradient(135deg, ${COVER_COLORS[event.event_type] || '#FF6B6B'}, ${COVER_COLORS[event.event_type] || '#FF6B6B'}dd)` }}>
      <span className="text-6xl mb-4">{EVENT_EMOJI[event.event_type] || '🎉'}</span>
      <h1 className="text-2xl font-bold text-center mb-2">{event.title}</h1>
      <p className="text-lg opacity-90 mb-6">{event.recipient_name}님에게</p>
      <div className="text-sm opacity-75">
        <p>{contributors.length}명의 마음을 담아</p>
        <p className="mt-1">{contributors.map(c => c.contributor_name).join(', ')}</p>
      </div>
      <p className="absolute bottom-6 text-xs opacity-50">CeleBook</p>
    </div>
  )
);

const MessagePage = forwardRef<HTMLDivElement, { contribution: Contribution; pageNum: number }>(
  ({ contribution, pageNum }, ref) => (
    <div ref={ref} className="w-full h-full bg-white flex flex-col p-6 relative">
      {contribution.image_url ? (
        <>
          <img src={contribution.image_url} alt="" className="w-full h-48 object-cover rounded-xl mb-4" />
          <div className="flex-1 flex flex-col">
            <p className="text-gray-800 text-sm leading-relaxed flex-1">{contribution.message}</p>
            <p className="text-right text-gray-500 font-medium mt-4">— {contribution.contributor_name}</p>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col justify-center">
          <div className="text-4xl text-center mb-6 opacity-20">💌</div>
          <p className="text-gray-800 text-base leading-relaxed text-center px-4">{contribution.message}</p>
          <p className="text-right text-gray-500 font-medium mt-8">— {contribution.contributor_name}</p>
        </div>
      )}
      <span className="absolute bottom-3 right-4 text-xs text-gray-300">{pageNum}</span>
    </div>
  )
);

const BackCoverPage = forwardRef<HTMLDivElement, { event: Event }>(
  ({ event }, ref) => (
    <div ref={ref} className="w-full h-full flex flex-col items-center justify-center p-8"
      style={{ background: `linear-gradient(135deg, ${COVER_COLORS[event.event_type] || '#FF6B6B'}cc, ${COVER_COLORS[event.event_type] || '#FF6B6B'})` }}>
      <p className="text-white text-lg font-medium">with love ❤️</p>
      <p className="text-white text-sm opacity-75 mt-2">Powered by CeleBook</p>
    </div>
  )
);

export default function BookPreview() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [event, setEvent] = useState<Event | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const bookRef = useRef<any>(null);

  useEffect(() => {
    if (!shareCode) return;
    Promise.all([
      getEventAdmin(shareCode, token),
      getContributions(shareCode),
    ]).then(([ev, contribs]) => {
      setEvent(ev);
      setContributions(contribs);
    }).finally(() => setLoading(false));
  }, [shareCode, token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">불러오는 중...</p></div>;
  if (!event) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">이벤트를 찾을 수 없습니다.</p></div>;
  if (contributions.length === 0) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">메시지가 없습니다.</p></div>;

  const totalPages = contributions.length + 2; // cover + messages + back cover

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center p-4">
      <div className="mb-4 text-center">
        <h1 className="text-white text-lg font-bold">{event.title} — 미리보기</h1>
        <p className="text-gray-400 text-sm">클릭하거나 드래그하여 페이지를 넘기세요</p>
      </div>

      <div className="shadow-2xl">
        {/* @ts-ignore - react-pageflip typing issues */}
        <HTMLFlipBook
          width={320}
          height={450}
          size="fixed"
          minWidth={280}
          maxWidth={400}
          minHeight={400}
          maxHeight={550}
          showCover={true}
          className="book-preview"
          ref={bookRef}
          onFlip={(e: any) => setCurrentPage(e.data)}
          flippingTime={600}
          usePortrait={true}
          startPage={0}
          drawShadow={true}
          maxShadowOpacity={0.3}
          mobileScrollSupport={true}
          style={{}}
          startZIndex={0}
          autoSize={false}
          clickEventForward={false}
          useMouseEvents={true}
          swipeDistance={30}
          showPageCorners={true}
          disableFlipByClick={false}
        >
          <CoverPage event={event} contributors={contributions} />
          {contributions.map((c, i) => (
            <MessagePage key={c.id} contribution={c} pageNum={i + 1} />
          ))}
          <BackCoverPage event={event} />
        </HTMLFlipBook>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={() => bookRef.current?.pageFlip()?.flipPrev()}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition cursor-pointer text-sm"
        >
          ← 이전
        </button>
        <span className="text-gray-400 text-sm">
          {currentPage + 1} / {totalPages}
        </span>
        <button
          onClick={() => bookRef.current?.pageFlip()?.flipNext()}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition cursor-pointer text-sm"
        >
          다음 →
        </button>
      </div>

      <button
        onClick={() => window.history.back()}
        className="mt-4 px-6 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition cursor-pointer text-sm"
      >
        대시보드로 돌아가기
      </button>
    </div>
  );
}
