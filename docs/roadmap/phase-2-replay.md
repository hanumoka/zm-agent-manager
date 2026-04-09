# Phase 2 — 세션 리플레이

**상태**: 진행중 (M4-M5 완료, M7 3/4 완료)
**선행 조건**: Phase 1 완료
**목표**: 과거 세션을 시간순으로 재생하고, 파일 변경 및 서브에이전트 활동을 시각화

---

## Milestone 1: 세션 리플레이 플레이어 (F5)

- [ ] 리플레이 플레이어 UI (재생/일시정지/스텝)
- [ ] 타임스탬프 기반 메시지 순차 표시
- [ ] 재생 속도 조절 (0.5x, 1x, 2x, 4x)
- [ ] 진행 바 + 타임라인 스크러빙
- [ ] 스텝 앞/뒤 이동

## Milestone 2: 파일 변경 하이라이트 (F6)

- [ ] `file-history-snapshot` 레코드 파싱
- [ ] 수정된 파일 목록 시각화
- [ ] 파일별 변경 전/후 diff 표시
- [ ] 리플레이 시점에 맞춘 파일 상태 표시

## Milestone 3: 서브에이전트 추적 (F7)

- [ ] `{sessionId}/subagents/` 디렉토리 스캔
- [ ] 부모-자식 세션 관계 트리 시각화
- [ ] 서브에이전트 세션 인라인 확장/축소
- [ ] 서브에이전트 활동 타임라인 통합 표시

## Milestone 4: 태스크 보드 (F11) — Phase 1에서 이관

- [x] JSONL TaskCreate/TaskUpdate 레코드 파싱 (task-scanner.ts)
- [x] 전체 세션 스캔으로 태스크 재구성 (todos/ 대신 JSONL 기반)
- [x] 칸반 보드 UI (Pending / In Progress / Completed) + 프로젝트 필터 + 삭제 토글
- [x] 태스크 상세 뷰 (상태 변경 이력 타임라인)

## Milestone 5: 대시보드 전체 구현 (F1) — Phase 1에서 이관

- [x] StatCard 컴포넌트 (프로젝트, 활성 세션, 오늘 세션, 총 메시지)
- [x] ActivityChart (14일 활동 바 차트, Recharts)
- [x] RecentSessions 리스트 (최근 10개, 타임라인 이동)
- [x] DashboardPage 플레이스홀더 교체

## Milestone 6: 문서 인벤토리 & diff (F12)

- [ ] 관리 문서 목록 스캔 (CLAUDE.md, MEMORY.md, .claude/rules/ 등)
- [ ] 문서별 메타데이터 (크기, 라인 수, 최종 수정일)
- [ ] file-history 기반 diff 뷰

## Milestone 7: 비용 실시간 추적 (F13)

- [x] JSONL usage 필드 파싱 (토큰 수, 모델명) — cost-scanner.ts
- [x] 모델별 비용 계산 (Opus/Sonnet/Haiku 가격 테이블)
- [x] 일별 비용 차트 (Recharts) + 대시보드 StatCard 연동
- [ ] 예산 설정 및 알림
