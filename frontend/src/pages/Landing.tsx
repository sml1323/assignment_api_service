import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-5xl font-serif font-bold text-gray-800">
            TripBook
          </h1>
          <p className="text-xl text-gray-500 font-light">
            함께 만드는 여행의 추억
          </p>
        </div>

        <div className="space-y-4 text-gray-600">
          <p className="text-lg">
            여행 사진을 올리고, 함께 간 사람들이<br />
            각자의 추억을 남기는 포토북
          </p>
        </div>

        <div className="space-y-4 text-left bg-white/70 rounded-2xl p-6 backdrop-blur">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📷</span>
            <div>
              <p className="font-medium text-gray-800">사진 업로드</p>
              <p className="text-sm text-gray-500">여행 사진을 한 번에 올리면 자동으로 페이지가 구성됩니다</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔗</span>
            <div>
              <p className="font-medium text-gray-800">링크 공유</p>
              <p className="text-sm text-gray-500">공유 링크로 친구들을 초대하면 각 페이지에 추억을 남길 수 있어요</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">📖</span>
            <div>
              <p className="font-medium text-gray-800">포토북 주문</p>
              <p className="text-sm text-gray-500">완성된 포토북을 실물 책으로 인쇄해서 받아보세요</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/create')}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white text-lg font-medium rounded-xl transition-colors shadow-lg shadow-orange-200"
        >
          여행 포토북 만들기
        </button>
      </div>
    </div>
  );
}
