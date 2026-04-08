# Readout 기능 명세서

> 작성일: 2026-04-08
> 대상: Readout v0.0.11 (macOS)
> 목적: zm-agent-manager 기획 시 참고할 기능 중심 명세서
> 기술 상세: [`readout-analysis.md`](./readout-analysis.md) 참조

---

## 목차

1. [제품 개요](#1-제품-개요)
2. [기능 분류 체계](#2-기능-분류-체계)
3. [핵심 기능 상세](#3-핵심-기능-상세)
4. [보조 기능 상세](#4-보조-기능-상세)
5. [설정 및 관리 기능](#5-설정-및-관리-기능)
6. [데이터 처리 로직](#6-데이터-처리-로직)
7. [zm-agent-manager 적용 판단](#7-zm-agent-manager-적용-판단)

---

## 1. 제품 개요

**Readout**은 Claude Code 개발 환경을 실시간으로 모니터링하고, 과거 세션을 리플레이하며, 비용/도구/건강 상태를 분석하는 macOS 데스크톱 앱이다.

**핵심 가치**: "6개 터미널 탭 대신 하나의 대시보드"

**사용 흐름**:
```
개발자가 Claude Code로 작업
  → Readout이 ~/.claude/ 데이터를 실시간 감시
  → 대시보드에서 세션/도구/비용/건강 상태를 한눈에 파악
  → 과거 세션을 리플레이하여 작업 내용 복기
  → 문제 발견 시 Hygiene/Lint 경고로 안내
```

---

## 2. 기능 분류 체계

총 **25개 기능**을 5개 카테고리로 분류.

| 카테고리 | 기능 수 | 핵심 가치 |
|----------|---------|----------|
| **실시간 모니터링** | 7개 | 현재 무슨 일이 일어나고 있는가? |
| **히스토리 분석** | 6개 | 과거에 무슨 일이 있었는가? |
| **설정 관리** | 4개 | Claude Code가 어떻게 설정되어 있는가? |
| **건강 검사** | 5개 | 문제가 있는가? 개선할 점은? |
| **앱 설정** | 3개 | Readout 자체 설정 |

### 전체 기능 목록

```
실시간 모니터링
  F-MON-01  대시보드 (Dashboard)
  F-MON-02  실시간 세션 모니터 (Live)
  F-MON-03  세션 히스토리 통계 (Sessions)
  F-MON-04  도구 사용 분석 (Tools)
  F-MON-05  비용 추적 (Costs)
  F-MON-06  포트 모니터 (Ports)
  F-MON-07  AI 어시스턴트 (Assistant)

히스토리 분석
  F-HIS-01  세션 리플레이 (Session Replay)
  F-HIS-02  트랜스크립트 검색 (Transcripts)
  F-HIS-03  세션별 파일 변경 (Diffs)
  F-HIS-04  Git 타임라인 (Timeline)
  F-HIS-05  커밋 활동 그래프 (Work Graph)
  F-HIS-06  워크스페이스 스냅샷 (Snapshots)

설정 관리
  F-CFG-01  스킬 관리 (Skills)
  F-CFG-02  에이전트 관리 (Agents)
  F-CFG-03  메모리 뷰어 (Memory)
  F-CFG-04  훅 디버거 (Hooks)

건강 검사
  F-HLT-01  프로젝트 위생 검사 (Hygiene)
  F-HLT-02  의존성 검사 (Deps)
  F-HLT-03  워크트리 관리 (Worktrees)
  F-HLT-04  환경변수 보안 감사 (Env)
  F-HLT-05  CLAUDE.md 린터 (Lint)

앱 설정
  F-SET-01  초기 설정 (Setup)
  F-SET-02  레포 관리 (Repos)
  F-SET-03  앱 환경설정 (Settings)
```

---

## 3. 핵심 기능 상세

### F-MON-01. 대시보드 (Dashboard)

**목적**: 개발 환경 전체 현황을 한 화면에 요약

**제공 정보**:
- 시간대별 인사 메시지 ("Morning, {name}" / "Deep in it, {name}?")
- 등록 레포 수, 오늘 커밋 수, 활성 세션 수, 예상 비용
- 최근 30일 활동 차트 (일별 막대그래프)
- 작업 시간대 히트맵 (요일×시간)
- 모델별 비용 비율
- 최근 세션 목록 (세션명 + 프로젝트 + 시간)
- 건강 경고 배너 (Hygiene 이슈, 미커밋 파일, CLAUDE.md 미설정)
- **비용 예산 제안**: "Set a spending budget" — "You've spent $N this month with no budget alerts config..." + "Cost control" 버튼
- 최근 활성 레포의 Skills/Agents/Memory/Repos 요약
- **워크스페이스 리스캔 알림**: "Workspace rescanned" 토스트 (리스캔 완료 시)

**시간대별 인사 메시지** (확인된 4종):
| 시간대 | 메시지 |
|--------|--------|
| 아침 | "Morning, {name}" (추정) |
| 낮 | "Midday, {name}" (확인) |
| 오후 | "Afternoon grind, {name}" (확인) |
| 밤 | "Deep in it, {name}?" (확인) |

**입력 데이터**: history.jsonl, stats-cache.json, sessions/*.json, git status, .claude/skills/, .claude/agents/, memory/MEMORY.md

**갱신 주기**: 앱 진입 시 + 주기적 (추정 30초)

---

### F-MON-02. 실시간 세션 모니터 (Live)

**목적**: 현재 실행 중인 Claude Code 세션을 실시간으로 추적

**제공 정보**:
- 활성 세션 수, 현재 생성 중인 세션 수, 총 메모리 사용량
- 세션별 카드: 프로젝트명, 작업 디렉토리, 경과 시간(H:MM:SS), 메모리(MB), 상태(active/generating)

**핵심 로직**:
1. `~/.claude/sessions/{pid}.json` 파일 스캔
2. 각 pid에 대해 `ps -p {pid}` 로 프로세스 존재 확인
3. 메모리: `ps -o rss= -p {pid}` (RSS → MB 변환)
4. 경과 시간: `startedAt` (Unix ms) 부터 현재까지 차이
5. Generating 감지: 해당 세션 JSONL의 마지막 레코드가 assistant이고 아직 완료되지 않은 경우

**갱신 주기**: 5초 간격 폴링 (추정)

---

### F-MON-03. 세션 히스토리 통계 (Sessions)

**목적**: 모든 세션의 사용 패턴과 통계를 종합 분석

**제공 정보**:
- 총 세션 수, 총 메시지 수, 총 토큰 수
- 주 모델명 (가장 많이 사용된 모델)
- 프로젝트 수
- 작업 시간대 히트맵 (When You Work)
- 일별 활동 차트 (최근 30일)
- 모델별 토큰 사용 바 차트
- 프로젝트별 세션 수 / 최근 사용 시간 테이블
- 최근 세션 목록 (세션 제목 + 프로젝트 뱃지 + 시간 + **Replay 버튼**)

**핵심 로직**:
- Sessions/Messages: history.jsonl 고유 sessionId 카운트 + 모든 JSONL의 user/assistant 레코드 수
- Tokens: 모든 assistant 레코드의 `message.usage` (input_tokens + output_tokens + cache) 합산
- When You Work: history.jsonl timestamp → 요일/시간 분류 → 셀 색상 강도 매핑
- Model Usage: stats-cache.json.modelUsage 또는 JSONL의 message.model별 집계
- By Project: history.jsonl의 project 필드별 그룹핑
- Recent Sessions: history.jsonl 최신 N개, display 필드로 세션 제목 표시

---

### F-MON-04. 도구 사용 분석 (Tools)

**목적**: Claude Code가 어떤 도구를 얼마나 사용하는지 분석

**제공 정보**:
- 총 도구 호출 수, 접근 파일 수, 세션당 평균 호출 수
- 프로젝트별 필터링
- 일별 도구 사용 추이 차트 (14일) + 가장 바쁜 날 표시
- **도구별 분포 바 차트** — Bash(79), Read(48), Write(45), Edit(32), TaskUpdate(31) 등
- **도구 호출 체인 패턴** — "Bash→Bash(48)", "Write→Write(34)", "Read→Edit(18)" 등 연속 호출 패턴
- **가장 많이 편집된 파일** — 파일 경로 + 프로젝트명 + 편집 횟수

**핵심 로직**:
- 모든 JSONL에서 assistant 레코드의 content에서 `type: 'tool_use'` 블록 추출
- Tool Distribution: `tool_use.name` 별 카운트
- Common Sequences: 동일 세션 내 연속된 두 tool_use의 name 쌍을 카운트
- Most Edited Files: name이 'Write' 또는 'Edit'인 tool_use의 `input.file_path` 별 카운트
- Files Touched: 모든 tool_use에서 file_path 인자가 있는 고유 파일 수

**실제 확인된 도구 목록** (13종):
Read, Bash, Edit, Write, TaskUpdate, TaskCreate, Agent, WebSearch, ToolSearch, WebFetch, AskUserQuestion, ExitPlanMode, Glob

---

### F-MON-05. 비용 추적 (Costs)

**목적**: API 사용 비용을 추정하고 추이를 분석

**제공 정보**:
- 4개 기간별 비용: Today / This Week / This Month / All Time
- 모델별 비용 바 차트
- 월간 예상 비용 (Monthly Projection) + 현재 소진량 (Burn)
- 주간/월간 트렌드 비교 (증감 표시)
- 일별 비용 차트 (14일)
- 가격 갱신 날짜 + 새로고침 버튼

**비용 계산 공식** (실제 데이터로 $27.07 재현 검증 완료):
```
cost = (input_tokens × model.input / 1,000,000)
     + (output_tokens × model.output / 1,000,000)
     + (cache_read_tokens × model.cacheRead / 1,000,000)
     + (cache_write_tokens × model.cacheWrite / 1,000,000)
```

**가격표** (readout-pricing.json):
| 모델 | Input | Output | Cache Read | Cache Write |
|------|-------|--------|------------|-------------|
| opus-4-6 | $5.00 | $25.00 | $0.50 | $6.25 |
| sonnet-4-5 | $3.00 | $15.00 | $0.30 | $3.75 |
| haiku-4-5 | $1.00 | $5.00 | $0.10 | $1.25 |

**데이터 소스**:
- 일별 토큰: readout-cost-cache.json (Readout이 JSONL 스캔하여 자체 생성)
- 가격표: readout-pricing.json (Anthropic 공식 가격 기반)
- 모델 slug 매핑: `claude-opus-4-6` → `opus-4-6` (접두사 `claude-` 제거)

---

### F-HIS-01. 세션 리플레이 (Session Replay)

**목적**: 과거 세션을 타임라인으로 재구성하여 시간 순으로 리플레이

**진입점**: Sessions의 "Replay" 버튼 또는 Diffs의 "Replay" 버튼

**제공 기능**:
- **타임라인 스크러버**: 수평 바로 전체 세션 진행 위치를 시각화, 드래그로 임의 위치 이동
- **재생 컨트롤**: 재생/일시정지, 0.5x/1x/2x/4x 속도 조절, 앞/뒤 스텝 이동
- **이벤트 타임라인**: 수직 스크롤 — 사용자 메시지, 어시스턴트 응답, 도구 호출을 시간순 나열
- **도구 호출 상세**: 각 도구의 이름, 입력, 실행 시간, 결과(접기/펼치기)
- **파일 변경 하이라이트**: 파일 수정 이벤트 발생 시 해당 파일명에 펄스 애니메이션 ("Files light up as edits land")
- **리플레이 내 검색**: 이벤트 내용 검색

**타임라인 이벤트 종류**:
| 이벤트 | 소스 레코드 | 표시 |
|--------|-----------|------|
| 사용자 메시지 | type: 'user' | 파란 노드 + 메시지 텍스트 |
| 어시스턴트 응답 | type: 'assistant' (text block) | 녹색 노드 + 텍스트 요약 |
| 사고 과정 | type: 'assistant' (thinking block) | 회색 노드 (접힌 상태) |
| 도구 호출 | type: 'assistant' (tool_use block) | 주황 노드 + 도구명 + 입력 요약 |
| 도구 결과 | type: 'assistant' (tool_result block) | 회색 (접힌 상태) |
| 파일 변경 | file-history-snapshot | 파일 하이라이트 펄스 |
| 턴 종료 | type: 'system' (turn_duration) | 구분선 + 소요시간 |

**핵심 로직**:
1. `{sessionId}.jsonl` 전체 파싱 → timestamp 순 정렬
2. parentUuid로 메시지 체인 구성 (root → user → assistant → ... 순서)
3. assistant 레코드의 content에서 text/thinking/tool_use/tool_result 블록 분리
4. file-history/{sessionId}/ 에서 파일 변경 이력 매핑
5. PlaybackControls: playheadFraction(0.0~1.0)으로 타임라인 위치 제어

---

### F-HIS-02. 트랜스크립트 검색 (Transcripts)

**목적**: 모든 세션의 대화 내용을 전문 검색

**제공 기능**:
- 검색어 입력 (최소 2자)
- 기간 필터: Today / This Week / This Month / All Time
- 세션별 매치 결과 리스트 (검색어 하이라이트)

**핵심 로직**:
- 모든 JSONL에서 user/assistant 레코드의 message.content 텍스트 추출
- 검색어 매칭 (대소문자 무시)
- timestamp 기준 기간 필터링
- 검색 디바운스: 300ms (추정)

---

### F-HIS-03. 세션별 파일 변경 (Diffs)

**목적**: 각 세션에서 어떤 파일이 어떻게 변경되었는지 추적

**제공 정보**:
- 파일 변경이 있는 세션 수, 총 변경 파일 수
- 날짜별 그룹핑
- 세션 카드: 세션 제목 + "Claude Code" 뱃지 + 프로젝트명 + 파일 수 + 편집 수 + 커밋 해시 + **Replay 버튼**
- 카드 클릭 시: 파일별 변경 목록 + 줄 수 변경(+N/-N) + "Show Diff" 버튼

**데이터 소스**:
- `file-history/{sessionId}/{hash}@v{n}` — 파일의 세션 전후 버전 스냅샷
- JSONL의 Write/Edit tool_use에서 변경 파일 추출

---

### F-HIS-04. Git 타임라인 (Timeline)

**목적**: 레포별 Git 커밋 히스토리를 시각적 타임라인으로 표시

**제공 정보**:
- 총 레포 수, 브랜치 수, 커밋 수
- 레포별 수직 타임라인: 커밋 해시(녹색 링크) + 메시지 + 작성자 + 상대 시간
- 브랜치 표시

**데이터 소스**: `git log --all --oneline` (각 레포)

---

### F-HIS-05. 커밋 활동 그래프 (Work Graph)

**목적**: 모든 레포의 커밋 활동을 종합 분석

**제공 정보**:
- 활성/유휴/휴면 레포 수, 총 커밋 수
- All / Mine 필터
- 30일 커밋 활동 차트
- 레포별 커밋 수 바 차트
- Pull Requests 목록 (GitHub API 연동)
- 미커밋 작업 목록 (레포별 미커밋 파일 수)
- 전체 레포 리스트

---

### F-HIS-06. 워크스페이스 스냅샷 (Snapshots)

**목적**: 세션 시작 전 워크스페이스 상태를 저장하고, 필요 시 복원

**제공 기능**:
- 현재 브랜치별 dirty 상태 표시
- "Save Snapshot" 버튼으로 현재 상태 저장
- 저장된 스냅샷 목록
- 세션 전 상태로 파일 복원 (Session Undo)

**주의**: zm-agent-manager는 읽기 전용 원칙이므로 복원 기능은 구현 범위 밖

---

## 4. 보조 기능 상세

### F-CFG-01. 스킬 관리 (Skills)

**목적**: Claude Code 커스텀 스킬(슬래시 커맨드) 조회 및 관리

**제공 기능**:
- 프로젝트별 스킬 목록 (이름 + description)
- 온라인 스킬 브라우저 ("Browse skills.sh")
- 폴더에서 추가 ("Add from folder")
- 새 스킬 생성 ("New Skill")

**데이터 소스**: `{project}/.claude/skills/*/SKILL.md`, `~/.claude/skills/`, 플러그인 스킬

---

### F-CFG-02. 에이전트 관리 (Agents)

**목적**: Claude Code 커스텀 서브에이전트 조회 및 관리

**제공 기능**:
- 프로젝트별 에이전트 목록 (이름 + description + 컬러 아이콘)
- 새 에이전트 생성 ("New Agent")

**데이터 소스**: `{project}/.claude/agents/*.md`, `~/.claude/agents/`

---

### F-CFG-03. 메모리 뷰어 (Memory)

**목적**: Claude Code의 MEMORY.md 내용을 조회하고 검색

**제공 기능**:
- 프로젝트별 메모리 목록 (라인 수 표시)
- 메모리 내용 미리보기 (마크다운 렌더링)
- 메모리 내 검색

**데이터 소스**: `~/.claude/projects/{path}/memory/MEMORY.md`

---

### F-CFG-04. 훅 디버거 (Hooks)

**목적**: Claude Code 훅의 설정 상태와 실행 결과를 디버깅

**제공 기능**:
- 설정된 훅 목록 (이벤트 타입별 그룹핑)
- 각 훅의 matcher, 타입(command/prompt/agent/http), 명령/프롬프트
- 실행 상태 표시:
  - 성공: 초록 체크 + exit 0
  - 차단: 빨강 X + exit 2 + 에러 메시지
  - 실패: 주황 경고 + exit code + stderr
- 안내: "Hooks are defined in ~/.claude/settings.json under the 'hooks' key."

**데이터 소스**: `{project}/.claude/settings.json` (hooks 섹션), 런타임 실행 로그

---

### F-HLT-01. 프로젝트 위생 검사 (Hygiene)

**목적**: 프로젝트의 건강 상태를 종합 검사하고 개선 사항을 안내

**제공 기능**:
- 이슈 수 원형 게이지 (심각도별: Info/Warning/Error)
- 이슈 카테고리별 접이식 목록
- 확인된 검사 항목:
  - 미커밋 파일 존재 여부
  - (추가 항목은 바이너리에서 "HygieneCategory", "HygieneSeverity"로 확인)
- "Workspace is clean" 상태 표시 (이슈 0건일 때 녹색 체크)

---

### F-HLT-02. 의존성 검사 (Deps)

**목적**: npm 의존성의 건강 상태 및 관계 시각화

**제공 기능**:
- Health 탭: 의존성 버전 상태, 업데이트 가능 여부, npm audit 취약점
- Graph 탭: 의존성 관계 그래프 시각화

**데이터 소스**: 각 레포의 `package.json`, `npm audit`

---

### F-HLT-03. 워크트리 관리 (Worktrees)

**목적**: Git worktree 상태 모니터링

**제공 기능**:
- 워크트리 목록 (경로 + 브랜치 + 상태)
- 미커밋 변경이 있는 워크트리 경고
- 디렉토리가 삭제된 워크트리 감지 (prune 추천)

**데이터 소스**: `git worktree list` (각 레포)

---

### F-HLT-04. 환경변수 보안 감사 (Env)

**목적**: .env 파일의 존재와 보안 상태를 감사

**제공 기능**:
- 레포별 .env 파일 목록
- 변수명 표시 (값은 절대 표시하지 않음)
- 보안 경고 (예: .gitignore에 등록되지 않은 .env 파일)

**데이터 소스**: 각 레포의 `.env`, `.env.local`, `.env.*.local` 파일 스캔

---

### F-HLT-05. CLAUDE.md 린터 (Lint)

**목적**: CLAUDE.md 파일의 구조적 품질을 검사하고 개선 사항을 제안

**제공 정보**:
- 검사 파일 수, 이슈 수, 클린 파일 수
- 파일별 카드: 라인 수 + 파일 크기 + 이슈 수

**린트 규칙** (5개, 바이너리에서 추출 확인):

| 규칙 ID | 검사 내용 | 메시지 |
|---------|----------|--------|
| L01 | 파일 길이 초과 (56줄 이상) | "CLAUDE.md is getting long (N lines). Consider extracting details to separate files." |
| L02 | 필수 섹션 누락 | "Consider adding a ## Development section" / "Consider adding sections (## Quick Start, ## Tech Stack, etc.)" |
| L03 | 에이전트 책임 분리 | "Consider splitting responsibilities across multiple agents with narrower scope." |
| L04 | 스킬 부재 | "sessions but no skills. Skills automate repetitive workflows." |
| L05 | MEMORY.md 크기 | "MEMORY.md over 200 lines gets truncated in Claude's system prompt. Consider trimming." |

---

## 5. 설정 및 관리 기능

### F-SET-01. 초기 설정 (Setup)

**목적**: 워크스페이스 스캔 및 에이전트 감지

**제공 기능**:
- 워크스페이스 스캔 진행 상태 ("Scanning your workspace...")
- Claude Code / Codex 에이전트 감지 및 연결 상태
- 설정 없는 레포 목록 표시
- 에이전트별 설치/활성화 토글

---

### F-SET-02. 레포 관리 (Repos)

**목적**: 등록된 Git 레포지토리의 상태 모니터링

**제공 정보**:
- Active/Dirty/Unpushed/Total 통계
- 레포별 카드: 브랜치 + dirty 뱃지 + skills 수 + 최근 커밋 메시지 + 미니 activity 스파크라인

**리포 건강 모니터 (Repo Pulse)** — 별도 화면:
- Need Attention / Clean / Uncommitted 통계
- 주의 필요 레포 목록 (미커밋 파일 + Show Diff 버튼)

---

### F-SET-03. 앱 환경설정 (Settings)

Settings는 총 **8개 섹션**으로 구성 (스크롤 필요):

**1. Scan Directories** — 워크스페이스 관리
- 스캔 디렉토리 추가/삭제
- "Add Directory" / "Scan for New" 버튼
- "Scans up to 2 levels deep for git repos"
- "Rescan Workspace" / "Refresh all data" 버튼

**2. Readout Assistant** — AI 채팅 설정
- Anthropic (토글 ON/OFF) + API Key 입력 + 모델 선택 (Haiku/Sonnet/Opus 칩)
- OpenAI (접기/펼치기)
- Gemini (접기/펼치기)
- "Ask about repos, costs, sessions, and more. Keys are stored locally."

**3. General** — 일반 설정
- "Launch at login" 토글
- "Check for updates automatically" 토글
- "Check for Updates" / "Export Log" 버튼

**4. Agents** — 에이전트 엔진
- Claude Code (토글 ON/OFF, 경로 표시)
- Codex (Not installed)
- "Disabled agents won't appear in sessions, costs, or the dashboard."

**5. Remote Machines** — 원격 머신 모니터링
- "No remote machines configured" (초기 상태)
- "Add Machine" / "View This Mac" 버튼
- "Connect to remote machines running Claude Code or Codex via SSH."
- "Uses your ~/.ssh/authorized_keys and ssh-agent for authentication."

**6. Sidebar** — 사이드바 커스터마이즈
- "Show or hide sidebar items."
- "Customize Sidebar" / "Reset to Default" 버튼

**7. Cost Budget** — 비용 예산 알림
- Daily: $N / Monthly: $N 설정 필드
- **"Alert at N%"** 슬라이더 (기본 80%)
- "Set to $0 to disable."

**8. Footer** — 버전 정보
- "Readout v0.0.11 © 2026 Benji Taylor • Sponsor"
- "Readout is in beta. Expect bugs, visual inconsistencies, and rough edges."

### F-MON-06. 포트 모니터 (Ports)

**목적**: 로컬 개발 서버/프로세스의 열린 포트 감지

**제공 정보**:
- 총 포트 수, 프로세스 수, Node.js 프로세스 수
- 프로세스별 카드: 프로세스명 + PID + 실행 경로 + 포트번호 + 바인딩 주소

**데이터 소스**: `lsof -i -P -n` 또는 유사 시스템 명령

### F-MON-07. AI 어시스턴트 (Assistant)

**목적**: 워크스페이스 데이터를 자연어로 질의

**제공 기능**:
- API 키 설정 (Anthropic, OpenAI, Google)
- 모델 선택 (Haiku/Sonnet/Opus)
- 채팅 인터페이스
- 16종 임베드 위젯: 모든 화면의 데이터를 대화 내에서 인라인 표시
  (Agents, Costs, Deps, Env, Hygiene, Live, MCP, Memory, Ports, Repos, Sessions, Skills, Snapshots, Timeline, Worktrees)

---

## 6. 데이터 처리 로직

### 6.1 프로젝트 경로 인코딩

`~/.claude/projects/` 하위 디렉토리명은 절대 경로에서 `/` → `-` 치환.

```
/Users/hanumoka/projects/zm-agent-manager
→ -Users-hanumoka-projects-zm-agent-manager
```

### 6.2 세션 JSONL 레코드 타입 (7종)

| 타입 | 빈도(예시) | 설명 |
|------|-----------|------|
| `assistant` | 489 (50.8%) | Claude 응답 (text + thinking + tool_use + tool_result) |
| `user` | 379 (39.4%) | 사용자 메시지 |
| `file-history-snapshot` | 49 (5.1%) | 파일 변경 스냅샷 시점 |
| `system` | 33 (3.4%) | 턴 종료 메타 (소요시간, 메시지 수) |
| `queue-operation` | 10 (1.0%) | 백그라운드 태스크 큐 |
| `attachment` | 2 (0.2%) | 첨부 파일/붙여넣기 |
| `permission-mode` | 1 (0.1%) | 권한 모드 변경 |

### 6.3 assistant content block 타입 (3종)

| 타입 | 빈도(예시) | 설명 |
|------|-----------|------|
| `tool_use` | 353 (64%) | 도구 호출 (name + input) |
| `text` | 115 (21%) | 텍스트 응답 |
| `thinking` | 24 (4%) | 사고 과정 (thinking + signature) |

### 6.4 도구별 사용 빈도 (13종)

| 도구 | 빈도(예시) | 기능 |
|------|-----------|------|
| Read | 139 | 파일 읽기 |
| Bash | 87 | 셸 명령 실행 |
| Edit | 35 | 파일 부분 수정 |
| TaskUpdate | 21 | 태스크 상태 변경 |
| Write | 19 | 파일 생성/덮어쓰기 |
| WebSearch | 12 | 웹 검색 |
| TaskCreate | 11 | 태스크 생성 |
| Agent | 9 | 서브에이전트 생성 |
| ToolSearch | 6 | 도구 검색 |
| WebFetch | 5 | URL 콘텐츠 가져오기 |
| ExitPlanMode | 3 | Plan 모드 종료 |
| AskUserQuestion | 2 | 사용자 질문 |
| Glob | 1 | 파일 패턴 검색 |

### 6.5 parentUuid 체인 구조

메시지는 parentUuid로 연결된 체인(linked list)으로 구성됨:

```
(root) → user → attachment → attachment → assistant → assistant → assistant
                                                                      ↓
                                                                    user → assistant → ...
```

- root (parentUuid = null): permission-mode, file-history-snapshot
- 연속된 assistant: 하나의 턴에서 여러 도구 호출이 연속 실행된 경우
- isSidechain: true인 레코드는 메인 체인에서 분기된 사이드 체인

### 6.6 실시간 파일 감시

Readout은 `~/.claude/` 디렉토리를 파일 시스템 감시(FSEvents 또는 kqueue)로 모니터링:
- 새 세션 파일 생성 → Live에 세션 추가
- 기존 세션 파일에 새 줄 추가 → 이벤트 증분 파싱
- sessions/{pid}.json 생성/삭제 → Live 세션 추가/제거
- file-history/ 변경 → Diffs 갱신

---

## 7. zm-agent-manager 적용 판단

### 7.1 구현 대상 (Phase 1~3 매핑)

| 기능 ID | 기능명 | Phase | 우선순위 | PRD 매핑 |
|---------|--------|-------|---------|---------|
| F-MON-01 | Dashboard | 1 | ★★★★☆ | 메인 화면 |
| F-MON-02 | Live | 1 | ★★★★★ | F2 |
| F-MON-03 | Sessions | 1 | ★★★★★ | F1 |
| F-MON-04 | Tools | 1 | ★★★★☆ | F4 |
| F-HIS-01 | Session Replay | 2 | ★★★★★ | F5 |
| F-HIS-02 | Transcripts | 2 | ★★★★☆ | F5 확장 |
| F-HIS-03 | Diffs | 2 | ★★★★★ | F6 |
| F-MON-05 | Costs | 3 | ★★★☆☆ | F8 |
| F-CFG-01 | Skills | 3 | ★★★☆☆ | 뷰어 |
| F-CFG-02 | Agents | 3 | ★★★☆☆ | 뷰어 |
| F-CFG-03 | Memory | 3 | ★★★☆☆ | 뷰어 |
| F-CFG-04 | Hooks | 3 | ★★☆☆☆ | 뷰어 |
| F-HIS-04 | Timeline | 1 | ★★★☆☆ | F3 참고 |
| F-HLT-01 | Hygiene | 3 | ★★☆☆☆ | 부가 |
| F-HLT-05 | Lint | 3 | ★★☆☆☆ | 부가 |

### 7.2 구현 제외 (범위 밖)

| 기능 ID | 기능명 | 제외 이유 |
|---------|--------|----------|
| F-MON-07 | Assistant | 높은 구현 비용, API 키 필요 |
| F-MON-06 | Ports | 개발 서버 모니터링은 범위 밖 |
| F-HIS-05 | Work Graph | Git 관리 도구는 범위 밖 |
| F-HIS-06 | Snapshots | 읽기 전용 원칙 위반 (파일 복원) |
| F-SET-02 | Repos/Repo Pulse | Git 관리 도구는 범위 밖 |
| F-HLT-02 | Deps | npm 의존성은 범위 밖 |
| F-HLT-03 | Worktrees | Git worktree는 범위 밖 |
| F-HLT-04 | Env | .env 감사는 범위 밖 |

### 7.3 차별화 포인트

| 관점 | Readout | zm-agent-manager |
|------|---------|-------------------|
| 플랫폼 | macOS 전용 | **크로스 플랫폼** (Electron) |
| 데이터 접근 | 읽기+쓰기 | **읽기 전용** (핵심 원칙) |
| 범위 | 개발 환경 전체 (git, ports, deps) | **Claude Code 세션 특화** |
| 대상 OS | macOS Tahoe 26.0+ | **제한 없음** |
| 코드 | 비공개 | **오픈소스** 예정 |
