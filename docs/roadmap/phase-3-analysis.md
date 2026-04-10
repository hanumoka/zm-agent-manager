# Phase 3 — 분석 및 확장

**상태**: 진행중 (M2 검색 일부 완료)
**선행 조건**: Phase 2 완료
**목표**: 세션 데이터를 기반으로 통계, 검색, 비교 기능 제공

---

## Milestone 1: 세션 통계 대시보드 (F8) — **완료**

- [x] `stats-cache.json` 의존 없이 JSONL 직접 재집계 (cost-scanner와 일관)
- [x] JSONL 기반 세션별 통계 계산 (메시지/도구/토큰/비용) — `stats-service.ts`
- [x] 일별/주별 활동 차트 — `DailyActivityChart` (최근 30일, Recharts)
- [x] 모델별 토큰 사용량 시각화 — `ModelUsageBars`
- [x] 비용 추정 표시 — `ProjectTable` (프로젝트별 cost) + StatCard
- [x] **보너스**: When You Work 7×24 히트맵 + By Project 테이블 (F8 세부 요구)
- [x] 사이드바 "Stats" 메뉴 추가 (6 → 7), Playwright E2E 7 → 8, 단위 테스트 8개 신규
- [x] 완료: 2026-04-10 (커밋 9f79913 + 7c03d0c + 66922e3)

## Milestone 2: 검색 기능 (F9) — **완료**

- [x] 세션 내 메시지 텍스트 전문 검색 — search-service.ts (전체 세션)
- [x] 도구 호출 내용 검색 (파일 경로, 명령어 등) — tool_use input JSON 검색
- [x] 검색 결과 하이라이트 + 해당 위치 이동 (HighlightedText, 클릭 시 타임라인 이동)
- [x] 프로젝트/기간 필터링 — `SearchFilters` 타입 + SearchPage 드롭다운/날짜 입력 (2026-04-09)

## Milestone 3: 세션 비교 (F10)

- [ ] 두 세션 선택 UI
- [ ] Side-by-side 메시지 비교 뷰
- [ ] 도구 호출 패턴 비교
- [ ] 세션 간 통계 비교 차트

## Milestone 4: 태스크 워크플로우 (F14)

- [ ] 워크플로우 정의 스키마 구현
- [ ] 태스크 메타데이터 관리 (심각도/유형)
- [ ] 사용자 정의 단계 UI

## Milestone 5: 문서 중요도 분류 & 알림 (F15)

- [ ] 경로 기반 중요도 규칙 정의
- [ ] 문서 변경 감지 및 알림
- [ ] 리뷰 상태 관리

## Milestone 6: 알림 시스템 (F16)

- [ ] Electron Notification API 연동
- [ ] 알림 트리거 구현 (세션 시작/종료, 비용, 태스크)
- [ ] 알림 설정 UI
- [ ] 알림 이력 저장 (~/.zm-agent-manager/notifications/)

## Milestone 7: 스킬/에이전트/메모리/MCP 모니터 (F17-F20)

- [ ] 스킬 목록 스캔 및 YAML frontmatter 파싱 (F17)
- [ ] 에이전트 목록 및 사용 이력 표시 (F18)
- [ ] 메모리 뷰어 — MEMORY.md 내용 표시 + 검색 (F19)
- [ ] 훅/규칙/MCP 모니터 — 설정 현황 표시 (F20)
