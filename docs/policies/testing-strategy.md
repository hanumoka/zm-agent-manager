# 테스트 전략

zm-agent-manager의 테스트 인프라와 전략을 정의한다.

## 테스트 계층

### 1. Unit Tests (Vitest)
- **위치**: `src/main/test/`, `src/renderer/src/test/`
- **대상**: 순수 함수, 파서, 유틸리티
- **현재**: 19개 테스트 (jsonl-parser 5, e2e-scan 13, App 1)
- **명령**: `npm run test`

### 2. E2E Tests (Playwright `_electron`) — 도입 예정
- **목적**: 사이드바 6개 페이지의 smoke test, 핵심 사용자 플로우 검증
- **프레임워크**: `@playwright/test` + `_electron` API (공식 지원)
- **위치**: `e2e/` (프로젝트 루트)
- **명령**: `npm run test:e2e`

#### 설정 핵심
- `npm run build` 후 `out/main/index.js` 진입점으로 실행 (dev 서버 사용 금지)
- `data-testid` 속성으로 안정적인 셀렉터 확보
- `CLAUDE_DATA_DIR` 환경변수로 fixture 데이터 주입 (읽기전용 원칙 준수)
- 다크 모드 + 애니메이션 비활성화로 시각 회귀 안정화

#### 우선순위
1. 사이드바 네비게이션 smoke test (6개 페이지 로드 확인)
2. 세션 선택 → 타임라인 → 5개 탭 전환
3. 검색 페이지 전체 플로우
4. 시각 회귀 (`toHaveScreenshot`)

### 3. 탐색 테스트 (MCP 서버) — 개발 단계 활용
- **목적**: AI 기반 인터랙티브 버그 탐색 (CI 대체 아님)
- **도입 완료**: `electron-test-mcp` v0.1.0 (`.mcp.json` 등록)
- **사용 시나리오**: Claude Code가 직접 메뉴 클릭 → 콘솔 에러/시각 이상 탐지

#### 사용 방법
1. Claude Code 재시작 (`.mcp.json` 변경 반영)
2. `npm run build`로 최신 빌드 생성
3. Claude Code에 요청: "electron-test-mcp으로 앱을 launch해서 사이드바 메뉴를 모두 클릭해보고 오류를 찾아줘"
4. MCP 도구 호출:
   - `launch({ appPath: "./out/main/index.js" })`
   - `screenshot()`, `click()`, `getText()` 등으로 탐색
   - `evaluateMain()`로 메인 프로세스 검사

#### 지원 도구
- **연결**: connect, disconnect, launch, close
- **상호작용**: click, fill, type, hover, press, drag, selectOption
- **검사**: screenshot, snapshot, getText, getAttribute, isVisible, count
- **고급**: wait, evaluate, evaluateMain

#### 주의: `launch` 실패 시 `connect` 우회 (2026-04-09 첫 탐색에서 확인)
- `npx -y electron-test-mcp`로 실행되는 임시 디렉토리에는 `electron` 패키지가 없어
  Playwright `_electron.launch`가 `executablePath not found` 오류로 실패할 수 있다.
- 우회: 프로젝트의 electron 바이너리로 직접 띄우고 CDP 포트로 connect.
  ```bash
  ./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron . --remote-debugging-port=9222
  ```
  → MCP 호출: `connect({ port: 9222 })`
- 이 방식은 앱 종료를 자동으로 해주지 않으므로, 탐색 종료 후 백그라운드 프로세스를 직접 정리한다.

#### 첫 탐색 결과 (2026-04-09)
- 사이드바 6개 + TimelinePage 5탭 + 검색 입력까지 콘솔 에러 0건
- 데이터 정합성/UX 이슈 4건 발견 → `docs/troubleshooting/known-issues.md`의
  "MCP 탐색 테스트 발견 이슈" 섹션 참조 (High 1, Low 3)

## CI 통합 (GitHub Actions)

### 런너
- macOS (네이티브)
- Linux (`xvfb-run` 가상 디스플레이)
- Windows (Phase 4 이후 검토)

### Electron 실행 플래그 (CI)
```
--no-sandbox
--disable-gpu
--disable-dev-shm-usage
```

### 테스트 실행
```yaml
- run: npm ci
- run: npm run build
- name: Run E2E (Linux)
  if: runner.os == 'Linux'
  run: xvfb-run --auto-servernum npm run test:e2e
- name: Run E2E (macOS)
  if: runner.os == 'macOS'
  run: npm run test:e2e
```

## electron-vite 특이사항

1. **빌드 후 테스트** — dev 서버는 hot reload로 인해 race condition 발생
2. **진입점**: `out/main/index.js` (`dist/`나 `src/`가 아님)
3. **환경변수 주입**: `electron.launch({ env: ... })`로 fixture 경로 제공
4. **Node 22 LTS** — `.nvmrc` 사용 (Tailwind v4 native binding)

## 시각 회귀 테스트

- **1차 권장**: Playwright `toHaveScreenshot()` (별도 인프라 불필요, repo에 baseline 커밋)
- **2차 검토**: Lost Pixel, Argos CI (cross-platform baseline 필요 시)

## 참고 자료

- [Playwright Electron API](https://playwright.dev/docs/api/class-electron)
- [Electron Automated Testing](https://www.electronjs.org/docs/latest/tutorial/automated-testing)
- [robertn702/playwright-mcp-electron](https://github.com/robertn702/playwright-mcp-electron)
- [fracalo/electron-playwright-mcp](https://github.com/fracalo/electron-playwright-mcp)
