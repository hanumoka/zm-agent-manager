# CLAUDE.md — zm-agent-manager

## 프로젝트 개요
Claude Code 세션 실시간 모니터링 및 리플레이 Electron 데스크톱 앱.
`~/.claude/` 디렉토리의 세션 데이터(JSONL)를 읽어 시각화한다.

## 기술 스택
- **Electron** — 메인 프레임워크 (메인/렌더러 프로세스)
- **TypeScript** — 전체 코드 (strict mode)
- **React 18** — 렌더러 UI
- **Vite** — 빌드 도구 (electron-vite)
- **chokidar** — 파일 감시
- **Tailwind CSS** — 스타일링
- **Zustand** — 상태 관리

## 프로젝트 구조
```
src/
├── main/          # Electron 메인 프로세스 (파일 감시, JSONL 파싱, IPC)
├── renderer/      # React UI (세션 목록, 타임라인, 도구 추적)
├── shared/        # 메인/렌더러 공유 타입 및 유틸
└── preload/       # preload 스크립트 (contextBridge)
```

## 코딩 컨벤션 (요약)
- TypeScript strict mode, `any` 금지, 한국어 주석 허용
- camelCase (변수/함수), PascalCase (컴포넌트/타입), kebab-case (일반 파일)
- 함수형 컴포넌트 + hooks, 세미콜론, 싱글 쿼트, 2 spaces
- 상세: [`docs/policies/coding-conventions.md`](docs/policies/coding-conventions.md)

## 핵심 원칙
- **읽기 전용**: `~/.claude/` 디렉토리 데이터를 절대 수정하지 않는다
- **성능 우선**: 대용량 JSONL 스트리밍 파싱, 가상화 리스트 사용
- **IPC 분리**: 파일 I/O는 메인 프로세스에서만 수행, 렌더러는 IPC로 데이터 수신

## 주요 데이터
- 세션 데이터: `~/.claude/projects/{encoded-path}/{sessionId}.jsonl`
- 글로벌 히스토리: `~/.claude/history.jsonl`
- 통계 캐시: `~/.claude/stats-cache.json`
- JSONL 레코드 타입: `file-history-snapshot`, `user`, `assistant`

## 개발 명령어
```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 빌드
npm run build

# 린트
npm run lint
```

## 문서 관리

프로젝트 문서는 `docs/` 하위 7개 카테고리로 관리한다.
전체 인덱스: [`docs/README.md`](docs/README.md)

| 폴더 | 용도 |
|------|------|
| `requirements/` | PRD 등 요구사항 |
| `policies/` | 코딩 컨벤션, Git, 문서 관리 규칙 |
| `sessions/` | 세션 작업 로그 |
| `troubleshooting/` | 알려진 이슈 + 해결법 |
| `temp/` | 임시문서 (.gitignore 처리) |
| `roadmap/` | 마일스톤 체크리스트 |
| `ideas/` | 미구체화 아이디어 |

### 세션 시작 프로토콜
매 세션 시작 시 순서대로 읽기:
1. `docs/sessions/SESSION_LOG.md` — 이전 작업 파악
2. `docs/roadmap/ROADMAP.md` — 현재 마일스톤 확인
3. 진행 중인 `docs/roadmap/phase-*.md` — 다음 할 일 확인

### 세션 종료 프로토콜
세션 마무리 시 수행:
1. `SESSION_LOG.md` 상단(구분선 아래)에 세션 요약 추가
2. roadmap 체크리스트 업데이트 (`- [x]`)
3. 새 이슈 발견 시 → `troubleshooting/known-issues.md`
4. 새 아이디어 발생 시 → `ideas/INBOX.md`

### 관리 규칙
- SESSION_LOG.md: 최근 10개 세션만 유지, 초과분은 `sessions/archive/YYYY-MM.md`로 이동
- INBOX.md: 구체화된 아이디어는 `requirements/` 또는 `roadmap/`으로 승격 후 제거
- 상세 규칙: [`docs/policies/doc-management.md`](docs/policies/doc-management.md)
