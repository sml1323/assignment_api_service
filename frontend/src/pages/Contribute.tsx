import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPages, claimZone, updateMessage } from '../lib/api';
import type { Page, Zone, Message } from '../lib/api';

const COLOR_PRESETS = [
  { hex: '#FFFFFF', name: '흰색' },
  { hex: '#FFD700', name: '노랑' },
  { hex: '#FF6B6B', name: '빨강' },
  { hex: '#7FDBFF', name: '하늘' },
  { hex: '#2ECC40', name: '초록' },
  { hex: '#FF851B', name: '주황' },
  { hex: '#B10DC9', name: '보라' },
  { hex: '#FFAFD8', name: '핑크' },
];

const POSITION_PRESETS = [
  { x: 75, y: 15, label: '우상' },
  { x: 75, y: 50, label: '우중' },
  { x: 75, y: 85, label: '우하' },
  { x: 25, y: 15, label: '좌상' },
  { x: 25, y: 50, label: '좌중' },
  { x: 25, y: 85, label: '좌하' },
];

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

export default function Contribute() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const shareToken = sessionStorage.getItem('share_token') || '';
  const participantName = sessionStorage.getItem('participant_name') || '';

  // Modal state
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [messageText, setMessageText] = useState('');
  const [selectedColor, setSelectedColor] = useState('#FFFFFF');
  const [selectedPos, setSelectedPos] = useState({ x: 75, y: 15 });
  const [submitting, setSubmitting] = useState(false);

  // Drag state
  const [dragging, setDragging] = useState<string | null>(null); // message id
  const photoRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((msgId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setDragging(msgId);
  }, []);

  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging || !photoRef.current) return;
    const rect = photoRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));

    // Update local state immediately for smooth visual feedback
    setPages(prev => prev.map(p => ({
      ...p,
      zones: p.zones.map(z => ({
        ...z,
        message: z.message?.id === dragging
          ? { ...z.message, position_x: Math.round(x), position_y: Math.round(y) }
          : z.message,
      })),
    })));
  }, [dragging]);

  const handleDragEnd = useCallback(async () => {
    if (!dragging) return;
    const page = pages[currentPage];
    const zone = page?.zones.find(z => z.message?.id === dragging);
    if (zone?.message) {
      try {
        await updateMessage(dragging, shareToken, false, {
          position_x: zone.message.position_x,
          position_y: zone.message.position_y,
        });
      } catch { /* silent — position already updated locally */ }
    }
    setDragging(null);
  }, [dragging, pages, currentPage, shareToken]);

  useEffect(() => {
    if (!tripId || !shareToken) {
      setError('접근 권한이 없습니다');
      setLoading(false);
      return;
    }
    loadPages();
  }, [tripId]);

  const loadPages = async () => {
    try {
      const data = await getPages(tripId!, shareToken, false);
      setPages(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openNewModal = (zone: Zone) => {
    setSelectedZone(zone);
    setEditingMessage(null);
    setMessageText('');
    setSelectedColor('#FFFFFF');
    setSelectedPos(zone.zone_number <= 2
      ? POSITION_PRESETS[zone.zone_number - 1]
      : { x: 50, y: 50 });
    setError('');
  };

  const openEditModal = (zone: Zone) => {
    if (!zone.message) return;
    setSelectedZone(zone);
    setEditingMessage(zone.message);
    setMessageText(zone.message.content);
    setSelectedColor(zone.message.color || '#FFFFFF');
    setSelectedPos({ x: zone.message.position_x, y: zone.message.position_y });
    setError('');
  };

  const closeModal = () => {
    setSelectedZone(null);
    setEditingMessage(null);
    setMessageText('');
    setError('');
  };

  const handleSubmit = async () => {
    if (!selectedZone || !messageText.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      if (editingMessage) {
        await updateMessage(editingMessage.id, shareToken, false, {
          content: messageText.trim(),
          color: selectedColor,
          position_x: selectedPos.x,
          position_y: selectedPos.y,
        });
      } else {
        await claimZone(selectedZone.id, shareToken, {
          author_name: participantName,
          content: messageText.trim(),
          color: selectedColor,
          position_x: selectedPos.x,
          position_y: selectedPos.y,
        });
      }
      closeModal();
      await loadPages();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">페이지 로딩 중...</p></div>;
  }

  if (!shareToken || !participantName) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">공유 링크를 통해 접속해주세요</p>
          <button onClick={() => navigate('/')} className="text-orange-500 hover:underline">홈으로</button>
        </div>
      </div>
    );
  }

  const page = pages[currentPage];
  if (!page) return null;

  const isOverlayZone = (z: Zone) => z.zone_number <= 2;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-500">{participantName}님</span>
        <span className="text-sm text-gray-400">{currentPage + 1} / {pages.length}</span>
      </div>

      <div className="max-w-lg mx-auto p-4">
        {page.subtitle && (
          <div className="text-center mb-3">
            <p className="text-sm font-medium text-gray-500">{page.subtitle}</p>
          </div>
        )}

        {/* Photo + Overlay Zones */}
        <div
          ref={photoRef}
          className="relative bg-white rounded-2xl overflow-hidden shadow-lg select-none"
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchMove={handleDragMove}
          onTouchEnd={handleDragEnd}
        >
          <img
            src={page.photo_url}
            alt={page.caption || `Page ${page.page_number}`}
            className="w-full aspect-[4/3] object-cover pointer-events-none"
            draggable={false}
          />

          {/* Overlay messages on photo (zones 1-2) — draggable */}
          {page.zones
            .filter((z) => isOverlayZone(z) && z.message)
            .map((zone) => (
              <div
                key={zone.id}
                className={`absolute px-2 py-1 transition-opacity ${
                  dragging === zone.message!.id
                    ? 'opacity-90 cursor-grabbing ring-2 ring-white/50 rounded-lg'
                    : 'cursor-grab hover:opacity-80'
                }`}
                style={{
                  left: `${zone.message!.position_x}%`,
                  top: `${zone.message!.position_y}%`,
                  transform: 'translate(-50%, -50%)',
                  maxWidth: '45%',
                }}
                onMouseDown={(e) => handleDragStart(zone.message!.id, e)}
                onTouchStart={(e) => handleDragStart(zone.message!.id, e)}
                onDoubleClick={() => openEditModal(zone)}
              >
                <p
                  className="text-sm font-medium leading-snug"
                  style={{
                    color: zone.message!.color,
                    textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.4)',
                  }}
                >
                  {zone.message!.content}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{
                    color: zone.message!.color,
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    opacity: 0.7,
                  }}
                >
                  — {zone.message!.author_name}
                </p>
                {zone.message!.updated_at && (
                  <p className="text-[9px] mt-0.5" style={{ color: zone.message!.color, opacity: 0.5, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
                    {timeAgo(zone.message!.updated_at)}
                  </p>
                )}
              </div>
            ))}

          {/* Empty overlay zones — click to add */}
          {page.zones
            .filter((z) => isOverlayZone(z) && !z.message)
            .map((zone) => {
              const defaultPos = POSITION_PRESETS[zone.zone_number - 1] || POSITION_PRESETS[0];
              return (
                <button
                  key={zone.id}
                  onClick={() => openNewModal(zone)}
                  className="absolute bg-white/10 hover:bg-white/30 border border-dashed border-white/50 rounded-lg px-3 py-2 text-white/70 text-xs transition-all cursor-pointer"
                  style={{
                    left: `${defaultPos.x}%`,
                    top: `${defaultPos.y}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  + 추억
                </button>
              );
            })}

          {page.caption && (
            <div className="px-4 py-2 bg-gray-50">
              <p className="text-sm text-gray-600">{page.caption}</p>
            </div>
          )}
        </div>

        {/* Bottom Zones (3-4) */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          {page.zones
            .filter((z) => !isOverlayZone(z))
            .map((zone) => (
              <div key={zone.id}>
                {zone.message ? (
                  <div
                    className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => openEditModal(zone)}
                  >
                    <p className="text-gray-700 text-sm leading-relaxed">{zone.message.content}</p>
                    <p className="text-gray-400 text-xs mt-2 text-right">— {zone.message.author_name}</p>
                    {zone.message.updated_at && (
                      <p className="text-gray-300 text-[10px]">{timeAgo(zone.message.updated_at)}</p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => openNewModal(zone)}
                    className="w-full bg-white hover:bg-orange-50 border-2 border-dashed border-gray-200 hover:border-orange-300 rounded-xl p-4 text-gray-400 text-sm transition-colors cursor-pointer min-h-[100px] flex items-center justify-center"
                  >
                    ✏️ 추억 남기기
                  </button>
                )}
              </div>
            ))}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-4 py-2 text-gray-500 disabled:text-gray-300"
          >
            ← 이전
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
            disabled={currentPage === pages.length - 1}
            className="px-4 py-2 text-orange-500 disabled:text-gray-300"
          >
            다음 →
          </button>
        </div>
      </div>

      {/* Modal — New or Edit */}
      {selectedZone && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-6 space-y-4">
            <h3 className="text-lg font-medium text-gray-800">
              {editingMessage ? '수정하기' : '추억 남기기'}
            </h3>
            <p className="text-sm text-gray-500">
              {editingMessage ? `${editingMessage.author_name}님의 메시지` : `${participantName}님의 이름으로 작성됩니다`}
            </p>

            {/* Text input */}
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="이 순간의 추억을 남겨주세요..."
              maxLength={selectedZone.max_length}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-300 outline-none resize-none h-28"
              autoFocus
            />

            {/* Color Picker */}
            {isOverlayZone(selectedZone) && (
              <div>
                <p className="text-xs text-gray-500 mb-2">글자 색상</p>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setSelectedColor(c.hex)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        selectedColor === c.hex ? 'border-orange-500 scale-110' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Position Picker (overlay zones only) */}
            {isOverlayZone(selectedZone) && (
              <div>
                <p className="text-xs text-gray-500 mb-2">위치</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {POSITION_PRESETS.map((pos) => (
                    <button
                      key={`${pos.x}-${pos.y}`}
                      onClick={() => setSelectedPos(pos)}
                      className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedPos.x === pos.x && selectedPos.y === pos.y
                          ? 'bg-orange-100 text-orange-700 border border-orange-300'
                          : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {isOverlayZone(selectedZone) && messageText && (
              <div className="bg-gray-800 rounded-xl p-4 relative min-h-[60px]">
                <p
                  className="text-sm font-medium"
                  style={{
                    color: selectedColor,
                    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                  }}
                >
                  {messageText}
                </p>
                <p className="text-xs mt-1 opacity-60" style={{ color: selectedColor }}>
                  — {editingMessage?.author_name || participantName}
                </p>
              </div>
            )}

            <div className="text-xs text-gray-400">
              {messageText.length} / {selectedZone.max_length}
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!messageText.trim() || submitting}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-xl transition-colors"
              >
                {submitting ? '처리 중...' : editingMessage ? '수정하기' : '작성하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
