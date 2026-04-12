# 세션 히스토리 로그

최근 10개 세션의 작업 로그를 역순(최신이 위)으로 기록한다.
10개 초과 시 오래된 항목은 `archive/YYYY-MM.md`로 이동한다.

---

## 2026-04-12 저녁 | INBOX #8/#9/#10/#11/#12 일괄 + Workflow 페이지 재설계 + #13 등록

- **목표**: v0.1.0-beta.4 검증 후 추가 사용자 요구(5개 INBOX 아이디어 + Workflow 재설계) 일괄 구현
- **작업 내용**:
  - **INBOX #8 — LiveStatus 헤더** (실시간 상태 표시):
    - `src/renderer/src/components/LiveStatus.tsx` 신규 — 초록 pulse dot + `HH:MM:SS` + "X초 전" (1초 interval로 자체 tick)
    - TaskBoard + WorkflowPage 헤더에 배치
  - **INBOX #9 — 파이프라인 시각화** (1차 → 재설계):
    - 1차: `PipelineView.tsx` 칸반 스타일 (사용자 피드백으로 폐기 → 삭제)
    - 재설계: `WorkflowGraph.tsx` 신규 — **SVG 노드/엣지 그래프**, 베지어 곡선 + `stroke-dashoffset` marching ants 무한 애니메이션, stage 변경 시 0.5s 가속 + 노드 glow
  - **INBOX #10 — 프로젝트당 1개 워크플로우 제약**:
    - TaskCard에 `boundWorkflow`/`boundProjectName` props — 매칭 시 워크플로우 드롭다운 잠금 + "🔒 프로젝트 고정" 배지
  - **INBOX #11 — 프로젝트 문서 기반 워크플로우 + Claude Code 인식**:
    - `src/main/workflow-scanner.ts` 신규 — `.claude/workflow.md` YAML frontmatter 파싱 (skill-scanner `parseFrontmatter` 재사용), `ProjectWorkflowResult` 반환 (workflow + projectPath + projectName)
    - 사용자 선택 프로젝트 파라미터 지원 (`projectPath` 옵션)
    - IPC `GET_PROJECT_WORKFLOW` + preload `getProjectWorkflow(projectPath?)`
    - `.claude/rules/workflow-system.md` 정책 문서 신규
    - `CLAUDE.md`에 "## Workflow" 섹션 추가
    - 본 프로젝트 `.claude/workflow.md` 작성 (zm-agent-manager 6단계)
    - 7개 단위 테스트 (workflow-scanner.test.ts)
  - **INBOX #12 — Completed 태스크 오늘/과거 분리**:
    - `src/renderer/src/lib/task-utils.ts` (`getCompletedAt`, `isSameLocalDay`)
    - Completed 레인 헤더에 `[오늘 (N)] [과거 (M)]` 탭 토글
    - 8개 단위 테스트
  - **Workflow 전용 페이지 분리** (사용자 후속 요구):
    - 사이드바 NAV_ITEMS에 **Workflow** 메뉴 신규 (Tasks 위, GitBranch 아이콘)
    - `src/renderer/src/components/WorkflowPage.tsx` 신규 — Workflow 전용 페이지
    - 프로젝트 드롭다운 (헤더 우측, "모든 프로젝트" 옵션 **없음** — 프로젝트별 모니터링)
    - 기본 선택: `getKnownProjects()` 가장 최근 활동 프로젝트
    - 드롭다운 변경 시 즉시 refetch + 5초 폴링 타이머 재시작
    - 빈 상태 3단계 (프로젝트 없음 / workflow.md 없음 / 정상)
  - **TaskBoard 정리**:
    - Pipeline 탭 제거 (Tasks/Plans 2탭으로 환원)
    - **POLL_INTERVAL_MS 30s → 5s**
    - `metadataMap` state 제거 (WorkflowPage로 이전)
    - `PipelineView.tsx` 삭제
  - **task-metadata-service 부수 fix**:
    - `getTaskMetadata`가 `workflowName` 필드를 로드하지 않는 버그 수정 (재조회 시 손실)
    - `listAllTaskMetadata()` bulk endpoint 신규
  - **workflow-utils 추출** (PipelineView 폐기 시 로직 이관):
    - `src/renderer/src/lib/workflow-utils.ts` — `mapTaskToStage`, `groupTasksByStage`
    - 9개 단위 테스트
  - **INBOX #13 — 워크플로우 CRUD + DAG/Loop + 프로젝트 전용 폴더** (신규 아이디어 등록):
    - 사용자가 면밀한 검토 + 작업 계획 요구
    - 웹 검색 (Symfony/XState/Sismic/GitHub Actions/GCP Workflows/React Flow) + 코드 탐색
    - 새 폴더 구조 `.claude/zm-agent-manager/workflows/{name}.md` (다중 파일)
    - Statechart 변형 스키마: start/end + nodes + edges (loop 허용)
    - 7가지 검증 룰 (workflow-validator)
    - Form 기반 CRUD UI 설계 (WorkflowList + WorkflowEditor)
    - 신규 의존성: `yaml` (eemeli)
    - 마이그레이션: 기존 `.claude/workflow.md` → 새 폴더 자동 변환
    - 7-step 작업 단계 (P1~P7, ~12-15h, 2-3 세션 권장)
    - **상태**: 사용자 진행 방식(A/B/C) 선택 대기
- **검증**:
  - `npm run typecheck` 통과
  - `npm run test` — 162 → **186 passed** (+24 신규: workflow-scanner 7, task-utils 8, workflow-utils 9)
  - `npm run lint` — 0 errors
  - `npm run build` — 성공
  - `npm run test:e2e` — **Playwright 14/14 통과** (Workflow 페이지 smoke 추가)
  - **CDP 실제 앱 검증**: LiveStatus, Completed 탭, Pipeline → Workflow 그래프, 프로젝트 드롭다운, 5개 프로젝트 + zm-agent-manager 6단계 그래프 모두 동작 확인
- **신규 의존성**: 없음 (P1 전 단계)
- **gitignore**: `.claude/scheduled_tasks.lock` 추가
- **문서 갱신**: `INBOX.md` #8/#9/#10/#11/#12 [구현 완료] 전환 + #13 신규 등록, `CLAUDE.md` Workflow 섹션, `.claude/rules/workflow-system.md` 신규
- **남은 작업**: INBOX #13 진행 방식 결정 + 실제 구현 (다음 세션). 재배포는 사용자가 별도 결정

---

## 2026-04-12 오후 | 남은 이슈 전체 처리 + v0.1.0-beta.3 재배포

- **목표**: 오전 세션에서 남은 이슈 전부 해결 후 새 installer 배포 + 검증
- **작업 내용**:
  - **Part A — 프로젝트 선택 UI** (Medium 이슈 해결):
    - `src/main/project-settings-service.ts` 신규 — `~/.zm-agent-manager/project-settings.json`
    - `src/main/current-project.ts` 수정 — 사용자 선택 1순위, history.jsonl fallback
    - IPC 채널 3개(`GET/SET_PROJECT_SETTINGS`, `GET_KNOWN_PROJECTS`), preload API
    - `ConfigPage` "Projects" 탭 신설 — 드롭다운 + 자동 감지 옵션 + 저장 즉시 캐시 무효화
  - **Part B — Lint error 2건**:
    - `ConfigPage.tsx:242` + `FileChangePanel.tsx:89` `react-hooks/set-state-in-effect` 규칙 false positive
    - 각 위치에 `eslint-disable-next-line` 주석(초기 로드 패턴은 React docs가 명시적으로 허용)
  - **Part C — INBOX #5 알림 확장**:
    - `src/main/activity-monitor.ts` 신규 — 60초 간격 setInterval 루프
    - C1 stuck: 활성 세션 JSONL mtime 15분 경과 시 알림 (`computeStuckCandidates` 순수 함수)
    - C2 미커밋: `simple-git` 지연 로드, 프로젝트별 50개 이상 + 1시간 debounce (`shouldNotifyUncommitted`)
    - C3 좀비: `ps-list` 지연 로드, pid 생존 확인 (`computeZombieCandidates`)
    - `NotificationSettings` 3개 토글 + `NotificationCategory` 3개 추가
    - `main/index.ts`에서 whenReady에 등록, will-quit에 정리
  - **Part D — 재배포 준비**:
    - `package.json` v0.1.0-beta.2 → v0.1.0-beta.3
    - `simple-git@3.35.2`, `ps-list@9.0.0` dependencies 추가
- **검증**:
  - `npm run typecheck` 통과
  - `npm run test` — 147 → **157 passed** (+10 신규 activity-monitor 테스트)
  - `npm run lint` — 2 errors → **0 errors**
  - `npm run build` — 3단계 빌드 성공
  - `npm run test:e2e` — **Playwright 13/13 통과**
- **문서 갱신**: `known-issues.md` Medium 이슈 [해결됨], `INBOX.md` #5 완료 표시
- **배포**: 2개 원자 커밋(`d4c9e2d` feat + `5b53d03` chore) + `v0.1.0-beta.3` 태그 push → GitHub Actions 3-platform 빌드 전부 success (Run #3)
- **설치본 CDP 검증 6개 항목 전부 통과** (mcp__electron-test__connect 9222):
  1. Config 탭 목록: Hooks/Rules/MCP/Permissions/**Notifications(7)**/**Projects(1)** — 신규 탭 확인
  2. ProjectsTab 렌더링: 자동감지 + 5개 프로젝트(zm-agent-manager/sonix_docs/my-blog/zm-quant/zm-v3) 드롭다운
  3. **Medium 이슈 완전 해결 실증**: zm-agent-manager 선택 → Skills 페이지 `zm-analyze-jsonl`, `zm-new-component`, `zm-phase-status`, `zm-session-end`, `zm-session-start`, `zm-validate-req` 정확히 6개 고유 스킬 표시 (이전 검증에서는 zm-v3/my-blog가 유동적으로 나타나던 버그)
  4. Notifications 7개 토글: 비용/문서/세션/태스크 + **에이전트 stuck/대규모 미커밋/좀비 세션**
  5. PeriodComparisonCard: 주간/월간 토글, 최근 7일 $1606.42, "데이터 부족" + "신규 활동" 분기 정상
  6. 일별 비용 차트: Recharts 정상 렌더
- **검증 중 신규 Low 이슈 발견 + 즉시 수정** (2026-04-12 오후 후반):
  - **발견**: Tasks 페이지 "모든 프로젝트" 필터 시 Plans 레인에 1개만 표시 (프로젝트별 최신이 아닌 전체 중 1개)
  - **원인**: `TaskBoard.tsx:523` `activePlan = [filteredPlans[0]]` — 주석("프로젝트별 최신 플랜 1개")과 구현 불일치
  - **수정**: `src/renderer/src/lib/plan-utils.ts` 신규 — `pickLatestPlanPerProject` 순수 함수 (Map 그룹핑 + timestamp desc 정렬, string/number 혼합 timestamp 정규화). `TaskBoard.tsx`에서 해당 함수 호출로 교체
  - **테스트**: `plan-utils.test.ts` 5개 (빈/단일/다중/문자열/파싱실패)
  - **검증**: typecheck/lint/build 통과, 전체 테스트 157 → **162 passed**
  - **문서**: `known-issues.md` Low [해결됨] 전환
- **v0.1.0-beta.4 재배포**: 2개 원자 커밋(`2b8fb32` fix + `51122a8` chore) + 태그 `v0.1.0-beta.4` push → GitHub Actions Run #4 3-platform 전부 success (Linux/macOS/Windows)
- **남은 작업**: 사용자 로컬 재설치 + CDP 재검증 대기 (TaskBoard Plans 레인이 프로젝트 개수만큼 표시되는지 실증 확인)

---

## 2026-04-12 | 배포/런타임 이슈 2건 해결 + INBOX #1 비용 추적 확장

- **목표**: 이전 세션에서 발견된 known-issues 2건 종결 + INBOX #1(비용 추적) 확장
- **작업 내용**:
  - **이슈 B 해결 — 설치된 exe에서 프로젝트 스코프 스킬/에이전트 미발견**:
    - `src/main/current-project.ts` 신규 — `history.jsonl`에서 최근 활동 세션의 `project` 필드를 반환하는 헬퍼 (5초 TTL 캐시, fallback: `process.cwd()`)
    - `isAbsolutePath()` 가드로 인코딩된 디렉토리명 제외
    - 4개 스캐너 기본값 전환: `skill-scanner`, `agent-scanner`, `config-scanner`, `claude-md-linter`
    - `options.projectDir/projectRoot` 오버라이드 유지 → 기존 테스트 호환
  - **이슈 A 해결 — TaskBoard 실시간 모니터링 미지원**:
    - 30초 `setInterval` 폴링 + `window focus` 이벤트 리스너
    - `refetch(showSpinner)` 헬퍼로 초기 로드와 백그라운드 갱신 구분
    - `isMountedRef` 가드로 unmount race 방지
    - tasks/plans 병렬 재조회 (`Promise.all`)
  - **doc-watcher 후속 정비**:
    - `initDocWatcher()` async 전환, `getCurrentProjectPath()` 사용
    - `main/index.ts`에서 `.catch()` 에러 핸들링 추가 (unhandled rejection 방지)
  - **INBOX #1 비용 추적 확장** (Plan 모드에서 설계 후 구현):
    - `src/shared/format.ts` 신규 — `formatCost`, `shortModelName` 공용 유틸
    - `src/renderer/src/lib/period-comparison.ts` 신규 — `computePeriodComparison` 순수 함수 (주간/월간 계산, `empty`/`insufficient`/`ok` 3단계 status)
    - `CostTracker.tsx`: `ModelCostBars` (비용 내림차순 막대) + `PeriodComparisonCard` (주간/월간 토글, ▲▼ 증감 아이콘) 추가
    - `CostTracker.tsx`, `StatsPage.tsx`, `ComparePage.tsx` 로컬 `formatCost`/`shortModelName` 제거
    - 신규 테스트: `format.test.ts` (7개) + `period-comparison.test.ts` (6개)
- **검증**:
  - `npm run typecheck` 통과 (node + web)
  - `npm run test` — 134 → **147 passed** (+13 신규)
  - `npm run build` — electron-vite 3단계 빌드 성공
  - `npm run test:e2e` — **Playwright 13/13 통과** (사이드바 12개 페이지 smoke)
  - **CDP 실제 앱 검증** (electron-test-mcp connect 9222): ① PeriodComparisonCard 주간/월간 토글 렌더 ② 기간 비교 "데이터 부족" + "신규 활동" 분기 ③ ModelCostBars Opus/Sonnet 내림차순 + 100% 막대 너비 ④ 이슈 B 해결 확인(Skills 페이지 실제 프로젝트 디렉토리 스캔) ⑤ TaskBoard remount 시 `setInterval(30000)` 스파이 캡처 ⑥ Tasks 페이지에 현재 세션 작업 실시간 표시 — **6개 항목 모두 통과**
  - Lint 2 errors는 이번 세션 무관 (CostTracker:220, FileChangePanel:88 — 세션 시작 전부터 존재)
- **신규 이슈 발견** — Medium: 멀티 프로젝트 환경 current-project 유동성
  - Skills 페이지 연속 2회 방문 시 zm-v3 → my-blog로 변함 (5초 캐시 만료)
  - A안(자동 감지) 설계상 한계. 후속 B안(사용자 선택 드롭다운) 필요
  - `known-issues.md`에 미해결 Medium으로 등록
- **문서 갱신**: `known-issues.md` 이슈 A/B [해결됨] 전환 + 신규 이슈 1건 등록, `INBOX.md` #1 완료 표시
- **설계 선택**:
  - 이슈 A: 활성 세션 자동 감시(session-watcher 모델 변경)는 범위 확대로 기각, 폴링으로 최소 침습 해결
  - 이슈 B: 사용자 선택 프로젝트 드롭다운(UI 추가) 대신 최근 활동 세션 자동 감지로 블래스트 반경 최소화
  - INBOX #1: StatsPage `ModelUsageBars`에 비용 추가 방안은 `stats-service.ts` 수정 필요 → 기각, CostTracker 내 신규 컴포넌트로 집중
- **다음 할 일**: INBOX #5 알림 확장 (stuck/미커밋/좀비) 또는 기존 Lint error 2건 정리

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
  - **CI/CD 배포 자동화**:
    - GitHub Actions 워크플로우: 태그 푸시 시 Windows/macOS/Linux 자동 빌드
    - electron-builder 설정: publish → github, macOS Universal, Windows NSIS
    - v0.1.0-beta.1 → snap 빌드 실패 → v0.1.0-beta.2 성공
    - 발견 이슈: 설치된 exe에서 프로젝트 스코프 스킬/에이전트 미발견 (process.cwd() 차이)
  - **발견 이슈 — TaskBoard 실시간 모니터링 미지원**:
    - Tasks 페이지가 마운트 시 1회 로드 후 실시간 갱신 안됨
    - 원인: onNewRecords 미구독 + session-watcher 미감시
    - 해결안: 주기적 폴링(30초) 권장
- **다음 할 일**: TaskBoard 폴링 추가 + exe 프로젝트 스코프 스캔 수정

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
