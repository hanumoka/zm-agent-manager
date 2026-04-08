# Readout 앱 경쟁 분석 보고서

> 분석 일자: 2026-04-08
> 대상: Readout v0.0.11 (macOS, com.benjitaylor.Readout)
> 분석 방법: 바이너리 strings 추출 + Python 자동화 캡처(pyobjc + pyautogui) + 웹 리서치
> 목적: zm-agent-manager Phase 1~3 설계 참고

---

## 1. 앱 개요

| 항목 | 내용 |
|------|------|
| 개발자 | Benji Taylor (Coinbase Base Design Head) |
| 플랫폼 | macOS 전용 (Swift/SwiftUI, Tahoe 26.0+) |
| 버전 | 0.0.11 (베타) |
| 가격 | 무료 |
| 계정 | 불필요 (완전 로컬) |
| 업데이트 | Sparkle 프레임워크 |
| 태그라인 | "Your dev environment, at a glance. One dashboard instead of six terminal tabs." |

---

## 2. 사이드바 구조 (6개 섹션, 25개 항목)

```
Overview
  ├── Readout (Dashboard)
  └── Assistant (AI Chat)
Monitor
  ├── Live
  ├── Sessions
  ├── Transcripts
  ├── Tools
  ├── Costs
  ├── Setup
  └── Ports
Workspace
  ├── Repos
  ├── Work Graph
  ├── Repo Pulse
  ├── Timeline
  ├── Diffs
  └── Snapshots
Config
  ├── Skills
  ├── Agents
  ├── Memory
  └── Hooks
Health
  ├── Hygiene
  ├── Deps
  ├── Worktrees
  ├── Env
  └── Lint
Settings
```

---

## 3. 화면별 상세 컴포넌트 분석

### 3.1 Overview — Readout (Dashboard)

메인 대시보드. 전체 개발 환경 요약을 한 화면에 제공.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 인사 헤더 | 텍스트 | "Hey, {username}" + 레포/스킬/에이전트 수 요약 + 오늘 커밋 수 |
| 통계 카드 (4개) | StatCard | Repos, Commits Today, Sessions, Est. Cost — 각각 아이콘+숫자+라벨, 색상 구분 (파랑/초록/파랑/노랑) |
| Activity 차트 | BarChart | 일별 활동량 막대 차트 (최근 30일) |
| When You Work | Heatmap | 요일×시간대 작업 패턴 히트맵 |
| Cost by Model | HorizontalBar | 모델별 비용 바 (예: Opus 4.6 — $1.39) + Total 표시 |
| Recent Sessions | List | 세션명 + 프로젝트 뱃지 + 상대 시간 (예: "24m ago") |
| Hygiene 경고 | Banner | "1 hygiene issue needs attention" — 주의 아이콘 |
| Uncommitted 경고 | Banner | "{repo} has N uncommitted files" |
| CLAUDE.md 제안 | ActionCard | "Add CLAUDE.md to N projects" + "Better results" 액션 버튼 |
| Recently Active | CardGrid | 레포별 Skills/Agents/Memory/Repos 요약 (가로 카드 4개) |

**zm-agent-manager 시사점**: Dashboard와 세션 목록을 분리하되, 대시보드에 핵심 지표 카드를 배치하는 패턴 참고.

---

### 3.2 Overview — Assistant

AI 대화 인터페이스. 워크스페이스 데이터를 자연어로 질의.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 모델 선택 | Dropdown | 우측 상단 "Sonnet" 드롭다운 |
| 빈 상태 | EmptyState | 로봇 일러스트 + "Add an API key to start chatting" |
| API 키 버튼 | Button | "Add API Key" — Anthropic, OpenAI, Google 지원 |

**zm-agent-manager 시사점**: Phase 3 이후 검토 가능. 높은 구현 비용.

---

### 3.3 Monitor — Live

실시간 활성 Claude Code 세션 모니터링.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 통계 카드 (3개) | StatCard | Sessions (활성 수), Generating (현재 생성 중), Memory MB (메모리 사용량) |
| 세션 카드 | SessionCard | 프로젝트명 + 프로젝트 폴더 뱃지 + 경과 시간(1:14:29) + 메모리(1006 MB) + "active" 상태 뱃지 (녹색) |

**zm-agent-manager 시사점**: Phase 1 F2(실시간 스트리밍) 핵심 참고. 메모리 사용량 표시는 추가 가치.

---

### 3.4 Monitor — Sessions

세션 히스토리 통계 및 분석 대시보드.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 요약 텍스트 | Text | "N session, N messages total. Primary model: {model}. Active across N projects." |
| When You Work | Heatmap | 요일×시간 히트맵 (Tue/Wed/Thu 등) |
| 통계 카드 (3개) | StatCard | Sessions, Messages, Tokens (예: 1, 101, 2K) |
| Daily Activity | BarChart | 일별 활동 막대 차트 |
| Model Usage | HorizontalBar | 모델별 토큰 사용량 바 (Opus 4.6 — 2K) |
| By Project | Table | 프로젝트명 + 세션 수 + 최근 사용 시간 |
| Recent Sessions | List | 세션 제목(한국어 지원) + 프로젝트 뱃지 + 상대 시간 |

**zm-agent-manager 시사점**: Phase 1 F1(세션 목록) + Phase 3 F8(세션 통계) 직접 참고.

---

### 3.5 Monitor — Transcripts

전체 세션 트랜스크립트 전문 검색.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 검색창 | SearchInput | "Search transcripts..." 플레이스홀더 |
| 기간 필터 | TabBar | Today / This Week / This Month / All Time (하이라이트 탭) |
| 빈 상태 | EmptyState | "Search across all your session transcripts. Type at least 2 characters." |

**zm-agent-manager 시사점**: Phase 2 이후 세션 검색 기능으로 참고.

---

### 3.6 Monitor — Tools

도구 사용 분석 대시보드. 가장 정보 밀도가 높은 화면.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 통계 카드 (3개) | StatCard | Total Calls (281), Files Touched (48), Avg/Session (47) |
| 프로젝트 필터 | Dropdown | "All Projects" |
| Usage Over Time | BarChart | 일별 도구 사용 차트 (14일) + "Busiest: Apr 8 with 281 calls" 텍스트 |
| Tool Distribution | HorizontalBar | 10개 도구별 수평 바 — Bash(79), Read(48), Write(45), Edit(32), TaskUpdate(31), TaskCreate, Agent, WebSearch, ToolSearch, ExitPlanMode |
| Common Sequences | PatternList | 도구 체인 패턴 8개 — "Bash → Bash (48)", "Write → Write (34)", "Read → Read (34)", "Edit → Edit (19)" 등 |
| Most Edited Files | FileList | 파일별 편집 횟수 — CLAUDE.md, settings.json, SESSION_LOG.md |

**zm-agent-manager 시사점**: Phase 1 F4(도구 추적) + Phase 3 확장 직접 참고. Common Sequences(도구 체인)는 INBOX 아이디어 #3과 연결.

---

### 3.7 Monitor — Costs

비용 추적 및 예측 대시보드.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 비용 카드 (4개) | StatCard | Today ($27.07, 파랑), This Week ($27.07, 초록), This Month ($27.07, 초록), All Time ($1.39, 노랑) |
| Cost by Model | HorizontalBar | 모델별 비용 바 + 금액 라벨 |
| Monthly Projection | DualStat | Estimate $116 / Burn $27.07 |
| Trends | Table | This Week / This Month 비교 + 변화량 |
| Daily Cost | BarChart | 일별 비용 막대 차트 |
| 가격 메타 | Footer | "Prices updated 2026-01-23" + "Refresh Prices" 버튼 + 면책 문구 |

**zm-agent-manager 시사점**: INBOX 아이디어 #1(비용 추적). stats-cache.json의 costUSD 활용.

---

### 3.8 Monitor — Setup

(미캡처 — 좌표 한계로 Ports와 겹침. 바이너리 분석 기반 추정)

- Claude Code / Codex 에이전트 설정
- 스캔 디렉토리 관리
- 연결 상태 확인

---

### 3.9 Monitor — Ports

로컬 개발 서버/프로세스 포트 모니터링.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 요약 텍스트 | Text | "N port open across N process." |
| 통계 카드 (3개) | StatCard | Ports, Processes, Node (Node.js 프로세스 수) |
| 프로세스 카드 | ProcessCard | 프로세스명 + PID + 실행 경로 + 포트 번호(:6379) + 바인딩 주소(127.0.0.1) |

**zm-agent-manager 시사점**: 직접적 관련 낮음. 개발 환경 모니터링 확장 시 참고.

---

### 3.10 Workspace — Repos

등록된 Git 레포지토리 관리.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 통계 카드 (4개) | StatCard | Active (녹색), Dirty (주황), Unpushed (회색), Total (파랑) |
| 섹션 헤더 | SectionHeader | "Active N" + 필터 아이콘 |
| 레포 카드 | RepoCard | 프로젝트명 + 브랜치(main) + dirty 뱃지 + skills 뱃지 + 최근 커밋 메시지 + 시간 + 미니 activity 스파크라인 |

**zm-agent-manager 시사점**: 직접적 관련 낮음. 멀티 레포 지원 시 참고.

---

### 3.11 Workspace — Work Graph

크로스 레포 작업 활동 종합 그래프.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 필터 탭 | TabBar | All / Mine |
| 통계 카드 (4개) | StatCard | Active, Idle, Dormant, Commits |
| Commit Activity | BarChart | 30일 커밋 막대 차트 |
| Commits by Repo | HorizontalBar | 레포별 커밋 수 바 |
| Pull Requests | List | PR 목록 (GitHub API 연동) |
| Uncommitted Work | RepoList | 레포별 미커밋 파일 수 |
| All Repos | RepoList | 레포 목록 + 최근 커밋 + 시간 |

---

### 3.12 Workspace — Repo Pulse

레포 건강 상태 한눈에 파악.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 요약 | Text | "N repos scanned. N needs attention (N uncommitted files)." |
| 통계 카드 (3개) | StatCard | Need Attention (주황), Clean (초록), Uncommitted (빨강) |
| 경고 섹션 | Section | "Needs Attention" 헤더 + 도움말 아이콘 |
| 레포 카드 | AlertCard | 프로젝트명 + 파일 수 뱃지 + 시간 + 최근 커밋 메시지 |

---

### 3.13 Workspace — Timeline (Git Timeline)

커밋 히스토리 시각적 타임라인.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 통계 카드 (3개) | StatCard | Repos, Branches, Commits |
| 레포 헤더 | RepoHeader | 프로젝트명 + main 뱃지 + "N branch" |
| 커밋 타임라인 | VerticalTimeline | 수직 라인 + 커밋 노드 — 해시(컬러 링크) + 메시지 + 작성자 + 상대 시간 |

**zm-agent-manager 시사점**: Phase 1 F3(메시지 타임라인) UI 패턴 참고. 수직 타임라인 + 노드 디자인.

---

### 3.14 Workspace — Diffs

세션별 파일 변경 diff 모아보기.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 통계 카드 (2개) | StatCard | Sessions, Files Changed |
| 날짜 구분 | DateHeader | "Today" |
| Diff 카드 | DiffCard | 세션 제목 + "Claude Code" 뱃지(파랑) + 프로젝트 뱃지(초록) + 파일수 + 편집수 뱃지(노랑) + "Replay" 버튼 |

**zm-agent-manager 시사점**: Phase 2 F6(파일 변경 하이라이트) 참고. Replay 버튼 → 세션 리플레이 진입점.

---

### 3.15 Workspace — Snapshots

워크스페이스 상태 저장/복원.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 통계 카드 (3개) | StatCard | Repos, Snapshots, Dirty |
| 섹션 헤더 | Section | "Current Branches N" |
| 브랜치 카드 | BranchCard | 프로젝트명 + main 뱃지 + dirty 수 |
| 액션 버튼 | Button | "Save Snapshot" — 카메라 아이콘 |

**zm-agent-manager 시사점**: 읽기 전용 원칙과 충돌하므로 직접 구현 불가. 별도 저장소에 스냅샷 저장하는 방식으로 변형 가능.

---

### 3.16 Config — Skills

Claude Code 커스텀 스킬 관리.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 액션 버튼 (3개) | ButtonGroup | "Browse skills.sh" (검색), "Add from folder" (폴더), "New Skill" (생성) |
| 요약 | Text | "N project-specific across N repo." |
| 레포 그룹 | GroupHeader | "zm-agent-manager N" |
| 스킬 목록 | ItemList | 번개 아이콘 + 스킬명 + description (접힌 상태) |

---

### 3.17 Config — Agents

Claude Code 커스텀 에이전트 관리.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 액션 버튼 | Button | "New Agent" (녹색 원) |
| 요약 | Text | "N agents across N repo." |
| 레포 그룹 | GroupHeader | "zm-agent-manager" |
| 에이전트 카드 | AgentCard | 사람 아이콘(컬러 구분) + 에이전트명 + description 미리보기 |

---

### 3.18 Config — Memory

Claude Code MEMORY.md 뷰어.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 검색창 | SearchInput | "Search memories..." |
| 요약 | Text | "N lines of context across N project, {project} has the most detail (N lines)." |
| 프로젝트 카드 | ExpandableCard | 프로젝트 경로 + 라인 수 뱃지 + 메모리 내용 미리보기 (마크다운 렌더링) |

---

### 3.19 Config — Hooks

(미캡처 — 좌표 한계. 바이너리 분석 기반 추정)

| 컴포넌트 (추정) | 유형 | 상세 |
|----------|------|------|
| HooksDebuggerView | DebugView | 훅 실행 상태 디버깅 |
| HookCard | Card | 개별 훅 상태/결과 표시 |
| hookStatuses | StatusList | 훅별 성공/실패/차단 상태 |

---

### 3.20 Health — Hygiene

프로젝트 건강 상태 검사.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 스코어 게이지 | CircularGauge | "N issues" 원형 게이지 + 심각도별 뱃지 (Info/Warning/Error) |
| 제안 카드 | ActionCard | "Set up Readout Assistant — Add an API key to auto-diagnose issues" + 화살표 |
| 이슈 섹션 (접이식) | CollapsibleSection | "Uncommitted Changes N" — 접기/펼치기 |
| 이슈 카드 | IssueCard | "N uncommitted files" + 프로젝트 뱃지 |

**zm-agent-manager 시사점**: INBOX 아이디어 참고. 프로젝트 건강 점수 표시 패턴.

---

### 3.21 Health — Deps (Dependencies)

의존성 건강 검사.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 탭 | TabBar | Health / Graph (두 가지 뷰) |
| 빈 상태 | EmptyState | "No package.json found — Dependency health checks repos with a package.json in their root." |

---

### 3.22 Health — Worktrees

Git worktree 관리.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| (로딩 중) | Skeleton | 통계 카드 4개 스켈레톤 + 워크트리 목록 스켈레톤 |

**zm-agent-manager 시사점**: Skeleton 로딩 UI 패턴 참고 — 실시간 데이터 로딩 시 적용.

---

### 3.23 Health — Env

환경변수 파일(.env) 보안 감사.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 통계 카드 | StatCard | (스켈레톤 로딩 중) |
| 빈 상태 | EmptyState | "No .env files found — No .env files detected across your repos." |

---

### 3.24 Health — Lint

CLAUDE.md 파일 린터.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| 요약 | Text | "N issues across N file. N clean." |
| 통계 카드 (3개) | StatCard | Files (파랑), Issues (주황), Clean (초록) |
| 파일 카드 | FileCard | 프로젝트명 + 경고 아이콘 + 라인 수 + 파일 크기 + "N issues" 뱃지 |

**zm-agent-manager 시사점**: INBOX 아이디어 #4(CLAUDE.md Linter) 직접 참고.

---

### 3.25 Settings

앱 전체 설정.

| 컴포넌트 | 유형 | 상세 |
|----------|------|------|
| Rescan Workspace | ActionRow | "Refresh all data" 버튼 |
| Scan Directories | DirectoryList | 경로 목록 + "Add Directory" / "Scan for New" 버튼 + "Scans up to 2 levels deep for git repos" |
| Readout Assistant | SettingsGroup | Anthropic (토글 ON/OFF) + API Key 입력 + "Paste" 버튼 + 모델 선택 (Haiku/Sonnet/Opus 칩) |
| 추가 AI | SettingsGroup | OpenAI (접기), Gemini (접기) |
| Assistant 설명 | InfoText | "Ask about repos, costs, sessions, and more. Keys are stored locally. Shell env vars are auto-detected." |
| General | SettingsGroup | "Launch at login" 토글 + "Check for updates automatically" 토글 |
| 액션 버튼 | ButtonGroup | "Check for Updates" + "Export Log" |
| Agents | SettingsGroup | Claude Code (토글 ON) + Codex (Not installed) |

---

## 4. 공통 UI 패턴 정리

### 4.1 StatCard (통계 카드)
거의 모든 화면 상단에 3~4개 배치. 숫자 + 라벨 + 색상 점 구성.

```
┌─────────────┐
│     281     │
│ ● Total Calls│
└─────────────┘
```
색상 규칙: 파랑(정보), 초록(정상), 주황(주의), 빨강(경고), 노랑(비용)

### 4.2 BarChart (막대 차트)
Activity, Daily Cost, Usage Over Time 등에 사용. 일별 데이터 시각화.

### 4.3 HorizontalBar (수평 바 차트)
Tool Distribution, Cost by Model, Commits by Repo 등. 항목별 비교.

### 4.4 Skeleton 로딩
데이터 로딩 중 회색 플레이스홀더 블록 표시. Worktrees, Env 등에서 확인.

### 4.5 EmptyState (빈 상태)
데이터 없을 때 아이콘 + 설명 텍스트 + 액션 안내. Transcripts, Deps, Env 등.

### 4.6 뱃지 시스템
- 상태 뱃지: "active" (녹색), "dirty" (주황)
- 수량 뱃지: "2 files" (파랑), "6 skills" (파랑), "3 issues" (주황)
- 카테고리 뱃지: "Claude Code" (파랑), 프로젝트명 (초록)

### 4.7 접이식 섹션 (CollapsibleSection)
Hygiene의 "Uncommitted Changes" 등. 헤더 클릭으로 펼침/접기.

---

## 5. zm-agent-manager 반영 매핑

### Phase 1 직접 참고

| Readout 화면 | zm-agent-manager 기능 | 참고 포인트 |
|-------------|----------------------|------------|
| Dashboard | 메인 화면 | StatCard 4개 + Recent Sessions 패턴 |
| Live | F2 실시간 스트리밍 | 세션 카드 (상태/시간/메모리), 통계 카드 |
| Sessions | F1 세션 목록 | By Project 그룹핑, Recent Sessions 리스트 |
| Tools | F4 도구 추적 | Tool Distribution 바 차트, Common Sequences |
| Timeline | F3 메시지 타임라인 | 수직 타임라인 + 노드 디자인 |

### Phase 2 참고

| Readout 화면 | zm-agent-manager 기능 | 참고 포인트 |
|-------------|----------------------|------------|
| Diffs | F6 파일 변경 하이라이트 | 세션별 diff 카드 + Replay 버튼 |
| Transcripts | F5 세션 리플레이 | 검색 + 기간 필터 패턴 |

### Phase 3 / INBOX 참고

| Readout 화면 | INBOX 아이디어 | 참고 포인트 |
|-------------|--------------|------------|
| Costs | #1 비용 추적 | 4개 기간 비교 카드 + Monthly Projection + Trends |
| Tools (Sequences) | #3 Tool Chain | Common Sequences 패턴 리스트 |
| Lint | #4 CLAUDE.md Linter | 파일별 이슈 수 + 상세 진입 |
| Hygiene | #5 알림 시스템 | 원형 스코어 + 이슈 섹션 |

---

## 6. Readout vs zm-agent-manager 차별화 포인트

| 관점 | Readout | zm-agent-manager |
|------|---------|-------------------|
| 플랫폼 | macOS 전용 | 크로스 플랫폼 (Electron) |
| 데이터 접근 | 읽기+쓰기 (스냅샷) | **읽기 전용** (핵심 원칙) |
| 범위 | 개발 환경 전체 (git, ports, deps, env) | Claude Code 세션 모니터링 특화 |
| AI 통합 | Assistant (멀티 모델 채팅) | 없음 (Phase 3 이후 검토) |
| 가격 | 무료 베타 | 오픈소스 예정 |
| 대상 OS | macOS Tahoe 26.0+ | 제한 없음 |
