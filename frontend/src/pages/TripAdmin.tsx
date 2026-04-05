import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { getTrip, getPages, uploadPagesBulk, updateTripStatus, finalizeBook, reorderPages } from '../lib/api';
import type { Trip, Page } from '../lib/api';

export default function TripAdmin() {
  const { tripId } = useParams<{ tripId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const adminToken = searchParams.get('token') || localStorage.getItem(`trip_admin_${tripId}`) || '';

  const [trip, setTrip] = useState<Trip | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [tab, setTab] = useState<'pages' | 'status' | 'order'>('pages');
  const [copied, setCopied] = useState(false);
  const [expandedPage, setExpandedPage] = useState<string | null>(null);

  useEffect(() => {
    if (adminToken && tripId) {
      localStorage.setItem(`trip_admin_${tripId}`, adminToken);
    }
    loadData();
  }, [tripId]);

  const loadData = async () => {
    if (!tripId || !adminToken) return;
    try {
      const [t, p] = await Promise.all([
        getTrip(tripId, adminToken),
        getPages(tripId, adminToken, true),
      ]);
      setTrip(t);
      setPages(p);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (files: FileList) => {
    if (!tripId) return;
    setUploading(true);
    try {
      await uploadPagesBulk(tripId, Array.from(files), adminToken);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
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
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500">로딩 중...</p></div>;
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500 mb-2">{error || '여행을 찾을 수 없습니다'}</p>
          <button onClick={() => navigate('/')} className="text-orange-500 hover:underline">홈으로</button>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-serif font-bold text-gray-800">{trip.title}</h1>
              <p className="text-sm text-gray-500">{trip.destination} · {trip.page_count}페이지</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[trip.status]}`}>
              {statusLabels[trip.status]}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto flex">
          {(['pages', 'status', 'order'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'pages' ? '페이지 관리' : t === 'status' ? '참여 현황' : '주문'}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        {/* Share Link */}
        {trip.status === 'collecting' && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
            <p className="text-sm font-medium text-orange-800 mb-2">공유 링크</p>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 bg-white border border-orange-200 rounded-lg text-sm text-gray-600"
              />
              <button
                onClick={copyShareLink}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 transition-colors"
              >
                {copied ? '복사됨!' : '복사'}
              </button>
            </div>
          </div>
        )}

        {/* Pages Tab */}
        {tab === 'pages' && (
          <div className="space-y-4">
            {trip.status === 'draft' && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files && handleUpload(e.target.files)}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-4 border-2 border-dashed border-gray-300 hover:border-orange-400 rounded-xl text-gray-500 hover:text-orange-500 transition-colors"
                >
                  {uploading ? '업로드 중...' : '📷 사진 일괄 업로드'}
                </button>
              </>
            )}

            {pages.length === 0 ? (
              <p className="text-center text-gray-400 py-8">아직 페이지가 없습니다</p>
            ) : (
              <div className="space-y-3">
                {pages.map((page, idx) => {
                  const claimedCount = page.zones.filter((z) => z.claimed_by).length;
                  const isExpanded = expandedPage === page.id;
                  return (
                    <div key={page.id} className="bg-white rounded-xl overflow-hidden shadow-sm">
                      <div className="flex gap-3 p-3">
                        {/* Reorder buttons */}
                        <div className="flex flex-col justify-center gap-1 flex-shrink-0">
                          <button
                            onClick={async () => {
                              if (idx === 0) return;
                              const ids = pages.map(p => p.id);
                              [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                              await reorderPages(tripId!, ids, adminToken);
                              await loadData();
                            }}
                            disabled={idx === 0}
                            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:text-gray-200 text-xs"
                          >▲</button>
                          <span className="text-[10px] text-gray-300 text-center">{idx + 1}</span>
                          <button
                            onClick={async () => {
                              if (idx === pages.length - 1) return;
                              const ids = pages.map(p => p.id);
                              [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                              await reorderPages(tripId!, ids, adminToken);
                              await loadData();
                            }}
                            disabled={idx === pages.length - 1}
                            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:text-gray-200 text-xs"
                          >▼</button>
                        </div>

                        <img
                          src={page.photo_url}
                          alt={`Page ${page.page_number}`}
                          className="w-20 h-16 object-cover rounded-lg flex-shrink-0 cursor-pointer"
                          onClick={() => setExpandedPage(isExpanded ? null : page.id)}
                        />
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => setExpandedPage(isExpanded ? null : page.id)}
                        >
                          <p className="text-sm font-medium text-gray-700 truncate">
                            {page.subtitle || `Page ${page.page_number}`}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {claimedCount}/{page.zones.length} 존 작성됨
                          </p>
                          <div className="flex gap-1 mt-1">
                            {page.zones.map((z) => (
                              <div
                                key={z.id}
                                className={`w-2 h-2 rounded-full ${z.claimed_by ? 'bg-orange-400' : 'bg-gray-200'}`}
                              />
                            ))}
                          </div>
                        </div>
                        <span
                          className="text-gray-300 self-center cursor-pointer"
                          onClick={() => setExpandedPage(isExpanded ? null : page.id)}
                        >{isExpanded ? '▲' : '▼'}</span>
                      </div>

                      {isExpanded && (
                        <div className="border-t px-3 pb-3 pt-2 space-y-2">
                          {page.zones.map((zone) => (
                            <div
                              key={zone.id}
                              className={`p-2 rounded-lg text-sm ${
                                zone.message ? 'bg-orange-50' : 'bg-gray-50'
                              }`}
                            >
                              <span className="text-xs text-gray-400">Zone {zone.zone_number}</span>
                              {zone.message ? (
                                <div className="mt-1">
                                  <p className="text-gray-700">{zone.message.content}</p>
                                  <p className="text-xs text-gray-400 mt-1">— {zone.message.author_name}</p>
                                </div>
                              ) : (
                                <p className="text-gray-300 mt-1">비어있음</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {pages.length > 0 && (
              <button
                onClick={() => navigate(`/trip/${tripId}/preview`)}
                className="w-full py-3 border border-orange-300 text-orange-600 rounded-xl font-medium hover:bg-orange-50 transition-colors"
              >
                📖 미리보기
              </button>
            )}

            {trip.status === 'draft' && pages.length > 0 && (
              <button
                onClick={() => handleStatusChange('collecting')}
                className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors"
              >
                참여자 초대 시작하기
              </button>
            )}
          </div>
        )}

        {/* Status Tab */}
        {tab === 'status' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-600">참여 현황</span>
                <span className="text-sm font-medium text-orange-600">
                  {trip.zone_stats.claimed} / {trip.zone_stats.total}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all"
                  style={{ width: `${trip.zone_stats.total ? (trip.zone_stats.claimed / trip.zone_stats.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {pages.map((page) => (
              <div key={page.id} className="bg-white rounded-xl p-4 shadow-sm">
                <p className="text-sm font-medium text-gray-700 mb-2">{page.subtitle || `Page ${page.page_number}`}</p>
                <div className="grid grid-cols-2 gap-2">
                  {page.zones.map((zone) => (
                    <div
                      key={zone.id}
                      className={`p-2 rounded-lg text-xs ${
                        zone.claimed_by
                          ? 'bg-orange-50 text-orange-700'
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
              <div className="space-y-3">
                <button
                  onClick={() => navigate(`/trip/${tripId}/preview`)}
                  className="w-full py-3 border border-orange-300 text-orange-600 rounded-xl font-medium hover:bg-orange-50 transition-colors"
                >
                  미리보기
                </button>
                <button
                  onClick={handleFinalize}
                  disabled={finalizing}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-xl font-medium transition-colors"
                >
                  {finalizing ? '포토북 생성 중... (최대 30초)' : '포토북 확정하기'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Order Tab */}
        {tab === 'order' && (
          <div className="space-y-4">
            {trip.status === 'finalized' ? (
              <div className="text-center space-y-4">
                <p className="text-6xl">✅</p>
                <h2 className="text-lg font-medium text-gray-800">포토북이 확정되었습니다</h2>
                <p className="text-sm text-gray-500">Book UID: {trip.sweetbook_book_uid}</p>
                <button
                  onClick={() => navigate(`/trip/${tripId}/order?token=${adminToken}`)}
                  className="w-full py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition-colors"
                >
                  주문하기
                </button>
              </div>
            ) : trip.status === 'ordered' ? (
              <div className="text-center space-y-4">
                <p className="text-6xl">📦</p>
                <h2 className="text-lg font-medium text-gray-800">주문이 완료되었습니다</h2>
                <p className="text-sm text-gray-500">Order UID: {trip.sweetbook_order_uid}</p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400">포토북 확정 후 주문할 수 있습니다</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
