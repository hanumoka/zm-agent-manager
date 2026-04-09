# 개발 로드맵

PRD의 기능 정의를 실행 가능한 단계별 체크리스트로 분해한다.
각 Phase의 상세 항목은 개별 파일 참조.

## 전체 현황

| Phase | 제목 | 상태 | 상세 |
|-------|------|------|------|
| 1 | 세션 모니터링 (MVP) | **완료** (F1-F4) | [phase-1-mvp.md](./phase-1-mvp.md) |
| 2 | 세션 리플레이 | **진행중** (M3-M5 완료, M7 3/4) | [phase-2-replay.md](./phase-2-replay.md) |
| 3 | 분석 및 확장 | 대기 | [phase-3-analysis.md](./phase-3-analysis.md) |

## Phase 간 의존성

```
Phase 1 (MVP) ──→ Phase 2 (리플레이) ──→ Phase 3 (분석)
```

- Phase 1이 완료되어야 Phase 2 착수 가능 (JSONL 파싱, 타임라인 뷰 기반)
- Phase 2 완료 후 Phase 3 착수 (리플레이 인프라 활용)

> **참고**: Phase 1은 F1~F4(세션 모니터링 핵심)를 완료하였다. PRD-v2에서 Phase 1에 포함한 F11(태스크 보드)과 F1(대시보드 전체)은 Phase 2에서 처리한다.
