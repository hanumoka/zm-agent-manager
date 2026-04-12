# 아이디어 수집함 (INBOX)

구체화되지 않은 아이디어를 자유롭게 기록한다.
충분히 구체화된 항목은 `requirements/` 또는 `roadmap/`으로 승격한 뒤 여기서 제거한다.

---

## Readout 앱 분석 기반 아이디어 (2026-04-08)

> Readout (readout.org) macOS 앱 바이너리 리버스 엔지니어링 + 웹 리서치 결과에서 도출.
> zm-agent-manager에 적용 가치가 높은 기능 후보.

### ~~1. 비용 추적 + 예산 알림~~ → **구현 완료** (2026-04-12)
- 기본 비용 집계 + 예산 임계 알림: Phase 2 M7에서 구현
- 모델별 비용 막대 차트 + 기간 비교(주간/월간) + formatCost/shortModelName 중앙화: 2026-04-12 추가 구현
- **결과물**: `CostTracker.tsx`의 `ModelCostBars` + `PeriodComparisonCard` 컴포넌트, `src/shared/format.ts`, `src/renderer/src/lib/period-comparison.ts`
- **테스트**: format.test.ts (7개) + period-comparison.test.ts (6개) 추가

### ~~2. Session Handoff — 세션 간 컨텍스트 전달~~ → **구현 완료** (2026-04-11)
- 세션 종료 시 "브리프" 자동 생성 → 다음 세션이 이어받기 가능
- **참고**: Claude Code /transfer-context 스킬, claude-code-session-kit, handoff 플러그인
- **재사용**: history-parser.ts, session-store.ts, notification-settings-service.ts
- **핵심 과제**: 세션 간 관계 데이터 모델 설계 필요 (현재 history.jsonl에 관계 정보 없음)

### ~~3. Tool Chain 분석 — 도구 호출 시퀀스 패턴~~ → **구현 완료** (2026-04-11)
- 연속 호출 시퀀스(체인) 패턴 분석 (예: Read → Grep → Edit)
- **참고**: claude-code-reverse 시각화 도구, MindStudio 워크플로우 패턴 5가지
- **재사용**: ToolTracker.tsx의 extractToolCalls()/computeStats() 90% 재사용, Recharts 설치됨
- **핵심 과제**: N-gram 패턴 추출 + Sankey/Flow 차트만 신규 작성

### ~~4. CLAUDE.md Linter~~ → **구현 완료** (2026-04-11)
- CLAUDE.md 구조/길이/섹션 자동 분석 + 개선 제안
- **참고**: AgentLinter (5차원 점수), cclint (프로젝트 파일 린터), Anthropic 공식 200줄 이하 권장
- **재사용**: doc-scanner.ts의 countLines(), DocInventory.tsx
- **핵심 과제**: 마크다운 섹션 파싱 정규식 + 검증 규칙 정의

### ~~5. 알림 시스템~~ → **구현 완료** (2026-04-12)
- 세션 시작/종료/태스크 완료/비용 임계: 이전 세션에서 구현
- 에이전트 stuck/대규모 미커밋/좀비 프로세스: 2026-04-12 오후 추가 구현
- **결과물**: `src/main/activity-monitor.ts` — 60초 간격 3개 검사(stuck 15분, 미커밋 50개/1시간, 좀비 pid 확인). `NotificationSettings`에 `agentStuck`/`uncommittedChanges`/`zombieProcess` 토글. Config 페이지 Notifications 탭에 UI 추가
- **신규 의존성**: `simple-git`, `ps-list`
- **테스트**: `activity-monitor.test.ts` 10개 (순수 함수 3개 추출)

### ~~6. 플래닝 모니터링 — ExitPlanMode 기반 플랜 추적 (2026-04-11)~~ → **구현 완료**
- `plan-scanner.ts` + Tasks 페이지 Plans 탭 + 마크다운 렌더링 (2026-04-11 구현)

### ~~7. 커스터마이즈 가능한 사이드바~~ → **구현 완료** (2026-04-11)
- 사용자가 사이드바 메뉴 순서/표시 여부 설정
- **참고**: electron-preferences 라이브러리
- **재사용**: notification-settings-service.ts 패턴 복사, App.tsx NAV_ITEMS 동적화
- **핵심 과제**: sidebar-settings-service.ts 신규 + 설정 UI (토글/드래그)

---

## 실시간 모니터링 UX 확장 (2026-04-12 오후 사용자 요청)

> 설치본 사용 후 사용자가 제시한 5가지 기능 요청. 각각 독립 실행 가능하나 2-4는 상호 의존적.

### ~~8. 실시간 갱신 상태 헤더 표시~~ → **구현 완료** (2026-04-12 오후)
- **결과물**: `src/renderer/src/components/LiveStatus.tsx` — 초록 pulse dot + `HH:MM:SS` + "X초 전" 라벨 (1초 interval로 자체 tick)
- TaskBoard 헤더에 배치, `refetch` 성공 시 `lastUpdatedAt` 업데이트
- 타 페이지(Dashboard/Sessions/Stats 등)로의 확장은 별도 세션

### ~~9. 파이프라인/플로우 그래프 시각화~~ → **구현 완료 + 재설계 완료** (2026-04-12 오후)
- **1차 구현 (폐기됨)**: `PipelineView.tsx` — 수평 스테이지 **칸반 박스** + TaskChip 나열. 사용자 피드백 "칸반 아닌 그래프 다이어그램 형태여야 함"으로 폐기
- **재설계 (현행)**:
  - `src/renderer/src/components/WorkflowPage.tsx` 신규 — 사이드바 Workflow 전용 메뉴(Tasks 위)로 이동, **5초 폴링**
  - `src/renderer/src/components/WorkflowGraph.tsx` 신규 — **SVG 노드/엣지 그래프**
    - 원(circle) 노드: 반경이 태스크 수에 비례 (36~60px)
    - 베지어 곡선 엣지: `stroke-dasharray` + `stroke-dashoffset` CSS 애니메이션으로 "물 흐르는" marching ants 효과 (2.4s linear infinite)
    - 태스크가 단계 변경 시 해당 엣지만 0.5s 가속 + 노드 glow filter
    - 노드 클릭 시 하단 패널에 단계별 태스크 목록 표시
  - `src/renderer/src/lib/workflow-utils.ts` 신규 — `mapTaskToStage`/`groupTasksByStage` 순수 함수 (9개 테스트)
- **프로젝트별 모니터링** (사용자 후속 요구 반영):
  - WorkflowPage 헤더에 **프로젝트 드롭다운** 추가 — "모든 프로젝트" 옵션 **없음**
  - 기본 선택: `getKnownProjects()`의 가장 최근 활동 프로젝트
  - 드롭다운 변경 시 해당 프로젝트의 `.claude/workflow.md`를 즉시 로드 + 5초 폴링 타이머 재시작
  - `scanProjectWorkflow(options.projectPath)` 파라미터 지원 — scanner 레벨에서 특정 프로젝트 스캔 가능
  - IPC `GET_PROJECT_WORKFLOW` + preload `getProjectWorkflow(projectPath?)` 확장
  - 선택된 프로젝트에 `workflow.md`가 없으면 경로 + 생성 안내 메시지 표시
  - **추후 계획**: 프로젝트별 워크플로우 설정 UI (각 프로젝트의 `.claude/workflow.md` 편집)
- **TaskBoard 변경**: Pipeline 탭 제거, 폴링 30s → **5s**, Tasks/Plans 2탭으로 환원
- **삭제**: `PipelineView.tsx` 폐기
- **재사용**: PipelineView의 `prevStageRef` 패턴을 WorkflowGraph에 재구현 (엣지/노드 활성화용)
- **신규 의존성 없음** (순수 SVG + CSS)

### ~~10. 프로젝트당 1개 워크플로우 제약~~ → **구현 완료** (2026-04-12 오후)
- **결과물**: TaskCard에 `boundWorkflow`/`boundProjectName` props 추가
- 태스크의 `projectName`이 `boundProjectName`과 일치하면 워크플로우 드롭다운이 잠김 + "🔒 프로젝트 고정" 배지
- 단계 드롭다운은 여전히 편집 가능 (사용자가 단계 진행 상황 수동 업데이트 가능)
- `TaskMetadata.workflowName` 쓰기 유지 (렌더 시점 오버레이만 적용 — 기존 데이터 보존)

### ~~11. 워크플로우를 프로젝트 문서로 저장 + Claude Code 인식~~ → **구현 완료** (2026-04-12 오후)
- **결과물**:
  - `src/main/workflow-scanner.ts` — `.claude/workflow.md` YAML frontmatter 파싱 (skill-scanner `parseFrontmatter` 재사용)
  - IPC `GET_PROJECT_WORKFLOW` + preload `getProjectWorkflow`
  - `.claude/rules/workflow-system.md` 정책 문서 신규
  - `CLAUDE.md`에 "## Workflow" 섹션 추가 — `.claude/workflow.md` 자동 참조
  - 본 프로젝트의 `.claude/workflow.md` 생성 (zm-agent-manager 고유 6단계)
- **저장 위치**: `<project-root>/.claude/workflow.md` (프로젝트당 1개)
- **형식**: YAML frontmatter (`name`, `displayName`, `stages`) + 자유 마크다운 본문
- **Claude Code 인식**: CLAUDE.md "## Workflow" 섹션이 자동 로드되며 해당 섹션이 workflow.md 참조를 안내

### ~~12. Completed 태스크 오늘/과거 분리~~ → **구현 완료** (2026-04-12 오후)
- **결과물**: `src/renderer/src/lib/task-utils.ts` (`getCompletedAt`, `isSameLocalDay` 순수 함수)
- Completed 레인 헤더에 `[오늘 (N)] [과거 (M)]` 탭 토글, 기본값 "오늘"
- `TaskInfo.events[]`에서 last `completed` 이벤트 timestamp 추출하여 로컬 자정 기준 분기
- 8개 단위 테스트

---

## 워크플로우 관리 시스템 확장 (2026-04-12 오후 사용자 요구)

### 13. 워크플로우 CRUD + DAG/Loop 지원 + 프로젝트 전용 폴더
- **배경**: 현재 프로젝트당 1개 워크플로우(`.claude/workflow.md`)는 linear stages만 지원. 사용자는 (a) 다중 워크플로우, (b) DAG + Loop (예: 검증 실패 → 구현 재작업), (c) 앱 내 CRUD UI 요구
- **새 폴더 구조**: `<project-root>/.claude/zm-agent-manager/workflows/{name}.md` — 앱 전용 namespace, 다중 파일
- **새 스키마** (Statechart 변형 — XState/Sismic 패턴 참고):
  ```yaml
  name: default
  displayName: ...
  start: 요구사항검증
  end: [배포]
  nodes:
    - { id: 요구사항검증, description: ... }
    - { id: 검증 }
    - { id: 구현 }
    ...
  edges:
    - { from: 검증, to: 문서갱신, label: 통과 }
    - { from: 검증, to: 구현, label: 실패 }   # 🔁 loop
  ```
- **검증 룰** (workflow-validator.ts):
  1. start 필수 (1개), end 필수 (1개 이상)
  2. 모든 노드 unique id
  3. edges의 from/to는 nodes에 존재
  4. start → 모든 노드 도달 가능 (BFS)
  5. 모든 노드 → end 도달 가능 (역방향 BFS) — 데드락 방지
  6. end 노드는 outgoing edge 없음
  7. **Loop 허용** — DAG 강제 안 함, 사용자가 명시적 cycle 정의
- **신규 의존성**: `yaml` (eemeli) — 기존 `parseFrontmatter`는 nested 구조 미지원
- **마이그레이션**: 기존 `.claude/workflow.md` 단일 파일 → 새 폴더의 `default.md`로 자동 변환
- **CRUD UI**: form 기반 (name/displayName + 노드 테이블 + 엣지 테이블 + 저장 시 자동 검증). 비주얼 드래그 에디터(react-flow)는 후속 phase
- **WorkflowGraph 업데이트**: edges 기반 + level BFS 레이아웃 + loop 엣지는 위쪽 arc 곡선
- **CLAUDE.md 정책 영향**: "## Workflow" 섹션 경로 변경 + `.claude/rules/workflow-system.md` 스키마 갱신
- **참고 자료**:
  - [Symfony Workflow](https://symfony.com/doc/current/workflow/workflow-and-state-machine.html) — places/transitions
  - [XState Statecharts](https://xstate.js.org/) — states/transitions/loops
  - [Sismic YAML statechart](https://sismic.readthedocs.io/en/latest/format.html)
  - [GCP Workflows](https://cloud.google.com/workflows) — branches + loops
  - [React Flow workflow editor](https://reactflow.dev/ui/templates/workflow-editor) — 후속 visual editor 후보
- **작업 단계**: P1(스키마+파서) → P2(IPC) → P3(마이그레이션) → P4(그래프 loop 렌더) → P5(WorkflowPage 통합) → P6(CRUD UI) → P7(검증). 총 ~12-15h, 2-3 세션 분할 권장
- **상태**: **사용자 진행 방식(A/B/C) 선택 대기**
