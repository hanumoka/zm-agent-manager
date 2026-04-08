---
name: zm-phase-status
description: 현재 로드맵 Phase 진행 상태를 체크리스트 기반으로 시각화
disable-model-invocation: true
allowed-tools: Read Glob
---

# Phase 진행 상태 확인

현재 로드맵의 진행 상태를 확인하고 시각적으로 표시한다.

## 실행 순서

1. `docs/roadmap/ROADMAP.md` 읽기
2. 각 Phase 상세 파일 (`phase-1-mvp.md`, `phase-2-replay.md`, `phase-3-analysis.md`) 읽기
3. 각 Milestone별 체크리스트 완료율 계산

## 출력 형식

```
## 로드맵 진행 현황

### Phase 1: 세션 모니터링 (MVP) — [상태]
  M1. 프로젝트 스캐폴딩     ████░░░░░░  2/5
  M2. 세션 목록              ░░░░░░░░░░  0/5
  M3. JSONL 파싱 서비스      ░░░░░░░░░░  0/4
  M4. 실시간 파일 감시       ░░░░░░░░░░  0/4
  M5. 메시지 타임라인        ░░░░░░░░░░  0/4
  M6. 도구 호출 추적         ░░░░░░░░░░  0/4
  전체: 2/26 (7.7%)

### Phase 2: 세션 리플레이 — 대기
### Phase 3: 분석 및 확장 — 대기
```

프로그레스 바는 10칸 기준으로 비율에 맞게 표시.
