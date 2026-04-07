# CeleBook Design System

> 여행 포토북 협업 웹앱. 사진이 주인공, UI는 조용히 서포트.

## Visual Theme & Atmosphere

Photography-first. UI 요소는 사진을 방해하지 않는다. 따뜻하고 친근한 톤,
과하지 않은 그림자, 넉넉한 여백. 모바일 웹앱 최적화 (max-w-md 중심).

## Color Palette

| Role | Tailwind | Hex | Usage |
|------|----------|-----|-------|
| Brand Primary | `orange-500` | `#f97316` | 주요 CTA, 액센트 (이 색만 포인트) |
| Brand Hover | `orange-600` | `#ea580c` | hover 상태 |
| Brand Light | `orange-50` | `#fff7ed` | 배경 틴트, 배지 배경 |
| Text Primary | `gray-800` | `#1f2937` | 제목, 본문 (pure black 금지) |
| Text Secondary | `gray-500` | `#6b7280` | 보조 텍스트, 설명 |
| Text Tertiary | `gray-400` | `#9ca3af` | 힌트, placeholder |
| Surface | `white` | `#ffffff` | 카드, 입력 필드 배경 |
| Background | `gray-50` | `#f9fafb` | 페이지 배경 (내부 페이지) |
| Background Hero | amber-50 → orange-50 gradient | - | Landing 전용 |
| Border | `gray-200` | `#e5e7eb` | 카드 테두리, 구분선 |
| Status Draft | `gray-100` / `gray-600` | - | 초안 |
| Status Collecting | `emerald-50` / `emerald-600` | - | 참여 수집 중 |
| Status Finalized | `blue-50` / `blue-600` | - | 확정됨 |
| Status Ordered | `violet-50` / `violet-600` | - | 주문 완료 |
| Success | `emerald-500` | `#10b981` | 성공, 완료 |
| Danger | `red-500` | `#ef4444` | 에러, 삭제 |

**규칙**: orange만 accent. 다른 색은 의미적 상태 표현에만 사용.

## Typography

```css
/* 기본 폰트 스택 */
font-family: 'Pretendard Variable', Pretendard, -apple-system, system-ui, sans-serif;

/* 제목 전용 */
.font-display { font-family: 'Playfair Display', Georgia, serif; }
```

| Style | Class | Size | Weight | Letter-Spacing |
|-------|-------|------|--------|----------------|
| Hero Title | `text-4xl font-display font-bold` | 36px | 700 | `-0.02em` |
| Page Title | `text-xl font-semibold` | 20px | 600 | `-0.01em` |
| Section Title | `text-base font-semibold` | 16px | 600 | normal |
| Body | `text-sm` | 14px | 400 | normal |
| Caption | `text-xs` | 12px | 400 | `0.01em` |
| Overline | `text-xs font-medium uppercase tracking-wider` | 12px | 500 | `0.05em` |

## Component Styles

### Card
```
bg-white rounded-2xl border border-gray-100 shadow-sm
hover: shadow-md transition-shadow duration-200
```

### Button - Primary
```
bg-orange-500 hover:bg-orange-600 active:scale-[0.98]
text-white font-medium rounded-xl
py-3 px-6 transition-all duration-150
```

### Button - Secondary (Outline)
```
border border-gray-200 hover:border-gray-300 hover:bg-gray-50
text-gray-700 font-medium rounded-xl
py-3 px-6 transition-all duration-150
```

### Button - Ghost
```
text-gray-500 hover:text-gray-700 hover:bg-gray-50
rounded-lg py-2 px-3 transition-colors
```

### Input Field
```
w-full px-4 py-3 bg-white border border-gray-200 rounded-xl
text-sm text-gray-800 placeholder:text-gray-400
focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400
transition-all duration-150
```

### Badge / Status Pill
```
px-2.5 py-1 rounded-full text-xs font-medium
(색상은 Status Color 참조)
```

### Tab Navigation
```
flex border-b border-gray-100
각 탭: py-3 text-sm font-medium border-b-2 transition-colors
활성: border-orange-500 text-orange-600
비활성: border-transparent text-gray-400 hover:text-gray-600
```

## Layout Principles

- **Max Width**: `max-w-md` (448px) 중심. 관리 페이지만 `max-w-2xl`
- **Page Padding**: `px-5 py-6` (모바일 기본)
- **Section Gap**: `space-y-6` (섹션 간), `space-y-3` (섹션 내)
- **Card Padding**: `p-5` (일반), `p-4` (컴팩트)
- **Border Radius**: `rounded-2xl` (카드), `rounded-xl` (버튼/입력), `rounded-full` (배지)

## Depth & Elevation

| Level | Class | Usage |
|-------|-------|-------|
| Flat | (없음) | 페이지 배경 |
| Subtle | `shadow-sm border border-gray-100` | 기본 카드 |
| Raised | `shadow-md` | 호버 카드, 모달 |
| Floating | `shadow-lg` | 떠 있는 요소, bottom sheet |

## Do's and Don'ts

**Do:**
- 사진을 크게, 여백을 넉넉히
- orange는 CTA에만
- `border-gray-100` 위스퍼 보더로 카드 구분
- `rounded-2xl` 일관 적용
- 로딩 상태에 `animate-pulse` skeleton

**Don't:**
- pure black (`#000`) 텍스트 금지 → `gray-800` 사용
- 3가지 이상 색 accent 혼용 금지
- `shadow-lg` 남발 금지
- 카드 안에 카드 중첩 금지
- 텍스트만으로 된 로딩 상태 금지

## Responsive Behavior

모바일 퍼스트. 대부분 페이지는 `max-w-md` 단일 컬럼.
- `< 640px`: 풀폭, `px-5`
- `>= 640px`: 중앙 정렬 `max-w-md mx-auto`
- TripAdmin: `max-w-2xl` (넓은 레이아웃)
