# Readout 앱 클론 구현 명세서

> 분석 일자: 2026-04-08
> 대상: Readout v0.0.11 (macOS, com.benjitaylor.Readout)
> 분석 방법: 바이너리 strings 추출 + Python 자동화 캡처(pyobjc + pyautogui) + 웹 리서치 + 데이터 소스 매핑
> 목적: zm-agent-manager에서 Readout을 카피 구현하기 위한 상세 명세

---

## 1. 앱 개요

| 항목 | 내용 |
|------|------|
| 개발자 | Benji Taylor (Coinbase Base Design Head) |
| 플랫폼 | macOS 전용 (Swift/SwiftUI, Tahoe 26.0+) |
| 버전 | 0.0.11 (베타, 빌드 57) |
| 번들 ID | com.benjitaylor.Readout |
| 바이너리 크기 | 24.6 MB (arm64) |
| 업데이트 | Sparkle 프레임워크 (readout-updates.vercel.app) |
| 가격 | 무료, 계정 불필요, 완전 로컬 |
| 태그라인 | "Your dev environment, at a glance. One dashboard instead of six terminal tabs." |

---

## 2. 데이터 소스 매핑

### 2.1 `~/.claude/` 디렉토리 구조 및 Readout 화면 매핑

```
~/.claude/
├── history.jsonl                    → Sessions, Dashboard (Recent Sessions)
├── stats-cache.json                 → Sessions (통계), Costs (일부)
├── readout-pricing.json             → Costs (Readout이 생성한 가격표)
├── readout-cost-cache.json          → Costs (Readout이 생성한 비용 캐시)
├── sessions/{pid}.json              → Live (활성 세션 감지)
├── projects/
│   └── {encoded-path}/
│       ├── {sessionId}.jsonl        → Sessions, Tools, Diffs, Replay, Transcripts
│       ├── {sessionId}/
│       │   └── subagents/
│       │       └── agent-{id}.jsonl → Sessions (서브에이전트 활동)
│       ├── memory/
│       │   └── MEMORY.md            → Memory 화면
│       └── settings.json            → Config (프로젝트 설정)
├── file-history/
│   └── {sessionId}/
│       └── {hash}@v{n}             → Diffs, Snapshots (파일 변경 이력)
├── settings.json                    → Settings
├── todos/{sessionId}-*.json         → (Tasks 추적)
├── shell-snapshots/                 → (셸 상태 스냅샷)
├── paste-cache/                     → (붙여넣기 캐시)
├── plugins/                         → Skills (플러그인 스킬)
└── tasks/                           → Live (태스크 상태)
```

### 2.2 프로젝트 `.claude/` 디렉토리 (Readout이 스캔)

```
{project}/.claude/
├── settings.json                    → Settings (프로젝트 권한/훅)
├── skills/{name}/SKILL.md           → Skills 화면
├── agents/{name}.md                 → Agents 화면
├── hooks/{name}.sh                  → Hooks 화면
└── rules/{name}.md                  → (Config에서 참고)
```

### 2.3 Git 데이터 (Readout이 git CLI로 수집)

```
git status                           → Repos (dirty/clean), Repo Pulse
git log                              → Timeline, Work Graph (commits)
git branch                           → Timeline (branches), Repos
git diff                             → Diffs, Snapshots (변경 사항)
git worktree list                    → Worktrees 화면
```

### 2.4 시스템 데이터

```
lsof -i -P                          → Ports (열린 포트)
ps                                   → Ports (프로세스), Live (세션 PID)
.env 파일 스캔                        → Env 화면
CLAUDE.md 파싱                       → Lint 화면
package.json 파싱                    → Deps 화면
```

### 2.5 JSONL 레코드 구조

각 세션 파일(`{sessionId}.jsonl`)의 한 줄 = 하나의 JSON 레코드.

```typescript
// 공통 필드
interface BaseRecord {
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  type: 'user' | 'assistant' | 'file-history-snapshot' | 'attachment' | 'permission-mode';
  timestamp: number;       // Unix ms
  cwd: string;
  version: number;
  gitBranch: string;
  agentId: string | null;
  slug: string;            // 모델 slug (예: "claude-opus-4-6")
}

// user 레코드
interface UserRecord extends BaseRecord {
  type: 'user';
  message: {
    role: 'user';
    content: string | ContentBlock[];
  };
  isSidechain: boolean;
  userType: 'external' | 'internal';
}

// assistant 레코드
interface AssistantRecord extends BaseRecord {
  type: 'assistant';
  message: {
    role: 'assistant';
    content: ContentBlock[];   // text, tool_use, tool_result 블록
    model: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens: number;
      cache_creation_input_tokens: number;
    };
  };
}

// tool_use 블록 구조
interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;            // Bash, Read, Write, Edit, Glob, Grep, Agent, ...
  input: Record<string, unknown>;
}

// tool_result 블록 구조
interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
}
```

### 2.6 history.jsonl 레코드 구조

```typescript
interface HistoryRecord {
  display: string;           // 사용자 메시지 요약 (UI 표시용)
  pastedContents: Record<string, PastedContent>;
  timestamp: number;         // Unix ms
  project: string;           // 절대 경로
  sessionId: string;
}
```

### 2.7 stats-cache.json 구조

```typescript
interface StatsCache {
  version: number;
  lastComputedDate: string;  // "YYYY-MM-DD"
  dailyActivity: Array<{
    date: string;
    messageCount: number;
    sessionCount: number;
    toolCallCount: number;
  }>;
  dailyModelTokens: Array<{
    date: string;
    tokensByModel: Record<string, number>;
  }>;
  modelUsage: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    costUSD: number;
  }>;
}
```

### 2.8 readout-pricing.json (Readout이 생성)

```typescript
interface PricingData {
  updated: string;           // "YYYY-MM-DD"
  source: string;            // Anthropic pricing URL
  models: Record<string, {
    input: number;           // $/1M tokens
    output: number;
    cacheRead: number;
    cacheWrite: number;
  }>;
}
```

### 2.9 sessions/{pid}.json (활성 세션 감지)

```typescript
interface ActiveSession {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;         // Unix ms
  kind: 'interactive' | 'task';
  entrypoint: 'cli' | 'desktop';
}
```

---

## 3. 전체 레이아웃 구조

### 3.1 윈도우 레이아웃

```
┌──────────────────────────────────────────────────────────────┐
│ ● ● ●  (트래픽 라이트)                                        │
├──────────────┬───────────────────────────────────────────────┤
│              │                                               │
│   SIDEBAR    │              CONTENT AREA                     │
│   (230pt)    │              (나머지 전체)                      │
│              │                                               │
│  섹션 헤더    │  ┌─ 페이지 제목 (24pt bold) ─────────────────┐ │
│  ─────────   │  │                                           │ │
│  ● 메뉴 항목  │  │  ┌─ StatCards (3~4개, 수평 배열) ────────┐ │ │
│  ● 메뉴 항목  │  │  │  [N ● label]  [N ● label]  [N ● la] │ │ │
│  ● 메뉴 항목  │  │  └────────────────────────────────────────┘ │ │
│              │  │                                           │ │
│  섹션 헤더    │  │  ┌─ 섹션 (아이콘 + 제목 + 카운트) ────────┐ │ │
│  ─────────   │  │  │                                       │ │ │
│  ● 메뉴 항목  │  │  │  [컨텐츠 카드/리스트/차트]              │ │ │
│  ● 메뉴 항목  │  │  │                                       │ │ │
│              │  │  └────────────────────────────────────────┘ │ │
│              │  │                                           │ │
│  ─────────   │  │  ┌─ 섹션 2 ──────────────────────────────┐ │ │
│  ● Settings  │  │  │  [추가 컨텐츠]                         │ │ │
│              │  │  └────────────────────────────────────────┘ │ │
├──────────────┴───────────────────────────────────────────────┤
└──────────────────────────────────────────────────────────────┘
```

### 3.2 치수 (포인트 단위, Retina 2x 기준)

| 요소 | 크기 |
|------|------|
| 윈도우 기본 크기 | 756 × 949 pt |
| 사이드바 폭 | ~230 pt (고정) |
| 콘텐츠 영역 | ~526 pt (윈도우 - 사이드바) |
| 사이드바 섹션 헤더 | 높이 ~20pt, 글자 12pt, 회색 대문자 |
| 사이드바 메뉴 항목 | 높이 ~28pt, 글자 14pt |
| 사이드바 선택 배경 | 둥근 사각형, radius ~8pt |
| 콘텐츠 패딩 | 상하좌우 ~20pt |
| 페이지 제목 | 24pt bold, 흰색 |
| StatCard | ~150×65pt, radius ~12pt |
| StatCard 숫자 | 28pt bold |
| StatCard 라벨 | 12pt, 회색 |
| 섹션 제목 | 14pt semibold + 아이콘 |
| 카드 간격 | ~12pt |

---

## 4. 디자인 토큰 (색상 시스템)

### 4.1 배경색

| 토큰 | 색상 | 용도 |
|------|------|------|
| `bg-window` | `#000000` | 윈도우 최외곽, 사이드바 배경 |
| `bg-content` | `#1c1c1e` | 메인 콘텐츠 배경 |
| `bg-card` | `#242425` ~ `#2c2c2e` | StatCard, 리스트 카드 배경 |
| `bg-card-hover` | `#3a3a3c` | 카드 호버 상태 |
| `bg-sidebar-selected` | `#3a3a3c` 반투명 | 선택된 사이드바 항목 |
| `bg-divider` | `#38383a` | 구분선 |

### 4.2 텍스트 색상

| 토큰 | 색상 | 용도 |
|------|------|------|
| `text-primary` | `#ffffff` | 제목, 숫자, 주요 텍스트 |
| `text-secondary` | `#a3a3a3` | 라벨, 보조 텍스트, 시간 |
| `text-tertiary` | `#6e6e73` | 비활성, 플레이스홀더 |
| `text-section-header` | `#8e8e93` | 사이드바 섹션 헤더 (소문자) |

### 4.3 강조/상태 색상

| 토큰 | 색상 | 용도 |
|------|------|------|
| `accent-blue` | `#4a90d9` | 통계 점, 선택 상태, 링크 |
| `accent-green` | `#34c759` | 활성 뱃지, 정상 상태, 초록 점 |
| `accent-yellow` | `#ffd60a` | 비용, 경고, 노란 점 |
| `accent-orange` | `#ff9f0a` | 주의, dirty 상태, 이슈 |
| `accent-red` | `#ff453a` | 오류, uncommitted, 빨간 점 |
| `accent-purple` | `#bf5af2` | 에이전트 아이콘 |

### 4.4 차트 색상

| 토큰 | 색상 | 용도 |
|------|------|------|
| `chart-bar-primary` | `#4a90d9` | Usage Over Time, Daily Cost |
| `chart-bar-secondary` | `#34c759` | Daily Activity |
| `chart-tool-bash` | `#4a90d9` | Bash 바 |
| `chart-tool-read` | `#34c759` | Read 바 |
| `chart-tool-write` | `#ffd60a` | Write 바 |
| `chart-tool-edit` | `#ff9f0a` | Edit 바 |
| `chart-tool-other` | `#8e8e93` | 기타 도구 바 |

### 4.5 뱃지 색상

| 뱃지 유형 | 배경 | 텍스트 |
|-----------|------|--------|
| "active" | `#34c759` 반투명 | `#34c759` |
| "N dirty" | `#ff9f0a` 반투명 | `#ff9f0a` |
| "N files" | `#4a90d9` 반투명 | `#4a90d9` |
| "N skills" | `#4a90d9` 반투명 | `#4a90d9` |
| "N issues" | `#ff9f0a` 반투명 | `#ff9f0a` |
| "Claude Code" | `#4a90d9` 반투명 | `#4a90d9` |
| 프로젝트명 | `#34c759` 반투명 | `#34c759` |

---

## 5. 사이드바 구조 상세

### 5.1 섹션 목록 (6개 섹션, 23개 항목 + Settings)

```
Overview        (섹션 헤더 없음, 최상단)
  🏠 Readout        Dashboard — 메인 대시보드
  🤖 Assistant      AI Chat — API 키 필요

Monitor         (섹션 헤더: "Monitor")
  📡 Live           실시간 세션 모니터
  📊 Sessions       세션 히스토리 통계
  📄 Transcripts    세션 트랜스크립트 검색
  🔧 Tools          도구 사용 분석
  💰 Costs          비용 추적
  ⚙️ Setup          초기 설정/연결 상태
  🔌 Ports          로컬 포트 모니터

Workspace       (섹션 헤더: "Workspace")
  📁 Repos          등록 레포 관리
  📊 Work Graph     크로스 레포 작업 그래프
  💓 Repo Pulse     레포 건강 상태
  📅 Timeline       Git 커밋 타임라인
  📝 Diffs          세션별 파일 변경
  📸 Snapshots      워크스페이스 스냅샷

Config          (섹션 헤더: "Config")
  ⚡ Skills          커스텀 스킬 관리
  👥 Agents         커스텀 에이전트 관리
  🧠 Memory         MEMORY.md 뷰어
  🔗 Hooks          훅 디버거

Health          (섹션 헤더: "Health")
  🩺 Hygiene        프로젝트 건강 검사
  📦 Deps           의존성 건강
  🌳 Worktrees      Git worktree 관리
  🔑 Env            .env 파일 보안 감사
  📋 Lint           CLAUDE.md 린터

⚙️ Settings       앱 설정 (섹션 헤더 없음, 최하단)
```

### 5.2 사이드바 아이콘

각 항목에 SF Symbols 아이콘 사용 (Electron에서는 유사 아이콘으로 대체).

---

## 6. 화면별 구현 명세

### 6.1 Dashboard (Readout)

**데이터 소스**: `history.jsonl`, `stats-cache.json`, `sessions/*.json`, git status, `.claude/skills/`, `.claude/agents/`, `memory/MEMORY.md`

**레이아웃 (위→아래)**:
```
[인사 헤더] ─────────────────────────────────────────
  "Hey, {username}"  (24pt bold)
  "You have N repos set up, N with skills and N with agents.
   {repo} has the richest config."  (14pt, secondary)
  "You've landed N commit today."  (14pt, secondary)

[StatCards 4개] ──────────────────────────────────────
  | N Repos | N Commits Today | N Sessions | $N.NN Est. Cost |
  (각 카드: 숫자 28pt bold + 색상 점 + 라벨 12pt)
  (색상: 파랑, 초록, 파랑, 노랑)

[2-Column Grid] ─────────────────────────────────────
  좌: Activity (30일 막대차트)    우: When You Work (히트맵)

[2-Column Grid] ─────────────────────────────────────
  좌: Cost by Model (수평바)     우: Recent Sessions (리스트)

[경고 배너들] ───────────────────────────────────────
  ⚠️ "N hygiene issue needs attention"
  ⚠️ "{repo} has N uncommitted files"
  💡 "Add CLAUDE.md to N projects"  [Better results] 버튼

[Recently Active] ──────────────────────────────────
  "{repo}" ✏️
  [Skills | Agents | Memory | Repos] 4개 미니 카드
```

**데이터 수집 로직**:
- Repos 수: 등록된 스캔 디렉토리에서 git repo 카운트
- Commits Today: `git log --after="today" --oneline | wc -l`
- Sessions: `history.jsonl` 에서 오늘 날짜 세션 수
- Est. Cost: `readout-cost-cache.json` + `readout-pricing.json` 계산
- Activity: `stats-cache.json.dailyActivity`
- When You Work: `history.jsonl` timestamp를 요일×시간 매핑
- Recent Sessions: `history.jsonl` 최근 N개
- Skills/Agents: `.claude/skills/`, `.claude/agents/` 디렉토리 스캔

---

### 6.2 Assistant

**데이터 소스**: Settings의 API 키, 모든 화면의 데이터 (임베드)

**레이아웃**:
```
[헤더] "Assistant" + [Sonnet ▼] 모델 드롭다운 (우측)

[빈 상태 / 채팅]
  빈 상태: 로봇 일러스트 + "Add an API key to start chatting"
           + "Anthropic, OpenAI, or Google — your pick."
           + [🔑 Add API Key] 버튼

  채팅: ChatBubble 리스트 + 16종 임베드 위젯
  임베드 종류: Agents, CostBreakdown, Costs, Deps, Env,
              Hygiene, Live, MCP, Memory, Ports, RepoDetail,
              Repos, Sessions, Skills, Snapshots, Timeline, Worktrees
```

---

### 6.3 Live

**데이터 소스**: `~/.claude/sessions/*.json` (pid 기반 프로세스 감지), 프로세스 메모리 (ps)

**레이아웃**:
```
[제목] "Live"

[StatCards 3개]
  | N Sessions (파랑) | N Generating (초록) | N Memory MB (회색) |

[세션 카드 리스트] (활성 세션당 1개)
  ┌─────────────────────────────────────────────────────────┐
  │ ● ⟳  {project-name}                          [active]  │
  │   📁 {folder}  ⏱ H:MM:SS  💾 N MB                      │
  └─────────────────────────────────────────────────────────┘
  (왼쪽: 상태 점(녹색 깜빡임) + 스피너)
  (우측: "active" 뱃지 녹색)
  (하단: 폴더 경로 + 경과 시간 + 메모리)
```

**데이터 수집 로직**:
- `~/.claude/sessions/*.json` 스캔 → pid 추출
- `ps -p {pid}` 로 프로세스 존재 확인
- 메모리: `ps -o rss= -p {pid}` (RSS → MB 변환)
- 경과 시간: `startedAt` 부터 현재까지 차이
- Generating: assistant 레코드가 스트리밍 중인지 (마지막 레코드 타입 확인)

---

### 6.4 Sessions

**데이터 소스**: `history.jsonl`, `stats-cache.json`, 세션 JSONL 파일들

**레이아웃**:
```
[제목] "Sessions"
[요약] "N session, N messages total. Primary model: {model}. Active across N projects."

[When You Work] ─ 히트맵 (7×24 그리드, 요일×시간)
  Mon Tue Wed Thu Fri Sat Sun
  [각 셀: 활동량에 따른 색상 강도]

[StatCards 3개]
  | N Sessions (파랑) | N Messages (초록) | NK Tokens (파랑) |

[Daily Activity] ─ 막대 차트 (최근 30일)
  (X축: 날짜, Y축: 메시지 수, 바 색상: 초록)

[Model Usage] ─ 수평 바 차트
  {model-name}  ▓▓▓▓▓▓▓▓▓░  NK
  (바 색상: 파랑, 우측: 토큰 수)

[By Project] ─ 테이블
  | {project-name} | N (세션수) | {time} (최근) |

[Recent Sessions] ─ 세션 리스트
  ┌──────────────────────────────────────────────┐
  │ {세션 제목/첫 메시지 요약}                      │
  │ 📁 {project}  ⏱ {time ago}                   │
  └──────────────────────────────────────────────┘
```

**데이터 수집 로직**:
- Sessions 수: `history.jsonl` 고유 sessionId 카운트
- Messages: 모든 JSONL의 user+assistant 레코드 수 합산
- Tokens: 모든 assistant 레코드의 `message.usage` 합산
- When You Work: `history.jsonl` timestamp → 요일/시간 분류
- Daily Activity: `stats-cache.json.dailyActivity`
- Model Usage: `stats-cache.json.modelUsage` 또는 `dailyModelTokens`
- By Project: `history.jsonl` project 필드별 그룹핑
- Recent Sessions: `history.jsonl` 최신 N개, display 필드 표시

---

### 6.5 Transcripts

**데이터 소스**: 모든 세션 JSONL 파일 (전문 검색)

**레이아웃**:
```
[제목] "Transcripts"
[검색창] 🔍 "Search transcripts..."  (전체 너비 입력 필드)
[기간 필터] [Today] [This Week] [This Month] [All Time]  (탭 바, All Time 기본)
[빈 상태] "Search across all your session transcripts. Type at least 2 characters."
[검색 결과] 세션별 매치 리스트 (하이라이트)
```

**검색 로직**:
- 모든 JSONL에서 user/assistant 레코드의 message.content 텍스트 검색
- 기간 필터: timestamp 기준 필터링
- 최소 2자 입력 필요

---

### 6.6 Tools

**데이터 소스**: 모든 세션 JSONL (assistant 레코드의 tool_use 블록)

**레이아웃**:
```
[제목] "Tools"

[StatCards 3개]
  | N Total Calls | N Files Touched | N Avg/Session |

[프로젝트 필터] "All Projects ▼" 드롭다운

[Usage Over Time] ─ 막대차트 (14일)
  🔥 "Busiest: {date} with N calls"

[Tool Distribution] ─ 수평 바 차트 (10개 도구)
  ⚡ "N tools" 카운트
  Bash       ▓▓▓▓▓▓▓▓▓▓▓▓▓  79
  Read       ▓▓▓▓▓▓▓▓       48
  Write      ▓▓▓▓▓▓▓        45
  Edit       ▓▓▓▓▓          32
  TaskUpdate ▓▓▓▓▓          31
  TaskCreate ▓▓▓            ...
  Agent      ▓▓
  WebSearch  ▓
  ToolSearch ▓
  ExitPlanMode ▓
  (각 바 색상: Bash=파랑, Read=초록, Write=노랑, Edit=주황, 나머지=회색)

[Common Sequences] ─ 도구 체인 패턴
  ⚡ "N patterns"
  Bash → Bash        ▓▓▓▓▓  48
  Write → Write      ▓▓▓    34
  Read → Read        ▓▓▓    34
  Edit → Edit        ▓▓     19
  Read → Edit        ▓▓     18
  TaskUpdate → TaskUpdate ▓  11
  TaskCreate → TaskCreate ▓  11
  Write → TaskUpdate ▓       9

[Most Edited Files] ─ 파일 리스트
  📄 "N total" 카운트
  CLAUDE.md          📁 {project}
  settings.json      📁 {project}/.claude
  SESSION_LOG.md     📁 {project}/docs/sessions
```

**데이터 수집 로직**:
- Total Calls: 모든 JSONL에서 type=tool_use 블록 카운트
- Files Touched: tool_use에서 file_path 인자가 있는 고유 파일 수
- Tool Distribution: tool_use.name별 카운트
- Common Sequences: 연속된 두 tool_use의 name 쌍 카운트
- Most Edited Files: Write/Edit tool_use의 file_path별 카운트

---

### 6.7 Costs

**데이터 소스**: `readout-pricing.json`, `readout-cost-cache.json`, 세션 JSONL (usage 필드)

**레이아웃**:
```
[제목] "Costs"
[요약] "Estimated total: $N.NN across N model. Daily average: $N.NN."

[비용 카드 4개]
  | $N.NN Today (파랑) | $N.NN This Week (초록) | $N.NN This Month (초록) | $N.NN All Time (노랑) |

[Cost by Model] ─ 수평 바
  ⚡ 아이콘
  {model-name}  ▓▓▓▓▓▓▓▓▓  $N.NN

[Monthly Projection] ─ 이중 통계    [Trends] ─ 비교 테이블
  Estimate $NNN                      | This Week  | $N.NN | ─  |
  Burn     $NN.NN                    | This Month | $N.NN | ─  |
  (📊 아이콘 + Tab: Trends)

[Daily Cost] ─ 막대차트 (최근 14일)
  (X축: 날짜, Y축: 비용, 바 색상: 파랑)

[가격 메타]
  "Prices updated {date}" + [🔄 Refresh Prices]
  ⓘ "Estimates based on published API pricing. Actual costs depend on your plan and billing."
```

**비용 계산 로직**:
```
cost = (input_tokens × pricing.input / 1M)
     + (output_tokens × pricing.output / 1M)
     + (cache_read_tokens × pricing.cacheRead / 1M)
     + (cache_write_tokens × pricing.cacheWrite / 1M)
```

---

### 6.8 Ports

**데이터 소스**: `lsof -i -P -n` 또는 유사 시스템 명령

**레이아웃**:
```
[제목] "Ports"
[요약] "N port open across N process."

[StatCards 3개]
  | N Ports (파랑) | N Processes (초록) | N Node (초록) |

[프로세스 카드 리스트]
  ┌──────────────────────────────────────────────────────┐
  │ 📦 {process-name}  PID {pid}                         │
  │   {full-command-path}                                │
  │   :{port}  {bind-address}                            │
  └──────────────────────────────────────────────────────┘
  (포트 번호: 파랑 bold)
```

---

### 6.9 Repos

**데이터 소스**: git status, git log, `.claude/skills/`, `.claude/agents/`

**레이아웃**:
```
[제목] "Repos"

[StatCards 4개]
  | N Active (초록) | N Dirty (주황) | N Unpushed (회색) | N Total (파랑) |

[Active 섹션] ─ "Active N" + 필터 아이콘
  ┌──────────────────────────────────────────────────────────┐
  │ {repo-name}   ⎇ main  [● N dirty] [N skills]  ~~~~~~~~ │
  │ {최근 커밋 메시지}  — {time ago}                    >     │
  └──────────────────────────────────────────────────────────┘
  (우측: 미니 activity 스파크라인 그래프 + 화살표)
```

---

### 6.10 Work Graph

**데이터 소스**: git log (모든 레포), GitHub API (PR)

**레이아웃**:
```
[제목] "Work Graph"
[필터] [All] [Mine] 탭

[StatCards 4개]
  | N Active | N Idle | N Dormant | N Commits |

[Commit Activity] ─ 30일 막대차트
[Commits by Repo] ─ 레포별 수평 바
[Pull Requests] ─ PR 리스트 (GitHub API)
[Uncommitted Work] ─ 레포별 미커밋 파일
[All Repos] ─ 전체 레포 리스트 + 최근 커밋
```

---

### 6.11 Repo Pulse

**데이터 소스**: git status (모든 레포)

**레이아웃**:
```
[제목] "Repo Pulse"
[요약] "N repos scanned. N needs attention (N uncommitted files)."

[StatCards 3개]
  | N Need Attention (주황) | N Clean (초록) | N Uncommitted (빨강) |

[Needs Attention 섹션] ⚠️ + ⓘ 도움말
  ┌──────────────────────────────────────────────────────────┐
  │ {repo-name}  [N files] 뱃지                        >    │
  │ {time ago}  {최근 커밋 메시지}                            │
  ├──────────────────────────────────────────────────────────┤
  │ (펼침 시)                                                │
  │   ? .claude/settings.local.json                         │
  │   [👁 Show Diff]                                         │
  └──────────────────────────────────────────────────────────┘
```

---

### 6.12 Timeline (Git Timeline)

**데이터 소스**: git log --all

**레이아웃**:
```
[제목] "Git Timeline"

[StatCards 3개]
  | N Repos (파랑) | N Branches (초록) | N Commits (파랑) |

[레포별 타임라인]
  ■ {repo-name}  [main] 뱃지  "N branch"

  │ ● {short-hash}                                {author}
  │   {commit message}                            {time ago}
  │
  │ ● {short-hash}
  │   {commit message}                            {time ago}
  │
  (수직 라인 + 원형 노드)
  (해시: 녹색 링크, 메시지: 흰색, 작성자/시간: 회색)
```

---

### 6.13 Diffs

**데이터 소스**: file-history/{sessionId}/, JSONL (tool_use: Write/Edit)

**레이아웃**:
```
[제목] "Diffs"
[요약] (숨김)

[StatCards 2개]
  | N Sessions (파랑) | N Files Changed (초록) |

[날짜별 그룹] ─ "Today"
  ┌────────────────────────────────────────────────────────┐
  │ {세션 제목/첫 메시지}                                     │
  │ [Claude Code] [📁 project]  N files  [N edits]  ⟳Replay│
  └────────────────────────────────────────────────────────┘
  (뱃지: Claude Code=파랑, project=초록, edits=노랑)
  (Replay 버튼: 세션 리플레이로 이동)
```

---

### 6.14 Snapshots

**데이터 소스**: git status, 자체 스냅샷 저장소

**레이아웃**:
```
[제목] "Snapshots"

[StatCards 3개]
  | N Repos (파랑) | N Snapshots (초록) | N Dirty (주황) |

[Current Branches] ─ "N"
  ┌──────────────────────────────────────────┐
  │ 📁 {repo-name}  [main] 뱃지  ● N       │
  └──────────────────────────────────────────┘

[📸 Save Snapshot] 버튼
```

---

### 6.15 Skills

**데이터 소스**: `.claude/skills/*/SKILL.md`, `~/.claude/skills/`, 플러그인 스킬

**레이아웃**:
```
[제목] "Skills"
[액션 바] [🔍 Browse skills.sh] [📁 Add from folder] [✨ New Skill]

[요약] "N project-specific across N repo."

[레포 그룹] ─ "{repo-name} N"
  ⚡ zm-analyze-jsonl     ---
  ⚡ zm-new-component     ---
  ⚡ zm-phase-status      ---
  ⚡ zm-session-end       ---
  ⚡ zm-session-start     ---
  ⚡ zm-validate-req      ---
  (각 항목: 번개 아이콘 + 스킬명 + description 한 줄)
  (클릭 시 상세 화면 또는 인라인 펼침)
```

---

### 6.16 Agents

**데이터 소스**: `.claude/agents/*.md`, `~/.claude/agents/`

**레이아웃**:
```
[제목] "Agents"
[액션 바] [🟢 New Agent]

[요약] "N agents across N repo."

[레포 그룹] ─ "{repo-name}"
  ┌──────────────────────────────────────────────────────┐
  │ 👤 zm-electron-expert                            >   │
  │   Electron 앱 아키텍처 전문가. 메인/렌더러/프리로드...     │
  ├──────────────────────────────────────────────────────┤
  │ 👤 zm-jsonl-analyst                              >   │
  │   Claude Code JSONL 세션 데이터 분석 전문가...           │
  ├──────────────────────────────────────────────────────┤
  │ 👤 zm-ui-reviewer                                >   │
  │   React + Tailwind UI 코드 리뷰 전문가...               │
  └──────────────────────────────────────────────────────┘
  (아이콘 색상: 빨강, 파랑, 노랑 등 에이전트별 구분)
```

---

### 6.17 Memory

**데이터 소스**: `~/.claude/projects/{path}/memory/MEMORY.md`

**레이아웃**:
```
[제목] "Memory"
[검색창] 🔍 "Search memories..."

[요약] "N lines of context across N project. {project} has the most detail (N lines)."

[프로젝트 카드] (접기/펼치기)
  ┌──────────────────────────────────────────────────────┐
  │ projects/{project-name}                              │
  │ [33 lines] zm-agent-manager Memory, Project Overview │
  ├──────────────────────────────────────────────────────┤
  │ (펼침 시 — 마크다운 렌더링)                              │
  │                                                      │
  │ ## zm-agent-manager Memory                           │
  │ ### Project Overview                                 │
  │ - Claude Code 세션 실시간 모니터링 및 리플레이 Electron 앱│
  │ - Tech stack: Electron + TypeScript + React 18 + ... │
  │ ### Docs Structure (7 categories)                    │
  │   docs/                                              │
  │   ├── requirements/                                  │
  │   ├── policies/                                      │
  │   ...                                                │
  └──────────────────────────────────────────────────────┘
```

---

### 6.18 Hooks

**데이터 소스**: `.claude/settings.json` (hooks 섹션), `.claude/hooks/*.sh`

(미캡처 — 바이너리 분석 기반 추정)

```
[제목] "Hooks"
[훅 리스트] — 이벤트별 그룹핑
  PreToolUse
    ├── Edit|Write → zm-block-claude-dir-write.sh  [상태]
    └── Bash → zm-block-dangerous-bash.sh          [상태]
  PostToolUse
    └── Edit|Write → zm-lint-on-save.sh            [상태]
  Stop
    └── (prompt 타입) 문서 갱신 판단                  [상태]
  (상태: ✅ 성공, ❌ 차단, ⏱ 실행시간)
```

---

### 6.19 Hygiene

**데이터 소스**: git status, `.env` 파일, CLAUDE.md, 종합 검사

**레이아웃**:
```
[제목] "Hygiene"

[원형 스코어] ─ 큰 원형 게이지
  (중앙: "N issues" 숫자)
  (우측: "● N Info" / "● N Warning" / "● N Error" 심각도 뱃지)

[제안 카드]
  ┌──────────────────────────────────────────────────────┐
  │ 💬 Set up Readout Assistant                      >   │
  │   Add an API key to auto-diagnose issues             │
  └──────────────────────────────────────────────────────┘

[이슈 섹션] ─ 접이식
  ◎ Uncommitted Changes N ⓘ                         ˅
  ┌──────────────────────────────────────────────────────┐
  │ N uncommitted file(s)  [project-name] 뱃지           │
  │ {repo-name}                                          │
  └──────────────────────────────────────────────────────┘
```

---

### 6.20 Deps (Dependencies)

**데이터 소스**: `package.json` (각 레포 루트)

**레이아웃**:
```
[제목] "Dependencies"
[탭] [Health] [Graph]

Health 탭:
  [빈 상태] "No package.json found"
  (있으면: 의존성 버전 상태, 업데이트 가능 여부)

Graph 탭:
  (의존성 관계 시각화 그래프)
```

---

### 6.21 Worktrees

**데이터 소스**: `git worktree list` (각 레포)

**레이아웃**:
```
[제목] "Worktrees"
[StatCards 4개] (스켈레톤 로딩)
[워크트리 리스트] (스켈레톤 로딩)
  (데이터 로드 후: 워크트리 경로 + 브랜치 + 상태)
```

---

### 6.22 Env

**데이터 소스**: 레포 내 `.env`, `.env.local`, `.env.*.local` 파일 스캔

**레이아웃**:
```
[제목] "Env"
[StatCards] (스켈레톤)
[빈 상태] "No .env files found — No .env files detected across your repos."
(있으면: 파일별 변수 목록, 보안 경고)
```

---

### 6.23 Lint

**데이터 소스**: 각 레포의 `CLAUDE.md` 파일 파싱

**레이아웃**:
```
[제목] "Lint"
[요약] "N issues across N file. N clean."

[StatCards 3개]
  | N Files (파랑) | N Issues (주황) | N Clean (초록) |

[파일 카드]
  ┌──────────────────────────────────────────────────────┐
  │ ⚠️ {repo-name}                                   >  │
  │   N lines  N.NKB  [N issues] 뱃지                    │
  └──────────────────────────────────────────────────────┘

(클릭 시 상세 — 이슈별 제안)
  - "CLAUDE.md is getting long (N lines). Consider extracting details."
  - "Consider adding a ## Development section"
  - "Consider adding sections (## Quick Start, ## Tech Stack, etc.)"
```

**린트 규칙 (바이너리에서 추출)**:
- 파일 길이 경고 (56줄 이상)
- 필수 섹션 누락 (Development, Quick Start, Tech Stack)
- 책임 분리 권고 ("Consider splitting responsibilities across multiple agents")
- 스킬 부재 경고 ("sessions but no skills. Skills automate repetitive workflows.")
- MEMORY.md 크기 경고 ("MEMORY.md over 200 lines gets truncated")

---

### 6.24 Settings

**데이터 소스**: 앱 자체 설정 (UserDefaults)

**레이아웃**:
```
[제목] "Settings"

[Rescan Workspace] ─ [🔄 Refresh all data]

[Scan Directories] ─ 디렉토리 관리
  ~/{project-path}
  [➕ Add Directory]  [🔍 Scan for New]
  "Scans up to 2 levels deep for git repos."

[Readout Assistant] ─ AI 설정
  ● Anthropic  [토글 ON/OFF]
    API Key: [____________]  [Paste]
    Model: [Haiku] [Sonnet] [Opus]  (칩 선택)
  ● OpenAI     (접기)
  ● Gemini     (접기)
  "Ask about repos, costs, sessions, and more.
   Keys are stored locally. Shell env vars are auto-detected."

[General]
  Launch at login      [토글]
  Check for updates    [토글]
  [Check for Updates]  [Export Log]

[Agents] ─ 에이전트 엔진 설정
  ● Claude Code  [토글 ON]
  ● Codex        Not installed
```

---

## 7. 공통 UI 패턴 구현 가이드

### 7.1 StatCard 컴포넌트

```
Props: { value: number | string, label: string, color: 'blue'|'green'|'yellow'|'orange'|'red' }

┌─────────────────┐
│      281        │  ← 28pt bold, white
│  ● Total Calls  │  ← 12pt, color dot(8px) + gray label
└─────────────────┘
배경: bg-card, radius: 12pt, padding: 12pt
전체 너비: 균등 분배 (flex: 1, gap: 12pt)
```

### 7.2 수평 바 차트

```
Props: { items: Array<{label, value, color}>, maxValue?: number }

{label}  ▓▓▓▓▓▓▓▓░░░░  {value}
         ↑ 비율에 따른 너비
바 높이: 8pt, radius: 4pt
라벨: 14pt monospace, 좌측 정렬 (고정폭 120pt)
값: 14pt, 우측
```

### 7.3 뱃지 컴포넌트

```
Props: { text: string, variant: 'blue'|'green'|'orange'|'red' }

[N files]
배경: accent 색상 15% opacity
텍스트: accent 색상 100%
padding: 2pt 8pt, radius: 4pt, font: 11pt
```

### 7.4 섹션 헤더

```
Props: { icon: string, title: string, count?: number, tooltip?: string }

⚡ Tool Distribution 10 tools ⓘ
아이콘(16pt) + 제목(14pt semibold) + 카운트(12pt gray) + 도움말 아이콘
```

### 7.5 카드 리스트 아이템

```
Props: { title, subtitle, badges[], rightContent, onClick }

┌──────────────────────────────────────────────────────┐
│ {icon} {title}  [badge1] [badge2]              >     │
│        {subtitle}                                    │
└──────────────────────────────────────────────────────┘
배경: bg-card, hover: bg-card-hover
padding: 12pt, radius: 8pt
우측: chevron (>) 또는 커스텀 콘텐츠
```

### 7.6 접이식 섹션

```
Props: { title, count, isOpen, onToggle, children }

◎ {title} {count} ⓘ                            ˅/˄
┌──────────────────────────────────────────────────────┐
│ (children — 접기/펼치기 애니메이션)                      │
└──────────────────────────────────────────────────────┘
```

### 7.7 스켈레톤 로딩

```
데이터 로딩 중 표시. 실제 컴포넌트와 동일한 크기의 회색 블록.
색상: #2c2c2e, 애니메이션: shimmer (좌→우 밝기 변화)
StatCard 스켈레톤, 리스트 스켈레톤, 차트 스켈레톤 각각 구현.
```

### 7.8 빈 상태 (EmptyState)

```
Props: { icon, title, description }

    (icon — 64pt, gray)
  {title}        ← 16pt semibold
  {description}  ← 14pt secondary
중앙 정렬, 콘텐츠 영역 중간에 배치
```

---

## 8. 인터랙션 패턴

### 8.1 네비게이션
- 사이드바 클릭 → 메인 콘텐츠 전환 (페이지 교체, 애니메이션 없음)
- 선택된 항목: 배경 하이라이트 (둥근 사각형)
- 카드 클릭 → 상세 보기 (인라인 펼침 또는 하위 페이지)

### 8.2 필터링
- 드롭다운: "All Projects" (Tools, Work Graph)
- 탭 바: 기간 필터 (Transcripts), Health/Graph (Deps), All/Mine (Work Graph)

### 8.3 검색
- 실시간 검색: 2자 이상 입력 시 즉시 결과 (Transcripts, Memory)
- 디바운스: 300ms

### 8.4 접기/펼치기
- Repo Pulse: 카드 클릭 → 파일 목록 + Show Diff 버튼
- Hygiene: 이슈 섹션 헤더 클릭 → 이슈 목록
- Memory: 프로젝트 카드 클릭 → MEMORY.md 내용

### 8.5 실시간 업데이트
- Live: 세션 상태 폴링 (5초 간격 추정)
- Dashboard: Hygiene 경고, uncommitted 파일 수 주기적 갱신
- Repo Pulse: git status 주기적 스캔

### 8.6 외부 연동
- GitHub API: Pull Requests (Work Graph)
- Anthropic API: Assistant 채팅
- 시스템 명령: git, lsof, ps

---

## 9. zm-agent-manager 구현 우선순위 매핑

### Phase 1 (MVP) — 직접 카피 대상

| Readout 화면 | 구현 우선순위 | 이유 |
|-------------|-------------|------|
| **Live** | ★★★★★ | F2 핵심 — 가장 단순하면서 가치 높음 |
| **Sessions** | ★★★★★ | F1 핵심 — 세션 목록 + 기본 통계 |
| **Tools** | ★★★★☆ | F4 핵심 — 도구 분포 + 체인 패턴 |
| **Dashboard** | ★★★★☆ | 진입점 — StatCard + 요약 정보 |
| **Timeline** | ★★★☆☆ | F3 참고 — 수직 타임라인 패턴 |

### Phase 2 — 확장 카피 대상

| Readout 화면 | 구현 우선순위 | 이유 |
|-------------|-------------|------|
| **Diffs** | ★★★★★ | F6 핵심 — 세션별 파일 변경 |
| **Transcripts** | ★★★★☆ | 검색 기능 — 세션 리플레이 진입점 |
| **Costs** | ★★★☆☆ | F8 일부 — 비용 추적 |

### Phase 3 — 선택적 카피 대상

| Readout 화면 | 구현 우선순위 | 이유 |
|-------------|-------------|------|
| **Skills** | ★★★☆☆ | Config 뷰어 |
| **Agents** | ★★★☆☆ | Config 뷰어 |
| **Memory** | ★★★☆☆ | Config 뷰어 |
| **Hygiene** | ★★☆☆☆ | 부가 기능 |
| **Lint** | ★★☆☆☆ | 부가 기능 |

### 구현하지 않을 화면

| Readout 화면 | 이유 |
|-------------|------|
| **Assistant** | 높은 구현 비용, API 키 필요 |
| **Repos/Work Graph/Repo Pulse** | git 관리 도구는 범위 밖 |
| **Ports** | 개발 서버 모니터링은 범위 밖 |
| **Snapshots** | 읽기 전용 원칙 위반 |
| **Worktrees/Env/Deps** | 범위 밖 |
| **Settings** | 자체 설정 UI로 대체 |
