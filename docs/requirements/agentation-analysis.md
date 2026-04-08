# Agentation 기능 분석서

> 분석일: 2026-04-08
> 대상: Agentation v2.0 (npm 패키지 + MCP 서버)
> 개발자: Benji Taylor (Readout과 동일 개발자)
> 소스: [github.com/benjitaylor/agentation](https://github.com/benjitaylor/agentation) (오픈소스, PolyForm Shield 1.0.0)
> 분석 방법: GitHub README/CLAUDE.md + Product Hunt + 공식 문서(agentation.com) + 블로그 리서치

---

## 1. 제품 개요

**Agentation**은 웹 페이지의 UI 요소를 시각적으로 어노테이션하고, 그 결과를 AI 코딩 에이전트(Claude Code, Codex 등)에게 구조화된 컨텍스트로 전달하는 도구이다.

**핵심 가치**: "UI 피드백을 말로 설명하는 대신, 클릭하면 에이전트가 정확한 코드 위치를 찾는다"

**Readout과의 관계**:
- Readout: 에이전트가 **무엇을 했는지** 분석 (세션 리플레이/모니터링)
- Agentation: 에이전트가 **무엇을 해야 하는지** 전달 (시각적 피드백)
- 동일 개발자(Benji Taylor)가 만든 **상호 보완 도구**

**규모**:
- GitHub: 3,300+ stars, 263 forks
- npm: 170,000+ 다운로드
- Product Hunt: #1 Daily (2026-03-27), 435 points, 611 followers

---

## 2. 아키텍처

```
┌─────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   브라우저 (React)    │     │   Agentation MCP     │     │   AI 에이전트     │
│                     │     │   서버               │     │   (Claude Code)   │
│  ┌───────────────┐  │     │                      │     │                  │
│  │ Agentation    │──HTTP──│  HTTP 서버 (:4747)    │     │                  │
│  │ 툴바 컴포넌트   │  │     │  + SSE (실시간)       │     │                  │
│  └───────────────┘  │     │                      │     │                  │
│                     │     │  MCP 서버 (stdio)  ──MCP──│  9개 도구 접근    │
│                     │     │                      │     │                  │
│                     │     │  공유 데이터 스토어     │     │                  │
└─────────────────────┘     └──────────────────────┘     └──────────────────┘
```

- **브라우저 툴바**: React 컴포넌트로 웹 앱에 임베드
- **MCP 서버**: 듀얼 서버 (HTTP + MCP stdio), 공유 데이터 스토어
- **AI 에이전트**: MCP 프로토콜로 9개 도구에 접근

---

## 3. 설치 및 설정

### 3.1 npm 패키지 (브라우저 툴바)

```bash
npm install agentation -D
```

```tsx
import { Agentation } from 'agentation';

function App() {
  return (
    <>
      <YourApp />
      <Agentation />   {/* 우하단에 플로팅 툴바 표시 */}
    </>
  );
}
```

- React 18+ 필수
- 데스크톱 브라우저 전용 (모바일 미지원)
- 런타임 의존성 없음 (순수 CSS 애니메이션)

### 3.2 MCP 서버 (에이전트 연동)

```bash
npm install agentation-mcp

# 모든 에이전트에 자동 등록
npx add-mcp "npx -y agentation-mcp server"

# Claude Code 전용 설정 마법사
npx agentation-mcp init

# 연결 상태 진단
npx agentation-mcp doctor
```

**서버 옵션**:
| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `--port` | 4747 | HTTP 서버 포트 |
| `--mcp-only` | false | MCP만 실행 (HTTP 스킵) |
| `--http-url` | - | 외부 HTTP 서버 URL |

---

## 4. 핵심 기능 상세

### F-AGT-01. 요소 선택 (Element Selection)

**목적**: 웹 페이지의 DOM 요소를 클릭하여 CSS 셀렉터 자동 추출

**동작**:
1. 툴바에서 선택 모드 활성화
2. 페이지의 아무 요소 클릭
3. 해당 요소의 CSS 셀렉터, 클래스명, 위치 좌표 자동 캡처
4. 메모 추가 가능

**출력 예시**:
```markdown
## Element Feedback
- Selector: `.sidebar > button.primary`
- Position: (120, 340)
- Note: "이 버튼 색상을 파란색에서 초록색으로 변경"
```

**가치**: "파란 버튼 수정해줘" 대신 `.sidebar > button.primary` 같은 정확한 셀렉터 제공

---

### F-AGT-02. 텍스트 선택 (Text Annotation)

**목적**: 특정 텍스트 콘텐츠를 하이라이트하여 어노테이션

**동작**: 텍스트 드래그 선택 → 선택 범위 + 텍스트 내용 + 컨텍스트 캡처

---

### F-AGT-03. 다중 요소 선택 (Multi-Element Selection)

**목적**: 여러 요소를 동시에 선택하여 일괄 피드백

**동작**: 드래그로 영역 선택 → 영역 내 모든 요소 캡처

---

### F-AGT-04. 영역 표시 (Region Annotation)

**목적**: 빈 공간 포함 아무 영역에 사각형 표시하여 레이아웃 피드백

**동작**: 드래그로 사각형 그리기 → 좌표 + 크기 캡처

---

### F-AGT-05. 애니메이션 프리징 (Animation Freezing)

**목적**: CSS/JS 애니메이션, 비디오를 일시정지하여 특정 상태를 캡처

**동작**:
- CSS 애니메이션 일시정지
- JavaScript 애니메이션 정지
- 비디오 프레임 고정
- CSS 타이밍 커브 및 키프레임 위치 분석

**가치**: 애니메이션 중간 상태에서 UI 문제를 정확히 지적 가능

---

### F-AGT-06. 구조화된 출력 (Markdown Export)

**목적**: 어노테이션 결과를 AI 에이전트가 파싱할 수 있는 마크다운으로 내보내기

**출력 상세도 4단계**:

| 레벨 | 이름 | 포함 내용 |
|------|------|----------|
| 1 | **Compact** | 셀렉터 + 메모만 |
| 2 | **Standard** | + 위치, 크기, 기본 스타일 |
| 3 | **Detailed** | + React 컴포넌트 계층, 주변 DOM 컨텍스트 |
| 4 | **Forensic** | + 전체 computed styles, 애니메이션 상태 |

---

### F-AGT-07. React 컴포넌트 감지

**목적**: DOM 요소뿐 아니라 React 컴포넌트 계층 구조까지 감지

**동작**: 호버 시 전체 컴포넌트 계층 표시 (예: `App > Layout > Sidebar > Button`)

**가치**: 에이전트가 DOM 셀렉터가 아닌 React 컴포넌트 파일을 직접 찾을 수 있음

---

### F-AGT-08. MCP 실시간 동기화 (v2.0 핵심)

**목적**: 어노테이션을 복사/붙여넣기 없이 AI 에이전트에게 실시간 전달

**MCP 9개 도구**:

| 도구 | 기능 | 파라미터 |
|------|------|---------|
| `agentation_list_sessions` | 피드백이 있는 페이지 목록 조회 | - |
| `agentation_get_session` | 특정 세션 + 모든 어노테이션 조회 | sessionId |
| `agentation_get_pending` | 특정 세션의 미처리 어노테이션 | sessionId |
| `agentation_get_all_pending` | 모든 세션의 미처리 어노테이션 | - |
| `agentation_acknowledge` | 어노테이션 확인 (수신 확인) | annotationId |
| `agentation_resolve` | 어노테이션 해결 완료 (요약 포함) | annotationId, summary? |
| `agentation_dismiss` | 어노테이션 거부 (사유 포함) | annotationId, reason |
| `agentation_reply` | 어노테이션 스레드에 메시지 추가 | annotationId, message |
| `agentation_watch_annotations` | 새 어노테이션 대기 (블로킹) | sessionId?, batchWindowSeconds?, timeoutSeconds? |

---

### F-AGT-09. 세션 관리

**목적**: 페이지별 어노테이션 세션을 관리

**세션 구조**:
- 각 페이지 = 하나의 세션
- 세션 내 어노테이션들은 메타데이터 포함 (생성 시간, 상태, 해결자)

**상태 흐름**:
```
pending → acknowledged → resolved (with summary)
                       → dismissed (with reason)
```

**필터링 가능**:
- 가장 오래 대기 중인 피드백
- 차단(blocking) 이슈만
- 미해결 어노테이션이 있는 페이지
- 의도별 분류 (질문 vs 수정 요청)

---

### F-AGT-10. 웹훅 (Webhooks)

**목적**: 어노테이션 이벤트를 외부 서비스에 전달

**지원 대상**: GitHub Issues, Slack, Linear, 커스텀 대시보드

**형식**: 구조화된 JSON 페이로드

---

## 5. 어노테이션 데이터 구조

```typescript
interface Annotation {
  id: string;                          // "ann_123"
  comment: string;                     // 사용자 피드백 텍스트
  element: string;                     // HTML 요소
  elementPath: string;                 // CSS 셀렉터 경로
  kind: 'feedback' | 'placement' | 'rearrange';
  intent: 'fix' | 'change' | 'question' | 'approve';
  severity: 'blocking' | 'important' | 'suggestion';
  status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  // + 타임스탬프, 해결자 정보 등
}

interface Session {
  id: string;
  url: string;                         // 페이지 URL
  annotations: Annotation[];
  status: SessionStatus;
}
```

**어노테이션 종류 (kind)**:
| 종류 | 설명 |
|------|------|
| `feedback` | 일반 피드백 (수정 요청, 질문, 승인) |
| `placement` | 요소 위치 변경 요청 |
| `rearrange` | 레이아웃 재배치 요청 |

**의도 (intent)**:
| 의도 | 설명 |
|------|------|
| `fix` | 버그 수정 |
| `change` | 변경 요청 |
| `question` | 질문 |
| `approve` | 승인 |

**심각도 (severity)**:
| 심각도 | 설명 |
|--------|------|
| `blocking` | 반드시 수정 필요 |
| `important` | 중요하지만 차단하지 않음 |
| `suggestion` | 제안 수준 |

---

## 6. 워크플로우 패턴

### 6.1 수동 모드 (v1 방식)

```
사용자가 브라우저에서 어노테이션
  → "Copy" 버튼으로 마크다운 복사
  → Claude Code에 붙여넣기
  → 에이전트가 셀렉터로 코드 위치 찾아 수정
```

### 6.2 핸즈프리 모드 (v2, MCP)

```
사용자가 브라우저에서 어노테이션
  → MCP 서버가 자동 전달
  → 에이전트: watch_annotations → acknowledge → 코드 수정 → resolve
  → 사용자가 추가 어노테이션 → 에이전트가 자동 감지 → 반복
```

### 6.3 크리틱 모드 (에이전트 자체 어노테이션)

```
에이전트가 headed 브라우저 실행
  → 페이지 스크롤하며 디자인 문제 감지
  → 에이전트가 직접 어노테이션 추가
  → 필요 스킬: vercel-labs/agent-browser
```

### 6.4 셀프 드라이빙 모드 (완전 자동)

```
에이전트가 이슈 감지 → 어노테이션 → 소스 코드 수정 → 어노테이션 해결 → 수정 검증
  → 필요: 크리틱 모드 + agentation-self-driving 스킬
```

---

## 7. 기술 스택

| 항목 | 내용 |
|------|------|
| 언어 | TypeScript (84.1%), SCSS (9.0%), HTML (3.3%), CSS (3.3%) |
| 프레임워크 | React 18+ |
| 빌드 | pnpm workspaces (모노레포) |
| 런타임 의존성 | 없음 (순수 CSS 애니메이션) |
| MCP 서버 | Node.js, stdio + HTTP 듀얼 |
| 라이선스 | PolyForm Shield 1.0.0 |

---

## 8. zm-agent-manager 적용 판단

### 8.1 직접 적용 가능한 개념

| 개념 | zm-agent-manager 적용 |
|------|---------------------|
| **구조화된 피드백 스키마** | 세션 리플레이에서 도구 호출 결과를 구조화된 형식으로 표시 |
| **상태 흐름 (pending→resolved)** | Hygiene 이슈나 린트 경고에 "해결됨" 상태 추가 |
| **심각도 분류 (blocking/important/suggestion)** | 린트/위생 이슈의 심각도 체계로 활용 |
| **세션 개념** | 페이지별 세션 = 프로젝트별 모니터링 세션과 유사 |

### 8.2 직접 구현 범위 밖

| 기능 | 이유 |
|------|------|
| 브라우저 툴바 | zm-agent-manager는 Electron 데스크톱 앱, 웹 어노테이션 범위 밖 |
| MCP 서버 | 에이전트 제어가 아닌 모니터링이 목적 |
| CSS 셀렉터 캡처 | 웹 UI 피드백 도구 특화 기능 |
| 애니메이션 프리징 | 웹 디버깅 특화 기능 |

### 8.3 Readout vs Agentation vs zm-agent-manager

| 관점 | Readout | Agentation | zm-agent-manager |
|------|---------|------------|-------------------|
| **핵심 가치** | 에이전트가 한 일을 분석 | 에이전트에게 할 일을 전달 | 에이전트 활동을 모니터링 |
| **데이터 흐름** | ~/.claude/ → 사용자 | 브라우저 → 에이전트 | ~/.claude/ → 사용자 |
| **플랫폼** | macOS 전용 | 웹 (React) | 크로스 플랫폼 (Electron) |
| **오픈소스** | 아니오 | 예 (제한적) | 예 (예정) |
| **사용 시점** | 작업 후 (리뷰) | 작업 중 (피드백) | 작업 중 + 작업 후 |

---

## 9. 참고 자료

- [GitHub: benjitaylor/agentation](https://github.com/benjitaylor/agentation)
- [agentation.com/mcp](https://www.agentation.com/mcp) — MCP 서버 문서
- [Introducing Agentation 2.0](https://www.agentation.com/blog/introducing-agentation-2)
- [Product Hunt: Agentation](https://www.producthunt.com/products/agentation) — #1 Daily (2026-03-27)
- [Two Tools Every Claude Code User Needs](https://tonylee.im/en/blog/two-tools-every-claude-code-user-needs-agentation-readout)
