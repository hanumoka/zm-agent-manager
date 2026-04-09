# 세션 히스토리 로그

최근 10개 세션의 작업 로그를 역순(최신이 위)으로 기록한다.
10개 초과 시 오래된 항목은 `archive/YYYY-MM.md`로 이동한다.

---

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
