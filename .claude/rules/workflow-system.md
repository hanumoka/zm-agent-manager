# 프로젝트 워크플로우 시스템 규칙 (INBOX #10, #11, #13)

이 문서는 zm-agent-manager와 Claude Code 양쪽에서 인식되는 프로젝트 워크플로우의 저장 위치, 형식, 검증 규칙을 정의한다.

## 원칙

1. **Source of truth는 프로젝트 저장소**
2. zm-agent-manager 앱은 이 파일을 읽기 + 사용자 명시 쓰기(CRUD UI)만 수행. `~/.claude/`는 여전히 읽기 전용
3. 동일 `name`을 가진 워크플로우가 여러 위치에 존재할 경우 프로젝트 정의가 항상 우선
4. **프로젝트당 다중 워크플로우 허용** (INBOX #13로 확장). 단, 단일 프로젝트 내 `name`은 유일해야 함
5. Loop(cycle)를 허용하는 Statechart 스키마가 기본. Linear(단순 stages 리스트)는 레거시 호환용

## 파일 위치

- **신규 표준**: `<project-root>/.claude/zm-agent-manager/workflows/{name}.md`
  - 앱 전용 namespace (`zm-agent-manager` 서브폴더)로 분리하여 다른 도구와 충돌 방지
  - 파일명은 `{workflow.name}.md`
- **레거시**: `<project-root>/.claude/workflow.md` (프로젝트당 1개)
  - listProjectWorkflows 호출 시 신규 폴더가 비어 있으면 **자동 마이그레이션**됨 (`default.md`로 복사)
- **글로벌 폴백**: `~/.zm-agent-manager/workflows/{name}.json` (기존 빌트인 워크플로우 라이브러리)

## 스키마 1: Statechart (신규, 권장)

```markdown
---
name: default
displayName: 기본 개발 워크플로우
start: 요구사항
end:
  - 배포
nodes:
  - id: 요구사항
    description: 검증 프로토콜
  - id: 설계
  - id: 구현
  - id: 검증
  - id: 문서갱신
  - id: 배포
edges:
  - from: 요구사항
    to: 설계
  - from: 설계
    to: 구현
  - from: 구현
    to: 검증
  - from: 검증
    to: 구현
    label: 실패
  - from: 검증
    to: 문서갱신
    label: 통과
  - from: 문서갱신
    to: 배포
---

# 단계별 상세 설명 (자유 마크다운)
```

**필수 필드**: `name`, `nodes`, `edges`, `start`, `end`  
**선택 필드**: `displayName`, 각 node의 `description`, 각 edge의 `label`

**파싱**: `yaml` (eemeli) 라이브러리 사용. 중첩 YAML 완전 지원.

## 스키마 2: Linear (레거시)

```markdown
---
name: default
displayName: 기본 개발 워크플로우
stages: 요구사항 설계 구현 테스트 리뷰 완료
---
```

- `stages`는 공백 구분 문자열 또는 문자열 배열
- 신규 `.claude/zm-agent-manager/workflows/` 경로에 들어가면 그대로 허용되지만, CRUD UI에서 저장할 때는 자동으로 Statechart 형식으로 재직렬화됨

## 검증 룰 (workflow-validator)

저장 시 (`SAVE_PROJECT_WORKFLOW` IPC) 자동 검증. 실패하면 저장 거부.

1. `name` 필수
2. `start` 필수 + `nodes`에 존재
3. `end` 1개 이상 + 각 end가 `nodes`에 존재
4. 모든 노드 `id` 유일
5. 모든 `edges`의 `from`/`to`가 `nodes`에 존재
6. `start`에서 BFS로 모든 노드 도달 가능 (unreachable 금지)
7. 모든 노드에서 역방향 BFS로 `end` 도달 가능 (데드락 금지)  
   + `end` 노드는 outgoing edge를 가질 수 없음

Loop는 허용된다. 예: `검증 → 구현` 역방향 엣지. DAG 강제 안 함.

## Claude Code 인식

Claude Code는 `CLAUDE.md`의 "## Workflow" 섹션을 통해 파일을 간접 참조한다. 프로젝트 루트의 `CLAUDE.md`에 다음 예시처럼 기재:

```markdown
## Workflow
이 프로젝트는 `.claude/zm-agent-manager/workflows/` 폴더의 워크플로우 정의를 따른다.
기본 워크플로우는 `default.md`.
```

Claude는 필요 시 Read 도구로 해당 파일을 직접 조회한다.

## zm-agent-manager 앱 동작

| 동작 | 구현 |
|------|------|
| 목록 조회 | `scanProjectWorkflowList(projectPath)` → IPC `LIST_PROJECT_WORKFLOWS` |
| 단일 조회 (기본) | `scanProjectWorkflow({ projectPath, workflowName? })` → IPC `GET_PROJECT_WORKFLOW` |
| 저장 | `saveProjectWorkflow(projectPath, wf)` → IPC `SAVE_PROJECT_WORKFLOW` (검증 + 쓰기) |
| 삭제 | `deleteProjectWorkflow(projectPath, name)` → IPC `DELETE_PROJECT_WORKFLOW` |
| 검증 (dry run) | `validateWorkflow(wf)` → IPC `VALIDATE_PROJECT_WORKFLOW` |

- Workflow 페이지는 **프로젝트 드롭다운 + 워크플로우 드롭다운** 2단계로 선택
- "Manage" 버튼으로 CRUD 모달(`WorkflowManager`) 열림
- 그래프 렌더는 BFS level 레이아웃 + loop는 위쪽 arc 곡선으로 표시

## 마이그레이션 동작

- `listProjectWorkflows()` 첫 호출 시:
  1. `.claude/zm-agent-manager/workflows/`에 파일이 있으면 그대로 반환
  2. 없고 `.claude/workflow.md`가 존재하면 → 파싱해서 `default.md`로 자동 저장 후 재-list
  3. 둘 다 없으면 빈 배열
- 레거시 원본(`.claude/workflow.md`)은 삭제하지 않는다 (사용자가 수동 정리)
