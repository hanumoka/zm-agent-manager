# 세션 히스토리 로그

최근 10개 세션의 작업 로그를 역순(최신이 위)으로 기록한다.
10개 초과 시 오래된 항목은 `archive/YYYY-MM.md`로 이동한다.

---

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

## 2026-04-09 | Phase 2 M4 태스크 보드(F11) 구현

- **목표**: JSONL TaskCreate/TaskUpdate 기반 칸반 태스크 보드 구현
- **작업 내용**:
  - `src/main/task-scanner.ts` 신규: 전체 세션 JSONL 스캔, TaskCreate/TaskUpdate 추출 및 태스크 상태 재구성
  - `src/shared/types.ts`: TaskInfo, TaskEvent, TaskStatus, AllTasksResult 타입 + GET_ALL_TASKS IPC 채널 추가
  - `src/main/ipc.ts`: GET_ALL_TASKS 핸들러 등록
  - `src/preload/index.ts + index.d.ts`: getAllTasks API 노출
  - `src/renderer/src/components/TaskBoard.tsx` 신규: 칸반 보드 (3레인), TaskCard (펼침/상태이력), 프로젝트 필터, 삭제 토글, 통계
  - `src/renderer/src/App.tsx`: Tasks 라우트 + 사이드바 네비게이션 추가
- **검증**: lint 0 에러, typecheck 통과, 테스트 19개 전체 통과

## 2026-04-09 | Phase 2 대시보드 검토 및 품질 수정

- **목표**: DashboardPage 구현 후 코드 품질 재검토 및 수정
- **작업 내용**:
  - `formatTimeAgo` 중복 제거: DashboardPage + SessionList → `lib/utils.ts`로 추출
  - DashboardPage 에러 처리 추가 (error 상태 체크 + 에러 UI)
  - known-issues.md "Recharts 미사용" → [해결됨] 갱신
  - CLAUDE.md Recharts 주석 "(대시보드 ActivityChart에서 사용)"으로 갱신
- **검증**: lint 0 에러, typecheck 통과, 테스트 19개 전체 통과

## 2026-04-09 | Phase 2 대시보드(F1) 구현 + UI 수정

- **목표**: Phase 2 M5 대시보드 전체 구현 + Electron 창 드래그 영역 수정
- **작업 내용**:
  - `DashboardPage.tsx` 신규 작성: StatCard 4개 (프로젝트/활성 세션/오늘 세션/총 메시지), ActivityChart 14일 바 차트 (Recharts), RecentSessions 10개 리스트
  - `App.tsx`: DashboardPage 스텁 제거, 별도 컴포넌트로 교체
  - `App.tsx`: TitleBar 컴포넌트 추가 (-webkit-app-region: drag), 레이아웃 세로 구조 변경
  - feature/phase2-dashboard 브랜치에서 작업 (git-workflow 정책 적용 시작)
- **검증**: lint 0 에러, typecheck 통과
- **다음 할 일**: 사용자 테스트 확인 후 커밋, Phase 2 다음 마일스톤 착수

## 2026-04-09 | Electron 창 드래그 영역 수정

- **목표**: `titleBarStyle: 'hiddenInset'`으로 인한 창 이동 불가 문제 해결
- **작업 내용**:
  - `src/renderer/src/App.tsx`: TitleBar 컴포넌트 추가 (`-webkit-app-region: drag`)
  - macOS traffic light 버튼 공간 확보 (`pl-[78px]`)
  - 레이아웃 구조 변경: 전체 상단 타이틀바 → 사이드바+메인 세로 배치
  - 사이드바 헤더에서 타이틀 제거 (타이틀바로 이관)
- **검증**: lint 0 에러, typecheck 통과
- **다음 할 일**: 사용자 테스트 확인 후 커밋

## 2026-04-09 | 문서 리팩토링 + 코드 리팩토링

- **목표**: Phase 1 완료 후 코드-문서 전수 검증 및 리팩토링
- **작업 내용**:
  - **문서 리팩토링** (14개 파일):
    - Critical 5건: ROADMAP/phase-1 상태 갱신, SESSION_LOG 누락 세션 추가, PRD v1 Deprecated, README 링크
    - Major 6건: PRD-v2 실제 결과 노트, feature-spec F17-F20 스텁, CLAUDE.md Recharts 주석, phase-2/3 마일스톤 보강
    - Minor 3건: git-workflow 노트, readout 교차참조, known-issues 갱신
  - **코드 리팩토링** (5개 파일):
    - `MessageTimeline.tsx`: messages 필터 useMemo 추가, virtualizer useEffect deps 수정 (매 렌더 scroll 버그 해결)
    - `session-scanner.ts`: stat 호출 Promise.all 병렬화
    - `jsonl-parser.ts`: 미사용 parseJsonlTail 함수 삭제 (-28줄)
    - `session-watcher.ts`: statSync → async stat 교체, watchSession async 변환
    - `App.tsx`: DashboardPage 플레이스홀더 텍스트 갱신
  - lint 0 에러, typecheck 통과, 테스트 19개 전체 통과
- **결과**: 문서 이슈 14건 중 11건 해결 + 코드 이슈 6건 전체 해결. 미해결 3건 추적 등록.
- **다음 할 일**: Phase 2 착수 결정 (F5-F7 + F11/F1대시보드/F12/F13)

_(이전 세션은 [archive/2026-04.md](./archive/2026-04.md) 참조)_
