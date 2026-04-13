import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, X, AlertTriangle } from 'lucide-react';
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  WorkflowValidationError,
} from '@shared/types';

/**
 * 워크플로우 CRUD 모달 (INBOX #13).
 *
 * - 좌측: 목록 + 신규 추가 + 삭제
 * - 우측: Form 기반 에디터 (이름/displayName + nodes 테이블 + edges 테이블)
 * - 저장 전 클라이언트 측 validate 호출 → 에러 인라인 표시
 */

interface WorkflowManagerProps {
  projectPath: string;
  workflows: WorkflowDefinition[];
  /** changed=true면 부모가 refetch 해야 함 */
  onClose: (changed: boolean) => void;
}

interface EditorState {
  name: string;
  displayName: string;
  start: string;
  end: string; // comma separated in UI
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  originalName: string | null; // null if new
}

const NEW_WORKFLOW_TEMPLATE: EditorState = {
  name: 'new-workflow',
  displayName: '새 워크플로우',
  start: '시작',
  end: '완료',
  nodes: [{ id: '시작' }, { id: '완료' }],
  edges: [{ from: '시작', to: '완료' }],
  originalName: null,
};

function toEditorState(wf: WorkflowDefinition): EditorState {
  if (wf.nodes && wf.nodes.length > 0) {
    return {
      name: wf.name,
      displayName: wf.displayName,
      start: wf.start ?? wf.nodes[0].id,
      end: (wf.end ?? []).join(', '),
      nodes: wf.nodes.map((n) => ({ ...n })),
      edges: (wf.edges ?? []).map((e) => ({ ...e })),
      originalName: wf.name,
    };
  }
  // linear → graph 변환
  const nodes = wf.stages.map((s) => ({ id: s }));
  const edges: WorkflowEdge[] = [];
  for (let i = 0; i < wf.stages.length - 1; i++) {
    edges.push({ from: wf.stages[i], to: wf.stages[i + 1] });
  }
  return {
    name: wf.name,
    displayName: wf.displayName,
    start: wf.stages[0] ?? '',
    end: wf.stages[wf.stages.length - 1] ?? '',
    nodes,
    edges,
    originalName: wf.name,
  };
}

function fromEditorState(state: EditorState): WorkflowDefinition {
  const end = state.end
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return {
    name: state.name.trim(),
    displayName: state.displayName.trim() || state.name.trim(),
    stages: state.nodes.map((n) => n.id),
    createdAt: 0,
    start: state.start.trim(),
    end,
    nodes: state.nodes,
    edges: state.edges,
  };
}

export function WorkflowManager({
  projectPath,
  workflows,
  onClose,
}: WorkflowManagerProps): React.JSX.Element {
  const [list, setList] = useState<WorkflowDefinition[]>(workflows);
  const [selected, setSelected] = useState<EditorState | null>(
    workflows[0] ? toEditorState(workflows[0]) : null
  );
  const [errors, setErrors] = useState<WorkflowValidationError[]>([]);
  const [saving, setSaving] = useState(false);
  const [changed, setChanged] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setList(workflows);
  }, [workflows]);

  const refreshList = async (): Promise<void> => {
    const result = await window.api?.listProjectWorkflows?.(projectPath);
    if (result) setList(result.workflows);
  };

  const handleSelectExisting = (wf: WorkflowDefinition): void => {
    setSelected(toEditorState(wf));
    setErrors([]);
    setMessage(null);
  };

  const handleNew = (): void => {
    setSelected({ ...NEW_WORKFLOW_TEMPLATE });
    setErrors([]);
    setMessage(null);
  };

  const handleSave = async (): Promise<void> => {
    if (!selected) return;
    setSaving(true);
    setErrors([]);
    try {
      const wf = fromEditorState(selected);
      const validation = await window.api?.validateProjectWorkflow?.(wf);
      if (validation && !validation.valid) {
        setErrors(validation.errors);
        setSaving(false);
        return;
      }
      await window.api?.saveProjectWorkflow?.(projectPath, wf);
      setChanged(true);
      setMessage('저장되었습니다');
      await refreshList();
      setSelected({ ...selected, originalName: wf.name });
    } catch (e) {
      setErrors([
        {
          rule: 'save-error',
          message: e instanceof Error ? e.message : '저장 실패',
        },
      ]);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!selected || !selected.originalName) return;
    // eslint-disable-next-line no-alert
    if (!confirm(`워크플로우 "${selected.originalName}"을(를) 삭제할까요?`)) return;
    try {
      await window.api?.deleteProjectWorkflow?.(projectPath, selected.originalName);
      setChanged(true);
      await refreshList();
      setSelected(null);
      setMessage('삭제되었습니다');
    } catch (e) {
      setErrors([
        {
          rule: 'delete-error',
          message: e instanceof Error ? e.message : '삭제 실패',
        },
      ]);
    }
  };

  const addNode = (): void => {
    if (!selected) return;
    setSelected({
      ...selected,
      nodes: [...selected.nodes, { id: `node-${selected.nodes.length + 1}` }],
    });
  };

  const updateNode = (idx: number, id: string): void => {
    if (!selected) return;
    const nodes = [...selected.nodes];
    nodes[idx] = { ...nodes[idx], id };
    setSelected({ ...selected, nodes });
  };

  const removeNode = (idx: number): void => {
    if (!selected) return;
    setSelected({
      ...selected,
      nodes: selected.nodes.filter((_, i) => i !== idx),
    });
  };

  const addEdge = (): void => {
    if (!selected) return;
    const first = selected.nodes[0]?.id ?? '';
    const last = selected.nodes[selected.nodes.length - 1]?.id ?? '';
    setSelected({
      ...selected,
      edges: [...selected.edges, { from: first, to: last }],
    });
  };

  const updateEdge = (idx: number, patch: Partial<WorkflowEdge>): void => {
    if (!selected) return;
    const edges = [...selected.edges];
    edges[idx] = { ...edges[idx], ...patch };
    setSelected({ ...selected, edges });
  };

  const removeEdge = (idx: number): void => {
    if (!selected) return;
    setSelected({
      ...selected,
      edges: selected.edges.filter((_, i) => i !== idx),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      data-testid="workflow-manager-modal"
    >
      <div className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">워크플로우 관리</h2>
          <button
            type="button"
            onClick={() => onClose(changed)}
            className="rounded p-1 hover:bg-muted"
            data-testid="workflow-manager-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* 좌측: 목록 */}
          <div className="flex w-56 shrink-0 flex-col border-r border-border">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-medium text-muted-foreground">목록</span>
              <button
                type="button"
                onClick={handleNew}
                className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-0.5 text-[10px] hover:bg-muted"
                data-testid="workflow-manager-new"
              >
                <Plus className="h-3 w-3" />
                New
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto">
              {list.length === 0 && (
                <li className="p-3 text-xs text-muted-foreground">워크플로우 없음</li>
              )}
              {list.map((wf) => (
                <li key={wf.name}>
                  <button
                    type="button"
                    onClick={() => handleSelectExisting(wf)}
                    className={`w-full truncate px-3 py-2 text-left text-xs hover:bg-muted ${
                      selected?.originalName === wf.name ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="font-medium text-foreground">{wf.displayName}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {wf.name}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* 우측: 에디터 */}
          <div className="flex flex-1 flex-col overflow-y-auto p-4">
            {!selected ? (
              <p className="text-xs text-muted-foreground">
                좌측에서 워크플로우를 선택하거나 <strong>New</strong>로 신규 추가하세요.
              </p>
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSave();
                }}
              >
                {/* 기본 정보 */}
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">name (파일명)</span>
                    <input
                      type="text"
                      value={selected.name}
                      onChange={(e) =>
                        setSelected({ ...selected, name: e.target.value })
                      }
                      className="rounded border border-border bg-card px-2 py-1 text-foreground"
                      data-testid="workflow-editor-name"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">displayName</span>
                    <input
                      type="text"
                      value={selected.displayName}
                      onChange={(e) =>
                        setSelected({ ...selected, displayName: e.target.value })
                      }
                      className="rounded border border-border bg-card px-2 py-1 text-foreground"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">start 노드 id</span>
                    <input
                      type="text"
                      value={selected.start}
                      onChange={(e) =>
                        setSelected({ ...selected, start: e.target.value })
                      }
                      className="rounded border border-border bg-card px-2 py-1 text-foreground"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">end 노드 (쉼표 구분)</span>
                    <input
                      type="text"
                      value={selected.end}
                      onChange={(e) =>
                        setSelected({ ...selected, end: e.target.value })
                      }
                      className="rounded border border-border bg-card px-2 py-1 text-foreground"
                    />
                  </label>
                </div>

                {/* 노드 테이블 */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="text-xs font-medium text-foreground">노드</h3>
                    <button
                      type="button"
                      onClick={addNode}
                      className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-0.5 text-[10px] hover:bg-muted"
                    >
                      <Plus className="h-3 w-3" /> 추가
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {selected.nodes.map((n, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={n.id}
                          onChange={(e) => updateNode(idx, e.target.value)}
                          className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs text-foreground"
                          placeholder="node id"
                        />
                        <button
                          type="button"
                          onClick={() => removeNode(idx)}
                          className="rounded border border-border bg-card p-1 text-destructive hover:bg-muted"
                          aria-label="노드 삭제"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 엣지 테이블 */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <h3 className="text-xs font-medium text-foreground">엣지</h3>
                    <button
                      type="button"
                      onClick={addEdge}
                      className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-0.5 text-[10px] hover:bg-muted"
                    >
                      <Plus className="h-3 w-3" /> 추가
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {selected.edges.map((e, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={e.from}
                          onChange={(ev) => updateEdge(idx, { from: ev.target.value })}
                          placeholder="from"
                          className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs text-foreground"
                        />
                        <span className="text-muted-foreground">→</span>
                        <input
                          type="text"
                          value={e.to}
                          onChange={(ev) => updateEdge(idx, { to: ev.target.value })}
                          placeholder="to"
                          className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs text-foreground"
                        />
                        <input
                          type="text"
                          value={e.label ?? ''}
                          onChange={(ev) => updateEdge(idx, { label: ev.target.value })}
                          placeholder="label (선택)"
                          className="w-32 rounded border border-border bg-card px-2 py-1 text-xs text-foreground"
                        />
                        <button
                          type="button"
                          onClick={() => removeEdge(idx)}
                          className="rounded border border-border bg-card p-1 text-destructive hover:bg-muted"
                          aria-label="엣지 삭제"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 에러 표시 */}
                {errors.length > 0 && (
                  <div
                    className="rounded border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive"
                    data-testid="workflow-editor-errors"
                  >
                    <div className="mb-1 flex items-center gap-1 font-medium">
                      <AlertTriangle className="h-3 w-3" />
                      검증 실패
                    </div>
                    <ul className="list-disc pl-4">
                      {errors.map((e, i) => (
                        <li key={i}>
                          <code className="text-[10px]">{e.rule}</code> — {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {message && (
                  <p className="text-xs text-green-500">{message}</p>
                )}

                {/* 액션 */}
                <div className="flex items-center gap-2 border-t border-border pt-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    data-testid="workflow-editor-save"
                  >
                    <Save className="h-3 w-3" />
                    {saving ? '저장 중...' : '저장 (+검증)'}
                  </button>
                  {selected.originalName && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="inline-flex items-center gap-1 rounded border border-destructive/50 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3 w-3" />
                      삭제
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
