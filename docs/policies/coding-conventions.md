# 코딩 컨벤션 상세

CLAUDE.md의 코딩 컨벤션 요약을 보완하는 상세 규칙이다.

---

## 언어 및 타입

- 전체 코드 TypeScript strict mode
- `any` 사용 금지 — `unknown` + 타입 가드 사용
- 한국어 주석 허용

## 네이밍

| 대상 | 규칙 | 예시 |
|------|------|------|
| 변수 / 함수 | camelCase | `sessionList`, `parseJsonl` |
| React 컴포넌트 | PascalCase | `SessionListView` |
| 타입 / 인터페이스 | PascalCase | `SessionRecord`, `IpcChannel` |
| 파일 (일반) | kebab-case | `session-watcher.ts` |
| 파일 (React 컴포넌트) | PascalCase | `SessionListView.tsx` |
| 상수 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |
| Enum 멤버 | PascalCase | `RecordType.User` |

## import 순서

1. Node 내장 모듈 (`path`, `fs`)
2. 외부 패키지 (`electron`, `react`, `chokidar`)
3. 내부 모듈 (`@shared/types`)
4. 상대 경로 (`./components/SessionList`)

그룹 사이에 빈 줄 삽입.

## 포맷팅

- 세미콜론: 사용
- 따옴표: 싱글 쿼트 (`'`)
- 들여쓰기: 2 spaces
- 줄 바꿈: 최대 100자 권장
- trailing comma: 사용 (`es5`)

## React

- 함수형 컴포넌트 + hooks만 사용
- 컴포넌트 Props 타입은 `interface`로 정의
- 커스텀 훅은 `use` 접두사 (`useSessionList`)
- 이벤트 핸들러는 `handle` 접두사 (`handleClick`)

## 에러 처리

- 외부 입력/API 경계에서만 try-catch
- 내부 로직은 타입 시스템으로 안전성 보장
- 에러 로깅은 구조화된 객체로 (`console.error({ context, error })`)

## 용어 사전

UI 라벨과 코드 내부에서 사용하는 용어를 통일한다.

| 한국어 (UI 라벨) | 영어 (코드/변수명) | 비고 |
|-----------------|-------------------|------|
| 태스크 보드 | TaskBoard | 칸반 형태의 태스크 관리 뷰 |
| 세션 | Session | Claude Code 대화 세션 |
| 프로젝트 | Project | ~/.claude/projects/ 하위 디렉토리 단위 |
| 프롬프트 | Prompt | 사용자 입력 (history.jsonl 기준) |
| 플랜 | Plan | ExitPlanMode로 생성된 계획 문서 |
| 비용 | Cost | 토큰 사용량 기반 비용 추정 |
| 알림 | Notification | Electron Notification API 발송 |
| 문서 인벤토리 | DocInventory | 프로젝트 관리 문서 목록 뷰 |
| 스킬 | Skill | ~/.claude/skills/ 커스텀 스킬 |
| 에이전트 | Agent | ~/.claude/agents/ 커스텀 에이전트 |
