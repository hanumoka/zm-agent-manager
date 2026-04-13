---
name: zm-agent-manager
displayName: zm-agent-manager 개발 워크플로우
stages: 요구사항검증 설계 구현 검증 문서갱신 배포
---

# zm-agent-manager 개발 워크플로우

본 프로젝트의 공식 작업 파이프라인. 모든 태스크는 아래 6단계 중 하나에 속해야 한다.

## 1. 요구사항검증
새 기능 요청/버그 리포트가 도착하면 `.claude/rules/requirement-validation.md` 프로토콜로 검증.
- 모호성 검사 (범위, 기준, 조건)
- 정책 충돌 검사 (PRD, 코딩 컨벤션, 핵심 원칙)
- 로드맵 정합성 (현재 Phase 범위 이탈 여부)
- 기술 타당성 (Electron 아키텍처, 성능)

## 2. 설계
Plan 모드를 사용하거나 `docs/ideas/INBOX.md` 또는 `docs/requirements/PRD.md`에서 구체화.
- 블래스트 반경 최소화 우선
- 재사용 가능한 기존 함수/컴포넌트 식별
- 단위 테스트 가능한 순수 함수 추출

## 3. 구현
코딩 컨벤션 준수 (`docs/policies/coding-conventions.md`).
- TypeScript strict, 한국어 주석 허용
- IPC 분리: 파일 I/O는 메인 프로세스만
- 렌더러 컴포넌트는 `data-testid` 부착

## 4. 검증
각 단계 사이 `npm run typecheck` 유지. 최종 배치:
- `npm run typecheck`
- `npm run test`
- `npm run lint` (0 errors)
- `npm run build`
- (선택) `npm run test:e2e` — Playwright sidebar-nav

## 5. 문서갱신
`.claude/rules/doc-auto-update.md` 트리거 준수.
- roadmap 항목 완료 → phase 체크리스트
- 이슈 → `docs/troubleshooting/known-issues.md`
- 아이디어 → `docs/ideas/INBOX.md`
- 정책 변경 → 해당 정책 파일

## 6. 배포
Conventional Commits 형식으로 커밋 + 버전 태그 + GitHub Actions.
- `v{version}` 태그 푸시 → 3-platform 자동 빌드
- Draft Release 확인 후 publish
- 설치 + CDP 검증 (가능한 경우)

