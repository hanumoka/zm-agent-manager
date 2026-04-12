import { parseHistoryFile } from './history-parser';
import { getProjectSettings } from './project-settings-service';

/**
 * "현재 프로젝트" 경로 결정 로직.
 *
 * **우선순위**:
 * 1. 사용자가 Config 페이지에서 명시적으로 선택한 경로 (`~/.zm-agent-manager/project-settings.json`)
 * 2. `history.jsonl`의 가장 최근 활동 세션의 `project` 필드 (자동 감지)
 * 3. `process.cwd()` 최종 fallback
 *
 * **배경**: 개발 모드에서는 `process.cwd()`가 프로젝트 루트이지만, 설치된 exe에서는
 * 설치 경로(`C:\Program Files\...`)가 되어 프로젝트 스코프 스캔이 실패한다.
 * 또한 자동 감지만 사용할 경우 멀티 프로젝트 환경에서 history.jsonl의 최신 타임스탬프가
 * 유동적이어서 "현재 프로젝트"가 계속 바뀐다. 따라서 사용자 선택을 최우선으로 사용.
 *
 * 동일 요청 폭주를 방지하기 위해 5초 TTL 메모리 캐시를 둔다. 사용자가 프로젝트를
 * 변경했을 때 즉시 반영하려면 `__clearCurrentProjectPathCache()`를 호출할 것.
 */

interface Cache {
  value: string;
  at: number;
}

const TTL_MS = 5000;
let cache: Cache | null = null;

function isAbsolutePath(p: string): boolean {
  if (!p) return false;
  if (p.startsWith('/')) return true;
  return /^[A-Za-z]:[\\/]/.test(p);
}

export async function getCurrentProjectPath(): Promise<string> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.value;

  let resolved = process.cwd();

  // 1순위: 사용자 선택 경로
  try {
    const settings = await getProjectSettings();
    if (settings.currentProjectPath && isAbsolutePath(settings.currentProjectPath)) {
      cache = { value: settings.currentProjectPath, at: now };
      return settings.currentProjectPath;
    }
  } catch {
    // 설정 파일 없으면 자동 감지로 진행
  }

  // 2순위: history.jsonl 자동 감지
  try {
    const { sessionMap } = await parseHistoryFile();
    let bestTs = -1;
    let bestProject: string | null = null;
    for (const entries of sessionMap.values()) {
      for (const e of entries) {
        if (e.timestamp > bestTs && isAbsolutePath(e.project)) {
          bestTs = e.timestamp;
          bestProject = e.project;
        }
      }
    }
    if (bestProject) resolved = bestProject;
  } catch {
    // history.jsonl 없으면 cwd fallback
  }

  cache = { value: resolved, at: now };
  return resolved;
}

/** 테스트에서 캐시 초기화용 */
export function __clearCurrentProjectPathCache(): void {
  cache = null;
}
