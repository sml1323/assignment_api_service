import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { getTrip, getPages, uploadPagesBulk, updateTripStatus, finalizeBook, reorderPages, getAuditLog, getOrderStatus, getCreditBalance, getCreditTransactions, sandboxCharge } from '../lib/api';
import type { Trip, Page, AuditEntry } from '../lib/api';

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
  const fileRef = useRef<HTMLInputElement>(null);

  const adminToken = searchParams.get('token') || localStorage.getItem(`trip_admin_${tripId}`) || '';

  const [trip, setTrip] = useState<Trip | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [tab, setTab] = useState<'pages' | 'status' | 'order' | 'credits'>('pages');
  const [copied, setCopied] = useState(false);
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
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
      const [t, p] = await Promise.all([
        getTrip(tripId, adminToken),
        getPages(tripId, adminToken, true),
      ]);
      setTrip(t);
      setPages(p);
      try {
        const audit = await getAuditLog(tripId, adminToken);
        setAuditLog(audit);
      } catch {}
      if (t.status === 'ordered' && t.sweetbook_order_uid) {
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
    { key: 'pages' as const, label: '페이지' },
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

        {/* Kakao Banner */}
        {!trip.sweetbook_order_uid && trip.status !== 'draft' && (
          <div className="bg-amber-50 rounded-2xl p-4 mb-5 border border-amber-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-700">카카오톡 알림</p>
              <p className="text-xs text-amber-500 mt-0.5">확정/주문 시 알림을 받습니다</p>
            </div>
            <a
              href={`/api/auth/kakao/login?trip_id=${tripId}&admin_token=${adminToken}`}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-amber-900 rounded-xl text-sm font-medium transition-colors flex-shrink-0"
            >
              연결
            </a>
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
                  className="w-full py-10 border-2 border-dashed border-gray-200 hover:border-orange-300
                             rounded-2xl text-gray-400 hover:text-orange-500 transition-all duration-200
                             flex flex-col items-center gap-2"
                >
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                  </svg>
                  <span className="text-sm font-medium">{uploading ? '업로드 중...' : '사진 일괄 업로드'}</span>
                </button>
              </>
            )}

            {pages.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-300 text-sm">아직 페이지가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pages.map((page, idx) => {
                  const claimedCount = page.zones.filter((z) => z.claimed_by).length;
                  const isExpanded = expandedPage === page.id;
                  return (
                    <div key={page.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      <div className="flex gap-3 p-3">
                        {/* Reorder */}
                        <div className="flex flex-col justify-center gap-0.5 flex-shrink-0">
                          <button
                            onClick={async () => {
                              if (idx === 0) return;
                              const ids = pages.map(p => p.id);
                              [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                              await reorderPages(tripId!, ids, adminToken);
                              await loadData();
                            }}
                            disabled={idx === 0}
                            className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-600 disabled:text-gray-200 text-xs transition-colors"
                          >▲</button>
                          <span className="text-[10px] text-gray-300 text-center font-medium">{idx + 1}</span>
                          <button
                            onClick={async () => {
                              if (idx === pages.length - 1) return;
                              const ids = pages.map(p => p.id);
                              [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                              await reorderPages(tripId!, ids, adminToken);
                              await loadData();
                            }}
                            disabled={idx === pages.length - 1}
                            className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-600 disabled:text-gray-200 text-xs transition-colors"
                          >▼</button>
                        </div>

                        <img
                          src={page.photo_url}
                          alt={`Page ${page.page_number}`}
                          className="w-20 h-16 object-cover rounded-xl flex-shrink-0 cursor-pointer"
                          onClick={() => setExpandedPage(isExpanded ? null : page.id)}
                        />
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => setExpandedPage(isExpanded ? null : page.id)}
                        >
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {page.subtitle || `Page ${page.page_number}`}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {claimedCount}/{page.zones.length} 작성됨
                          </p>
                          <div className="flex gap-1 mt-1.5">
                            {page.zones.map((z) => (
                              <div
                                key={z.id}
                                className={`w-1.5 h-1.5 rounded-full ${z.claimed_by ? 'bg-orange-400' : 'bg-gray-200'}`}
                              />
                            ))}
                          </div>
                        </div>
                        <svg
                          className={`w-4 h-4 text-gray-300 self-center flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          onClick={() => setExpandedPage(isExpanded ? null : page.id)}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-2">
                          {page.zones.map((zone) => (
                            <div
                              key={zone.id}
                              className={`p-3 rounded-xl text-sm ${
                                zone.message ? 'bg-orange-50' : 'bg-gray-50'
                              }`}
                            >
                              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Zone {zone.zone_number}</span>
                              {zone.message ? (
                                <div className="mt-1.5">
                                  <p className="text-gray-700 leading-relaxed">{zone.message.content}</p>
                                  <p className="text-xs text-gray-400 mt-1.5">— {zone.message.author_name}</p>
                                </div>
                              ) : (
                                <p className="text-gray-300 mt-1 text-xs">비어있음</p>
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
