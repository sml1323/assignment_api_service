# TripBook — 여행 포토북 협업 서비스

여행 다녀온 후, 함께 간 사람들이 같이 만드는 포토북 서비스입니다.

## 서비스 소개

**한 줄 설명:** 주최자가 여행 사진을 올리고, 참여자들이 각 페이지에 추억 메시지를 남겨 함께 포토북을 완성하는 협업 서비스

**타겟 고객:** 여행을 다녀온 20-30대 그룹 (주최자 1명 + 참여자 2-5명)

### 주요 기능

- **사진 일괄 업로드** — 여행 사진을 한 번에 올리면 자동으로 페이지 구성
- **공유 링크로 협업** — 링크를 보내면 참여자가 각 페이지에 텍스트 추억을 남김
- **사진 위 텍스트 배치** — 드래그로 위치 이동, 8가지 색상 프리셋 선택
- **미리보기** — react-pageflip 기반 페이지 넘기기 애니메이션
- **포토북 인쇄 주문** — Book Print API 연동으로 실물 책 주문 (A4 소프트커버)
- **존 기반 선점** — 참여자별 영역 선점으로 충돌 방지

---

## 실행 방법

### 요구사항

- Python 3.10+
- Node.js 18+
- Book Print API Sandbox Key ([api.sweetbook.com](https://api.sweetbook.com) 가입 후 발급)

### 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/sml1323/assignment_api_service.git
cd assignment_api_service

# 백엔드 설치
pip install -r backend/requirements.txt

# 프론트엔드 설치
cd frontend && npm install && cd ..

# 환경변수 설정
cp .env.example .env
# .env 파일에 API Key 입력

# 프론트엔드 빌드
cd frontend && npm run build && cd ..

# 더미 데이터 생성 (제주도 3박4일 시나리오)
python -m backend.app.seed

# 서버 실행
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

브라우저에서 `http://localhost:8000` 접속

> 시드 실행 후 콘솔에 주최자 대시보드 URL과 참여자 링크가 출력됩니다.

---

## API 연동 플로우

```
주최자 플로우                              Sweetbook API
─────────────                            ──────────────
                                         
 ┌──────────┐    ┌──────────┐    ┌──────────────┐
 │ 사진 업로드 │───→│ Pillow   │───→│ photos       │
 │ (일괄)    │    │ 텍스트합성 │    │ .upload      │
 └──────────┘    └──────────┘    └──────┬───────┘
                                        │
                                 ┌──────▼───────┐
                                 │ covers       │
                                 │ .create      │
                                 │ (구글포토북C)  │
                                 └──────┬───────┘
                                        │
                                 ┌──────▼───────┐
                                 │ contents     │  ← monthHeader
                                 │ .insert      │  ← 내지_photo (합성 이미지)
                                 │ (반복)       │  ← 내지b (텍스트)
                                 └──────┬───────┘
                                        │
                                 ┌──────▼───────┐
                                 │ finalize     │
                                 │ (책 확정)     │
                                 └──────┬───────┘
                                        │
                                 ┌──────▼───────┐
                                 │ orders       │
                                 │ .create      │
                                 └──────┬───────┘
                                        │
  ┌──────────┐                   ┌──────▼───────┐
  │ DB 업데이트│←──── Webhook ←───│ 상태 변경 알림 │
  │ AuditLog │    (서명 검증)     │ (PAID→SHIPPED)│
  └──────────┘    (idempotency)  └──────────────┘
```

### Webhook 연동

- `POST /api/webhooks/sweetbook` — 주문 상태 변경을 실시간 수신
- HMAC-SHA256 서명 검증 (X-Webhook-Signature + X-Webhook-Timestamp)
- event_id 기반 idempotency (중복 호출 자동 무시)
- 처리 실패 시 DLQ 패턴 (WebhookLog에 error_message + retry_count 기록)

### Audit Log

- 모든 주요 액션을 `audit_logs` 테이블에 기록 (trip 생성, 사진 업로드, 메시지 작성, finalize, 주문, webhook 수신)
- `GET /api/trips/:id/audit` — 관리자용 활동 타임라인 조회

---

## 사용한 API 목록

| API | 용도 |
|-----|------|
| `POST /books` | 새 포토북 생성 (PHOTOBOOK_A4_SC) |
| `POST /books/{bookUid}/photos` | 사진 업로드 (원본 + Pillow 합성 이미지) |
| `POST /books/{bookUid}/cover` | 표지 생성 (구글포토북C 테마) |
| `POST /books/{bookUid}/contents` | 내지 페이지 삽입 (내지_photo, 내지_monthHeader, 내지b) |
| `POST /books/{bookUid}/finalization` | 포토북 확정 (인쇄 준비 완료) |
| `GET /templates` | 사용 가능한 템플릿 목록 조회 |
| `GET /templates/{templateUid}` | 템플릿 상세 (파라미터 구조 확인) |
| `GET /book-specs` | 책 사양 조회 (크기, 페이지 범위) |
| `POST /orders` | 주문 생성 (배송 정보 포함) |
| `POST /orders/estimate` | 가격 견적 조회 |
| `GET /orders/{orderUid}` | 주문 상태 확인 |

### 사용한 템플릿

| 템플릿 UID | 이름 | 용도 |
|-----------|------|------|
| `7CO28K1SttwL` | 표지 (구글포토북C) | 표지 — coverPhoto + subtitle + dateRange |
| `50f9kmXxelPG` | 내지_monthHeader | 섹션 구분 페이지 ("APRIL 2026") |
| `5ADDkCtrodEJ` | 내지_photo | 사진 페이지 — Pillow 합성 이미지 + dayLabel |
| `3mjKd8kcaVzT` | 내지b | 텍스트 페이지 — 참여자 하단 존 메시지 |
| `5NxuQPBMyuTm` | 빈내지 | 최소 24페이지 충족용 패딩 |

---

## AI 도구 사용 내역

| AI 도구 | 활용 내용 |
|--------|---------|
| Claude Code (Opus) | 전체 프로젝트 설계, 백엔드/프론트엔드 구현, API 연동, 코드 리뷰 |
| Claude Code — /office-hours | 서비스 기획 (여행 포토북 협업 컨셉 도출, 디자인 문서 작성) |
| Claude Code — /plan-eng-review | 아키텍처 리뷰 (템플릿 선택, 존 모델, Pillow 합성 전략) |
| Codex (OpenAI) | 독립적 second opinion (UI 구조, MVP 스코프 검증) |

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19, TypeScript, Tailwind CSS 4, react-pageflip |
| 백엔드 | FastAPI, SQLAlchemy, SQLite (WAL mode) |
| 이미지 처리 | Pillow (사진 위 텍스트 합성 → 인쇄용 이미지 생성) |
| API 연동 | Book Print API Python SDK (Sandbox) |

---

## 설계 의도

### 왜 이 서비스를 선택했는지

과제 예시의 "여행 포토북"에서 한 단계 더 나갔습니다. 단순히 사진을 올려서 책을 만드는 서비스가 아니라, **함께 여행한 사람들이 각자의 추억을 남겨 공동으로 포토북을 완성하는 협업 경험**을 설계했습니다.

스위트북의 Book Print API 관점에서 보면, 이 서비스는 API를 "인쇄 벤더"가 아닌 **"소셜 크리에이션 인프라"**로 포지셔닝합니다. 1인이 혼자 만드는 포토북보다, 여러 명이 함께 만드는 포토북이 주문 전환율과 재방문율이 높을 것으로 예상합니다.

### 비즈니스 가능성

- **바이럴 구조**: 주최자가 링크를 공유하면 참여자들이 자연스럽게 서비스에 노출됨
- **높은 전환율**: 여러 명이 함께 만든 포토북은 "우리의 추억"이라는 감정적 가치가 높아 주문으로 이어질 확률이 큼
- **반복 사용**: 여행마다 새로운 포토북을 만들 수 있어 재사용 동기가 존재
- **확장 가능**: 여행 외에도 모임, 동아리, 팀빌딩 등 그룹 활동으로 확장 가능

### 더 시간이 있었다면 추가했을 기능

- 사진 위 자유 드로잉 (Canvas API) — 화살표, 동그라미 등 그리기
- AI 기반 사진 분석 — EXIF + Vision API로 자동 제목/목차 생성
- 실시간 협업 — WebSocket으로 다른 참여자의 작성 현황 실시간 표시
- 날짜별 갤러리 페이지 — rowGallery 템플릿으로 같은 날짜 사진 자동 배치
- 다중 레이아웃 선택 — 1사진/2사진/콜라주 등 페이지별 레이아웃 선택

---

## 프로젝트 구조

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 앱 + CORS + 정적 파일 서빙
│   │   ├── database.py          # SQLite + WAL mode
│   │   ├── models.py            # Trip, Page, Zone, Message
│   │   ├── schemas.py           # Pydantic 요청/응답 스키마
│   │   ├── seed.py              # 더미 데이터 (제주도 3박4일)
│   │   ├── routes/
│   │   │   ├── trips.py         # 여행 CRUD + 상태 전환
│   │   │   ├── pages.py         # 사진 업로드 + 존 자동 생성 + 순서 변경
│   │   │   ├── messages.py      # 존 선점 + 메시지 작성/수정/삭제
│   │   │   └── books.py         # Sweetbook API 연동 (finalize + order)
│   │   └── services/
│   │       ├── sweetbook.py     # Book Print API 통신 (구글포토북 테마)
│   │       └── image.py         # Pillow 이미지 합성 + 리사이즈
│   ├── requirements.txt
│   └── uploads/                 # 업로드된 사진 (gitignore)
├── frontend/
│   └── src/
│       ├── App.tsx              # 라우팅
│       ├── lib/api.ts           # API 클라이언트
│       └── pages/
│           ├── Landing.tsx      # 랜딩 페이지
│           ├── CreateTrip.tsx   # 여행 생성
│           ├── TripAdmin.tsx    # 주최자 대시보드
│           ├── JoinTrip.tsx     # 참여자 진입
│           ├── Contribute.tsx   # 메시지 작성 (드래그, 색상, 수정)
│           ├── BookPreview.tsx  # 포토북 미리보기
│           └── OrderPage.tsx    # 주문 (배송 정보)
├── bookprintapi-python-sdk/     # Book Print API Python SDK
├── .env.example                 # 환경변수 템플릿
└── README.md
```
