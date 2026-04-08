# 문서 관리 운영 규칙

이 문서는 `docs/` 디렉토리 구조의 메타 규칙을 정의한다.

---

## 카테고리별 관리 규칙

### requirements/
- PRD 및 기능 요구사항 문서 보관
- 변경 시 변경 이력(날짜 + 요약)을 문서 하단에 기록

### policies/
- 프로젝트 정책 문서 (코딩 컨벤션, Git, 문서 관리)
- 정책 변경 시 팀 합의 필요

### sessions/
- `SESSION_LOG.md`: 최근 10개 세션만 유지
- 10개 초과 시 오래된 항목을 `archive/YYYY-MM.md`로 이동
- 각 세션 엔트리 포함 항목: 날짜, 목표, 작업 내용, 결과, 다음 할 일

### troubleshooting/
- `known-issues.md`: 카테고리별로 이슈 기록
- 해결된 이슈는 `[해결됨]` 태그 추가 (삭제하지 않음)
- 동일 이슈 재발 방지를 위해 해결법 상세히 기록

### temp/
- `.gitignore`로 추적 제외
- 세션 중 임시 메모, 스크래치 파일 용도
- 주기적으로 정리 (사용자 확인 후)

### roadmap/
- `ROADMAP.md`: 전체 Phase 현황 개요
- `phase-*.md`: 각 Phase의 상세 체크리스트
- 작업 완료 시 체크 (`- [x]`) 업데이트
- PRD와의 관계: PRD = "무엇을", roadmap = "어떤 순서로"

### ideas/
- `INBOX.md`: 구체화되지 않은 아이디어 수집
- 구체화된 아이디어는 `requirements/` 또는 `roadmap/`으로 승격
- 승격된 항목은 INBOX에서 제거

## 세션 프로토콜

### 세션 시작 시

매 세션 시작 시 순서대로 읽기:
1. `docs/sessions/SESSION_LOG.md` — 이전 작업 파악
2. `docs/roadmap/ROADMAP.md` — 현재 마일스톤 확인
3. 진행 중인 `phase-*.md` — 다음 할 일 확인

### 세션 종료 시

세션 마무리 시 수행:
1. `SESSION_LOG.md` 상단에 세션 요약 추가
2. roadmap 체크리스트 업데이트
3. 새 이슈 → `known-issues.md`에 기록
4. 새 아이디어 → `INBOX.md`에 기록
