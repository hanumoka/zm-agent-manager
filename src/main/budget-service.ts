import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { Notification } from 'electron';
import type { BudgetSettings, CostSummary } from '@shared/types';

const DEFAULT_SETTINGS_FILE = join(homedir(), '.zm-agent-manager', 'budget-settings.json');

const DEFAULT_SETTINGS: BudgetSettings = {
  dailyUsd: null,
  monthlyUsd: null,
  alertPercent: 80,
  lastNotifiedKeys: [],
};

/** 옵션 (테스트에서 fixture 경로 주입). */
export interface BudgetOptions {
  settingsFile?: string;
  /** Notification 발송 시뮬레이션 — 테스트에서 주입. 미지정 시 Electron Notification 사용. */
  notify?: (title: string, body: string) => void;
}

function resolveFile(options: BudgetOptions): string {
  return options.settingsFile ?? DEFAULT_SETTINGS_FILE;
}

/**
 * 임의의 값을 유효한 BudgetSettings로 정규화한다.
 * load/save 양쪽에서 사용하여 save-load 왕복 시 데이터 무결성을 보장한다.
 *
 * - 숫자 아닌 값 / NaN / 음수 → null (`dailyUsd`/`monthlyUsd`) 또는 기본값 (`alertPercent`)
 * - `alertPercent`는 0 초과 100 이하. 범위 밖이면 기본값(80)
 * - `lastNotifiedKeys`는 string 배열. 아니면 빈 배열
 */
export function normalizeBudgetSettings(raw: unknown): BudgetSettings {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;

  const normalizeUsd = (v: unknown): number | null => {
    if (typeof v !== 'number') return null;
    if (!Number.isFinite(v)) return null;
    if (v < 0) return null;
    return v;
  };

  const alertPercent =
    typeof r.alertPercent === 'number' &&
    Number.isFinite(r.alertPercent) &&
    r.alertPercent > 0 &&
    r.alertPercent <= 100
      ? r.alertPercent
      : DEFAULT_SETTINGS.alertPercent;

  const lastNotifiedKeys = Array.isArray(r.lastNotifiedKeys)
    ? r.lastNotifiedKeys.filter((k): k is string => typeof k === 'string')
    : [];

  return {
    dailyUsd: normalizeUsd(r.dailyUsd),
    monthlyUsd: normalizeUsd(r.monthlyUsd),
    alertPercent,
    lastNotifiedKeys,
  };
}

/** 설정 파일 로드. 파일이 없거나 파싱 실패 시 기본값 반환. */
export async function loadBudgetSettings(options: BudgetOptions = {}): Promise<BudgetSettings> {
  const file = resolveFile(options);
  try {
    const raw = await readFile(file, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return normalizeBudgetSettings(parsed);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * 설정 파일 저장. 디렉토리가 없으면 생성.
 * 입력을 `normalizeBudgetSettings`로 한 번 거르므로 악성/버그 값이 파일에 남지 않는다.
 */
export async function saveBudgetSettings(
  settings: BudgetSettings,
  options: BudgetOptions = {}
): Promise<BudgetSettings> {
  const file = resolveFile(options);
  const normalized = normalizeBudgetSettings(settings);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(normalized, null, 2), 'utf-8');
  return normalized;
}

/**
 * 오늘 날짜 (로컬) → "YYYY-MM-DD".
 * cost-scanner의 `byDay[i].date`와 비교되므로 cost-scanner도 반드시 이 헬퍼(또는 동일 로직)를 사용해야 한다.
 */
export function todayLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 이번 달 (로컬) → "YYYY-MM" */
export function monthLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * ISO 문자열 또는 epoch ms → 로컬 시각 기준 "YYYY-MM-DD".
 * 값이 유효하지 않으면 'unknown' 반환.
 */
export function timestampToLocalDate(ts: string | number | undefined | null): string {
  if (ts === undefined || ts === null || ts === '') return 'unknown';
  const d = new Date(ts);
  if (!Number.isFinite(d.getTime())) return 'unknown';
  return todayLocal(d);
}

/**
 * 모듈 레벨 직렬화 체인 — Dashboard와 Costs가 동시에 GET_COST_SUMMARY를 호출해도
 * `evaluateBudgetAlerts`는 순차 실행되어 `lastNotifiedKeys` 쓰기 경쟁을 방지한다.
 * 성공/실패를 모두 삼켜 다음 호출이 계속 진행되도록 한다.
 */

let evaluationChain: Promise<void> = Promise.resolve();

/**
 * 비용 요약을 받아 예산 임계 도달 여부를 평가하고 알림을 발송한다.
 * 같은 (날짜+레벨) 키로는 한 번만 발송 (중복 방지).
 *
 * 모듈 레벨 Promise 체인으로 직렬화되므로 동시 호출 시에도
 * `lastNotifiedKeys` 읽기-쓰기 경쟁이 발생하지 않는다.
 *
 * @returns 발송된 알림 키 배열 (테스트/디버깅용)
 */
export function evaluateBudgetAlerts(
  summary: CostSummary,
  options: BudgetOptions = {},
  now: Date = new Date()
): Promise<string[]> {
  const resultPromise = evaluationChain.then(() => doEvaluateBudgetAlerts(summary, options, now));
  evaluationChain = resultPromise.then(
    () => undefined,
    () => undefined
  );
  return resultPromise;
}

async function doEvaluateBudgetAlerts(
  summary: CostSummary,
  options: BudgetOptions,
  now: Date
): Promise<string[]> {
  const settings = await loadBudgetSettings(options);

  // 일별/월별 비용 합산 (오늘 / 이번 달)
  const today = todayLocal(now);
  const month = monthLocal(now);
  const todayCost = summary.byDay
    .filter((d) => d.date === today)
    .reduce((acc, d) => acc + d.cost, 0);
  const monthCost = summary.byDay
    .filter((d) => d.date.startsWith(month))
    .reduce((acc, d) => acc + d.cost, 0);

  const sent: string[] = [];
  const newKeys: string[] = [...settings.lastNotifiedKeys];

  const checkAndNotify = (
    period: 'daily' | 'monthly',
    periodLabel: string,
    budget: number | null,
    actual: number,
    dateKey: string
  ): void => {
    if (budget === null || budget <= 0) return;

    const ratio = actual / budget;
    const alertRatio = settings.alertPercent / 100;

    // 100% 초과
    if (ratio >= 1) {
      const key = `${period}-${dateKey}-exceed`;
      if (!newKeys.includes(key)) {
        const title = `💰 ${periodLabel} 예산 초과`;
        const body = `${periodLabel} 비용 $${actual.toFixed(2)} / 예산 $${budget.toFixed(2)} (${(ratio * 100).toFixed(0)}%)`;
        sendNotification(options, title, body);
        newKeys.push(key);
        sent.push(key);
      }
      return; // 초과 시 경고는 생략
    }

    // alertPercent% 도달 (경고)
    if (ratio >= alertRatio) {
      const key = `${period}-${dateKey}-warn`;
      if (!newKeys.includes(key)) {
        const title = `⚠️ ${periodLabel} 예산 ${settings.alertPercent}% 도달`;
        const body = `${periodLabel} 비용 $${actual.toFixed(2)} / 예산 $${budget.toFixed(2)} (${(ratio * 100).toFixed(0)}%)`;
        sendNotification(options, title, body);
        newKeys.push(key);
        sent.push(key);
      }
    }
  };

  checkAndNotify('daily', '오늘', settings.dailyUsd, todayCost, today);
  checkAndNotify('monthly', '이번 달', settings.monthlyUsd, monthCost, month);

  // 새 키 저장 + 오래된 키 정리 (최근 60개만 유지)
  if (sent.length > 0) {
    const trimmed = newKeys.slice(-60);
    await saveBudgetSettings({ ...settings, lastNotifiedKeys: trimmed }, options);
  }

  return sent;
}

function sendNotification(options: BudgetOptions, title: string, body: string): void {
  if (options.notify) {
    options.notify(title, body);
    return;
  }
  try {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  } catch {
    // 메인 프로세스가 아니거나 Notification 사용 불가 — 무시
  }
}
