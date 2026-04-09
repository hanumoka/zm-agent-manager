# 알려진 이슈 및 해결법

이슈를 카테고리별로 기록한다. 해결된 이슈는 `[해결됨]` 태그를 붙인다.

---

## 빌드 / 환경설정

### [해결됨] Node.js 18에서 Tailwind v4 네이티브 바인딩 실패
- `@tailwindcss/oxide`가 Node >= 20 요구
- **해결**: `.nvmrc`에 Node 22 지정, CLAUDE.md에 요구사항 명시

### [해결됨] 의존성 카테고리 오류
- `tailwindcss`, `@tailwindcss/vite`, `tw-animate-css`가 dependencies에 있었음
- **해결**: devDependencies로 이동 (빌드 타임 전용)

### [해결됨] tw-animate-css import 누락
- `main.css`에 `@import 'tw-animate-css'`가 없어 shadcn 애니메이션 미동작
- **해결**: import 추가

### electron-vite v3 → v5 업그레이드 미검증
- 현재 v3.1.0 사용 중, 최신은 v5.0.0
- v3은 vite 6 지원하므로 당장 문제 없음
- Phase 1 완료 후 안정성 확인 뒤 업그레이드 검토

### Git 워크플로우 정책 미적용
- M1 스캐폴딩이 main 브랜치에서 직접 진행됨
- git-workflow.md 정책: feature/ 브랜치 → PR → main 머지
- M2부터 feature 브랜치 사용 필요

## 런타임

_아직 등록된 이슈 없음_

## 데이터 파싱

_아직 등록된 이슈 없음_

## UI / UX

_아직 등록된 이슈 없음_

---

## 문서 품질 이슈 (2026-04-08 감사 결과)

> 31건 발견, 5건 즉시 수정 완료, 나머지 추적 관리

### [해결됨] PRD-v2.md 참조 문서 목록 누락
- feature-spec.md, screen-design.md, wireframes.md가 Section 10에 없었음
- **수정 완료**: 구현 문서 / 분석 문서 2개 그룹으로 정리

### [해결됨] PRD-v2.md F5~F10 상속 미명시
- v1에서 상속된 기능임을 명시하지 않아 혼란
- **수정 완료**: Section 3 상단에 v1→v2 변경사항 박스 추가

### [해결됨] PRD-v2.md Section 4 F1~F10 위임 미명시
- Section 4에 F11~F16만 있고 F1~F10 상세가 없는 이유 설명 없음
- **수정 완료**: feature-spec.md 위임 명시 추가

### [해결됨] feature-spec.md F11 데이터 소스 강조 부족
- JSONL TaskCreate/TaskUpdate가 핵심 데이터 소스임을 강조하지 않음
- **수정 완료**: "중요" 박스 추가, todos/ 휘발성 경고

### 미해결 — feature-spec F7/F8/F9/F10 상세 부족
- F7(서브에이전트): 6줄, F8(통계): 1줄, F9(검색): 3줄, F10(비교): 2줄
- F1~F4 대비 1/10 수준의 상세도
- **조치**: Phase 2/3 착수 시 보강 예정

### 미해결 — F12/F15 병합 근거 미기술
- PRD-v2.md에서 별도 기능이지만 screen-design.md에서 "Docs" 하나로 병합
- **조치**: Phase 2 착수 시 결정

### 미해결 — 용어 비일관 (한국어/영어 혼용)
- "태스크 보드" vs "Task Board" vs "Board" — 문서별로 다르게 표기
- **조치**: 코딩 착수 시 공식 용어 사전 작성
