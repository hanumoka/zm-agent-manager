# 프로젝트 워크플로우 시스템 규칙 (INBOX #10, #11)

이 문서는 **프로젝트당 1개의 워크플로우 정의**를 Claude Code와 zm-agent-manager 앱 양쪽에서 인식하기 위한 규칙을 정의한다.

## 원칙

1. **프로젝트당 정확히 1개**. 여러 워크플로우를 병행하지 않는다
2. **Source of truth는 프로젝트 저장소의 `.claude/workflow.md` 파일**
3. zm-agent-manager 앱은 이 파일을 **읽기 전용**으로 사용 (쓰기 금지 — `~/.claude/` 원칙과 유사)
4. 기존 글로벌 워크플로우(`~/.zm-agent-manager/workflows/`)는 **라이브러리 폴백**으로 유지 (프로젝트에 `.claude/workflow.md`가 없을 때만 사용)

## 파일 형식

위치: `<project-root>/.claude/workflow.md`

```markdown
---
name: default
displayName: 기본 개발 워크플로우
stages: 요구사항 설계 구현 테스트 리뷰 완료
---

# 단계별 설명 (자유 마크다운)

## 요구사항
...

## 설계
...
```

**YAML frontmatter 필수 필드**:
- `name`: 워크플로우 고유 이름 (영문/숫자/하이픈 권장)
- `stages`: 공백으로 구분된 단계 목록 (순서가 있음)

**선택 필드**:
- `displayName`: 표시명. 없으면 `name`을 사용

**주의**:
- `stages`는 **공백 구분**만 지원 (쉼표 구분 미지원 — skill-scanner와 동일 정책)
- 마크다운 본문은 자유. 앱은 frontmatter만 파싱

## Claude Code 인식

Claude Code 세션 시작 시 이 파일을 자동으로 로드하려면 **프로젝트 루트의 `CLAUDE.md`에서 참조**한다:

```markdown
## Workflow
이 프로젝트는 `.claude/workflow.md`에 정의된 워크플로우를 따른다. 세션 시작 시 해당 파일을 반드시 읽고 현재 작업이 어느 단계에 속하는지 파악할 것.
```

Claude Code는 `CLAUDE.md`를 자동 로드하므로, 위 섹션을 통해 워크플로우 파일을 간접적으로 인식하게 된다. Claude는 필요 시 Read 도구로 `.claude/workflow.md`를 조회한다.

## zm-agent-manager 앱 동작

- `src/main/workflow-scanner.ts`의 `scanProjectWorkflow()`가 현재 프로젝트의 `.claude/workflow.md`를 파싱하여 `WorkflowDefinition` 반환
- IPC `GET_PROJECT_WORKFLOW`로 렌더러에 전달
- TaskBoard는 프로젝트 워크플로우가 있으면 TaskCard의 워크플로우 드롭다운을 잠금 + "프로젝트 고정" 배지 표시
- Pipeline 탭은 프로젝트 워크플로우의 `stages` 배열로 파이프라인 구성

## 충돌 정책

- 프로젝트 `.claude/workflow.md`와 글로벌 워크플로우가 동일한 `name`을 가질 수 있음
- 이 경우 **프로젝트 정의가 우선**. 글로벌 정의는 무시됨
- 앱 UI는 "프로젝트" / "글로벌" 출처를 명시적으로 표시

## 마이그레이션

- 기존 `~/.zm-agent-manager/workflows/{name}.json` 파일은 그대로 유지
- 사용자가 프로젝트에 `.claude/workflow.md`를 추가하면 해당 프로젝트에서만 신규 정의가 우선 사용됨
- 글로벌 워크플로우는 "프로젝트 파일이 없는 프로젝트"에서 fallback으로 계속 사용 가능
