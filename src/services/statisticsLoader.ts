import type { DateWindow } from '../analytics/salesDate.ts';

export interface StatisticsBatch {
  key: string;
  start: string;
  end: string;
  scopes: Array<'current' | 'previous'>;
}

export interface BatchFailure extends StatisticsBatch {
  message: string;
  status?: number;
  code?: string;
  durationMs: number;
}

export interface StatisticsLoadProgress {
  completed: number;
  total: number;
  batch: StatisticsBatch;
}

export interface StatisticsLoadResult<T extends { id?: string; date: string }> {
  current: T[];
  previous: T[];
  failures: BatchFailure[];
  batches: StatisticsBatch[];
  requestCount: number;
  rowCount: number;
  responseBytes: number;
  durationMs: number;
}

const parseDate = (value: string) => new Date(`${value}T12:00:00Z`);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const monthEnd = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12));

export const splitIntoMonthlyBatches = (window: DateWindow): Array<Omit<StatisticsBatch, 'scopes'>> => {
  const start = parseDate(window.start);
  const end = parseDate(window.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) throw new Error('Période statistique invalide');
  const batches = [];
  let cursor = start;
  while (cursor <= end) {
    const batchEnd = new Date(Math.min(monthEnd(cursor).getTime(), end.getTime()));
    const batch = { start: iso(cursor), end: iso(batchEnd) };
    batches.push({ ...batch, key: `${batch.start}:${batch.end}` });
    cursor = new Date(batchEnd.getTime() + 86_400_000);
  }
  return batches;
};

const dedupePlans = <T extends { id?: string; date: string }>(plans: T[]): T[] => {
  const seen = new Set<string>();
  return plans.filter((plan, index) => {
    const key = plan.id || `${plan.date}:${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));
};

const errorDetails = (error: unknown): Pick<BatchFailure, 'message' | 'status' | 'code'> => {
  const value = error as { message?: string; status?: number; code?: string; cause?: { status?: number; code?: string } };
  return { message: value?.message || 'Erreur inconnue lors du chargement', status: value?.status ?? value?.cause?.status, code: value?.code ?? value?.cause?.code };
};

export const friendlyStatisticsError = (failure: Pick<BatchFailure, 'message' | 'status' | 'code'>): string => {
  const text = failure.message.toLowerCase();
  if (failure.code === '57014' || text.includes('timeout') || text.includes('timed out') || text.includes('statement timeout')) {
    return 'Délai d’exécution dépassé lors du chargement des plans.';
  }
  if (failure.status === 401 || failure.status === 403) return 'Votre session ne permet pas de consulter ces statistiques.';
  if (failure.status && failure.status >= 500) return `Le service statistique est momentanément indisponible (HTTP ${failure.status}).`;
  return failure.status ? `Échec du chargement des plans (HTTP ${failure.status}).` : failure.message;
};

export const canExportStatistics = (state: 'idle' | 'loading' | 'success' | 'partial' | 'error', rowCount: number): boolean =>
  state === 'success' && rowCount > 0;

export async function loadStatisticsWindows<T extends { id?: string; date: string }>(options: {
  current: DateWindow;
  previous: DateWindow;
  fetchBatch: (start: string, end: string) => Promise<T[]>;
  concurrency?: number;
  retries?: number;
  onProgress?: (progress: StatisticsLoadProgress) => void;
  isStale?: () => boolean;
}): Promise<StatisticsLoadResult<T>> {
  const byKey = new Map<string, StatisticsBatch>();
  for (const scope of ['current', 'previous'] as const) {
    for (const raw of splitIntoMonthlyBatches(options[scope])) {
      const existing = byKey.get(raw.key);
      if (existing) existing.scopes.push(scope);
      else byKey.set(raw.key, { ...raw, scopes: [scope] });
    }
  }
  const batches = [...byKey.values()];
  const successful: Array<{ batch: StatisticsBatch; plans: T[]; bytes: number }> = [];
  const failures: BatchFailure[] = [];
  const started = performance.now();
  let cursor = 0;
  let completed = 0;

  const worker = async () => {
    while (cursor < batches.length) {
      if (options.isStale?.()) return;
      const batch = batches[cursor++];
      const batchStarted = performance.now();
      let lastError: unknown;
      for (let attempt = 0; attempt <= (options.retries ?? 1); attempt++) {
        try {
          const plans = await options.fetchBatch(batch.start, batch.end);
          successful.push({ batch, plans, bytes: new Blob([JSON.stringify(plans)]).size });
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError) failures.push({ ...batch, ...errorDetails(lastError), durationMs: performance.now() - batchStarted });
      completed += 1;
      options.onProgress?.({ completed, total: batches.length, batch });
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(options.concurrency ?? 2, 1), batches.length) }, worker));
  if (options.isStale?.()) throw Object.assign(new Error('Chargement remplacé par une recherche plus récente'), { code: 'STALE_REQUEST' });

  const plansFor = (scope: 'current' | 'previous', window: DateWindow) => dedupePlans(successful
    .filter(item => item.batch.scopes.includes(scope))
    .flatMap(item => item.plans)
    .filter(plan => plan.date >= window.start && plan.date <= window.end));
  return {
    current: plansFor('current', options.current), previous: plansFor('previous', options.previous), failures, batches,
    requestCount: batches.length, rowCount: successful.reduce((sum, item) => sum + item.plans.length, 0),
    responseBytes: successful.reduce((sum, item) => sum + item.bytes, 0), durationMs: performance.now() - started,
  };
}
