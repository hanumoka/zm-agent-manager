# Git 워크플로우 정책

---

## 브랜치 전략

| 브랜치 | 용도 |
|--------|------|
| `main` | 안정 릴리즈 |
| `develop` | 개발 통합 브랜치 |
| `feature/{이름}` | 기능 개발 |
| `fix/{이름}` | 버그 수정 |
| `docs/{이름}` | 문서 작업 |

> **참고**: Phase 1 MVP(M1~M6)는 main 브랜치에서 직접 커밋되었다 ([known-issues.md](../troubleshooting/known-issues.md) 참조). Phase 2부터 이 정책을 적용한다.

## 커밋 메시지 규칙

```
<type>: <subject>

[body]

[Co-Authored-By: ...]
```

### type

| 타입 | 설명 |
|------|------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `refactor` | 리팩토링 |
| `style` | 코드 포맷 변경 (기능 변화 없음) |
| `test` | 테스트 추가/수정 |
| `chore` | 빌드, 도구 설정 등 |

### 규칙

- subject는 50자 이내, 마침표 없음
- body는 72자에서 줄 바꿈
- 한국어 또는 영어로 작성 (프로젝트 내 일관성 유지)

## PR 규칙

- PR 제목은 커밋 메시지 규칙과 동일
- 본문에 변경 요약 + 테스트 계획 포함
- self-review 후 머지
