# docs/ — 프로젝트 문서 인덱스

zm-agent-manager 프로젝트 문서를 7개 카테고리로 관리한다.

| # | 카테고리 | 폴더 | 목적 | 핵심 문서 |
|---|----------|------|------|-----------|
| 1 | 요구사항 | [`requirements/`](./requirements/) | 프로젝트 기능 요구사항 정의 | [PRD.md](./requirements/PRD.md) |
| 2 | 정책 | [`policies/`](./policies/) | 코딩 컨벤션, Git 워크플로우, 문서 관리 규칙 | [coding-conventions.md](./policies/coding-conventions.md) |
| 3 | 세션 히스토리 | [`sessions/`](./sessions/) | Claude 세션 작업 로그 기록 | [SESSION_LOG.md](./sessions/SESSION_LOG.md) |
| 4 | 트러블슈팅 | [`troubleshooting/`](./troubleshooting/) | 알려진 이슈 + 해결법 | [known-issues.md](./troubleshooting/known-issues.md) |
| 5 | 임시문서 | [`temp/`](./temp/) | 일회성 작업 문서 (`.gitignore` 처리) | — |
| 6 | 로드맵 | [`roadmap/`](./roadmap/) | 마일스톤별 실행 체크리스트 | [ROADMAP.md](./roadmap/ROADMAP.md) |
| 7 | 아이디어 | [`ideas/`](./ideas/) | 미구체화 아이디어 수집 | [INBOX.md](./ideas/INBOX.md) |

## 문서 관리 원칙

- 모든 문서는 Markdown 형식으로 작성한다
- PRD = "무엇을" (고수준 기능 정의), roadmap = "어떤 순서로" (실행 체크리스트)
- 세션 로그는 최근 10개만 `SESSION_LOG.md`에 유지, 초과분은 `sessions/archive/`로 이동
- 임시문서(`temp/`)는 Git 추적하지 않는다
- 상세 규칙은 [`policies/doc-management.md`](./policies/doc-management.md) 참조
