# zm-agent-manager PRD v2

> 버전: 2.0
> 작성일: 2026-04-08
> 이전 버전: [`PRD.md`](./PRD.md) (v1, F1~F10)
> 변경 사유: 사용자 고민 5가지 반영 + 경쟁 분석(Readout/Agentation/Vibe Kanban) 결과 통합

---

## 1. 프로젝트 개요

### 1.1 프로젝트명
**zm-agent-manager** — Claude Code 세션 모니터링, 태스크 관리, 문서 감독 데스크톱 앱

### 1.2 목적
Claude Code CLI의 세션 데이터(`~/.claude/`)를 실시간으로 모니터링하고, 에이전트가 생성한 태스크를 시각화하며, Claude Code가 관리하는 문서의 변경을 감독하는 Electron 기반 데스크톱 앱을 개발한다.

### 1.3 배경

**문제 정의** (사용자 고민 5가지):
1. Claude Code가 관리하는 **작업 문서가 방대**한데 이를 체계적으로 모니터링할 도구가 없다
2. 터미널에서 Claude Code에게 준 **지시가 태스크화되어 관리되지 않는다**
3. 태스크가 사용자 정의 **워크플로우에 따라 진행되지 않는다**
4. Claude Code의 **실시간 활동을 시각적으로 확인하기 어렵다**
5. Claude Code가 수정한 **중요 문서의 변경을 놓칠 수 있다**

**경쟁 환경**:
| 도구 | 강점 | 약점 (zm-agent-manager가 해결) |
|------|------|------|
| Readout | 세션 모니터링/리플레이/비용 추적 25개 화면 | 태스크 관리 없음, 문서 감독 없음, macOS 전용 |
| Vibe Kanban | 칸반 보드 + 워크스페이스 + 10종 에이전트 | Claude Code 특화 아님, 웹 기반 |
| Agent Kanban | VS Code 마크다운 태스크 | VS Code 종속, Copilot 전용 |

### 1.4 대상 사용자
- Claude Code를 일상적으로 사용하는 개발자
- 여러 프로젝트에서 Claude Code 세션을 동시에 운영하는 사용자
- Claude Code에게 복잡한 작업을 지시하고 **진행 상황을 관리**하고 싶은 사용자
- Claude Code가 수정하는 **문서의 품질을 감독**하고 싶은 사용자

### 1.5 포지셔닝

> Readout이 **"모니터"** 라면, zm-agent-manager는 **"매니저"** 다.

```
세션 모니터링 (Readout 수준)
  + 태스크 보드 & 워크플로우 (Vibe Kanban 참고, Claude Code 특화)
  + 문서 변경 감독 & 중요도 분류 (독자 기능)
  = Claude Code 작업을 통합 관리하는 프로젝트 매니저
```

### 1.6 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **읽기 전용** | `~/.claude/` 디렉토리 데이터를 절대 수정하지 않는다 |
| **앱 자체 데이터 분리** | 앱이 관리하는 데이터(워크플로우, 중요도, 알림)는 `~/.zm-agent-manager/`에 저장 |
| **성능 우선** | 대용량 JSONL 스트리밍 파싱, 가상화 리스트 |
| **IPC 분리** | 파일 I/O는 메인 프로세스에서만 수행, 렌더러는 IPC로 데이터 수신 |
| **크로스 플랫폼** | macOS 우선, Windows/Linux 지원 |

---

## 2. 데이터 소스

### 2.1 읽기 전용 데이터 (`~/.claude/`, 수정 금지)

```
~/.claude/
├── history.jsonl                      → 세션 목록, 대시보드
├── stats-cache.json                   → 세션 통계, 비용 계산 기초
├── sessions/{pid}.json                → 실시간 활성 세션 감지
├── projects/{encoded-path}/
│   ├── {sessionId}.jsonl              → 핵심: 메시지, 도구 호출, 태스크 이벤트
│   ├── {sessionId}/subagents/         → 서브에이전트 세션
│   ├── memory/MEMORY.md               → 메모리 뷰어
│   └── settings.json                  → 프로젝트 설정
├── file-history/{sessionId}/          → 파일 변경 이력 (diff용)
├── todos/{sessionId}-*.json           → 태스크 보드 (활성 세션)
├── readout-pricing.json               → 비용 계산 가격표 (Readout이 생성)
└── readout-cost-cache.json            → 비용 캐시 (Readout이 생성)
```

**프로젝트 루트 디렉토리** (읽기 전용):
```
{project}/
├── .mcp.json                          → MCP 서버 설정
├── CLAUDE.md                          → 문서 건강 검사 (Lint)
├── .claude/skills/                    → 스킬 목록
├── .claude/agents/                    → 에이전트 목록
├── .claude/hooks/                     → 훅 목록
└── .claude/rules/                     → 규칙 목록
```

### 2.2 앱 자체 데이터 (`~/.zm-agent-manager/`, 앱이 관리)

```
~/.zm-agent-manager/
├── config.json                        → 앱 전역 설정
├── workflows/                         → 사용자 정의 워크플로우 템플릿
│   └── default.json                   → 기본: pending → in_progress → completed
├── task-metadata/{sessionId}/         → 태스크 확장 메타데이터
│   └── {taskId}.json                  → 워크플로우 단계, 심각도, 유형, 코멘트
├── doc-importance/rules.json          → 문서 중요도 분류 규칙 (경로 기반)
├── doc-reviews/                       → 문서 변경 리뷰 이력
│   └── {date}/{changeId}.json         → 승인/반려/코멘트
├── notifications/{date}.json          → 알림 이력
└── cache/                             → 파싱 캐시 (성능 최적화)
```

### 2.3 JSONL 레코드 타입 (7종, 검증 완료)

| 타입 | 빈도(예시) | 용도 |
|------|-----------|------|
| `assistant` | 489 (50.8%) | Claude 응답 — text, thinking, tool_use, tool_result 블록 |
| `user` | 379 (39.4%) | 사용자 메시지 |
| `file-history-snapshot` | 49 (5.1%) | 파일 변경 스냅샷 시점 |
| `system` | 33 (3.4%) | 턴 종료 메타 (소요시간, 메시지 수) |
| `queue-operation` | 10 (1.0%) | 백그라운드 태스크 큐 |
| `attachment` | 2 (0.2%) | 첨부 파일/붙여넣기 |
| `permission-mode` | 1 (0.1%) | 권한 모드 변경 |

### 2.4 도구 호출 (tool_use) — 13종 확인

| 도구 | 입력 키 | 태스크 관련 |
|------|--------|------------|
| Read | file_path | - |
| Write | file_path, content | 문서 변경 감지 |
| Edit | file_path, old_string, new_string | 문서 변경 감지 |
| Bash | command, description | - |
| **TaskCreate** | subject, description, activeForm | **태스크 생성** |
| **TaskUpdate** | taskId, status | **태스크 상태 변경** |
| Agent | subagent_type, description, prompt | 서브에이전트 |
| Glob, Grep, WebSearch, WebFetch, ToolSearch, AskUserQuestion, ExitPlanMode | 각 도구별 | - |

---

## 3. 핵심 기능 정의 (F1~F16)

> **v1 → v2 변경사항**:
> - F1~F10: PRD v1에서 상속 (F1 대시보드로 확장, 나머지 동일)
> - **F11~F16: v2에서 신규 추가** (사용자 고민 반영)
> - **Phase 1 범위 확장**: PRD v1의 F1~F4 → v2에서 F11(태스크 보드) 추가
> - 각 기능의 상세 사양은 [`feature-spec.md`](./feature-spec.md) 참조

### Phase 1 — 세션 모니터링 + 태스크 보드 (MVP)

| # | 기능 | 설명 | 데이터 소스 |
|---|------|------|------------|
| F1 | **대시보드** | 프로젝트 전체 현황 요약 — 활성 세션, 오늘 커밋, 비용, 최근 세션, 태스크 현황, 문서 변경 알림 | history.jsonl, stats-cache.json, sessions/*.json, git |
| F2 | **실시간 세션 모니터** | 활성 세션 실시간 표시 — 상태, 경과 시간, 메모리, 현재 도구 호출 | sessions/{pid}.json, JSONL 실시간 감시 |
| F3 | **메시지 타임라인** | user/assistant 메시지를 시간순 렌더링. parentUuid 기반 메시지 체인, thinking 블록 접기 | {sessionId}.jsonl |
| F4 | **도구 호출 추적** | 도구별 분포 차트, 사용 추이, 호출 체인 패턴(Common Sequences), 가장 많이 편집된 파일 | JSONL tool_use 블록 |
| **F11** | **태스크 보드** | Claude Code 내부 태스크를 칸반 보드로 시각화. JSONL의 TaskCreate/TaskUpdate + todos/ 파싱 | JSONL, todos/*.json |

### Phase 2 — 세션 리플레이 + 문서 감독

| # | 기능 | 설명 | 데이터 소스 |
|---|------|------|------------|
| F5 | **세션 리플레이** | 과거 세션을 타임라인으로 재구성. 재생/일시정지, 0.5x~4x 속도, 스텝 이동, 파일 변경 하이라이트 | {sessionId}.jsonl, file-history/ |
| F6 | **파일 변경 추적** | 세션별 파일 변경 목록 + side-by-side diff. file-history 버전 비교 | file-history/{hash}@v{n} |
| F7 | **서브에이전트 추적** | 서브에이전트 세션을 부모 세션과 함께 트리 시각화 | subagents/*.jsonl |
| **F12** | **문서 인벤토리 & diff** | CLAUDE.md, MEMORY.md, docs/ 등 관리 문서 목록 + 변경 이력 + diff 뷰 | file-history/, git, 파일 시스템 |
| **F13** | **비용 실시간 추적** | 모델별 비용 분석, 기간별 비교, 예산 알림 | JSONL usage, readout-pricing.json |

### Phase 3 — 분석, 워크플로우, 알림

| # | 기능 | 설명 | 데이터 소스 |
|---|------|------|------------|
| F8 | **세션 통계** | 토큰 사용량, 도구 호출 빈도, 세션 시간, 비용 통계 대시보드 | stats-cache.json, JSONL |
| F9 | **검색 기능** | 세션 내 메시지, 도구 호출, 파일 경로 전문 검색 | 모든 JSONL |
| F10 | **세션 비교** | 두 세션의 메시지/도구 호출 패턴 side-by-side diff | JSONL |
| **F14** | **태스크 워크플로우** | 사용자 정의 진행 단계 + 심각도/유형 분류 + 해결 요약/거부 사유 | ~/.zm-agent-manager/workflows/, task-metadata/ |
| **F15** | **문서 중요도 분류 & 알림** | 경로 기반 자동 중요도 분류 + 중요 변경 데스크톱 알림 + 리뷰 상태 관리 | doc-importance/rules.json, doc-reviews/ |
| **F16** | **알림 시스템** | 세션 시작/종료, 비용 임계치, 태스크 완료, 중요 문서 변경 시 데스크톱 알림 | 모든 데이터 소스 |

---

## 4. 신규 기능 상세 (F11~F16)

> **F1~F10 상세 사양**: [`feature-spec.md`](./feature-spec.md) 참조
> 본 섹션에서는 v2에서 신규 추가된 F11~F16만 기술한다.

### F11. 태스크 보드

**목적**: Claude Code가 내부적으로 관리하는 태스크를 칸반 보드로 시각화

**데이터 수집**:
- 1차: `~/.claude/todos/{sessionId}-*.json` — 활성 세션의 태스크 목록
- 2차: JSONL의 `TaskCreate`/`TaskUpdate` tool_use — 모든 세션의 태스크 이력 재구성

**표시 정보**:
- 태스크 제목 (subject), 설명 (description)
- 상태: pending / in_progress / completed / deleted
- 소속 세션, 생성 시간, 상태 변경 이력
- 의존성 (blocks/blockedBy)

**칸반 보드 레인**:
```
| Pending | In Progress | Completed |
|---------|-------------|-----------|
| 태스크A  | 태스크B      | 태스크C    |
| 태스크D  |             | 태스크E    |
```

**원칙**: `~/.claude/todos/`는 읽기 전용. 앱에서 태스크를 직접 생성/수정하지 않음.

---

### F12. 문서 인벤토리 & diff

**목적**: Claude Code가 관리하는 문서들의 현재 상태와 변경 이력을 추적

**표시 정보**:
- 문서 목록: CLAUDE.md, MEMORY.md, .claude/rules/*.md, .claude/skills/*, .claude/agents/*, docs/**
- 각 문서의: 최종 수정일, 크기, 라인 수, 변경 빈도
- 세션별 변경 이력: 어떤 세션에서 어떤 문서가 변경되었는지
- diff 뷰: file-history의 `{hash}@v{n}` 파일로 이전/이후 비교

---

### F13. 비용 실시간 추적

**목적**: API 사용 비용을 실시간으로 추정하고 추이를 분석

**비용 계산 공식** (실제 데이터로 $27.07 재현 검증 완료):
```
cost = (input_tokens x model.input / 1M)
     + (output_tokens x model.output / 1M)
     + (cache_read_tokens x model.cacheRead / 1M)
     + (cache_write_tokens x model.cacheWrite / 1M)
```

**가격표**: readout-pricing.json 참조 또는 자체 관리
- opus-4-6: input $5.00, output $25.00, cacheRead $0.50, cacheWrite $6.25
- sonnet-4-5: input $3.00, output $15.00, cacheRead $0.30, cacheWrite $3.75
- haiku-4-5: input $1.00, output $5.00, cacheRead $0.10, cacheWrite $1.25

---

### F14. 태스크 워크플로우

**목적**: Claude Code의 단순 상태를 사용자 정의 워크플로우로 확장 관리

**상태 흐름** (Agentation의 어노테이션 상태 모델 차용):
```
pending → acknowledged → in_progress → [사용자 정의 단계] → resolved (+ summary)
                                                          → failed (+ reason, retry 가능)
                                                          → dismissed (+ reason)
```

**사용자 정의 단계 예시**:
```json
{
  "name": "개발 워크플로우",
  "stages": ["요구사항 수집", "설계", "구현", "테스트", "리뷰", "완료"]
}
```

**심각도 분류** (Agentation severity 차용):
| 심각도 | 의미 | 표시 |
|--------|------|------|
| `blocking` | 반드시 완료 필요 | 빨간 뱃지, 최상단 |
| `important` | 중요하지만 병행 가능 | 주황 뱃지 |
| `suggestion` | 선택적 | 회색 뱃지 |

**유형 분류** (Agentation intent 차용):
| 유형 | 의미 |
|------|------|
| `fix` | 버그 수정 태스크 |
| `change` | 기능 변경/추가 태스크 |
| `question` | 조사/분석 태스크 |
| `approve` | 리뷰/검증 태스크 |

**원칙**: 워크플로우 메타데이터는 `~/.zm-agent-manager/task-metadata/`에 저장. Claude Code의 태스크 데이터는 수정하지 않음.

---

### F15. 문서 중요도 분류 & 알림

**목적**: Claude Code가 수정한 문서의 변경을 중요도별로 분류하여 알림

**중요도 자동 분류 (경로 기반)**:
| 중요도 | 경로 패턴 | 알림 방식 |
|--------|----------|----------|
| `blocking` (최상) | `docs/requirements/*`, `PRD*.md` | 즉시 데스크톱 알림 |
| `important` (상) | `docs/policies/*`, `CLAUDE.md`, `.claude/rules/*` | 즉시 알림 |
| `important` (중) | `docs/roadmap/*`, `MEMORY.md` | 세션 종료 시 일괄 알림 |
| `suggestion` (하) | `docs/sessions/*`, `docs/ideas/*`, 기타 | 대시보드에만 표시 |

**문서 변경 리뷰 상태** (Agentation 어노테이션 흐름 차용):
```
pending → acknowledged → approved (승인)
                       → rejected (반려 + 사유)
                       → commented (코멘트 추가)
```

**데이터 저장**: `~/.zm-agent-manager/doc-reviews/`

---

### F16. 알림 시스템

**목적**: 중요 이벤트 발생 시 사용자에게 데스크톱 알림

**알림 트리거**:
| 이벤트 | 조건 | 기본 활성화 |
|--------|------|-----------|
| 세션 시작 | sessions/{pid}.json 생성 감지 | ON |
| 세션 종료 | 프로세스 종료 감지 | ON |
| 태스크 완료 | TaskUpdate status=completed | ON |
| 비용 임계치 | 일/월 비용이 설정 예산의 N% 도달 | ON (예산 설정 시) |
| 문서 변경 (blocking) | blocking 중요도 문서 수정 감지 | ON |
| 문서 변경 (important) | important 중요도 문서 수정 감지 | OFF |
| 에이전트 stuck | 일정 시간 응답 없음 | OFF |

---

## 5. 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | **Electron** | 메인/렌더러 프로세스 구조 |
| 언어 | **TypeScript** | 전체 코드 (strict mode) |
| UI 라이브러리 | **React 18** | 렌더러 프로세스 UI |
| 빌드 도구 | **Vite** | electron-vite 사용 |
| 파일 감시 | **chokidar** | `~/.claude/` 디렉토리 실시간 감시 |
| 스타일링 | **Tailwind CSS** | 다크 모드 기본 (Readout 참고) |
| 상태 관리 | **Zustand** | 경량 상태 관리 |
| JSONL 파싱 | 자체 구현 | 스트리밍 라인 파서 |
| 앱 자체 DB | **JSON 파일** | `~/.zm-agent-manager/` (경량, SQLite 불필요) |
| 알림 | **Electron Notification API** | 데스크톱 네이티브 알림 |

---

## 6. 아키텍처 개요

### 6.1 프로세스 구조

```
┌──────────────────────────────────────────────────────────┐
│                     Main Process                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Session       │  │ JSONL Parser │  │ Task Service   │  │
│  │ Watcher       │  │ Service      │  │ (todos+JSONL)  │  │
│  │ (chokidar)    │  │ (streaming)  │  │                │  │
│  └──────────────┘  └──────────────┘  └────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Document      │  │ Cost         │  │ Notification   │  │
│  │ Monitor       │  │ Calculator   │  │ Service        │  │
│  │ (file-history)│  │              │  │                │  │
│  └──────────────┘  └──────────────┘  └────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                      │
│  │ App Data      │  │ IPC          │                      │
│  │ Manager       │  │ Handlers     │                      │
│  │ (~/.zm-*)     │  │              │                      │
│  └──────────────┘  └──────────────┘                      │
│                          │ IPC                            │
├──────────────────────────┼───────────────────────────────┤
│                          ▼                                │
│                   Renderer Process                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │Dashboard  │  │ Live     │  │ Sessions │  │ Tools    │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Tasks    │  │ Docs     │  │ Replay   │  │ Costs    │ │
│  │ Board    │  │ Monitor  │  │ Player   │  │          │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Config   │  │ Search   │  │ Settings │               │
│  │ Viewer   │  │          │  │          │               │
│  └──────────┘  └──────────┘  └──────────┘               │
└──────────────────────────────────────────────────────────┘
```

### 6.2 데이터 흐름

```
~/.claude/ (읽기 전용)
  │
  ├─ chokidar 감시 → JSONL 증분 파싱 → IPC → 렌더러 UI 갱신
  ├─ sessions/*.json → 활성 세션 감지 → Live 화면
  ├─ JSONL TaskCreate/TaskUpdate → Task Service → Tasks 보드
  ├─ file-history/ → Document Monitor → Docs 화면 + 알림
  └─ JSONL usage → Cost Calculator → Costs 화면

~/.zm-agent-manager/ (앱이 관리)
  │
  ├─ workflows/ → Task Service → 워크플로우 단계 매핑
  ├─ task-metadata/ → Task Service → 심각도/유형/코멘트
  ├─ doc-importance/ → Document Monitor → 중요도 분류
  ├─ doc-reviews/ → Document Monitor → 리뷰 상태
  └─ notifications/ → Notification Service → 알림 이력
```

---

## 7. 개발 로드맵

### Phase 1 — MVP (세션 모니터링 + 태스크 보드)

1. Electron + Vite + React + TypeScript 프로젝트 스캐폴딩
2. `~/.claude/` 디렉토리 스캔 및 세션 목록 표시 (F1)
3. JSONL 스트리밍 파싱 서비스 구현
4. chokidar 기반 실시간 파일 감시 (F2)
5. 메시지 타임라인 뷰 (F3)
6. 도구 호출 추적 — 분포 차트, 호출 체인 (F4)
7. **태스크 보드 — JSONL TaskCreate/TaskUpdate 파싱 + 칸반 뷰 (F11)**
8. 대시보드 — 종합 현황 (F1)

### Phase 2 — 세션 리플레이 + 문서 감독

9. 세션 리플레이 플레이어 (F5)
10. 파일 변경 하이라이트 + diff 뷰 (F6)
11. 서브에이전트 트리 시각화 (F7)
12. **문서 인벤토리 & diff — 관리 문서 목록 + 변경 이력 (F12)**
13. **비용 실시간 추적 — 모델별 비용 + 예산 설정 (F13)**

### Phase 3 — 분석, 워크플로우, 알림

14. 세션 통계 대시보드 (F8)
15. 전문 검색 기능 (F9)
16. 세션 비교 뷰 (F10)
17. **태스크 워크플로우 — 사용자 정의 단계 + 심각도/유형 (F14)**
18. **문서 중요도 분류 & 알림 — 경로 기반 분류 + 리뷰 상태 (F15)**
19. **알림 시스템 — 데스크톱 네이티브 알림 (F16)**

---

## 8. 비기능 요구사항

| 항목 | 요구사항 |
|------|---------|
| **성능** | 100MB+ JSONL 스트리밍 파싱, UI 블로킹 없음, 가상화 리스트 |
| **보안** | `~/.claude/` 읽기 전용, 앱 자체 데이터는 별도 디렉토리 |
| **호환성** | macOS 우선, 추후 Windows/Linux |
| **메모리** | 대량 세션 데이터 가상화, 캐시 크기 제한 |
| **알림** | Electron Notification API, 사용자 커스터마이즈 가능 |
| **다크 모드** | 기본 (Readout 참고 — `#000000` 배경 기반) |

---

## 9. 제약 사항 및 리스크

| 항목 | 설명 | 대응 |
|------|------|------|
| Claude Code 버전 호환 | JSONL 스키마가 버전에 따라 변경 가능 | version 필드 기반 분기 처리 |
| 파일 감시 성능 | 프로젝트 수 증가 시 chokidar 부하 | 활성 세션만 선택적 감시 |
| 데이터 크기 | JSONL 수백 MB | 스트리밍 파싱 + 페이지네이션 + 캐시 |
| 읽기 전용 원칙 | `~/.claude/` 절대 수정 금지 | 앱 데이터는 `~/.zm-agent-manager/`에 분리 |
| todos 데이터 휘발성 | 세션 종료 후 빈 배열로 초기화 | JSONL TaskCreate/TaskUpdate로 이력 재구성 |
| 비용 정확도 | 실제 과금과 추정치 차이 | "추정치" 면책 문구 표시 |

---

## 10. 참고 자료

### 구현 문서 (본 PRD 기반)
| 문서 | 설명 |
|------|------|
| [`feature-spec.md`](./feature-spec.md) | 기능명세서 — F1~F16 입력/출력/로직/UI 상세 |
| [`screen-design.md`](./screen-design.md) | 화면설계서 — 사이드바 + 10개 화면 + 네비게이션 |
| [`wireframes.md`](./wireframes.md) | 와이어프레임 — 7개 핵심 화면 ASCII 레이아웃 |

### 분석 문서 (기획 참고)
| 문서 | 설명 |
|------|------|
| [`PRD.md`](./PRD.md) | PRD v1 (F1~F10 원본, 본 문서로 대체됨) |
| [`readout-features.md`](./readout-features.md) | Readout 기능 명세서 (경쟁 분석) |
| [`readout-analysis.md`](./readout-analysis.md) | Readout 기술 분석서 (UI/데이터 상세) |
| [`agentation-analysis.md`](./agentation-analysis.md) | Agentation 기능 분석서 (상태 모델 참고) |
| [`user-concerns.md`](./user-concerns.md) | 사용자 고민 → 기능 매핑 + 의사결정 |
