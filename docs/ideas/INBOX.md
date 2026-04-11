# 아이디어 수집함 (INBOX)

구체화되지 않은 아이디어를 자유롭게 기록한다.
충분히 구체화된 항목은 `requirements/` 또는 `roadmap/`으로 승격한 뒤 여기서 제거한다.

---

## Readout 앱 분석 기반 아이디어 (2026-04-08)

> Readout (readout.org) macOS 앱 바이너리 리버스 엔지니어링 + 웹 리서치 결과에서 도출.
> zm-agent-manager에 적용 가치가 높은 기능 후보.

### 1. 비용 추적 + 예산 알림
- `stats-cache.json`에 이미 `costUSD` 필드 존재 → 낮은 구현 비용
- 모델별 비용 분석, 기간 비교, 예산 임계치 알림
- Readout 컴포넌트: CostTrackerView, BudgetBar, costAlertThreshold
- **적합 Phase**: Phase 3 (F8: 세션 통계)

### 2. Session Handoff — 세션 간 컨텍스트 전달
- 세션 종료 시 "브리프" 자동 생성 → 다음 세션이 이어받기 가능
- Readout 컴포넌트: HandoffSection, HandoffBrief
- CLAUDE.md 세션 프로토콜과 시너지 가능
- **적합 Phase**: Phase 2 또는 Phase 3

### 3. Tool Chain 분석 — 도구 호출 시퀀스 패턴
- 단순 도구별 카운트를 넘어, 연속 호출 시퀀스(체인) 패턴 분석
- 예: Read → Grep → Edit 체인이 가장 흔한 패턴
- Readout 컴포넌트: toolChains, toolAnalytics, toolErrors
- **적합 Phase**: Phase 3 (F4 확장)

### 4. CLAUDE.md Linter
- CLAUDE.md 파일의 구조, 길이, 섹션 구성을 자동 분석
- 개선 제안: "섹션 추가 권장", "길이 경고", "분리 권장" 등
- Readout 컴포넌트: ClaudeMdLinterView
- **적합 Phase**: Phase 3 (분석 기능)

### 5. 알림 시스템
- 세션 시작/종료, 에이전트 stuck, 비용 임계치, 대규모 미커밋 변경, 좀비 프로세스
- Readout: notifySessionStarted, notifyAgentStuck, notifyCostThreshold, notifyZombieProcesses
- macOS Notification Center 또는 Electron Notification API 활용
- **적합 Phase**: Phase 1 이후 (공통 인프라)

### ~~6. 플래닝 모니터링 — ExitPlanMode 기반 플랜 추적 (2026-04-11)~~ → **구현 완료**
- `plan-scanner.ts` + Tasks 페이지 Plans 탭 + 마크다운 렌더링 (2026-04-11 구현)

### 7. 커스터마이즈 가능한 사이드바
- 사용자가 사이드바 섹션 순서/표시 여부를 설정
- 기능 확장 시 UI 과부하 방지
- Readout 컴포넌트: SidebarCustomizeSheet, SidebarSectionWithDot (활성 표시)
- **적합 Phase**: Phase 1 설계 시 기반 마련
