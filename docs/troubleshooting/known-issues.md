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

### [종결] electron-vite v3 → v5 — 현행 유지
- v3.1.0에서 vite 6.3.5 + electron 33 정상 동작 확인 (2026-04-11)
- v5 업그레이드 시 Windows 크로스플랫폼 호환성 재검증 필요 (리스크)
- 업그레이드 필요성 발생 시 별도 사이클로 진행

### [종결] Git 워크플로우 정책 미적용 — 향후 협업 시 적용
- Phase 1~3 모두 main 직접 커밋으로 완료 (단독 개발)
- feature 브랜치 정책은 협업 또는 PR 기반 워크플로우 도입 시 적용

## 배포/설치 이슈 (2026-04-11 발견)

### 미해결 — Medium: TaskBoard 실시간 모니터링 미지원
- **현상**: Tasks 페이지에서 다른 프로젝트(예: zm-v3)에서 생성된 새 태스크가 실시간 반영 안됨
- **원인**: TaskBoard가 마운트 시 1회 `getAllTasks()` 호출 후 `onNewRecords` 미구독
- **병목**: (1) session-watcher가 해당 세션을 감시하지 않음, (2) TaskBoard가 이벤트 구독 안함
- **해결안**: 주기적 폴링(30초) 또는 활성 세션 자동 감시 + 이벤트 구독

### 미해결 — Medium: 설치된 exe에서 프로젝트 스코프 스킬/에이전트 미발견
- **현상**: `npm run dev`에서는 스킬/에이전트가 조회되지만, 설치된 exe에서는 0건
- **원인**: `process.cwd()`가 dev 모드에서는 프로젝트 루트이지만, exe에서는 설치 경로(예: `C:\Program Files\...`)로 변경
- **영향**: skill-scanner.ts, agent-scanner.ts의 프로젝트 스코프 스캔이 실패
- **글로벌 스코프**: `~/.claude/skills/`, `~/.claude/agents/`는 `homedir()` 기반이므로 정상
- **해결안**: 프로젝트 스코프 스캔 시 `process.cwd()` 대신 사용자 선택 프로젝트 경로 사용

---

## Windows 크로스플랫폼 호환성 (2026-04-11 발견)

macOS에서 개발되어 Unix 경로 구분자(`/`)에 의존하는 코드가 다수 존재. Windows에서 데이터 로딩 실패 원인.

### [해결됨] `encodeProjectPath()` Unix 경로만 처리 — High
- `src/shared/types.ts:11` — `replace(/\//g, '-')` → `replace(/[\\/:]/g, '-')`로 수정
- **해결**: `/`, `\`, `:` 모두 치환하여 Windows `C:\` 경로 정상 인코딩

### [해결됨] `.split('/')` 하드코딩 — High (5개 파일)
- `agent-scanner.ts`, `skill-scanner.ts`, `session-lifecycle-watcher.ts`, `doc-watcher.ts`, `jsonl-parser.ts`
- **해결**: `path.basename()` 사용으로 교체

### [해결됨] doc-watcher 글로브 패턴 경로 혼재 — Medium
- **해결**: 템플릿 리터럴 → `path.join()` 사용

### [해결됨] doc-scanner 경로 인코딩 중복 — Medium
- **해결**: `replace(/[\\/:]/g, '-')`로 통일

### [해결됨] `split('-').pop()` 연쇄 검증 — Low (5개 파일)
- `encodeProjectPath()` 수정 후 검증 완료, 로직 변경 불필요 확인

### [해결됨] `FileChangePanel.tsx` `.split('/')` 누락 — Medium (감사에서 발견)
- `src/renderer/src/components/FileChangePanel.tsx:45` — 렌더러 컴포넌트
- **해결**: `.split(/[\\/]/).pop()` 정규식으로 교체 (렌더러에서 path 모듈 사용 불가)

### [해결됨] `split('\n')` CRLF 비안전 — Low (3곳, 감사에서 발견)
- `doc-scanner.ts:62`, `memory-reader.ts:29`, `memory-reader.ts:76`
- **해결**: `split(/\r?\n/)` 로 교체하여 Windows CRLF 안전 처리

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

### [해결됨] feature-spec F7/F8/F9/F10 상세 부족
- Phase 2/3 모두 구현 완료되어 별도 보강 불필요. 구현 코드 자체가 명세 역할 (2026-04-11)

### [해결됨] F12/F15 병합 근거 미기술
- **근거**: DocInventory에서 문서 메타데이터(F12) + 중요도 분류/리뷰 상태(F15)를 동일 페이지에서 통합 표시하여 UX 일관성 확보 (2026-04-11)

### [해결됨] 용어 비일관 (한국어/영어 혼용)
- **해결**: coding-conventions.md에 용어 사전 추가 (2026-04-11)

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

### [해결됨] Low: session-store addNewRecords race condition
- **해결**: 함수형 `set(state => ...)` 으로 변경 (2026-04-11)

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

### [해결됨] Low: Dashboard "예상 비용" vs Costs "총 비용" 약간 차이
- **해결**: Dashboard 라벨을 "비용 (조회 시점)"으로 변경하여 스냅샷 특성 명시 (2026-04-11)

### [해결됨] Low: TimelinePage 탭에 `data-testid` 누락
- **해결**: 각 탭에 `data-testid="tab-{id}"` 추가 (2026-04-11)

### [해결됨] Low: Docs 페이지 Memory 카테고리 경로 가독성
- **해결**: `../../` 접두사를 `~/`로 치환 + title 속성에 원본 경로 표시 (2026-04-11)

---

## Phase 2 M7 예산 알림 감사 이슈 (2026-04-09 병렬 Explore 재검토)

> M7 커밋 `129f1c6` 완료 후 재검토에서 발견된 4건. 모두 같은 세션 내 수정됨.

### [해결됨] High: 타임존 불일치 — cost-scanner UTC vs budget-service 로컬
- **현상**: `cost-scanner.ts:206`이 `new Date(u.timestamp).toISOString().slice(0,10)`로 **UTC 기준** date 키 생성. 반면 `budget-service.ts`의 `todayLocal`/`monthLocal` 및 `CostTracker.tsx`의 `todayLocalKey`/`monthLocalKey`는 **로컬 시각**
- **영향**: 자정 부근 활동이 서로 다른 날짜 키로 집계되어 일별/월별 예산 평가 부정확. 예: KST 02:00 활동 → cost-scanner는 `2026-04-08`, budget-service는 `2026-04-09`
- **수정 완료**: `budget-service`에 `timestampToLocalDate()` 공유 헬퍼 추가, `cost-scanner`가 이를 사용하여 로컬 시각 기준으로 통일
- **검증**: 수정 후 오늘 비용이 $955.60 → $1021.18로 증가 (KST 새벽 활동이 올바르게 "오늘"로 분류됨)

### [해결됨] High: 입력 검증 부재
- **현상**: `SET_BUDGET_SETTINGS` IPC 핸들러가 런타임 검증 없이 값을 파일에 저장. `load`에서만 보정 → save-load 왕복 시 원본 값 손실
- **예시**: `setBudgetSettings({ alertPercent: -1, dailyUsd: NaN, ... })` 호출 시 파일에 그대로 저장, load에서는 보정된 값 반환
- **수정 완료**: `normalizeBudgetSettings(raw: unknown)` 공유 헬퍼 추출. `load`와 `save` 양쪽에서 사용하여 진입 시점에 NaN/음수/잘못된 타입을 모두 정규화
- **추가**: `saveBudgetSettings` 반환 타입을 `Promise<BudgetSettings>`로 조정하여 정규화된 결과를 호출자가 확인 가능

### [해결됨] Medium: evaluateBudgetAlerts race condition
- **현상**: `ipc.ts`에서 `GET_COST_SUMMARY` 응답 후 `void evaluateBudgetAlerts(summary).catch(() => {})` fire-and-forget. Dashboard와 Costs가 동시에 호출 시 `lastNotifiedKeys` 쓰기 경쟁 (TOCTOU) → 같은 알림 2회 발송 가능
- **수정 완료**: `budget-service` 모듈 레벨 `evaluationChain: Promise<void>`로 직렬화. 후속 호출은 항상 이전 호출 완료 후 실행. Electron main 단일 스레드 특성상 Promise 체인만으로 충분
- **검증**: 단위 테스트에서 `Promise.all([evaluate, evaluate])` 동시 호출 시 알림이 1회만 발송되는지 확인

### [해결됨] Low-Medium: budget-service 테스트 엣지 케이스 누락
- **현상**: 기존 9개 테스트가 주요 시나리오만 커버. 동시 임계 도달/다음날 재발송/`lastNotifiedKeys` trim/입력 정규화/`timestampToLocalDate` 미검증
- **수정 완료**: 11개 테스트 추가 (9 → 20), 위 이슈 1~3 회귀 방지 포함
  - evaluateBudgetAlerts: 일+월 동시 / 다음날 / trim(60) / race 직렬화
  - normalizeBudgetSettings: NaN/음수/잘못 타입 보정 / 유효값 보존 / save 왕복
  - timestampToLocalDate: ISO / epoch ms / 빈값·null·undefined / 파싱 불가

---

## Phase 2 M7 예산 알림 추가 재검토 (2026-04-09 두 번째 세션)

> `4162654` 시점 독립 재검토에서 **앞선 감사 이후 여전히 남아 있던** 이슈 8건 발견.
> 같은 세션에서 High 2 + Medium 3 수정 커밋, Low 3은 남김.

### [해결됨] High: `BudgetCard.handleSave`가 `lastNotifiedKeys`를 무조건 초기화
- **위치**: `src/renderer/src/components/CostTracker.tsx:120-126`
- **현상**: 저장 버튼을 누를 때마다 `lastNotifiedKeys: []`로 강제 리셋. 값 변경 여부 무관.
- **영향**: 임계 알림을 받은 뒤 입력 변경 없이 저장만 눌러도 다음 `cost:get-summary`에 동일 알림 재발송.
- **수정 완료**: `daily/monthly/alertPercent` 중 하나라도 변경된 경우에만 리셋. 변경 없으면 기존 `lastNotifiedKeys`를 유지.

### [해결됨] High: `SET_BUDGET_SETTINGS` 핸들러가 sanitized return을 버림
- **위치**: `src/main/ipc.ts:78-81`
- **현상**: `saveBudgetSettings`는 `normalizeBudgetSettings`로 정규화된 값을 return하지만, 핸들러는 원본 `settings` 인자를 그대로 돌려주어 렌더러가 보정 전 값을 받음.
- **수정 완료**: `const saved = await saveBudgetSettings(settings); return saved;` — 렌더러가 정규화된 결과를 받도록 연결.

### [해결됨] Medium: `lastNotifiedKeys` FIFO 트리밍이 월별 키를 밀어낼 수 있음
- **위치**: `src/main/budget-service.ts:214` (`newKeys.slice(-60)`)
- **시나리오**: daily warn/exceed 키가 매일 2개씩 쌓여 30일 후 60개 초과 시 FIFO로 월별 키가 밀려 같은 달 재발송 가능.
- **수정 완료**: `trimLastNotifiedKeys(keys)` 헬퍼 신규 — period별 분리 유지 (daily 최근 60, monthly 최근 12, other 최근 20). 월별 키가 daily 폭증에 밀리지 않는다.

### [해결됨] Medium: `evaluateBudgetAlerts` 실패 완전 무음
- **위치**: `src/main/ipc.ts:52` (`.catch(() => {})`)
- **현상**: 디스크 권한/파싱/Notification 실패 시 로그 없음 → 디버깅 불가.
- **수정 완료**: `.catch((err) => console.error('[budget] evaluate failed', err))` — 응답 흐름 영향 없이 로그만 남김.

### [해결됨] Medium: BudgetCard `data-testid`가 한국어 라벨 조건 분기
- **위치**: `src/renderer/src/components/CostTracker.tsx:164` — `label === '오늘' ? 'daily' : 'monthly'`
- **현상**: 라벨 문자열을 testid 키로 분기. i18n·라벨 변경 시 E2E 테스트 붕괴.
- **수정 완료**: `renderProgressBar`에 `period: 'daily' | 'monthly'` 첫 파라미터 추가. 라벨과 testid 분리.

### [해결됨] Low: BudgetCard unmount 가드 패턴 불일치
- **해결**: `let mounted` → `isMountedRef` 패턴으로 통일 (2026-04-11)

### [해결됨] Low: 진행 바 "150%" 텍스트 vs 100% 너비 캡 불일치
- **위치**: `src/renderer/src/components/CostTracker.tsx:162-163`
- **수정 완료**: 초과 시 텍스트를 `>100%`로 변경하여 바 너비 캡과 일관. 초과량 정보는 여전히 색상(destructive)으로 표현.

### [해결됨] Low: `todayLocal`/`monthLocal` 헬퍼 main/renderer 양쪽 중복
- **해결**: 설계 의도적 중복 (IPC 분리). cross-reference JSDoc 추가 완료 (2026-04-10)

---

## 세 번째 종합 재검토 (2026-04-10 audit-3-followup)

> 병렬 Explore 3개 + 통합 테스트(typecheck/lint/vitest 71/Playwright 7) 실행으로 전체 구조 감사.
> **Critical 0건**. 다음 항목들을 후속 조치로 처리.

### [해결됨] Medium: 핵심 비즈니스 로직 단위 테스트 갭 (P0 3건)
- **현상**: cost-scanner / task-scanner / session-store 가 완전 미테스트. 회귀 검증 부재로 최근 cost-scanner 타임존 수정도 회귀 테스트 없이 머지됨.
- **수정 완료**: 26개 단위 테스트 추가 (vitest 45 → 71)
  - `cost-scanner.test.ts` (8): 단일/다중 모델 / 일별 / 빈 timestamp / unknown model / 캐시 / 다중 프로젝트
  - `task-scanner.test.ts` (7): TaskCreate/Update / 상태 이력 / 다중 ID / 다중 세션 / 정렬 / 무관 도구 무시
  - `session-store.test.ts` (11): fetch/load/clear/addNewRecords 전체 + race condition 시연
- **사전 리팩토링**: cost-scanner / task-scanner에 `options.projectsDir` 옵션 추가 (테스트 가능성 확보)

### [해결됨] Low: 항목 컴포넌트 렌더링 최적화
- **현상**: SubagentPanel / TaskBoard / DocInventory가 부모 리렌더 시 모든 항목 재렌더링.
- **분석 후 가상화 보류**: 현재 데이터 규모(14/22/40)에서 가상화 ROI 마이너스, 또한 expand/collapse + 3-lane + 2단계 중첩 등 적용 비용 큼.
- **수정 완료**: SubagentCard / TaskCard / KanbanLane / DocRow에 `React.memo` 적용 → props 변경 없으면 카드 단위 리렌더 skip.

### [종결] Low: 리스트 가상화 — 현재 규모에서 불필요
- @tanstack/react-virtual 설치됨, MessageTimeline에서 이미 적용 (2026-04-11 확인)
- SubagentPanel (4건), TaskBoard (수십 건), DocInventory (수십 건) — 모두 100 미만
- 데이터 100+ 초과 시 DocInventory 우선 적용, 현재 규모에서 성능 문제 없음

### [해결됨] Low: search-service / budget-service 명시성 부족
- **현상**: `MAX_RESULTS = 100` 의미와 `searchInJsonl` 빈 timestamp 처리 의도가 주석 없이는 불명확
- **수정 완료**: 양쪽 모두 JSDoc 보강. `timestampToLocalDate`에는 cost-scanner cross-reference 추가.

### [해결됨] Low: session-store optional chaining 일관성
- **현상**: `window.api.getSessions()` 등 직접 호출 (다른 컴포넌트는 `?.xxx?.()` 패턴)
- **수정 완료**: 4개 메서드 모두 `window.api?.xxx?.()` 통일. preload 미로드 시 명시적 에러 처리.

---

## 네 번째 재검토 (2026-04-10 audit-4)

> 병렬 Explore agent 3개 + 통합 테스트(typecheck/lint/vitest 92/Playwright 10) 실행으로
> Phase 3 M1/M3/M7 F17 최근 구현 감사. **Critical 0건**. 2개 High + 3개 Medium 발견/수정.

### [해결됨] High: ComparePage race condition
- **현상**: `loadBoth()`가 `Promise.all`로 두 세션 병렬 로드 중, 사용자가 드롭다운에서 다른 세션을 선택하면 이전 Promise의 결과가 현재 상태를 덮어쓸 가능성. `isMountedRef`는 언마운트만 감지.
- **위치**: `src/renderer/src/components/ComparePage.tsx` `loadBoth` 내부
- **수정 완료**: 모듈 레벨 `loadTokenRef` 도입 — 호출마다 증가. Promise 완료 후 `requestToken !== loadTokenRef.current`면 결과 폐기. setIsLoading/setError도 같은 가드로 stale 방지.

### [해결됨] High: `window.api` optional chaining 불일관
- **현상**: 6개 컴포넌트가 `window.api.xxx()` 직접 호출 → preload 미로드 시 런타임 에러. 다른 컴포넌트는 `?.xxx?.()` 패턴 사용.
- **위치**: `CostTracker.tsx` / `DocInventory.tsx` / `SearchPage.tsx` / `SubagentPanel.tsx` / `TaskBoard.tsx`
- **수정 완료**: 전부 `window.api?.xxx?.()` + 결과 null 체크 → "preload API를 사용할 수 없습니다" throw. 기존 에러 분기에서 사용자에게 표시.
- **TimelinePage `onNewRecords`는 이벤트 리스너(구독 패턴)라 기존 가드 유지**

### [해결됨] Medium: `ComparePage.computeMetrics` 테스트 부재
- **현상**: 비용 계산 로직이 cost-scanner/stats-service와 동일하지만 테스트가 없어 회귀 발생 시 감지 불가. 실제로 이전 감사에서 `formatCostDiff` 버그가 MCP 시각 검증에서 발견됨.
- **수정 완료**:
  - `src/renderer/src/lib/compute-metrics.ts` 신규 — `computeSessionMetrics` / `formatDiffValue` / `formatCostDiff` 추출
  - NaN / Infinity 가드 추가 (formatDiffValue / formatCostDiff)
  - `compute-metrics.test.ts` 14개 케이스 — computeSessionMetrics 6 + formatDiffValue 4 + formatCostDiff 4

### [해결됨] Medium: App.test.tsx React `act()` 경고
- **현상**: App 렌더 시 DashboardPage가 `fetchSessions` / `getCostSummary` 비동기 호출 → 테스트 종료 후 상태 업데이트로 act() 경고.
- **수정 완료**: `window.api` stub (vi.fn) + `waitFor(() => getSessions 호출됨)`로 후속 상태 업데이트까지 대기.

### [해결됨] Medium: Stats heatmap vs dailyActivity 데이터 소스 불일치 — 문서화
- **현상**: heatmap은 history.jsonl 엔트리(사용자 프롬프트 입력만) 기반, dailyActivity는 JSONL 세션 파일의 모든 user/assistant 레코드 기반. 같은 날짜의 수치가 일치하지 않을 수 있음.
- **수정 완료**: `src/main/stats-service.ts`의 heatmap 섹션에 상세 주석 추가. 이는 의도된 설계 — heatmap = "언제 사용자가 프롬프트를 입력했나", dailyActivity = "전체 대화 볼륨".

### [해결됨] Low: `parseFrontmatter` 쉼표 구분 리스트 미지원 — 문서화
- **현상**: `allowed-tools: Read, Grep` (쉼표 구분) 사용 시 `["Read,", "Grep"]`로 잘못 파싱. 현재 모든 SKILL.md는 공백 구분이라 실해 없음.
- **수정 완료**: `src/main/skill-scanner.ts` JSDoc에 지원/미지원 범위 명시 추가.

### [해결됨] Low: Scanner options 패턴 부재
- **해결**: 11개 스캐너 모두 options 패턴 도입 완료 (2026-04-11)
- subagent-scanner, doc-scanner, session-watcher 3곳 추가 (2026-04-11)

---

### [해결됨] Low: 모델 가격 테이블 3곳 중복
- **위치**:
  - `src/main/cost-scanner.ts` — `MODEL_PRICING` + `DEFAULT_PRICING`
  - `src/main/stats-service.ts` — 동일 테이블 (Phase 3 M1에서 복사)
  - `src/renderer/src/components/ComparePage.tsx` — 동일 테이블 (Phase 3 M3에서 복사, 렌더러에서 직접 계산 목적)
- **현상**: 동일 가격 데이터가 3 파일에 중복. 새 모델 추가 / 가격 조정 시 3곳 모두 수정 필요
- **영향**: 낮음 — 모델 추가 빈도가 낮고, 렌더러는 메인 IPC 결과를 받을 수도 있음
- **수정 완료**: Option A 채택 — `src/shared/pricing.ts` 신규. `MODEL_PRICING` + `calculateCost()` 단일 정의. cost-scanner/stats-service/compute-metrics가 import. 커밋 `296e663` (2026-04-10)

### False alarm (Agent가 제기했으나 실제 문제 없음)

| 항목 | 검증 결과 |
|---|---|
| FileChangePanel silent fail | IPC 호출 없는 순수 props 기반 → 에러 발생 가능성 자체 없음 |
| SubagentPanel silent fail | 이미 error state + UI 분기 존재 (`SubagentPanel.tsx:126-132`) |
| DashboardPage `fetchSessions` deps 누락 | `[fetchSessions]` 정상 포함 (DashboardPage.tsx:109) |
| CostTracker 차트 슬라이스 | 이미 `split('-')` 안전 파싱 적용됨 |
| session-watcher 감시 해제 불완전 | `stopWatcher()`가 `await close() + clear()` 완전 (session-watcher.ts:151-159) |
