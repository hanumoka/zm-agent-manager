# Phase 2 — 세션 리플레이

**상태**: 진행중 (5/7 완료 — M1/M3/M4/M5/M7 ✓, M2/M6 부분완료: file-history diff 미구현)

**품질 강화** (2026-04-10 audit-3-followup):
- ✅ 회귀 테스트 26건 추가 (vitest 45 → 71): cost-scanner / task-scanner / session-store
- ✅ Phase 2 컴포넌트 성능 최적화: SubagentCard / TaskCard / KanbanLane / DocRow에 `React.memo`
- ⏳ 리스트 가상화는 데이터 100+ 시 조건부 트리거 (현재 데이터 규모에서 ROI 마이너스, known-issues 등록)
**선행 조건**: Phase 1 완료
**목표**: 과거 세션을 시간순으로 재생하고, 파일 변경 및 서브에이전트 활동을 시각화

---

## Milestone 1: 세션 리플레이 플레이어 (F5)

- [x] 리플레이 플레이어 UI (재생/일시정지/스텝) — ReplayPlayer.tsx
- [x] 타임스탬프 기반 메시지 순차 표시 (playheadIndex로 제어)
- [x] 재생 속도 조절 (0.5x, 1x, 2x, 4x)
- [x] 진행 바 + 타임라인 스크러빙 (클릭으로 위치 이동)
- [x] 스텝 앞/뒤 이동 + 처음/끝 이동

## Milestone 2: 파일 변경 하이라이트 (F6)

- [x] Write/Edit/Read tool_use에서 파일 변경 추출 — FileChangePanel.tsx
- [x] 수정된 파일 목록 시각화 (파일별 Write/Edit/Read 횟수)
- [ ] 파일별 변경 전/후 diff 표시 (file-history 연동 필요)
- [ ] 리플레이 시점에 맞춘 파일 상태 표시

## Milestone 3: 서브에이전트 추적 (F7)

- [x] `{sessionId}/subagents/` 디렉토리 스캔 + .meta.json 파싱 (subagent-scanner.ts)
- [x] 부모-자식 세션 관계 시각화 (SubagentPanel, 타입/설명/통계 표시)
- [x] 서브에이전트 세션 인라인 확장/축소 (MessageTimeline 재사용)
- [x] 서브에이전트 활동 타임라인 통합 표시 (TimelinePage Agents 탭)

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

- [x] 관리 문서 목록 스캔 (CLAUDE.md, MEMORY.md, .claude/rules/, skills/, agents/, docs/)
- [x] 문서별 메타데이터 (크기, 라인 수, 최종 수정일) + 카테고리별 그룹핑
- [ ] file-history 기반 diff 뷰

## Milestone 7: 비용 실시간 추적 (F13) — **완료**

- [x] JSONL usage 필드 파싱 (토큰 수, 모델명) — cost-scanner.ts
- [x] 모델별 비용 계산 (Opus/Sonnet/Haiku 가격 테이블)
- [x] 일별 비용 차트 (Recharts) + 대시보드 StatCard 연동
- [x] 예산 설정 및 알림 — `budget-service.ts` + Electron Notification + Costs 페이지 BudgetCard (2026-04-09)
