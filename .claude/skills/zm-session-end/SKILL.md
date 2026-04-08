---
name: zm-session-end
description: 세션 종료 프로토콜 실행 - SESSION_LOG 추가, roadmap 업데이트, 이슈/아이디어 기록
disable-model-invocation: true
allowed-tools: Read Edit Write Glob
---

# 세션 종료 프로토콜

CLAUDE.md에 정의된 세션 종료 프로토콜을 실행한다.
사용자에게 이번 세션 작업 내용을 확인한 후 수행.

## 실행 순서

1. **SESSION_LOG.md 업데이트**
   - `docs/sessions/SESSION_LOG.md`의 구분선(`---`) 바로 아래에 이번 세션 요약 추가
   - 형식: `## YYYY-MM-DD | (세션 제목)`
   - 항목: 목표, 작업 내용, 결과, 다음 할 일

2. **Roadmap 체크리스트 업데이트**
   - 완료한 항목을 `- [x]`로 변경
   - 진행 중인 Phase 상세 파일도 함께 업데이트

3. **이슈 기록** (해당 시)
   - 새로 발견한 이슈를 `docs/troubleshooting/known-issues.md`에 추가

4. **아이디어 기록** (해당 시)
   - 새로운 아이디어를 `docs/ideas/INBOX.md`에 추가

5. **SESSION_LOG 아카이브 확인**
   - 세션이 10개 초과하면 오래된 항목을 `docs/sessions/archive/YYYY-MM.md`로 이동

## 완료 후 출력

```
## 세션 종료 완료

- SESSION_LOG: 업데이트됨
- Roadmap: (변경 사항 요약)
- 이슈: (추가됨 / 없음)
- 아이디어: (추가됨 / 없음)
- 아카이브: (이동됨 / 불필요)
```
