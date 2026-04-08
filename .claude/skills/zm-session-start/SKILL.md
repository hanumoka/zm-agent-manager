---
name: zm-session-start
description: 세션 시작 프로토콜 실행 - SESSION_LOG, ROADMAP, 진행 중 phase 파일을 순서대로 읽고 현재 상태를 요약
disable-model-invocation: true
allowed-tools: Read Glob
---

# 세션 시작 프로토콜

CLAUDE.md에 정의된 세션 시작 프로토콜을 실행한다.

## 실행 순서

1. `docs/sessions/SESSION_LOG.md` 읽기 — 이전 작업 파악
2. `docs/roadmap/ROADMAP.md` 읽기 — 현재 마일스톤 확인
3. ROADMAP에서 **대기** 또는 **진행 중** 상태인 Phase의 상세 파일 읽기 (예: `docs/roadmap/phase-1-mvp.md`)
4. `docs/troubleshooting/known-issues.md` 읽기 — 알려진 이슈 확인

## 출력 형식

읽은 내용을 바탕으로 아래 형식으로 요약:

```
## 세션 시작 브리핑

### 이전 세션 요약
- (마지막 세션의 핵심 내용)

### 현재 진행 상태
- Phase: (현재 Phase 번호 및 제목)
- Milestone: (현재 진행 중인 Milestone)
- 완료율: (체크된 항목 / 전체 항목)

### 다음 할 일
1. (우선순위 순으로 나열)

### 알려진 이슈
- (있으면 표시, 없으면 "없음")
```
