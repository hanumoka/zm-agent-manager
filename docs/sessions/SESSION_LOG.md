# 세션 히스토리 로그

최근 10개 세션의 작업 로그를 역순(최신이 위)으로 기록한다.
10개 초과 시 오래된 항목은 `archive/YYYY-MM.md`로 이동한다.

---

## 2026-04-10 | Phase 3 M3 세션 비교 완료 (F10)

- **목표**: Phase 3 M3(F10) 신규 — 두 세션 side-by-side 비교
- **작업 내용** (조심스럽게, 4개 커밋 분할):
  1. **feat(compare)** `16597d1`: ComparePage 골격 + 세션 선택 드롭다운 2개 + 사이드바 "Compare" 메뉴 (8번째) + E2E smoke
  2. **feat(compare)** `3035832`: 병렬 `parseSession` fetch (`Promise.all`) + `ComparisonPanel` (메시지/도구/토큰/비용 + 차이값 B−A)
  3. **feat(compare)** `dfa2765`: `ToolDistributionPanel` (union 바 차트) + `SideBySideTimeline` (MessageTimeline 재사용, 2-column 500px)
  4. **fix(compare)** (이 커밋): 비용 차이 포맷터 — `formatCostDiff`로 `+$198.19` 형식 정확 표시
- **검증**:
  - typecheck / lint / vitest 79 / Playwright **9**(8→9) 모두 통과
  - MCP 시각 검증: 880c7f7f vs b4464add 비교 시 메시지 +759 / 도구 +284 / 토큰 +79.4M / 비용 +$198.19 정확 표시, 도구 분포 차트에 Bash/Read/Edit 등 9개 도구 side-by-side 바 렌더, 하단 MessageTimeline 2-column 정상
- **설계 선택**:
  - 기존 `MessageTimeline`(가상화) / 모델 가격 테이블 / `useSessionStore` 재사용
  - `isMountedRef` 패턴 + `Promise.all` race 안전
  - 가격 테이블은 cost-scanner/stats-service와 세 번째 중복(향후 `shared/pricing.ts`로 DRY 검토 가능)
- **문서 갱신**: phase-3-analysis.md M3 4/4 완료 + ROADMAP Phase 3 상태
- **다음 할 일**: Phase 3 M4 워크플로우 / M5 문서 중요도 / M6 알림 확장 / M7 모니터 뷰 또는 Phase 2 M2/M6 file-history diff

---

## 2026-04-10 | Phase 3 M1 세션 통계 대시보드 완료 (F8)

- **목표**: Phase 3 M1(F8) 신규 — 전체 세션 통계 대시보드
- **작업 내용** (조심스럽게, 4개 커밋 분할):
  1. **feat(stats)** `9f79913`: stats-service 백엔드 + 단위 테스트 8개
     - `StatsSummary` / `DailyActivity` / `HeatmapCell` / `ProjectStats` / `ModelTokenUsage` 타입 신규
     - `scanStatsSummary(options)` — JSONL 직접 재집계 (cost-scanner 일관)
     - 단일 스트리밍 순회로 SessionLevelStats → 전역 집계 (total/daily/heatmap/byProject/byModel)
     - `timestampToLocalDate` 재사용 (타임존 일관성)
  2. **feat(stats)** `7c03d0c`: IPC `GET_STATS_SUMMARY` 채널 + preload `getStatsSummary()`
  3. **feat(stats)** `66922e3`: StatsPage UI + 사이드바 "Stats" 메뉴
     - StatCard×4 / DailyActivityChart / WhenYouWork 히트맵 / ModelUsageBars / ProjectTable
     - 모든 하위 컴포넌트 `React.memo` + `isMountedRef` 패턴
     - 사이드바 6 → 7 (Stats 메뉴 Tasks/Costs 사이)
  4. **test(stats)** (이 커밋): Playwright E2E 7 → 8 smoke
- **검증**:
  - typecheck / lint / vitest **87**(79→87) / Playwright **8**(7→8) 모두 통과
  - MCP 시각 검증: 총 세션 10 / 메시지 5,475 / 토큰 843.2M / 도구 호출 2,050 정확 표시
  - 히트맵에 실제 Wed/Thu 10-18시 작업 패턴 가시화
- **문서 갱신**: phase-3-analysis.md M1 5/5 완료 + ROADMAP Phase 3 상태
- **다음 할 일**: Phase 3 M3 세션 비교 (F10) 또는 Phase 2 M2/M6 file-history diff

---

## 2026-04-09 | M7 예산 알림 재검토 + 수정 (타임존/검증/race)

- **목표**: M7 커밋 `129f1c6` 후 병렬 Explore 감사로 발견된 4건 이슈 수정
- **작업 내용** (3개 커밋):
  1. **fix(budget)** `3d01218`:
     - 타임존 통일 — `cost-scanner`가 `toISOString()`(UTC)에서 `timestampToLocalDate()`(로컬)로 변경
     - 입력 검증 — `normalizeBudgetSettings` 헬퍼 추출, `load`/`save` 양쪽에서 적용
     - race 직렬화 — 모듈 레벨 `evaluationChain: Promise<void>`로 `evaluateBudgetAlerts` 순차 실행
  2. **test(budget)** `000059e`: 엣지 케이스 11개 추가 (9 → 20)
  3. **docs**: known-issues.md "M7 감사 이슈" 섹션 신규, 4건 [해결됨] 기록 + SESSION_LOG
- **검증**:
  - typecheck / lint / vitest **45**(34→45) / Playwright 7 모두 통과
  - MCP 시각 확인: 오늘 비용 $955.60 → $1021.18 (KST 새벽 활동이 올바르게 "오늘"로 재분류됨 — 타임존 수정 효과)
- **다음 할 일**: Phase 3 M1 통계 대시보드 (F8) — 가장 사용자 가치 높음

---

## 2026-04-09 | Phase 2 M7 예산 알림 완료 (F13 4/4)

- **목표**: Phase 2 M7의 마지막 항목 "예산 설정 및 알림" 구현 → F13 비용 추적 100%
- **작업 내용**:
  - `BudgetSettings` 타입 + IPC 채널 2개(`budget:get-settings`, `budget:set-settings`) 추가
  - `src/main/budget-service.ts` 신규: `loadBudgetSettings`/`saveBudgetSettings`/`evaluateBudgetAlerts`
    - 저장 위치: `~/.zm-agent-manager/budget-settings.json` (옵션 주입 가능)
    - 트리거: `cost:get-summary` 호출 시 자동 평가, 일별/월별 독립
    - 알림 레벨: alertPercent 도달(`warn`) + 100% 초과(`exceed`)
    - 중복 방지: `lastNotifiedKeys`(`{period}-{date}-{level}`)로 같은 임계 1회만
    - Electron `Notification` API 사용, 옵션으로 `notify` 함수 주입(테스트용)
  - `ipc.ts`: GET/SET 핸들러 + `cost:get-summary` 응답 후 `evaluateBudgetAlerts` 트리거
  - preload + d.ts: `getBudgetSettings`/`setBudgetSettings` 노출
  - `CostTracker.tsx`: BudgetCard 신규 (일별/월별 input, 임계 슬라이더, 진행 바, 저장 버튼)
    - 진행 바 색상: green(<alert) / orange(≥alert) / red(≥100%) + testid 부여
- **단위 테스트** (`src/main/test/budget-service.test.ts` 신규, 9개):
  - load/save 기본/persistence/잘못된 alertPercent 보정
  - evaluate: 미설정/80% warn/100% exceed/월별 독립/임계 미도달/lastNotifiedKeys 저장
- **검증**: typecheck/lint/vitest **34**(25→34)/Playwright 7 모두 통과
- **MCP 시각 검증**: $5/$100 입력 → 저장 → 진행 바 즉시 표시(150% red), 알림 1회 발송 후 중복 방지 확인
- **문서 갱신**: phase-2 M7 [x] + ROADMAP.md Phase 2 상태
- **다음 할 일**: Phase 3 M1 통계 대시보드 (F8) — 가장 사용자 가치 높음

---

## 2026-04-09 | MCP 탐색 테스트 + High 이슈 수정 + Phase 3 M2 검색 필터 완료

- **목표**: Q5 후속 MCP 탐색 시연 → 발견 이슈 처리 → Phase 3 M2(검색 필터) 마무리
- **작업 내용**:
  - **MCP 탐색 테스트** (`electron-test-mcp` 첫 활용):
    - `launch`가 npx 임시 디렉토리에 electron이 없어 실패 → CDP 9222 포트로 직접 띄우고 `connect` 우회 (testing-strategy.md에 노트 추가)
    - 사이드바 6개 메뉴 + TimelinePage 5탭 + 검색 동작 모두 콘솔 에러 0건
    - 데이터/UX 이슈 4건 발견 → known-issues.md "MCP 탐색 테스트 발견 이슈" 섹션 신규
  - **High 이슈 수정** — `Session.messageCount` 필드 의미 분리:
    - 동일 필드명이 SessionList(history.jsonl 기반)와 TimelinePage(JSONL 레코드 기반)에서 상이하게 사용되어 사용자 혼란 (예: 36 vs 1455)
    - `SessionMeta.messageCount` → `promptCount`로 이름 변경 (types.ts, session-scanner.ts)
    - UI 라벨: "N개 메시지" → "N개 프롬프트" (SessionList, DashboardPage)
    - dead code `stats.totalMessages`(미사용) 제거
    - `ParsedSession.messageCount`는 의미 정확하므로 유지
  - **Phase 3 M2 검색 필터(F9 4/4)** 완료:
    - `SearchFilters` 타입 신규 (`projectName`, `dateFromMs`, `dateToMs`)
    - `search-service.ts`: record 단위 timestamp 필터 + 디렉토리 단위 projectName 필터
    - IPC/preload 시그니처 확장 (`searchSessions(query, filters?)`)
    - `SearchPage.tsx`: 프로젝트 드롭다운 + date input 2개 + "필터 초기화" 버튼
    - MCP 시각 검증: 2026-04-08 필터 시 108건 모두 "22시간 전" 표시로 정확 동작 확인
- **검증**: typecheck/lint/vitest 25(19→25)/Playwright 7 모두 통과
- **문서 갱신**: known-issues.md(4건 추가, High 1건 [해결됨]), testing-strategy.md(connect 우회), phase-3-analysis.md(M2 [x]), ROADMAP.md(Phase 3 상태)
- **추가 작업** (audit + Stage A/B):
  - 병렬 Explore agent로 변경 전체 재검토 → critical 버그 0건, search-service 단위 테스트 누락 1건 식별
  - Stage A: `feature/m2-search-filters-and-prompt-count` → main fast-forward 머지 (`3913bbc`)
  - Stage B: `searchSessions`/`parseHistoryFile`에 옵션 파라미터 추가(default 동일) + `search-service.test.ts` 신규 6개 케이스 → `feature/search-service-tests` → main fast-forward 머지 (`c5e9b35`)
- **다음 할 일**: Phase 2 M7 예산 알림 → Phase 3 M1 통계 대시보드 (다음 세션)

## 2026-04-09 | Q5 Electron MCP 서버 도입

- **목표**: Claude Code가 직접 앱을 탐색 테스트할 수 있는 MCP 서버 등록
- **작업 내용**:
  - 웹 검색으로 Electron MCP 서버 옵션 비교 (electron-test-mcp 선정)
  - `.mcp.json`에 `electron-test` 서버 등록 (`npx -y electron-test-mcp`)
  - 패키지 사전 캐싱 (`npm view electron-test-mcp` v0.1.0)
  - `testing-strategy.md`에 사용법 + 지원 도구 목록 추가
- **결과**: Claude Code 재시작 후 `launch({ appPath })` → 앱 자동 탐색 가능
- **지원 도구**: launch/close, click, screenshot, snapshot, getText, evaluate, evaluateMain 등
- **다음 할 일**: Claude Code 재시작 후 MCP로 앱 탐색 테스트 시연

## 2026-04-09 | Q3+Q4 Playwright E2E 인프라 구축

- **목표**: Playwright `_electron` E2E 테스트 인프라 구축 + 사이드바 6개 페이지 smoke test
- **작업 내용**:
  - `@playwright/test@1.59.1` 설치
  - `playwright.config.ts` 설정 (단일 worker, trace/screenshot/video 옵션)
  - `e2e/sidebar-nav.spec.ts`: 7개 테스트 (사이드바 + 6개 페이지)
  - `data-testid` 속성 추가: sidebar, nav-{label}, page-{name}
  - `vitest.config.ts`: e2e/ 디렉토리 제외 (Playwright 충돌 방지)
  - `package.json`: `test:e2e` + `test:e2e:headed` 스크립트 추가
  - `.gitignore`: test-results, playwright-report 추가
  - `eslint.config.mjs`: e2e 산출물 제외
- **검증**: lint 0 에러, typecheck 통과, vitest 19개 + Playwright 7개 = 26개 테스트 전체 통과
- **결과**: 빌드 + E2E 7개 테스트가 약 2.2초에 완료
- **다음 할 일**: Q5 (Electron MCP 서버 도입), Q6 (GitHub Actions CI)

## 2026-04-09 | Q1+Q2 런타임 오류 9건 수정

- **목표**: E2E 검토에서 발견된 런타임 오류 High 2건 + Medium 6건 + Low 1건 중 9건 수정
- **작업 내용**:
  - **High**:
    - `MessageTimeline.tsx`: optional chaining 누락 수정 (record.message?.content + 가드)
    - `TimelinePage.tsx`: window.api?.onNewRecords 가드 + addNewRecords deps 추가
  - **Medium**:
    - `ReplayPlayer.tsx`: indexOf → messages.slice() 단순화
    - `SubagentPanel/CostTracker/DocInventory/TaskBoard.tsx`: useEffect isMounted 플래그
    - `SearchPage.tsx`: useCallback 비동기에 isMountedRef 패턴
    - `CostTracker.tsx`: date.slice(5) → split('-') 안전 파싱
- **검증**: lint 0 에러, typecheck 통과, 테스트 19개 전체 통과
- **잔여**: Low 1건 (session-store addNewRecords race condition)
- **다음 할 일**: Q3 Playwright `_electron` E2E 인프라 구축

## 2026-04-09 | E2E 테스트 전략 수립 + 런타임 오류 분석

- **목표**: 메뉴 오류 검토, E2E 자동화 방안 조사, 품질 마일스톤 정의
- **작업 내용**:
  - 전체 컴포넌트 런타임 오류 검토 (10건 발견: High 2, Medium 7, Low 1)
    - High: MessageTimeline optional chaining, TimelinePage window.api 가드
    - Medium: ReplayPlayer indexOf, 5개 컴포넌트 unmount setState, deps 누락, date 형식
    - Low: session-store race condition
  - 웹 검색으로 Electron E2E 테스트 최신 (2026) 동향 조사
    - Playwright `_electron` 공식 지원 확인
    - Electron MCP 서버 4종 발견 (playwright-mcp-electron, Choreograph 등)
  - `docs/policies/testing-strategy.md` 신규 작성 (단위/E2E/MCP 3계층 전략)
  - `docs/roadmap/ROADMAP.md`에 품질 마일스톤 Q (Q1-Q6) 추가
  - `docs/troubleshooting/known-issues.md`에 10건 이슈 추가
- **결과**: 런타임 이슈 10건 추적 등록, E2E 테스트 로드맵 확정
- **다음 할 일**: Q1 (High 이슈 2건) 수정 → Q2 → Playwright E2E 인프라

## 2026-04-09 | 품질 정리 + Phase 3 M2 검색(F9) 착수

- **목표**: dead code 정리 + Phase 3 검색 기능 구현
- **작업 내용**:
  - 품질 정리: button.tsx 삭제, 빈 디렉토리 hooks/types/ 제거
  - `search-service.ts` 신규: 전체 세션 JSONL 텍스트 검색 (메시지 + tool_use)
  - `SearchPage.tsx` 신규: 검색 입력, 결과 리스트, 하이라이트, 타임라인 이동
  - `App.tsx`: Search 라우트 + 사이드바 추가
  - types/IPC/preload: SearchResult, SearchResponse + SEARCH_SESSIONS 채널
- **검증**: lint 0 에러, typecheck 통과, 테스트 19개 전체 통과
- **미완료**: 프로젝트/기간 필터링 (후속)

## 2026-04-09 | Phase 2 M1 리플레이(F5) + M2 파일 변경(F6) 구현

- **목표**: 세션 리플레이 플레이어 + 파일 변경 추적 구현
- **작업 내용**:
  - `ReplayPlayer.tsx` 신규: 재생/일시정지, 속도(0.5x-4x), 스텝 앞/뒤, 스크러버, MessageTimeline 재사용
  - `FileChangePanel.tsx` 신규: Write/Edit/Read tool_use에서 파일 변경 추출, 파일별 통계
  - `TimelinePage.tsx`: Files 탭 + Replay 버튼 추가
- **검증**: lint 0 에러, typecheck 통과, 테스트 19개 전체 통과

## 2026-04-09 | Phase 2 M6 문서 인벤토리(F12) 구현

- **목표**: 프로젝트 관리 문서 스캔 및 메타데이터 시각화
- **작업 내용**:
  - `doc-scanner.ts` 신규: 프로젝트별 문서 스캔 (CLAUDE.md, rules, skills, agents, docs, MEMORY)
  - `DocInventory.tsx` 신규: 카테고리별 문서 목록, StatCard 4개, 프로젝트 선택 드롭다운
  - `App.tsx`: Docs 라우트 + 사이드바 추가
  - types/IPC/preload: DocInfo 타입 + GET_PROJECT_DOCS 채널
- **검증**: lint 0 에러, typecheck 통과, 테스트 19개 전체 통과
- **미완료**: file-history 기반 diff 뷰 (후속 작업)

## 2026-04-09 | Phase 2 M3 서브에이전트 추적(F7) 구현

- **목표**: 세션 내 서브에이전트 실행 내역 추적 및 시각화
- **작업 내용**:
  - `subagent-scanner.ts` 신규: {sessionId}/subagents/ 디렉토리 스캔, .meta.json + .jsonl 파싱
  - `SubagentPanel.tsx` 신규: 서브에이전트 목록 (타입 아이콘, 통계), 인라인 확장 시 MessageTimeline 재사용
  - `TimelinePage.tsx`: Agents 탭 추가 (서브에이전트 있을 때만 표시)
  - types/IPC/preload: SubagentInfo 타입 + GET_SESSION_SUBAGENTS 채널
- **검증**: lint 0 에러, typecheck 통과, 테스트 19개 전체 통과

## 2026-04-09 | Phase 2 M7 비용 추적(F13) 구현

- **목표**: JSONL usage 필드 기반 비용 추적 기능 구현
- **작업 내용**:
  - `cost-scanner.ts` 신규: 전체 세션 usage 파싱, 모델별 가격 테이블 (Opus/Sonnet/Haiku), 일별 집계
  - `CostTracker.tsx` 신규: StatCard 4개 (총 비용/요청/입출력 토큰), 일별 비용 차트, 모델별 상세
  - `DashboardPage.tsx`: "예상 비용" StatCard 추가 (getCostSummary 연동)
  - `App.tsx`: Costs 라우트 + 사이드바 추가
  - types/IPC/preload: CostSummary 타입 + GET_COST_SUMMARY 채널
- **검증**: lint 0 에러, typecheck 통과, 테스트 19개 전체 통과

## 2026-04-09 | Phase 2 M4/M5 재검토 및 품질 수정

- **목표**: Phase 2 구현물 전체 교차검증 및 발견된 이슈 수정
- **작업 내용**:
  - ROADMAP.md + phase-2-replay.md 상태 "대기" → "진행중 (M4-M5 완료)" 갱신
  - `history-parser.ts` 공유 유틸 추출: session-scanner + task-scanner 중복 코드 제거
  - `formatTimeAgo` 타입 안전성 보강: string/number 모두 지원, TaskBoard 수동 변환 제거
- **검증**: lint 0 에러, typecheck 통과, 테스트 19개 전체 통과

_(이전 세션은 [archive/2026-04.md](./archive/2026-04.md) 참조)_
