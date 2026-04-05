import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getEventAdmin, getContributions, createBook, createOrder, type Event, type Contribution } from '../lib/api';

export default function Dashboard() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [event, setEvent] = useState<Event | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  // Order form
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [orderForm, setOrderForm] = useState({
    recipient_name: '',
    recipient_phone: '',
    postal_code: '',
    address1: '',
    address2: '',
    memo: '',
  });

  const reload = async () => {
    if (!shareCode) return;
    try {
      const [ev, contribs] = await Promise.all([
        getEventAdmin(shareCode, token),
        getContributions(shareCode),
      ]);
      setEvent(ev);
      setContributions(contribs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [shareCode, token]);

  const handleCreateBook = async () => {
    if (!shareCode) return;
    setActionLoading('book');
    try {
      await createBook(shareCode, token);
      await reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  };

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareCode) return;
    setActionLoading('order');
    try {
      await createOrder(shareCode, token, orderForm);
      await reload();
      setShowOrderForm(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading('');
    }
  };

  const contributeUrl = shareCode ? `${window.location.origin}/contribute/${shareCode}` : '';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">불러오는 중...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{error || '이벤트를 찾을 수 없습니다.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{event.title}</h1>
            <p className="text-gray-500 text-sm">
              {event.recipient_name}님의 축하책 | 상태: <span className="font-medium">{event.status}</span>
            </p>
          </div>
          <span className="text-3xl">
            {event.event_type === 'graduation' ? '🎓' :
             event.event_type === 'birthday' ? '🎂' :
             event.event_type === 'wedding' ? '💍' :
             event.event_type === 'retirement' ? '🏖️' : '🎉'}
          </span>
        </div>

        {/* Share link */}
        <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-2">
          <span className="text-sm text-gray-500 shrink-0">공유 링크:</span>
          <span className="text-sm font-mono text-blue-600 truncate">{contributeUrl}</span>
          <button
            onClick={() => navigator.clipboard.writeText(contributeUrl)}
            className="shrink-0 px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 cursor-pointer"
          >
            복사
          </button>
        </div>
      </div>

      {/* Contributions */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          💌 축하 메시지 ({contributions.length}개)
        </h2>
        {contributions.length === 0 ? (
          <p className="text-gray-400 text-center py-8">아직 메시지가 없습니다. 링크를 공유해보세요!</p>
        ) : (
          <div className="space-y-3">
            {contributions.map((c) => (
              <div key={c.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  {c.image_url && (
                    <img src={c.image_url} alt="" className="w-20 h-20 object-cover rounded-lg shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-gray-800">{c.contributor_name}</p>
                    <p className="text-gray-600 text-sm mt-1">{c.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">📚 책 제작</h2>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {event.status === 'collecting' && (
          <button
            onClick={handleCreateBook}
            disabled={actionLoading === 'book' || contributions.length === 0}
            className="w-full py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition disabled:opacity-50 cursor-pointer"
          >
            {actionLoading === 'book' ? '책 생성 중...' : `📖 축하책 만들기 (${contributions.length}개 메시지)`}
          </button>
        )}

        {event.status === 'reviewing' && !showOrderForm && (
          <div className="space-y-3">
            <p className="text-green-600 font-medium">책이 생성되었습니다! 주문할 준비가 되었어요.</p>
            <button
              onClick={() => setShowOrderForm(true)}
              className="w-full py-3 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition cursor-pointer"
            >
              🚚 인쇄 주문하기
            </button>
          </div>
        )}

        {showOrderForm && (
          <form onSubmit={handleOrder} className="space-y-3">
            <h3 className="font-medium text-gray-700">배송 정보</h3>
            <input
              type="text" placeholder="수령인 이름"
              value={orderForm.recipient_name}
              onChange={(e) => setOrderForm({ ...orderForm, recipient_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required
            />
            <input
              type="text" placeholder="전화번호 (010-1234-5678)"
              value={orderForm.recipient_phone}
              onChange={(e) => setOrderForm({ ...orderForm, recipient_phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required
            />
            <input
              type="text" placeholder="우편번호"
              value={orderForm.postal_code}
              onChange={(e) => setOrderForm({ ...orderForm, postal_code: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required
            />
            <input
              type="text" placeholder="주소"
              value={orderForm.address1}
              onChange={(e) => setOrderForm({ ...orderForm, address1: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required
            />
            <input
              type="text" placeholder="상세주소 (선택)"
              value={orderForm.address2}
              onChange={(e) => setOrderForm({ ...orderForm, address2: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button
              type="submit" disabled={actionLoading === 'order'}
              className="w-full py-3 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition disabled:opacity-50 cursor-pointer"
            >
              {actionLoading === 'order' ? '주문 중...' : '주문 확정'}
            </button>
          </form>
        )}

        {event.status === 'ordered' && (
          <p className="text-blue-600 font-medium text-center py-4">
            ✅ 주문이 완료되었습니다! 곧 인쇄가 시작됩니다.
          </p>
        )}
      </div>
    </div>
  );
}
