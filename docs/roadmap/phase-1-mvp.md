# Phase 1 — 세션 모니터링 (MVP)

**상태**: 대기
**목표**: Electron 앱에서 Claude Code 세션을 실시간으로 모니터링하는 기본 기능 완성

---

## UI 설계 참고 (Readout 앱 분석, 2026-04-08)

> Readout 바이너리 리버스 엔지니어링에서 확인된 패턴. Phase 1 설계 시 참고.

- **Dashboard vs Live 분리**: Readout은 요약 대시보드(ActivityChart, MiniStat)와 실시간 세션 뷰(LiveSessionsView)를 별도 탭으로 구성
- **Skeleton 로딩**: 실시간 데이터 로드 중 스켈레톤 UI 적용 (LiveWireSkeleton)
- **재사용 컴포넌트**: DataCard, AnimatedMiniStat 등 카드/통계 위젯을 대시보드와 상세 뷰에서 공유
- **사이드바 활성 표시**: SidebarSectionWithDot — 라이브 세션 활성 시 사이드바에 색상 점 표시
- **커스터마이즈 사이드바**: 사용자가 섹션 순서/표시 여부 설정 가능 (SidebarCustomizeSheet)

---

## Milestone 1: 프로젝트 스캐폴딩

- [ ] Electron + Vite + React + TypeScript 프로젝트 초기 설정
- [ ] electron-vite 설정 (`electron.vite.config.ts`)
- [ ] Tailwind CSS 설정
- [ ] ESLint + Prettier 설정
- [ ] 메인/렌더러/프리로드/공유 디렉토리 구조 생성

## Milestone 2: 세션 목록 (F1)

- [ ] `~/.claude/projects/` 디렉토리 스캔 서비스 (메인 프로세스)
- [ ] `history.jsonl` 파싱하여 세션 메타데이터 추출
- [ ] IPC 핸들러: 세션 목록 조회
- [ ] 세션 목록 UI 컴포넌트 (프로젝트별 그룹핑)
- [ ] 세션 상태 표시 (활성/완료)

## Milestone 3: JSONL 파싱 서비스 (F2 기반)

- [ ] 스트리밍 JSONL 라인 파서 구현
- [ ] 레코드 타입별 TypeScript 타입 정의 (`shared/types.ts`)
- [ ] 대용량 파일 처리 (100MB+) 성능 테스트
- [ ] 에러 핸들링 (잘못된 JSON 라인 스킵)

## Milestone 4: 실시간 파일 감시 (F2)

- [ ] chokidar 기반 JSONL 파일 감시 서비스
- [ ] 새 라인 추가 시 incremental 파싱
- [ ] IPC 채널로 실시간 이벤트 전달
- [ ] 감시 대상 세션 선택적 등록/해제

## Milestone 5: 메시지 타임라인 (F3)

- [ ] `user`/`assistant` 메시지 타임라인 UI
- [ ] `parentUuid` 기반 메시지 체인 시각화
- [ ] 메시지 내용 렌더링 (Markdown 지원)
- [ ] 가상화 리스트 적용 (대량 메시지 성능)

## Milestone 6: 도구 호출 추적 (F4)

- [ ] `assistant` 응답 내 `tool_use` 블록 파싱
- [ ] 도구별 아이콘/색상 시각화 (Read, Write, Bash, Grep 등)
- [ ] 도구 호출 결과 토글 표시
- [ ] 도구 사용 통계 요약 (세션 내)
