# 세션 히스토리 로그

최근 10개 세션의 작업 로그를 역순(최신이 위)으로 기록한다.
10개 초과 시 오래된 항목은 `archive/YYYY-MM.md`로 이동한다.

---

## 2026-04-11 | Windows 호환성 + Phase 2/3 완료 + INBOX 전건 구현

- **목표**: macOS 개발 프로젝트를 Windows에서 실행 + 잔여 기능 전부 구현
- **작업 내용**:
  - **Windows 크로스플랫폼 호환성** (12개 파일 수정):
    - `encodeProjectPath()` `/\\/:/` 정규식으로 Windows `C:\` 경로 정상 인코딩
    - `.split('/')` → `path.basename()` 교체 (6곳)
    - doc-watcher 글로브 `path.join()` 사용, CRLF 안전 `split(/\r?\n/)`
    - e2e-scan.test.ts 하드코딩 경로 → `encodeProjectPath(process.cwd())`
  - **Phase 2 M2/M6 완료** — file-history diff:
    - `file-history-service.ts` 신규: JSONL snapshot 파싱 + `~/.claude/file-history/` 백업 파일 읽기
    - `FileDiffView.tsx` 신규: diff 라이브러리 기반 라인별 diff 렌더링
    - FileChangePanel 확장: 파일 클릭 → 버전 선택 → diff 표시
    - ReplayPlayer: playhead 시점 추적 파일 목록 + 내용 뷰
    - DocInventory: History 버튼 + 버전 비교 diff
  - **Phase 3 M6 완료** — 알림 시스템 7/7:
    - `notification-history-service.ts` 신규: 이력 CRUD + 500건 FIFO
    - `task-complete-watcher.ts` 신규: TaskUpdate(completed) 감지 + 알림
    - session-watcher 내부 이벤트 리스너 인프라 (`onNewRecordsInternal`)
    - 기존 3곳(budget/session/doc) 알림 이력 저장 연결
    - Config Notifications 탭 이력 UI
  - **INBOX 아이디어 전건 구현**:
    - Tool Chain 분석: ToolTracker에 N-gram 패턴 + 전이 빈도 분석
    - CLAUDE.md Linter: `claude-md-linter.ts` 구조/완전성/보안 규칙 + 0-100 점수
    - 커스터마이즈 사이드바: `sidebar-settings-service.ts` + 메뉴 편집 모드
    - Session Handoff: `handoff-scanner.ts` + Dashboard 핸드오프 요약 섹션
    - 플래닝 모니터: `plan-scanner.ts` + Tasks Plans 레인/탭
  - **품질 개선** (8건):
    - Scanner options 패턴 11곳 완료 (subagent/doc/session-watcher 추가)
    - session-store race condition 함수형 set() 변경
    - BudgetCard isMountedRef 패턴 통일
    - TimelinePage data-testid 추가
    - Dashboard 비용 라벨 명확화
    - Docs Memory 경로 가독성 개선
    - coding-conventions.md 용어 사전 추가
    - ConfigPage "(향후)" 텍스트 제거
- **검증**: typecheck / vitest 134 통과
- **문서 갱신**: ROADMAP Phase 2/3 완료, known-issues 전건 종결, INBOX 전건 완료
- **다음 할 일**: Q6 GitHub Actions CI (보류)

---

## 2026-04-10 | Phase 3 M7 F17 스킬 모니터 완료

- **목표**: Phase 3 M7의 첫 번째 서브태스크(F17) — 커스텀 스킬 목록/상세 조회
- **작업 내용** (조심스럽게, 4개 커밋 분할):
  1. **feat(skills)** `81af032`: skill-scanner 백엔드 + 단위 테스트 13개
     - `SkillScope` / `SkillInfo` 타입 신규
     - `parseFrontmatter` 가벼운 YAML 파서 (key:value/하이픈 키/인용 제거)
     - `scanSkills({ projectDir?, globalDir? })` — 프로젝트 + 글로벌 병렬 스캔
     - 정렬: 프로젝트 우선, 스코프 내 알파벳순
  2. **feat(skills)** `3cc2db6`: IPC `GET_SKILLS` + preload `getSkills()`
  3. **feat(skills)** `c5447b3`: SkillsPage UI + 사이드바 Skills 메뉴
     - ScopeSection × 3 (project/global/plugin)
     - SkillCard memo + allowed-tools/model/disable-model-invocation 배지
     - 사이드바 8 → 9, Docs와 Search 사이
  4. **test(skills)** (이 커밋): Playwright 9 → 10 smoke + MCP 검증
- **검증**:
  - typecheck / lint / vitest **92**(79→92) / Playwright **10**(9→10) 모두 통과
  - MCP 시각 검증: 6개 스킬(프로젝트 스코프) 2-column 그리드 정확 렌더
  - "수동" 배지(zm-phase-status/session-end/session-start/validate-req) 표시 확인
- **설계 선택**:
  - 플러그인 스코프(F17 요구사항)는 구조 복잡도로 후속 사이클 연기
  - 사이드바 "Config" 그룹 도입 대신 평면 메뉴 유지 (F18-F20 추가 시 재구성 고려)
  - 기존 `doc-scanner` / `formatTimeAgo` 패턴 재사용
- **문서 갱신**: phase-3-analysis.md M7 F17 [x] + ROADMAP Phase 3 상태
- **다음 할 일**: M7 F18 에이전트 모니터 또는 Phase 2 M2/M6 file-history diff

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

_(이전 세션은 [archive/2026-04.md](./archive/2026-04.md) 참조)_
