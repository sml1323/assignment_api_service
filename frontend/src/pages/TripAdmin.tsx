import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { getTrip, getPages, getDays, uploadPagesBulk, updateTripStatus, finalizeBook, getAuditLog, getOrderStatus, getCreditBalance, getCreditTransactions, sandboxCharge, updateDay, movePage, setCover } from '../lib/api';
import type { Trip, Page, TripDay, AuditEntry } from '../lib/api';

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

export default function TripAdmin() {
  const { tripId } = useParams<{ tripId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const _fileRef = useRef<HTMLInputElement>(null); void _fileRef;

  const adminToken = searchParams.get('token') || localStorage.getItem(`trip_admin_${tripId}`) || '';

  const [trip, setTrip] = useState<Trip | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [days, setDays] = useState<TripDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadingDayId, setUploadingDayId] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [tab, setTab] = useState<'album' | 'status' | 'order' | 'credits'>('album');
  const [copied, setCopied] = useState(false);
  const [_expandedPage, _setExpandedPage] = useState<string | null>(null); void _expandedPage; void _setExpandedPage;
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [movingTo, setMovingTo] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditEnv, setCreditEnv] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [chargeAmount, setChargeAmount] = useState('100000');
  const [charging, setCharging] = useState(false);

  useEffect(() => {
    if (adminToken && tripId) {
      localStorage.setItem(`trip_admin_${tripId}`, adminToken);
    }
    loadData();
  }, [tripId]);

  const loadData = async () => {
    if (!tripId || !adminToken) return;
    try {
      const [t, p, daysRes] = await Promise.allSettled([
        getTrip(tripId, adminToken),
        getPages(tripId, adminToken, true),
        getDays(tripId, adminToken, true),
      ]);
      if (t.status === 'fulfilled') setTrip(t.value);
      if (p.status === 'fulfilled') setPages(p.value);
      if (daysRes.status === 'fulfilled') setDays(daysRes.value.days);
      try {
        const audit = await getAuditLog(tripId, adminToken);
        setAuditLog(audit);
      } catch {}
      const tripData = t.status === 'fulfilled' ? t.value : null;
      if (tripData?.status === 'ordered' && tripData?.sweetbook_order_uid) {
        try {
          const od = await getOrderStatus(tripId, adminToken);
          setOrderDetail(od);
        } catch {}
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files: FileList, dayId?: string) => {
    if (!tripId) return;
    setUploading(true);
    setUploadingDayId(dayId || null);
    try {
      await uploadPagesBulk(tripId, Array.from(files), adminToken, dayId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      setUploadingDayId(null);
    }
  };

  const handleMovePage = async (pageId: string, targetDayId: string) => {
    if (!tripId) return;
    try {
      await movePage(pageId, adminToken, targetDayId);
      setSelectedPages(new Set());
      setMovingTo(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMoveSelected = async (targetDayId: string) => {
    for (const pageId of selectedPages) {
      await handleMovePage(pageId, targetDayId);
    }
  };

  const handleSetCover = async (pageId: string) => {
    if (!tripId) return;
    try {
      await setCover(tripId, adminToken, pageId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDayTitleSave = async (dayId: string) => {
    if (!tripId) return;
    try {
      await updateDay(tripId, dayId, adminToken, { title: editTitle });
      setEditingDay(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const togglePageSelection = (pageId: string) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!tripId) return;
    try {
      await updateTripStatus(tripId, newStatus, adminToken);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFinalize = async () => {
    if (!tripId || !confirm('포토북을 확정하시겠습니까? 확정 후에는 참여자가 더 이상 메시지를 작성할 수 없습니다.')) return;
    setFinalizing(true);
    try {
      await finalizeBook(tripId, adminToken);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFinalizing(false);
    }
  };

  const shareUrl = trip ? `${window.location.origin}/join/${trip.share_token}` : '';

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center space-y-3">
          <p className="text-sm text-red-500">{error || '여행을 찾을 수 없습니다'}</p>
          <button onClick={() => navigate('/')} className="text-sm text-orange-500 hover:text-orange-600 transition-colors">
            홈으로
          </button>
        </div>
      </div>
    );
  }

  const tabItems = [
    { key: 'album' as const, label: '앨범' },
    { key: 'status' as const, label: '참여' },
    { key: 'order' as const, label: '주문' },
    { key: 'credits' as const, label: '충전금' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button onClick={() => navigate('/')} className="text-gray-300 hover:text-gray-500 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold text-gray-800 truncate">{trip.title}</h1>
                  <p className="text-xs text-gray-400">{trip.destination} · {trip.page_count}p</p>
                </div>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${statusColors[trip.status]}`}>
              {statusLabels[trip.status]}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex px-5">
          {tabItems.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 py-5">
        {/* Share Link Banner */}
        {trip.status === 'collecting' && (
          <div className="bg-orange-50 rounded-2xl p-4 mb-5 border border-orange-100">
            <p className="text-xs font-medium text-orange-600 mb-2">공유 링크</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 bg-white border border-orange-200 rounded-xl text-xs text-gray-500 truncate"
              />
              <button
                onClick={copyShareLink}
                className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 active:scale-[0.98] transition-all duration-150 flex-shrink-0"
              >
                {copied ? '복사됨!' : '복사'}
              </button>
            </div>
          </div>
        )}

        {/* Album Tab */}
        {tab === 'album' && (
          <div className="space-y-4">
            {/* Cover Section */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">표지</p>
              {trip.cover_image ? (
                <div className="flex items-center gap-4">
                  <img src={trip.cover_image} alt="표지" className="w-24 h-16 object-cover rounded-xl" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">표지 사진 설정됨</p>
                    <p className="text-xs text-gray-400 mt-0.5">아래 사진에서 다른 사진을 선택할 수도 있어요</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-400">표지 사진을 선택하세요</p>
                  <p className="text-xs text-gray-300">아래 Day 사진에 마우스를 올려 "표지로" 버튼을 누르거나, 직접 업로드하세요</p>
                  <input
                    type="file"
                    accept="image/*"
                    id="cover-upload"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !tripId || !days[0]) return;
                      // 표지 전용: 첫 번째 Day에 업로드 후 바로 표지로 설정
                      try {
                        const result = await uploadPagesBulk(tripId, [file], adminToken, days[0].id);
                        if (result.pages[0]) {
                          await setCover(tripId, adminToken, result.pages[0].id);
                        }
                        await loadData();
                      } catch (err: any) {
                        setError(err.message);
                      }
                    }}
                  />
                  <label
                    htmlFor="cover-upload"
                    className="inline-block px-4 py-2 border border-gray-200 hover:border-orange-300
                               rounded-xl text-sm text-gray-500 hover:text-orange-500 cursor-pointer
                               transition-all duration-150"
                  >
                    사진 업로드
                  </label>
                </div>
              )}
            </div>

            {/* Day Sections */}
            {days.map((day) => {
              const dayDate = day.date ? new Date(day.date + 'T00:00:00') : null;
              const dayLabel = dayDate
                ? `${dayDate.getMonth() + 1}/${dayDate.getDate()}(${['일','월','화','수','목','금','토'][dayDate.getDay()]})`
                : '';
              return (
                <div key={day.id} className="space-y-2">
                  {/* Day Header */}
                  <div className="flex items-baseline gap-2 pt-2">
                    <span className="text-base font-semibold text-gray-800">Day {day.day_number}</span>
                    <span className="text-xs text-gray-400">{dayLabel}</span>
                  </div>

                  {/* Day Title (inline edit) */}
                  {editingDay === day.id ? (
                    <div className="flex gap-2">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleDayTitleSave(day.id)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-200"
                        autoFocus
                      />
                      <button onClick={() => handleDayTitleSave(day.id)} className="text-orange-500 text-sm font-medium">저장</button>
                      <button onClick={() => setEditingDay(null)} className="text-gray-400 text-sm">취소</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingDay(day.id); setEditTitle(day.title || ''); }}
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {day.title || 'Day 제목 추가...'} <span className="text-gray-300 text-xs">편집</span>
                    </button>
                  )}

                  {/* Photo Grid */}
                  {day.pages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {day.pages.map((page) => {
                        const isSelected = selectedPages.has(page.id);
                        return (
                          <div
                            key={page.id}
                            className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group ${
                              isSelected ? 'ring-2 ring-orange-500' : ''
                            }`}
                            onClick={() => togglePageSelection(page.id)}
                          >
                            <img src={page.photo_url} alt="" className="w-full h-full object-cover" />
                            {/* Checkbox overlay */}
                            <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-orange-500 border-orange-500'
                                : 'border-white/80 bg-black/20 opacity-0 group-hover:opacity-100'
                            }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            {/* Cover badge */}
                            {trip.cover_image === page.photo_url && (
                              <div className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">표지</div>
                            )}
                            {/* Set as cover (on hover) */}
                            {trip.cover_image !== page.photo_url && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSetCover(page.id); }}
                                className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                표지로
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-gray-300 text-sm">
                      사진을 추가해보세요
                    </div>
                  )}

                  {/* Per-day upload */}
                  {(trip.status === 'draft' || trip.status === 'collecting') && (
                    <>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        id={`upload-${day.id}`}
                        className="hidden"
                        onChange={(e) => e.target.files && handleUpload(e.target.files, day.id)}
                      />
                      <label
                        htmlFor={`upload-${day.id}`}
                        className="block w-full py-3 border-2 border-dashed border-gray-200 hover:border-orange-300
                                   rounded-xl text-gray-400 hover:text-orange-500 text-center text-sm cursor-pointer
                                   transition-all duration-150"
                      >
                        {uploading && uploadingDayId === day.id ? '업로드 중...' : '+ 사진 추가'}
                      </label>
                    </>
                  )}
                </div>
              );
            })}

            {/* Bottom Actions */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => navigate(`/trip/${tripId}/preview`)}
                className="w-full py-3 border border-gray-200 hover:border-gray-300 hover:bg-gray-50
                           text-gray-600 rounded-xl font-medium transition-all duration-150"
              >
                미리보기
              </button>

              {trip.status === 'draft' && (
                <button
                  onClick={() => handleStatusChange('collecting')}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:scale-[0.98]
                             text-white rounded-xl font-medium transition-all duration-150"
                >
                  참여자 초대 시작하기
                </button>
              )}
            </div>

            {/* Sticky bottom bar for selection */}
            {selectedPages.size > 0 && (
              <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50">
                <div className="max-w-2xl mx-auto flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">{selectedPages.size}장 선택</span>
                  <select
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
                    value={movingTo || ''}
                    onChange={(e) => setMovingTo(e.target.value || null)}
                  >
                    <option value="">Day 이동...</option>
                    {days.map(d => (
                      <option key={d.id} value={d.id}>Day {d.day_number} · {d.date}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => movingTo && handleMoveSelected(movingTo)}
                    disabled={!movingTo}
                    className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
                  >
                    이동
                  </button>
                  <button
                    onClick={() => { setSelectedPages(new Set()); setMovingTo(null); }}
                    className="text-gray-400 text-sm"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status Tab */}
        {tab === 'status' && (
          <div className="space-y-4">
            {/* Progress */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex justify-between mb-3">
                <span className="text-sm text-gray-500">참여 현황</span>
                <span className="text-sm font-semibold text-orange-600">
                  {trip.zone_stats.claimed} / {trip.zone_stats.total}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-orange-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${trip.zone_stats.total ? (trip.zone_stats.claimed / trip.zone_stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Per-page status */}
            {pages.map((page) => (
              <div key={page.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-sm font-medium text-gray-800 mb-3">{page.subtitle || `Page ${page.page_number}`}</p>
                <div className="grid grid-cols-2 gap-2">
                  {page.zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`px-3 py-2 rounded-xl text-xs ${
                        zone.claimed_by
                          ? 'bg-orange-50 text-orange-600'
                          : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      Zone {zone.zone_number}: {zone.claimed_by || '비어있음'}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {trip.status === 'collecting' && (
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => navigate(`/trip/${tripId}/preview`)}
                  className="w-full py-3 border border-gray-200 hover:border-gray-300 hover:bg-gray-50
                             text-gray-600 rounded-xl font-medium transition-all duration-150"
                >
                  미리보기
                </button>
                <button
                  onClick={handleFinalize}
                  disabled={finalizing}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:scale-[0.98]
                             disabled:bg-gray-200 disabled:text-gray-400 disabled:scale-100
                             text-white rounded-xl font-medium transition-all duration-150"
                >
                  {finalizing ? '포토북 생성 중...' : '포토북 확정하기'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Order Tab */}
        {tab === 'order' && (
          <div className="space-y-5">
            {trip.status === 'finalized' ? (
              <div className="space-y-5">
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-800">포토북 확정 완료</h2>
                  <p className="text-sm text-gray-400 mt-1">주문할 준비가 되었습니다</p>
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                  {[
                    { label: 'Book UID', value: trip.sweetbook_book_uid, mono: true },
                    { label: '사양', value: 'A4 소프트커버 포토북' },
                    { label: '페이지', value: `${trip.page_count}p (최소 24p)` },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between text-sm">
                      <span className="text-gray-400">{row.label}</span>
                      <span className={`text-gray-700 ${row.mono ? 'font-mono text-xs' : ''}`}>{row.value}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate(`/trip/${tripId}/order?token=${adminToken}`)}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:scale-[0.98]
                             text-white rounded-xl font-semibold transition-all duration-150"
                >
                  주문하기
                </button>
              </div>
            ) : trip.status === 'ordered' ? (
              <div className="space-y-5">
                <div className="text-center py-2">
                  <h2 className="text-lg font-semibold text-gray-800">주문 완료</h2>
                  <p className="text-xs text-gray-400 font-mono mt-1">{trip.sweetbook_order_uid}</p>
                </div>

                {/* Timeline */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">주문 상태</p>
                  <div className="space-y-4">
                    {[
                      { code: 20, label: '결제 완료', icon: '💳' },
                      { code: 25, label: 'PDF 생성', icon: '📄' },
                      { code: 30, label: '제작 확정', icon: '✅' },
                      { code: 40, label: '인쇄 중', icon: '🖨️' },
                      { code: 50, label: '인쇄 완료', icon: '📋' },
                      { code: 60, label: '발송', icon: '🚚' },
                      { code: 70, label: '배송 완료', icon: '🎉' },
                    ].map((step) => {
                      const currentCode = orderDetail?.orderStatus || 20;
                      const isDone = step.code <= currentCode;
                      const isCurrent = step.code === currentCode;
                      return (
                        <div key={step.code} className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0
                            ${isDone ? 'bg-emerald-50' : 'bg-gray-50'}
                            ${isCurrent ? 'ring-2 ring-emerald-400 ring-offset-2' : ''}`}>
                            {step.icon}
                          </div>
                          <span className={`text-sm flex-1 ${isDone ? 'text-gray-800 font-medium' : 'text-gray-300'}`}>
                            {step.label}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-medium">현재</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="text-sm text-gray-300">포토북 확정 후 주문할 수 있습니다</p>
              </div>
            )}

            {/* Audit Log */}
            {auditLog.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">활동 로그</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {auditLog.slice(0, 20).map((entry) => (
                    <div key={entry.id} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-300 flex-shrink-0 w-12 tabular-nums">
                        {new Date(entry.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-medium flex-shrink-0 ${
                        entry.action.startsWith('webhook') ? 'bg-violet-50 text-violet-500' :
                        entry.action.startsWith('order') ? 'bg-blue-50 text-blue-500' :
                        entry.action.startsWith('book') ? 'bg-emerald-50 text-emerald-500' :
                        'bg-gray-50 text-gray-400'
                      }`}>
                        {entry.action}
                      </span>
                      <span className="text-gray-400 truncate">{entry.actor}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Credits Tab */}
        {tab === 'credits' && (
          <CreditsTab
            chargeAmount={chargeAmount}
            setChargeAmount={setChargeAmount}
            charging={charging}
            setCharging={setCharging}
            creditBalance={creditBalance}
            setCreditBalance={setCreditBalance}
            creditEnv={creditEnv}
            setCreditEnv={setCreditEnv}
            transactions={transactions}
            setTransactions={setTransactions}
          />
        )}
      </div>
    </div>
  );
}

function CreditsTab({
  chargeAmount, setChargeAmount, charging, setCharging,
  creditBalance, setCreditBalance, creditEnv, setCreditEnv,
  transactions, setTransactions,
}: {
  chargeAmount: string; setChargeAmount: (v: string) => void;
  charging: boolean; setCharging: (v: boolean) => void;
  creditBalance: number | null; setCreditBalance: (v: number | null) => void;
  creditEnv: string; setCreditEnv: (v: string) => void;
  transactions: any[]; setTransactions: (v: any[]) => void;
}) {
  const [error, setError] = useState('');
  const [chargeSuccess, setChargeSuccess] = useState('');

  const loadCredits = async () => {
    try {
      const bal = await getCreditBalance('');
      setCreditBalance(bal.balance);
      setCreditEnv(bal.env);
      const txn = await getCreditTransactions(10);
      setTransactions(txn.transactions || []);
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => { loadCredits(); }, []);

  const handleCharge = async () => {
    const amount = parseInt(chargeAmount);
    if (!amount || amount < 1000) return;
    setCharging(true);
    setError('');
    setChargeSuccess('');
    try {
      await sandboxCharge(amount, '테스트 충전');
      setChargeSuccess(`${amount.toLocaleString()}원 충전 완료!`);
      await loadCredits();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCharging(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Balance */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">충전금 잔액</p>
        {creditBalance != null ? (
          <div>
            <p className="text-3xl font-bold text-gray-800 tracking-tight">{creditBalance.toLocaleString()}<span className="text-lg font-normal text-gray-400 ml-1">원</span></p>
            {creditEnv && (
              <span className="inline-block mt-2 px-2 py-0.5 bg-gray-50 text-gray-400 text-[10px] font-medium rounded-full uppercase tracking-wider">
                {creditEnv === 'test' ? 'Sandbox' : 'Production'}
              </span>
            )}
          </div>
        ) : (
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        )}
      </div>

      {/* Sandbox Charge */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">테스트 충전</p>
        <div className="flex gap-2">
          <select
            value={chargeAmount}
            onChange={(e) => setChargeAmount(e.target.value)}
            className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 transition-all"
          >
            <option value="10000">10,000원</option>
            <option value="50000">50,000원</option>
            <option value="100000">100,000원</option>
            <option value="500000">500,000원</option>
          </select>
          <button
            onClick={handleCharge}
            disabled={charging}
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-[0.98]
                       disabled:bg-gray-200 disabled:text-gray-400 disabled:scale-100
                       text-white text-sm font-medium rounded-xl transition-all duration-150"
          >
            {charging ? '...' : '충전'}
          </button>
        </div>
        {chargeSuccess && <p className="text-sm text-emerald-600 mt-2">{chargeSuccess}</p>}
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">거래 내역</p>
        {transactions.length === 0 ? (
          <p className="text-sm text-gray-300">거래 내역이 없습니다</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map((tx: any, i: number) => (
              <div key={tx.transactionId || i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm text-gray-700">{tx.reasonDisplay || tx.memo || '거래'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(tx.createdAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${tx.direction === '+' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {tx.direction === '+' ? '+' : ''}{tx.amount?.toLocaleString()}원
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
