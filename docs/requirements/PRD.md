# zm-agent-manager — Product Requirements Document (PRD)

## 1. 프로젝트 개요

### 1.1 프로젝트명
**zm-agent-manager** — Claude Code 세션 실시간 모니터링 및 리플레이 데스크톱 앱

### 1.2 목적
Claude Code CLI는 세션 데이터를 `~/.claude/` 디렉토리에 JSONL 형식으로 저장한다.
이 데이터를 실시간으로 모니터링하고, 과거 세션을 리플레이하며, 에이전트 활동을 시각화하는 Electron 기반 데스크톱 앱을 개발한다.

### 1.3 배경
- Claude Code는 터미널 기반 CLI로, 세션 진행 상황을 실시간으로 시각적으로 확인하기 어렵다
- 여러 프로젝트에서 동시에 Claude Code를 사용할 때 세션을 통합 관리할 도구가 없다
- Readout 앱의 세션 리플레이 개념을 참고하되, 실시간 모니터링과 분석 기능을 추가한다

### 1.4 대상 사용자
- Claude Code를 일상적으로 사용하는 개발자
- 여러 프로젝트에서 Claude Code 세션을 동시에 운영하는 사용자
- 에이전트 활동을 분석하고 최적화하려는 사용자

---

## 2. Claude Code 세션 데이터 구조

### 2.1 디렉토리 구조

```
~/.claude/
├── projects/                          # 프로젝트별 세션 데이터
│   └── {encoded-project-path}/        # 예: -Users-hanumoka-projects-zm-agent-manager
│       ├── {sessionId}.jsonl          # 세션 메시지 로그 (핵심 데이터)
│       ├── {sessionId}/
│       │   ├── subagents/             # 서브에이전트 세션 데이터
│       │   └── tool-results/          # 도구 실행 결과 저장
│       └── memory/                    # 프로젝트별 자동 메모리
├── history.jsonl                      # 글로벌 세션 히스토리 인덱스
├── stats-cache.json                   # 세션 통계 캐시 (토큰, 모델별 사용량)
├── todos/                             # 태스크 저장소 ({sessionId}-agent-{sessionId}.json)
├── debug/                             # 디버그 로그
├── plans/                             # 플랜 모드 저장소
├── session-env/                       # 세션 환경 정보
├── shell-snapshots/                   # 셸 스냅샷
├── cache/                             # 캐시 데이터
├── paste-cache/                       # 붙여넣기 캐시
└── plugins/                           # 플러그인 데이터
```

### 2.2 세션 JSONL 레코드 구조

세션 JSONL 파일(`{sessionId}.jsonl`)의 각 줄은 다음 타입 중 하나:

#### `file-history-snapshot` — 파일 변경 스냅샷
```json
{
  "type": "file-history-snapshot",
  "messageId": "uuid",
  "snapshot": {
    "messageId": "uuid",
    "trackedFileBackups": {},
    "timestamp": "2026-04-08T01:43:40.448Z"
  },
  "isSnapshotUpdate": false
}
```

#### `user` — 사용자 메시지
```json
{
  "type": "user",
  "uuid": "uuid",
  "parentUuid": "uuid | null",
  "isSidechain": false,
  "userType": "external",
  "cwd": "/path/to/project",
  "sessionId": "uuid",
  "version": "2.1.33",
  "gitBranch": "HEAD",
  "slug": "session-slug",
  "message": {
    "role": "user",
    "content": "사용자 입력 텍스트 또는 content 배열"
  }
}
```

#### `assistant` — 에이전트 응답
```json
{
  "type": "assistant",
  "uuid": "uuid",
  "parentUuid": "uuid",
  "sessionId": "uuid",
  "message": {
    "role": "assistant",
    "content": ["텍스트 블록 또는 tool_use 블록"]
  }
}
```

### 2.3 history.jsonl 구조 (글로벌 인덱스)
```json
{
  "display": "사용자 첫 메시지 미리보기",
  "pastedContents": {},
  "timestamp": 1770341705166,
  "project": "/absolute/path/to/project",
  "sessionId": "uuid"
}
```

### 2.4 stats-cache.json 구조
```json
{
  "version": 2,
  "lastComputedDate": "2026-04-07",
  "dailyActivity": [
    { "date": "2026-02-06", "messageCount": 101, "sessionCount": 1, "toolCallCount": 22 }
  ],
  "dailyModelTokens": [
    { "date": "2026-02-06", "tokensByModel": { "claude-opus-4-6": 1565 } }
  ],
  "modelUsage": {
    "claude-opus-4-6": {
      "inputTokens": 76,
      "outputTokens": 1489,
      "cacheReadInputTokens": 1405156,
      "cacheCreationInputTokens": 104308,
      "costUSD": 0
    }
  }
}
```

---

## 3. 핵심 기능 정의

### Phase 1 — 세션 모니터링 (MVP)

| # | 기능 | 설명 |
|---|------|------|
| F1 | **세션 목록 뷰** | `~/.claude/projects/` 하위 모든 프로젝트/세션 목록 표시. 프로젝트 경로, 세션 ID, 마지막 활동 시간, 상태(활성/완료) 표시 |
| F2 | **실시간 세션 스트리밍** | 활성 세션의 JSONL 파일을 `chokidar`로 감시하여 새 라인이 추가될 때 실시간으로 UI에 반영 |
| F3 | **메시지 타임라인** | `user`/`assistant` 메시지를 시간순 타임라인으로 렌더링. `parentUuid` 기반 메시지 체인 표시 |
| F4 | **도구 호출 추적** | `assistant` 응답 내 `tool_use` 블록을 파싱하여 사용된 도구(Read, Write, Bash, Grep 등) 시각화 |

### Phase 2 — 세션 리플레이

| # | 기능 | 설명 |
|---|------|------|
| F5 | **세션 리플레이** | 과거 세션을 타임스탬프 기반으로 재생. 재생 속도 조절(0.5x~4x), 스텝 앞/뒤 이동 지원 |
| F6 | **파일 변경 하이라이트** | `file-history-snapshot` 레코드 기반으로 수정된 파일을 시각적으로 표시 |
| F7 | **서브에이전트 추적** | `{sessionId}/subagents/` 디렉토리의 서브에이전트 세션을 부모 세션과 함께 시각화 |

### Phase 3 — 분석 및 확장

| # | 기능 | 설명 |
|---|------|------|
| F8 | **세션 통계** | `stats-cache.json` + JSONL 파싱으로 토큰 사용량, 도구 호출 빈도, 세션 시간, 비용 추정 통계 대시보드 |
| F9 | **검색 기능** | 세션 내 메시지 텍스트, 도구 호출 내용, 파일 경로 등 전문 검색 |
| F10 | **세션 비교** | 두 세션의 메시지/도구 호출 패턴을 side-by-side diff로 비교 |

---

## 4. 기술 스택

| 영역 | 기술 | 버전/비고 |
|------|------|-----------|
| 프레임워크 | **Electron** | 메인/렌더러 프로세스 구조 |
| 언어 | **TypeScript** | 전체 코드 (strict mode) |
| UI 라이브러리 | **React 18** | 렌더러 프로세스 UI |
| 빌드 도구 | **Vite** | electron-vite 사용 |
| 파일 감시 | **chokidar** | `fs.watch`보다 안정적인 파일 감시 |
| 스타일링 | **Tailwind CSS** | 유틸리티 퍼스트 CSS |
| 상태 관리 | **Zustand** | 경량 상태 관리 (추후 결정 가능) |
| JSONL 파싱 | 자체 구현 | 스트리밍 라인 파서 |

---

## 5. 아키텍처 개요

### 5.1 Electron 프로세스 구조

```
┌─────────────────────────────────────────────────┐
│                  Main Process                    │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │   Window     │  │   Session Watcher        │  │
│  │   Manager    │  │   (chokidar)             │  │
│  └─────────────┘  └──────────────────────────┘  │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │   IPC        │  │   JSONL Parser           │  │
│  │   Handlers   │  │   Service                │  │
│  └─────────────┘  └──────────────────────────┘  │
│                       │ IPC                      │
├───────────────────────┼─────────────────────────┤
│                       ▼                          │
│                Renderer Process                   │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Session   │  │ Timeline │  │ Tool Call     │  │
│  │ List      │  │ View     │  │ Tracker       │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Replay   │  │ Stats    │  │ Search        │  │
│  │ Player   │  │ Dashboard│  │               │  │
│  └──────────┘  └──────────┘  └───────────────┘  │
└─────────────────────────────────────────────────┘
```

### 5.2 데이터 흐름

1. **Main Process**: `chokidar`로 `~/.claude/projects/` 디렉토리 감시
2. JSONL 파일 변경 감지 시 새 라인을 파싱
3. IPC 채널을 통해 파싱된 레코드를 Renderer Process로 전달
4. **Renderer Process**: React 컴포넌트에서 메시지 타임라인/도구 호출 등 렌더링

### 5.3 디렉토리 구조 (프로젝트)

```
zm-agent-manager/
├── docs/
│   └── PRD.md
├── src/
│   ├── main/                  # Electron 메인 프로세스
│   │   ├── index.ts           # 앱 엔트리
│   │   ├── watcher.ts         # chokidar 파일 감시
│   │   ├── parser.ts          # JSONL 파싱 서비스
│   │   └── ipc.ts             # IPC 핸들러
│   ├── renderer/              # Electron 렌더러 프로세스
│   │   ├── App.tsx            # React 앱 루트
│   │   ├── components/        # UI 컴포넌트
│   │   ├── hooks/             # React 커스텀 훅
│   │   ├── stores/            # 상태 관리
│   │   └── types/             # TypeScript 타입 정의
│   ├── shared/                # 메인/렌더러 공유 타입/유틸
│   │   └── types.ts           # 세션 레코드 타입 정의
│   └── preload/               # preload 스크립트
│       └── index.ts
├── electron.vite.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── CLAUDE.md
└── README.md
```

---

## 6. 개발 로드맵

### Phase 1 — MVP (세션 모니터링)
1. Electron + Vite + React + TypeScript 프로젝트 스캐폴딩
2. `~/.claude/` 디렉토리 스캔 및 세션 목록 표시
3. JSONL 파싱 서비스 구현
4. chokidar 기반 실시간 파일 감시
5. 메시지 타임라인 뷰 구현
6. 도구 호출 시각화

### Phase 2 — 세션 리플레이
7. 세션 리플레이 플레이어 구현
8. 파일 변경 하이라이트
9. 서브에이전트 트리 시각화

### Phase 3 — 분석 및 확장
10. 세션 통계 대시보드
11. 전문 검색 기능
12. 세션 비교 뷰

---

## 7. 비기능 요구사항

- **성능**: 대용량 JSONL 파일(100MB+) 처리 시 UI 블로킹 없음 (스트리밍 파싱)
- **보안**: `~/.claude/` 디렉토리는 읽기 전용으로만 접근. 세션 데이터를 수정하지 않음
- **호환성**: macOS 우선 지원 (추후 Windows/Linux)
- **메모리**: 대량의 세션 데이터를 로드할 때 가상화 리스트(virtualized list) 사용

---

## 8. 제약 사항 및 리스크

| 항목 | 설명 |
|------|------|
| Claude Code 버전 호환 | JSONL 스키마가 Claude Code 버전에 따라 변경될 수 있음 — 버전 필드(`version`) 기반 분기 처리 필요 |
| 파일 감시 성능 | 프로젝트가 많을 경우 chokidar 감시 대상이 증가 — 활성 세션만 선택적 감시로 최적화 |
| 데이터 크기 | 장기 사용 시 JSONL 파일이 수백 MB까지 커질 수 있음 — 스트리밍 파싱 + 페이지네이션 필수 |
| 읽기 전용 원칙 | `~/.claude/` 데이터를 절대 수정하지 않아야 함 — 앱 자체 데이터는 별도 디렉토리에 저장 |
