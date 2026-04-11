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

### ~~2. Session Handoff — 세션 간 컨텍스트 전달~~ → **구현 완료** (2026-04-11)
- 세션 종료 시 "브리프" 자동 생성 → 다음 세션이 이어받기 가능
- **참고**: Claude Code /transfer-context 스킬, claude-code-session-kit, handoff 플러그인
- **재사용**: history-parser.ts, session-store.ts, notification-settings-service.ts
- **핵심 과제**: 세션 간 관계 데이터 모델 설계 필요 (현재 history.jsonl에 관계 정보 없음)

### ~~3. Tool Chain 분석 — 도구 호출 시퀀스 패턴~~ → **구현 완료** (2026-04-11)
- 연속 호출 시퀀스(체인) 패턴 분석 (예: Read → Grep → Edit)
- **참고**: claude-code-reverse 시각화 도구, MindStudio 워크플로우 패턴 5가지
- **재사용**: ToolTracker.tsx의 extractToolCalls()/computeStats() 90% 재사용, Recharts 설치됨
- **핵심 과제**: N-gram 패턴 추출 + Sankey/Flow 차트만 신규 작성

### ~~4. CLAUDE.md Linter~~ → **구현 완료** (2026-04-11)
- CLAUDE.md 구조/길이/섹션 자동 분석 + 개선 제안
- **참고**: AgentLinter (5차원 점수), cclint (프로젝트 파일 린터), Anthropic 공식 200줄 이하 권장
- **재사용**: doc-scanner.ts의 countLines(), DocInventory.tsx
- **핵심 과제**: 마크다운 섹션 파싱 정규식 + 검증 규칙 정의

### 5. 알림 시스템
- 세션 시작/종료, 에이전트 stuck, 비용 임계치, 대규모 미커밋 변경, 좀비 프로세스
- Readout: notifySessionStarted, notifyAgentStuck, notifyCostThreshold, notifyZombieProcesses
- macOS Notification Center 또는 Electron Notification API 활용
- **적합 Phase**: Phase 1 이후 (공통 인프라)

### ~~6. 플래닝 모니터링 — ExitPlanMode 기반 플랜 추적 (2026-04-11)~~ → **구현 완료**
- `plan-scanner.ts` + Tasks 페이지 Plans 탭 + 마크다운 렌더링 (2026-04-11 구현)

### ~~7. 커스터마이즈 가능한 사이드바~~ → **구현 완료** (2026-04-11)
- 사용자가 사이드바 메뉴 순서/표시 여부 설정
- **참고**: electron-preferences 라이브러리
- **재사용**: notification-settings-service.ts 패턴 복사, App.tsx NAV_ITEMS 동적화
- **핵심 과제**: sidebar-settings-service.ts 신규 + 설정 UI (토글/드래그)
