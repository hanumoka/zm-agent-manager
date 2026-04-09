# zm-agent-manager 기능명세서

> 버전: 1.0
> 작성일: 2026-04-08
> 기반: [`PRD-v2.md`](./PRD-v2.md) (F1~F20)
> 목적: 각 기능의 입력/출력/로직/UI를 구현 가능한 수준으로 정의

---

## 목차

- Phase 1: F1(대시보드), F2(실시간 모니터), F3(메시지 타임라인), F4(도구 추적), F11(태스크 보드)
- Phase 2: F5(세션 리플레이), F6(파일 변경), F7(서브에이전트), F12(문서 인벤토리), F13(비용 추적)
- Phase 3: F8(세션 통계), F9(검색), F10(세션 비교), F14(워크플로우), F15(문서 중요도), F16(알림)

---

## Phase 1 기능

### F1. 대시보드

**목적**: 전체 현황을 한 화면에 요약하여 진입점 제공

**입력 데이터**:
| 데이터 | 소스 | 읽기 방식 |
|--------|------|----------|
| 활성 세션 수 | `~/.claude/sessions/*.json` | 파일 존재 + pid 프로세스 확인 |
| 오늘 세션 수 | `history.jsonl` | timestamp가 오늘인 레코드 카운트 |
| 오늘 커밋 수 | `git log --after=today` | child_process 실행 |
| 예상 비용 | JSONL usage 필드 + pricing | 토큰 × 단가 계산 |
| 최근 세션 | `history.jsonl` 최신 5개 | display + project + timestamp |
| 태스크 현황 | JSONL TaskCreate/TaskUpdate | pending/in_progress/completed 카운트 |
| Hygiene 경고 | git status + 문서 검사 | 미커밋 파일 수, CLAUDE.md 린트 |

**출력 UI 컴포넌트**:
| 컴포넌트 | 데이터 | 위치 |
|----------|--------|------|
| StatCard x4 | Repos, Commits Today, Sessions, Est. Cost | 상단 |
| ActivityChart | 30일 일별 활동 (stats-cache.json.dailyActivity) | 중단 좌 |
| WhenYouWork | 요일×시간 히트맵 (history.jsonl timestamp) | 중단 우 |
| CostByModel | 모델별 비용 바 | 중하단 좌 |
| RecentSessions | 세션 리스트 + Replay 버튼 | 중하단 우 |
| AlertBanner | Hygiene 경고, 예산 제안, 태스크 현황 | 하단 |
| RecentlyActive | 프로젝트별 Skills/Agents/Memory/Tasks 요약 | 최하단 |

**갱신 주기**: 앱 진입 시 전체 로드 + 30초 간격 폴링

---

### F2. 실시간 세션 모니터

**목적**: 현재 실행 중인 Claude Code 세션의 상태를 실시간 표시

**입력 데이터**:
| 데이터 | 소스 | 읽기 방식 |
|--------|------|----------|
| 활성 세션 목록 | `~/.claude/sessions/*.json` | 파일 스캔 + pid 프로세스 확인 |
| 세션 메타 | sessions/{pid}.json | pid, sessionId, cwd, startedAt, kind, entrypoint |
| 메모리 사용량 | `ps -o rss= -p {pid}` | child_process, RSS → MB |
| 현재 도구 호출 | {sessionId}.jsonl 마지막 레코드 | chokidar 감시 + 증분 파싱 |

**출력 UI 컴포넌트**:
| 컴포넌트 | 데이터 |
|----------|--------|
| StatCard x3 | Sessions(활성), Generating(생성중), Memory MB(합계) |
| SessionCard (목록) | 프로젝트명 + 경과시간(H:MM:SS) + 메모리(MB) + 상태뱃지(active/generating) |

**핵심 로직**:
```typescript
// 활성 세션 감지
1. ~/.claude/sessions/*.json 스캔
2. 각 파일에서 pid 추출
3. ps -p {pid} 로 프로세스 존재 확인
4. 존재하면 활성 세션으로 등록
5. startedAt으로 경과 시간 계산 (1초 간격 UI 갱신)
6. ps -o rss= -p {pid} 로 메모리 측정

// Generating 감지
7. 해당 세션 JSONL의 마지막 레코드 type 확인
8. type === 'assistant' && content에 완료되지 않은 tool_use → generating
```

**갱신 주기**: 5초 간격 세션 스캔 + 1초 간격 경과 시간 UI 갱신

---

### F3. 메시지 타임라인

**목적**: 세션 내 user/assistant 메시지를 시간순 타임라인으로 렌더링

**입력 데이터**:
| 데이터 | 소스 |
|--------|------|
| 메시지 목록 | `{sessionId}.jsonl` — type: user, assistant |
| 메시지 체인 | parentUuid → uuid 연결 |
| 도구 호출 | assistant content의 tool_use/tool_result 블록 |
| 사고 과정 | assistant content의 thinking 블록 |
| 턴 메타 | type: system (durationMs, messageCount) |

**출력 UI 컴포넌트**:
| 컴포넌트 | 데이터 |
|----------|--------|
| UserMessage | role=user 메시지 텍스트 (마크다운 렌더링) |
| AssistantMessage | role=assistant 텍스트 블록 (마크다운 렌더링) |
| ThinkingBlock | thinking 블록 (접기/펼치기, 기본 접힘) |
| ToolCallInline | tool_use — 도구명 + 입력 요약 + 실행시간 + 결과(접기) |
| TurnDivider | system 레코드 — 턴 구분선 + 소요시간 + 메시지수 |
| VirtualizedList | 전체 목록 가상화 (대량 메시지 성능) |

**핵심 로직**:
```typescript
// 메시지 체인 구성
1. JSONL 전체 파싱 → 레코드 배열
2. parentUuid로 연결 리스트 구성
3. root (parentUuid === null) 에서 시작하여 체인 순회
4. isSidechain === true인 레코드는 분기 표시
5. assistant content 내 블록을 타입별 분리:
   - text → AssistantMessage
   - thinking → ThinkingBlock (접힌 상태)
   - tool_use → ToolCallInline
   - tool_result → ToolCallInline의 결과 (접힌 상태)
```

**성능 요구사항**: 1000+ 메시지 세션에서 초기 렌더 1초 이내 (가상화 필수)

---

### F4. 도구 호출 추적

**목적**: Claude Code가 사용하는 도구의 패턴과 빈도를 분석

**입력 데이터**:
| 데이터 | 소스 |
|--------|------|
| 도구 호출 목록 | 모든 JSONL의 assistant content → tool_use 블록 |
| 파일 경로 | tool_use.input.file_path (Read, Write, Edit) |
| 명령어 | tool_use.input.command (Bash) |

**출력 UI 컴포넌트**:
| 컴포넌트 | 데이터 |
|----------|--------|
| StatCard x3 | Total Calls, Files Touched, Avg/Session |
| ProjectFilter | 프로젝트별 드롭다운 필터 |
| UsageOverTime | 일별 도구 사용 막대 차트 (14일) |
| ToolDistribution | 도구별 수평 바 차트 (13종) |
| CommonSequences | 연속 도구 쌍 패턴 바 차트 |
| MostEditedFiles | Write/Edit 대상 파일별 편집 횟수 리스트 |

**핵심 로직**:
```typescript
// Tool Distribution
1. 모든 JSONL에서 tool_use 블록 추출
2. tool_use.name 별 카운트 → 내림차순 정렬

// Common Sequences (도구 체인 패턴)
3. 동일 세션 내 연속된 두 tool_use의 name 쌍 추출
4. (prev_tool, curr_tool) 쌍별 카운트 → 내림차순 정렬
   예: ("Bash", "Bash") = 48, ("Write", "Write") = 34

// Most Edited Files
5. name이 'Write' 또는 'Edit'인 tool_use에서 input.file_path 추출
6. file_path별 카운트 → 내림차순 정렬

// Files Touched
7. input에 file_path가 있는 모든 tool_use에서 고유 file_path 수
```

---

### F11. 태스크 보드

**목적**: Claude Code 내부 태스크를 칸반 보드로 시각화

**입력 데이터**:
| 데이터 | 소스 | 설명 |
|--------|------|------|
| 활성 태스크 | `~/.claude/todos/{sessionId}-*.json` | 현재 세션의 태스크 (세션 종료 시 `[]`로 초기화됨) |
| **태스크 이력 (핵심)** | **JSONL tool_use: TaskCreate** | subject, description, activeForm — **모든 세션의 태스크 영구 이력** |
| **상태 변경 (핵심)** | **JSONL tool_use: TaskUpdate** | taskId, status — **todos/가 비어도 이력 재구성 가능** |

> **중요**: todos/ 파일은 세션 종료 시 빈 배열로 초기화되므로, JSONL의 TaskCreate/TaskUpdate가 **실질적인 주요 데이터 소스**이다. todos/는 활성 세션의 현재 상태 조회에만 사용.

**출력 UI 컴포넌트**:
| 컴포넌트 | 데이터 |
|----------|--------|
| KanbanBoard | 3개 레인 (Pending / In Progress / Completed) |
| TaskCard | 제목(subject) + 설명(description) + 상태뱃지 + 세션명 + 생성시간 |
| TaskDetail (펼침) | 상태 변경 이력 타임라인 + 소속 세션 링크 |
| SessionFilter | 세션별 필터 드롭다운 |
| TaskStats | 총 태스크 수, 완료율, 평균 소요시간 |

**핵심 로직**:
```typescript
// 태스크 목록 재구성 (JSONL 기반)
1. 모든 JSONL에서 TaskCreate tool_use 추출 → 태스크 생성 이벤트 목록
2. TaskUpdate tool_use 추출 → 상태 변경 이벤트 목록
3. TaskCreate의 순서(JSONL 내 위치)로 taskId 매핑 (1-based)
4. 각 태스크의 현재 상태 = 해당 taskId의 마지막 TaskUpdate.status

// 칸반 보드 레인 배치
5. status별 그룹핑: pending → 첫 번째 레인, in_progress → 두 번째, completed → 세 번째
6. deleted 태스크는 기본 숨김 (필터로 표시 가능)

// 실시간 갱신
7. 활성 세션의 JSONL 감시 → 새 TaskCreate/TaskUpdate 감지 시 보드 갱신
```

**원칙**: 읽기 전용 — 앱에서 태스크를 직접 생성/수정하지 않음

---

## Phase 2 기능

### F5. 세션 리플레이

**목적**: 과거 세션을 타임라인으로 재구성하여 시간순으로 리플레이

**입력 데이터**:
| 데이터 | 소스 |
|--------|------|
| 전체 레코드 | `{sessionId}.jsonl` 전체 파싱 |
| 파일 변경 이력 | `file-history/{sessionId}/{hash}@v{n}` |

**출력 UI 컴포넌트**:
| 컴포넌트 | 데이터 |
|----------|--------|
| ReplayMeta | 세션 메타 — 프로젝트명, 시작시간, 메시지수, 도구수 |
| TimelineBar | 수평 스크러버 (0~100% 재생 위치) + PlayheadTriangle |
| PlaybackControls | 재생/일시정지, 속도(0.5x/1x/2x/4x), 스텝 앞/뒤, 처음/끝 |
| EventTimeline | 수직 타임라인 — UserMessage, AssistantMessage, ToolCallRow, ThinkingBlock |
| FileChangePanel | 변경된 파일 목록 + 펄스 하이라이트 애니메이션 |
| ReplaySearch | 이벤트 내 텍스트 검색 |

**핵심 로직**:
```typescript
// 타임라인 구성
1. JSONL 전체 파싱 → timestamp 순 정렬
2. 각 레코드를 TimelineEvent로 변환:
   - user → UserEvent
   - assistant (text) → TextEvent
   - assistant (thinking) → ThinkingEvent
   - assistant (tool_use) → ToolCallEvent
   - assistant (tool_result) → ToolResultEvent
   - file-history-snapshot → FileChangeEvent
   - system (turn_duration) → TurnEndEvent
3. 전체 이벤트의 시간 범위 계산 (첫 timestamp ~ 마지막 timestamp)

// 재생 제어
4. playheadFraction (0.0~1.0) → 현재 재생 위치
5. isPlaying 상태에 따라 playheadFraction 자동 증가 (speed에 따른 속도)
6. 스텝 이동: 이전/다음 이벤트로 playheadFraction 점프
7. 스크러버 드래그: playheadFraction 직접 설정

// 파일 하이라이트
8. FileChangeEvent 도달 시 해당 파일명에 펄스 CSS 애니메이션 (500ms)
```

---

### F6. 파일 변경 추적

**목적**: 세션별 파일 변경 목록과 diff 표시

**입력 데이터**:
| 데이터 | 소스 |
|--------|------|
| 변경 파일 목록 | JSONL의 Write/Edit tool_use → file_path |
| 파일 버전 | `file-history/{sessionId}/{hash}@v{n}` |

**출력 UI 컴포넌트**:
| 컴포넌트 | 데이터 |
|----------|--------|
| StatCard x2 | Sessions (파일 변경 있는), Files Changed |
| DiffSessionCard | 세션 제목 + 파일수 + 편집수 + Replay 버튼 |
| FileDiffView | side-by-side diff (v1 vs v2) |

**핵심 로직**:
```typescript
// file-history 버전 비교
1. file-history/{sessionId}/ 디렉토리 스캔
2. {hash}@v1, {hash}@v2 등 버전 파일 읽기
3. 동일 hash의 v1과 v2를 비교하여 diff 생성
4. 줄 단위 diff 알고리즘 적용 (추가/삭제/수정 표시)
```

---

### F7. 서브에이전트 추적

**목적**: 서브에이전트 세션을 부모 세션과 함께 트리 시각화

**입력 데이터**: `{sessionId}/subagents/agent-{id}.jsonl`

**출력**: 부모 세션 타임라인에 서브에이전트 노드 인라인 표시 + 클릭 시 서브에이전트 타임라인 펼침

---

### F12. 문서 인벤토리 & diff

**목적**: Claude Code가 관리하는 문서들의 현재 상태와 변경 이력 추적

**입력 데이터**:
| 데이터 | 소스 |
|--------|------|
| 문서 목록 | 파일 시스템 스캔 — CLAUDE.md, MEMORY.md, .claude/rules/, .claude/skills/, .claude/agents/, docs/ |
| 변경 이력 | file-history/{sessionId}/ + JSONL Write/Edit tool_use |
| 파일 메타 | fs.stat — 크기, 수정일, 라인 수 |

**출력 UI 컴포넌트**:
| 컴포넌트 | 데이터 |
|----------|--------|
| DocInventoryList | 문서 목록 — 이름, 경로, 크기, 라인수, 최종수정일, 변경빈도 |
| DocChangeTimeline | 세션별 문서 변경 시간순 타임라인 |
| DocDiffView | 선택한 문서의 이전/이후 side-by-side diff |
| DocHealthBadge | 문서 건강 상태 뱃지 (Lint 결과 연동) |

---

### F13. 비용 실시간 추적

**목적**: API 사용 비용을 실시간으로 추정하고 추이를 분석

**입력 데이터**:
| 데이터 | 소스 |
|--------|------|
| 토큰 사용량 | JSONL assistant.message.usage |
| 가격표 | readout-pricing.json 또는 자체 관리 |
| 비용 캐시 | readout-cost-cache.json 또는 자체 캐시 |

**출력 UI 컴포넌트**:
| 컴포넌트 | 데이터 |
|----------|--------|
| CostCard x4 | Today, This Week, This Month, All Time |
| CostByModel | 모델별 비용 수평 바 |
| MonthlyProjection | 월 예상 + 현재 소진 |
| DailyCostChart | 일별 비용 막대 차트 |
| BudgetAlert | 예산 대비 N% 도달 시 경고 |

**비용 계산** (검증 완료):
```
cost = (input × $5.00/1M) + (output × $25.00/1M)
     + (cacheRead × $0.50/1M) + (cacheWrite × $6.25/1M)
// opus-4-6 기준. 모델별 단가는 pricing 파일 참조
```

---

## Phase 3 기능

### F8. 세션 통계

**목적**: 전체 세션 사용 패턴 분석 대시보드

**출력**: When You Work 히트맵, Daily Activity 차트, Model Usage 바, By Project 테이블, 총 세션/메시지/토큰 StatCard

---

### F9. 검색 기능

**목적**: 모든 세션의 대화 내용을 전문 검색

**입력**: 검색어 (최소 2자) + 기간 필터 (Today/This Week/This Month/All Time)
**출력**: 세션별 매치 결과 리스트 (검색어 하이라이트)
**로직**: 모든 JSONL의 user/assistant text content에서 검색어 매칭 (대소문자 무시, 디바운스 300ms)

---

### F10. 세션 비교

**목적**: 두 세션의 메시지/도구 호출 패턴을 side-by-side diff로 비교

**입력**: 두 세션 선택
**출력**: 병렬 타임라인, 도구 사용 비교 차트, 비용 비교

---

### F14. 태스크 워크플로우

**목적**: Claude Code의 단순 상태를 사용자 정의 워크플로우로 확장

**입력 데이터**:
| 데이터 | 소스 |
|--------|------|
| 워크플로우 정의 | `~/.zm-agent-manager/workflows/{name}.json` |
| 태스크 메타 | `~/.zm-agent-manager/task-metadata/{sessionId}/{taskId}.json` |
| Claude Code 상태 | JSONL TaskUpdate → status |

**워크플로우 정의 스키마**:
```json
{
  "name": "개발 워크플로우",
  "stages": [
    { "id": "requirements", "label": "요구사항 수집", "color": "#4a90d9" },
    { "id": "design", "label": "설계", "color": "#34c759" },
    { "id": "implement", "label": "구현", "color": "#ffd60a" },
    { "id": "test", "label": "테스트", "color": "#ff9f0a" },
    { "id": "review", "label": "리뷰", "color": "#bf5af2" },
    { "id": "done", "label": "완료", "color": "#34c759" }
  ]
}
```

**태스크 메타데이터 스키마** (앱이 관리):
```json
{
  "taskId": "1",
  "sessionId": "20b85cb8-...",
  "workflowStage": "implement",
  "severity": "important",
  "intent": "change",
  "resolution": null,
  "dismissReason": null,
  "comments": [
    { "author": "user", "text": "테스트 먼저 작성해줘", "timestamp": 1775618540491 }
  ]
}
```

**상태 흐름**:
```
Claude Code: pending → in_progress → completed
                                            ↓
zm-agent-manager (매핑):
  pending → acknowledged → in_progress → [사용자 단계들] → resolved (+ summary)
                                                        → failed (+ reason)
                                                        → dismissed (+ reason)
```

**심각도**: blocking(빨강) / important(주황) / suggestion(회색)
**유형**: fix / change / question / approve

---

### F15. 문서 중요도 분류 & 알림

**목적**: 문서 변경을 중요도별로 분류하여 사용자에게 알림

**중요도 규칙** (`~/.zm-agent-manager/doc-importance/rules.json`):
```json
{
  "rules": [
    { "pattern": "docs/requirements/**", "severity": "blocking" },
    { "pattern": "PRD*.md", "severity": "blocking" },
    { "pattern": "docs/policies/**", "severity": "important" },
    { "pattern": "CLAUDE.md", "severity": "important" },
    { "pattern": ".claude/rules/**", "severity": "important" },
    { "pattern": "docs/roadmap/**", "severity": "important" },
    { "pattern": "MEMORY.md", "severity": "important" },
    { "pattern": "**", "severity": "suggestion" }
  ]
}
```

**문서 리뷰 스키마** (`~/.zm-agent-manager/doc-reviews/`):
```json
{
  "changeId": "uuid",
  "filePath": "docs/requirements/PRD-v2.md",
  "sessionId": "20b85cb8-...",
  "severity": "blocking",
  "status": "pending",
  "detectedAt": 1775618540491,
  "resolvedAt": null,
  "action": null,
  "comment": null
}
```

**리뷰 상태 흐름**:
```
pending → acknowledged → approved (승인)
                       → rejected (반려 + 사유)
                       → commented (코멘트)
```

---

### F16. 알림 시스템

**목적**: 중요 이벤트 발생 시 데스크톱 네이티브 알림

**알림 트리거**:
| 이벤트 | 감지 방법 | 기본 |
|--------|----------|------|
| 세션 시작 | sessions/{pid}.json 생성 | ON |
| 세션 종료 | pid 프로세스 미존재 | ON |
| 태스크 완료 | JSONL TaskUpdate status=completed | ON |
| 비용 임계치 | 계산된 비용 ≥ 예산 × alertPercent | ON |
| 문서 변경 (blocking) | file-history 감시 + 중요도 규칙 | ON |
| 문서 변경 (important) | file-history 감시 + 중요도 규칙 | OFF |
| 에이전트 stuck | 마지막 레코드 후 N분 경과 | OFF |

**알림 구현**: `Electron Notification API` (네이티브 OS 알림)

**알림 이력**: `~/.zm-agent-manager/notifications/{date}.json`에 저장

---

## 공통 UI 컴포넌트

### StatCard
```
Props: { value: number | string, label: string, color: ColorToken }
```
- 숫자(28pt bold) + 색상점(8px) + 라벨(12pt gray)
- 배경: bg-card, radius: 12pt, 균등 분배(flex:1)

### Badge
```
Props: { text: string, variant: 'blue'|'green'|'orange'|'red'|'gray' }
```
- 배경: accent 15% opacity, 텍스트: accent 100%
- padding: 2pt 8pt, radius: 4pt, font: 11pt

### HorizontalBarChart
```
Props: { items: Array<{label, value, color}> }
```
- 라벨 고정폭 120pt + 바(비율) + 값 우측

### SectionHeader
```
Props: { icon: string, title: string, count?: number }
```

### CardListItem
```
Props: { title, subtitle, badges[], rightContent, onClick }
```
- hover: bg-card-hover, padding: 12pt, radius: 8pt

### EmptyState
```
Props: { icon, title, description }
```

### SkeletonLoader
- 데이터 로딩 중 회색 블록, shimmer 애니메이션

---

## 디자인 토큰 (Readout 참고)

### 배경
| 토큰 | 값 | 용도 |
|------|-----|------|
| bg-window | #000000 | 윈도우, 사이드바 |
| bg-content | #1c1c1e | 메인 콘텐츠 |
| bg-card | #242425 | 카드, StatCard |
| bg-card-hover | #3a3a3c | 호버 |

### 텍스트
| 토큰 | 값 | 용도 |
|------|-----|------|
| text-primary | #ffffff | 제목, 숫자 |
| text-secondary | #a3a3a3 | 라벨, 보조 |
| text-tertiary | #6e6e73 | 비활성 |

### 강조
| 토큰 | 값 | 용도 |
|------|-----|------|
| accent-blue | #4a90d9 | 정보, 선택 |
| accent-green | #34c759 | 활성, 정상 |
| accent-yellow | #ffd60a | 비용, 경고 |
| accent-orange | #ff9f0a | 주의, dirty |
| accent-red | #ff453a | 오류, blocking |

---

## F17. 스킬 모니터

> Phase 3+ 기능. 상세 사양은 [`PRD-v2.md`](./PRD-v2.md) Section 4 참조.
> 프로젝트/글로벌/플러그인 스킬 목록 표시. YAML frontmatter 파싱하여 name, description, tools, model 표시.

## F18. 에이전트 모니터

> Phase 3+ 기능. 상세 사양은 [`PRD-v2.md`](./PRD-v2.md) Section 4 참조.
> 프로젝트/글로벌 에이전트 목록 표시. YAML 파싱하여 name, description, tools, model 표시. 서브에이전트 사용 이력 연동.

## F19. 메모리 뷰어

> Phase 3+ 기능. 상세 사양은 [`PRD-v2.md`](./PRD-v2.md) Section 4 참조.
> 프로젝트별 MEMORY.md 내용 표시 + 검색. 라인 수 경고(200줄 초과 시).

## F20. 훅/규칙/MCP 모니터

> Phase 3+ 기능. 상세 사양은 [`PRD-v2.md`](./PRD-v2.md) Section 4 참조.
> Hooks: 이벤트별 그룹 + 실행 상태. Rules: 경로별 규칙 목록 + 내용 미리보기. MCP: 서버 목록 + 연결 상태. Permissions: allow/deny 목록.
