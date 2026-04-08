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
