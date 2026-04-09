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
- Phase 1 전체(M1~M6)가 main 브랜치에서 직접 커밋됨
- git-workflow.md 정책: feature/ 브랜치 → PR → main 머지
- Phase 2부터 feature 브랜치 사용 필요

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

---

## 코드-문서 정합성 이슈 (2026-04-09 문서 리팩토링 시 발견)

### [해결됨] ROADMAP.md Phase 1 상태 미갱신
- Phase 1 완료 후에도 "진행중" 상태 유지
- **수정 완료**: "완료 (F1-F4)"로 갱신

### [해결됨] phase-1-mvp.md 상태 미갱신
- M1~M6 모두 [x] 상태이나 문서 상태가 "진행중"이었음
- **수정 완료**: "완료 (2026-04-09)"로 갱신, F11 이관 노트 추가

### [해결됨] SESSION_LOG.md Phase 1 개발 세션 누락
- 10개 커밋에 해당하는 개발 세션이 기록되지 않았음
- **수정 완료**: 요약 세션 엔트리 추가

### [해결됨] PRD.md v1 폐기 표시 누락
- PRD-v2 존재 시 v1에 폐기 안내가 없어 혼란 유발
- **수정 완료**: Deprecated 배너 추가

### [해결됨] docs/README.md 핵심 문서 링크 오류
- 요구사항 핵심 문서가 PRD.md(v1)를 가리키고 있었음
- **수정 완료**: PRD-v2.md로 업데이트

### [해결됨] parseJsonlTail Dead Code 제거
- `jsonl-parser.ts`의 `parseJsonlTail` 함수가 어디에서도 사용되지 않았음
- **수정 완료**: 함수 삭제 (-28줄)

### [해결됨] MessageTimeline 렌더링 성능 이슈
- `messages` 필터가 매 렌더마다 새 배열 생성 (useMemo 누락)
- `virtualizer`가 useEffect deps에 포함되어 매 렌더마다 불필요한 scroll 실행
- **수정 완료**: useMemo 추가, virtualizer deps에서 제거

### [해결됨] session-scanner 순차 stat 호출
- 세션별 `getFileLastActivity` 호출이 순차적이라 다수 세션 시 성능 저하
- **수정 완료**: `Promise.all`로 병렬화

### [해결됨] session-watcher statSync 비일관
- async 함수 `parseNewLines`/`watchSession` 내에서 동기 `statSync` 사용
- **수정 완료**: async `stat`으로 교체, `watchSession`을 async 함수로 변경

### [해결됨] button.tsx 미사용 (Dead Code)
- `src/renderer/src/components/ui/button.tsx`에 shadcn Button 컴포넌트가 미사용이었음
- **수정 완료**: 파일 삭제

### [해결됨] 빈 디렉토리 (hooks/, types/)
- `src/renderer/src/hooks/`와 `src/renderer/src/types/`가 빈 상태였음
- **수정 완료**: 디렉토리 삭제

### [해결됨] Recharts 미사용
- package.json에 recharts 의존성이 있으나 Phase 1에서 미사용이었음
- **수정 완료**: Phase 2 대시보드 ActivityChart에서 Recharts 사용 시작

---

## 런타임 오류 가능성 (2026-04-09 E2E 테스트 검토 시 발견)

### [해결됨] High: MessageTimeline optional chaining 누락
- `MessageTimeline.tsx:77, 125`: `record.message.content` 직접 접근
- **수정 완료**: `record.message?.content` + 가드 추가, undefined 시 null 반환

### [해결됨] High: TimelinePage window.api 가드 부재
- `TimelinePage.tsx:51`: `window.api.onNewRecords` 직접 호출
- **수정 완료**: `window.api?.onNewRecords` 가드 + early return + deps에 addNewRecords 추가

### [해결됨] Medium: ReplayPlayer indexOf 비효율 + race condition
- `ReplayPlayer.tsx:55-63`: `messages.indexOf(r)`로 visibleRecords 계산
- **수정 완료**: `messages.slice(0, playheadIndex)`로 단순화

### [해결됨] Medium: 5개 컴포넌트 unmount 시 setState 경고
- `SubagentPanel`, `CostTracker`, `DocInventory`, `TaskBoard`, `SearchPage`
- **수정 완료**: useEffect는 `isMounted` 플래그, SearchPage는 `isMountedRef` 패턴 적용

### [해결됨] Medium: TimelinePage useEffect deps 누락
- **수정 완료**: deps에 `addNewRecords` 추가

### [해결됨] Medium: CostTracker date 형식 가정
- **수정 완료**: `split('-')` 기반 안전 파싱, 형식 다를 시 원본 사용

### 미해결 — Low: session-store addNewRecords race condition
- 동시 호출 시 messageCount 부정확 가능
- **조치**: 함수형 set으로 변경 (Q3 이후)

---

## MCP 탐색 테스트 발견 이슈 (2026-04-09 electron-test-mcp 탐색)

> Claude Code가 electron-test-mcp으로 사이드바 6개 메뉴 + TimelinePage 5탭 + 검색을 직접 클릭하며 발견. 콘솔 에러는 0건이었으나 데이터 정합성/UX 이슈 4건 식별.

### [해결됨] High: `Session.messageCount` 필드 의미 불일치
- **현상**: Sessions 카드 "36개 메시지" vs 동일 세션 TimelinePage Messages 탭 "1455"
- **원인**:
  - `src/main/session-scanner.ts:112` — `messageCount: historyEntries.length` (history.jsonl 사용자 프롬프트만)
  - `src/main/jsonl-parser.ts:87` — `record.type === 'user' || 'assistant'`인 모든 레코드 카운팅
  - 동일 필드명 `messageCount`가 두 가지 다른 의미로 사용됨
- **수정 완료** (Option A 채택, 2026-04-09):
  - `SessionMeta.messageCount` → `promptCount`로 이름 변경 (`types.ts`, `session-scanner.ts`)
  - UI 라벨: "36개 메시지" → "36개 프롬프트" (`SessionList.tsx`, `DashboardPage.tsx`)
  - `ParsedSession.messageCount`는 의미 정확하므로 그대로 유지 (TimelinePage Messages 탭)
  - Dead code `stats.totalMessages`(미사용) 함께 제거
  - 검증: typecheck/lint/vitest 19/Playwright 7 모두 통과

### 미해결 — Low: Dashboard "예상 비용" vs Costs "총 비용" 약간 차이
- **현상**: Dashboard 표시 직후 Costs로 이동하면 비용 값이 다름 (예: $1278.98 → $1282.65)
- **원인**: 두 페이지가 동일 IPC `getCostSummary`를 다른 시점에 호출. 그 사이 새 활동(현재 세션) 누적
- **영향**: 정상 동작이지만 사용자에게 데이터 불일치로 보임
- **조치 후보**: Zustand 스토어로 결과 캐싱 + 명시적 refresh 버튼, 또는 Dashboard 라벨을 "스냅샷 비용"으로 변경

### 미해결 — Low: TimelinePage 탭에 `data-testid` 누락
- **현상**: `[role="tab"]`도 잡히지 않아 E2E/MCP에서 텍스트 기반 셀렉터(`text=Tools`)에 의존
- **위치**: `src/renderer/src/components/TimelinePage.tsx` 탭 렌더링 부분
- **조치**: 각 탭에 `data-testid="tab-{messages|tools|agents|files|replay}"` 추가 (사이드바 nav 패턴과 일관성)

### 미해결 — Low: Docs 페이지 Memory 카테고리 경로 가독성
- **현상**: Memory 카테고리 문서 경로가 `../../.claude/projects/-Users-hanumoka-projects-zm-agent-manager/memory/MEMORY.md` 형태로 매우 김
- **영향**: 상대 경로 접두사(`../../`)가 도구상 의미 없고, 실제 정보(파일명)는 끝부분이라 파악 어려움
- **조치 후보**: Memory 카테고리는 `~/.claude/projects/{enc}/memory/` 표시 또는 파일명 + 작은 글씨로 디렉토리 분리 표시
