# TODOS

## require_admin() DRY 리팩토링
**What:** trips.py, pages.py, books.py에 중복된 require_admin() 함수를 공통 모듈로 추출
**Why:** 3개 파일에 동일한 로직이 복사됨. 인증 로직 변경 시 3곳 모두 수정 필요
**Context:** 2026-04-07 eng review에서 발견. Day 기반 앨범 구현 시 diff 최소화를 위해 보류. 기능 구현 완료 후 별도 PR로 처리 권장
**Depends on:** Day 기반 앨범 구현 완료 후
