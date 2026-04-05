import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getEvent, createContribution, type Event } from '../lib/api';

export default function Contribute() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({ contributor_name: '', message: '' });
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');

  useEffect(() => {
    if (!shareCode) return;
    getEvent(shareCode)
      .then(setEvent)
      .catch(() => setError('이벤트를 찾을 수 없습니다.'))
      .finally(() => setLoading(false));
  }, [shareCode]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('10MB 이하 파일을 선택해주세요.');
        return;
      }
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareCode) return;
    setSubmitting(true);
    setError('');
    try {
      await createContribution(shareCode, {
        contributor_name: form.contributor_name,
        message: form.message,
        image: image || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

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
        <div className="text-center">
          <p className="text-5xl mb-4">😢</p>
          <p className="text-gray-500">{error || '이벤트를 찾을 수 없습니다.'}</p>
        </div>
      </div>
    );
  }

  if (event.status === 'ordered' || event.status === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full text-center">
          <p className="text-5xl mb-4">📚</p>
          <h1 className="text-xl font-bold text-gray-800 mb-2">이미 제작된 책이에요</h1>
          <p className="text-gray-500">더 이상 메시지를 추가할 수 없습니다.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full text-center">
          <p className="text-5xl mb-4">💌</p>
          <h1 className="text-xl font-bold text-gray-800 mb-2">메시지가 전달되었어요!</h1>
          <p className="text-gray-500 mb-4">{event.recipient_name}님에게 축하 메시지가 전해질 거예요.</p>
          <button
            onClick={() => {
              setSuccess(false);
              setForm({ contributor_name: '', message: '' });
              setImage(null);
              setPreview('');
            }}
            className="px-6 py-2 bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition cursor-pointer"
          >
            한 번 더 쓰기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full">
        <div className="text-center mb-6">
          <p className="text-4xl mb-2">
            {event.event_type === 'graduation' ? '🎓' :
             event.event_type === 'birthday' ? '🎂' :
             event.event_type === 'wedding' ? '💍' :
             event.event_type === 'retirement' ? '🏖️' : '🎉'}
          </p>
          <h1 className="text-xl font-bold text-gray-800">{event.title}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {event.recipient_name}님에게 축하 메시지를 남겨주세요
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              type="text"
              value={form.contributor_name}
              onChange={(e) => setForm({ ...form, contributor_name: e.target.value })}
              placeholder="내 이름"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-300 focus:border-rose-400 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">축하 메시지</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="진심을 담아 축하의 말을 적어주세요..."
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-300 focus:border-rose-400 outline-none resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사진 (선택)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImageChange}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-rose-50 file:text-rose-600 hover:file:bg-rose-100 file:cursor-pointer"
            />
            {preview && (
              <img src={preview} alt="미리보기" className="mt-2 w-full h-48 object-cover rounded-xl" />
            )}
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-rose-500 text-white rounded-xl font-medium hover:bg-rose-600 transition disabled:opacity-50 cursor-pointer"
          >
            {submitting ? '전송 중...' : '💌 축하 메시지 보내기'}
          </button>
        </form>
      </div>
    </div>
  );
}
