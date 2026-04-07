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

  const inputClass = `w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800
    placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400
    transition-all duration-150`;

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-sm w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-display font-bold text-gray-800 tracking-tight">CeleBook</h1>
          <p className="text-sm text-gray-400">함께 만드는 여행 포토북</p>
        </div>

        {/* Tab */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => { setIsRegister(false); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              !isRegister ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            로그인
          </button>
          <button
            onClick={() => { setIsRegister(true); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              isRegister ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="아이디"
              className={inputClass}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className={inputClass}
            />
          </div>

          {error && <p className="text-sm text-red-500 px-1">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 active:scale-[0.98]
                       text-white font-semibold rounded-xl transition-all duration-150
                       disabled:bg-gray-200 disabled:text-gray-400 disabled:scale-100"
          >
            {loading ? '처리 중...' : isRegister ? '가입하기' : '로그인'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          데모 계정: <span className="text-gray-500 font-medium">demo</span> / <span className="text-gray-500 font-medium">demo1234</span>
        </p>
      </div>
    </div>
  );
}
