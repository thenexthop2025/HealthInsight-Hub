import type { Rules, ColumnMeta } from './types';
import { sharedRuleHelpers } from './types';
/**
 * Adapter for Frequency analysis results
 * Ensures per-variable shape with levels and summary numbers are numeric.
 */

export interface FrequencyAdaptedEntry {
  variable: string;
  summary?: {
    total?: number;
    valid?: number;
    missing?: number;
  };
  levels: Array<{
    value: string;
    count: number;
    percent?: number;
    valid_percent?: number;
    cumulative_valid_percent?: number;
  }>;
}

export type FrequencyAdapted = Record<string, FrequencyAdaptedEntry>;

const toNum = (v: any): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

export const adaptFrequency = (raw: any): FrequencyAdapted => {
  if (!raw || typeof raw !== 'object') return {} as FrequencyAdapted;
  const out: FrequencyAdapted = {} as FrequencyAdapted;
  Object.entries(raw).forEach(([variable, payload]: [string, any]) => {
    const levels = (payload?.levels || payload?.frequency || payload) as any[];
    const normalized = Array.isArray(levels)
      ? levels.map((lv) => ({
          value: String(lv.value ?? lv.name ?? ''),
          count: toNum(lv.count ?? lv.n ?? 0),
          percent: lv.percent !== undefined ? toNum(lv.percent) : undefined,
          valid_percent: lv.valid_percent !== undefined ? toNum(lv.valid_percent) : undefined,
          cumulative_valid_percent:
            lv.cumulative_valid_percent !== undefined ? toNum(lv.cumulative_valid_percent) : undefined,
        }))
      : [];
    const summary = payload?.summary
      ? {
          total: toNum(payload.summary.total),
          valid: toNum(payload.summary.valid),
          missing: toNum(payload.summary.missing),
        }
      : undefined;
    out[variable] = { variable, levels: normalized, summary };
  });
  return out;
};

// Rules for Frequency

export const frequencyRules: Rules = {
  name: '频率分析',
  description: '分类变量的频数/比例',
  requiredVars: [],
  optionalVars: ['dependent'],
  supportsGrouping: false,
  isSuitable: (col: ColumnMeta, _role: string, ctx) => {
    const thr = Math.max(50, Math.floor((ctx?.totalRows ?? 0) * 0.2));
    return sharedRuleHelpers.requireCategorical(col, thr).ok;
  },
  explain: (col: ColumnMeta, _role: string, ctx) => {
    const thr = Math.max(50, Math.floor((ctx?.totalRows ?? 0) * 0.2));
    return sharedRuleHelpers.requireCategorical(col, thr, col?.unique_count);
  },
};
