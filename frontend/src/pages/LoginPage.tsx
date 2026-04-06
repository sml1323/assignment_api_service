import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!username || !password) {
      setError('아이디와 비밀번호를 입력해주세요');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = isRegister
        ? await register(username, password)
        : await login(username, password);
      localStorage.setItem('user_token', result.token);
      localStorage.setItem('username', result.username);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-gray-800">CeleBook</h1>
          <p className="text-gray-500 mt-2">함께 만드는 여행 포토북</p>
        </div>

        {/* Tab */}
        <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => { setIsRegister(false); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              !isRegister ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => { setIsRegister(true); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              isRegister ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">아이디</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디 입력"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-300 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-300 outline-none"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors"
          >
            {loading ? '처리 중...' : isRegister ? '가입하기' : '로그인'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          데모 계정: demo / demo1234
        </p>
      </div>
    </div>
  );
}
