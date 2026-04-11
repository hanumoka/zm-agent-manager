# 개발 로드맵

PRD의 기능 정의를 실행 가능한 단계별 체크리스트로 분해한다.
각 Phase의 상세 항목은 개별 파일 참조.

## 전체 현황

| Phase | 제목 | 상태 | 상세 |
|-------|------|------|------|
| 1 | 세션 모니터링 (MVP) | **완료** (F1-F4) | [phase-1-mvp.md](./phase-1-mvp.md) |
| 2 | 세션 리플레이 | **완료** (M1-M7 전체) | [phase-2-replay.md](./phase-2-replay.md) |
| 3 | 분석 및 확장 | **완료** (M1-M7 전체) | [phase-3-analysis.md](./phase-3-analysis.md) |
| Q | 품질 — E2E 테스트 + 런타임 오류 수정 | **Q1-Q5 완료**, Q6 보류 | (테스트 인프라 + known-issues 전건 종결) |

## Phase 간 의존성

```
Phase 1 (MVP) ──→ Phase 2 (리플레이) ──→ Phase 3 (분석)
```

- Phase 1이 완료되어야 Phase 2 착수 가능 (JSONL 파싱, 타임라인 뷰 기반)
- Phase 2 완료 후 Phase 3 착수 (리플레이 인프라 활용)

> **참고**: Phase 1은 F1~F4(세션 모니터링 핵심)를 완료하였다. PRD-v2에서 Phase 1에 포함한 F11(태스크 보드)과 F1(대시보드 전체)은 Phase 2에서 처리한다.

## 품질 마일스톤 Q (Phase와 병행)

E2E 테스트 검토에서 발견된 10건 런타임 오류 수정 + 자동화 인프라 구축. 상세는 [`testing-strategy.md`](../policies/testing-strategy.md), 이슈는 [`known-issues.md`](../troubleshooting/known-issues.md) 참조.

- [x] Q1: High 이슈 2건 수정 (MessageTimeline, TimelinePage)
- [x] Q2: Medium 이슈 6건 수정 (ReplayPlayer, 5개 컴포넌트 unmount, deps, date 형식) — Low 1건 잔여
- [x] Q3: Playwright `_electron` E2E 인프라 구축
- [x] Q4: 사이드바 6개 페이지 smoke test 작성 (7개 테스트 통과)
- [x] Q5: Electron MCP 서버 도입 (electron-test-mcp v0.1.0)
- [ ] Q6: GitHub Actions CI 통합 (macOS + Linux) — 보류
