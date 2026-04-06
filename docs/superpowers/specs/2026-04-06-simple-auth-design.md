# Simple Auth System Design

> 간단한 로그인/회원가입 시스템. JWT 없이 기존 admin_token 패턴을 활용한 token 기반 인증.

## 배경

현재 celebook은 trip별 admin_token으로 관리자 인증을 처리한다. 하지만 "내 여행 목록"을 보려면 사용자 계정이 필요하다. 공유 페이지는 비회원 접근을 유지한다.

## 백엔드

### User 모델

```python
class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=generate_id)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    token = Column(String, unique=True, default=generate_token)
    created_at = Column(DateTime, server_default=func.now())
```

### Trip 모델 변경

```python
# 기존 필드 유지 + 추가
user_id = Column(String, ForeignKey("users.id"), nullable=True)
```

nullable=True로 기존 trip 호환.

### API 엔드포인트

| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | `/api/auth/register` | 회원가입 | 없음 |
| POST | `/api/auth/login` | 로그인 | 없음 |
| GET | `/api/auth/me` | 내 정보 | X-User-Token |
| GET | `/api/my/trips` | 내 여행 목록 | X-User-Token |

### POST /api/auth/register

요청: `{ "username": "hong", "password": "1234" }`
응답: `{ "user_id": "...", "username": "hong", "token": "..." }`
에러: 409 (username 중복)

### POST /api/auth/login

요청: `{ "username": "hong", "password": "1234" }`
응답: `{ "user_id": "...", "username": "hong", "token": "..." }`
에러: 401 (인증 실패)

### GET /api/my/trips

내 user_id로 생성된 trip 목록 반환. Trip 생성 시 X-User-Token이 있으면 자동으로 user_id 연결.

### 패스워드

bcrypt 해시. `passlib` 또는 `bcrypt` 라이브러리 사용.

### 기존 API 변경

- `POST /api/trips` — X-User-Token 헤더가 있으면 user_id 자동 연결, 없으면 기존처럼 동작

## 프론트엔드

### 새 페이지

- `/login` — 로그인/회원가입 탭 전환 페이지

### 변경

- `/` 랜딩 — 로그인 상태면 "내 여행" 섹션 표시
- `/create` — 로그인 돼 있으면 자동으로 user_id 연결
- 헤더/네비게이션 — 로그인 상태 표시 + 로그아웃

### 인증 저장

- `localStorage`에 `user_token`, `username` 저장
- API 호출 시 `X-User-Token` 헤더 추가

### 공유 페이지

`/join/:token`, `/trip/:id/contribute` — 변경 없음, 비회원 접근 유지.

## Pydantic 스키마

```python
class AuthRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=4, max_length=100)

class AuthResponse(BaseModel):
    user_id: str
    username: str
    token: str

class UserTripResponse(BaseModel):
    id: str
    title: str
    destination: str
    status: str
    created_at: datetime
    page_count: int
    sweetbook_book_uid: str | None
    sweetbook_order_uid: str | None
```

## 더미 데이터 (seed.py)

seed.py에 기본 유저 추가:
```python
# 더미 유저
user = User(username="demo", password_hash=hash("demo1234"))
# trip.user_id = user.id 로 연결
```

seed 실행 시 출력:
```
👤 데모 계정: demo / demo1234
```

## 파일 구조

### 생성
- `backend/app/routes/auth.py` — 인증 라우터
- `frontend/src/pages/LoginPage.tsx` — 로그인/가입 페이지

### 수정
- `backend/app/models.py` — User 모델 + Trip.user_id
- `backend/app/schemas.py` — Auth 스키마
- `backend/app/main.py` — auth 라우터 등록
- `backend/app/routes/trips.py` — trip 생성 시 user_id 연결
- `backend/app/seed.py` — 더미 유저 추가
- `frontend/src/lib/api.ts` — auth API 함수
- `frontend/src/pages/Landing.tsx` — 로그인 시 내 여행 표시
- `frontend/src/App.tsx` — /login 라우트 추가
