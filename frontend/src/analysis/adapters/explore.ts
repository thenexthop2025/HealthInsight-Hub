/**
 * Adapter for Explore analysis results
 * Normalizes backend payload into a stable shape used by ExploreCharts.
 */

import type { Rules, ColumnMeta } from './types';
import { sharedRuleHelpers } from './types';

export type ExploreNumeric = {
  type: 'numeric';
  descriptive: {
    count?: number; mean?: number; std?: number;
    min?: number; max?: number; median?: number;
    q1?: number; q3?: number;
  };
};

export type ExploreCategorical = {
  type: 'categorical';
  levels: Array<{ value: string; count: number; percent?: number }>;
  summary?: { total?: number; valid?: number; missing?: number };
};

export type ExploreGrouped = {
  type: 'numeric_grouped' | 'categorical_grouped';
  group_by: string;
  by_group: Record<string, ExploreNumeric['descriptive'] | ExploreCategorical>;
  overall?: ExploreNumeric['descriptive'];
};

export type ExploreAdapted = Record<string, ExploreNumeric | ExploreCategorical | ExploreGrouped>;

const toNum = (v: any): number | undefined => {
  if (v === null || v === undefined || Number.isNaN(v)) return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
};

const adaptNumericStats = (stats: any) => ({
  count: toNum(stats?.count ?? stats?.n ?? stats?.sample_size),
  mean: toNum(stats?.mean),
  std: toNum(stats?.std ?? stats?.std_dev ?? stats?.stddev),
  min: toNum(stats?.min),
  max: toNum(stats?.max),
  median: toNum(stats?.median ?? stats?.q50),
  q1: toNum(stats?.q1 ?? stats?.q25),
  q3: toNum(stats?.q3 ?? stats?.q75),
});

export const adaptExplore = (raw: any): ExploreAdapted => {
  if (!raw || typeof raw !== 'object') return {} as ExploreAdapted;
  const out: ExploreAdapted = {} as ExploreAdapted;

  Object.entries(raw).forEach(([key, payload]: [string, any]) => {
    // grouped numeric like: { type: 'numeric_grouped', grouped_stats/by_group, group_by, overall }
    if (payload?.grouped_stats || payload?.by_group) {
      const groupBy = payload?.group_by || payload?.grouping_variable || 'group';
      const byGroupRaw = payload?.by_group || payload?.grouped_stats || {};
      const by_group: Record<string, any> = {};
      Object.entries(byGroupRaw).forEach(([g, st]: [string, any]) => {
        // try numeric first
        const adapted = adaptNumericStats(st);
        const hasNumeric = Object.values(adapted).some((v) => v !== undefined);
        if (hasNumeric) by_group[g] = adapted; else by_group[g] = st;
      });
      out[key] = {
        type: 'numeric_grouped',
        group_by: String(groupBy),
        by_group,
        overall: payload?.overall ? adaptNumericStats(payload.overall) : undefined,
        // 传递每组抽样原始值（若后端提供）
        group_samples: payload?.group_samples,
      } as any;
      return;
    }

    // numeric
    if (payload?.descriptive || payload?.overall) {
      out[key] = {
        type: 'numeric',
        descriptive: adaptNumericStats(payload?.descriptive || payload?.overall || payload),
      } as ExploreNumeric;
      return;
    }

    // categorical
    if (payload?.levels || payload?.frequency) {
      let levels: Array<{ value: string; count: number; percent?: number }> = [];
      if (Array.isArray(payload?.levels)) {
        levels = payload.levels.map((lv: any) => ({ value: String(lv?.value ?? lv?.name ?? ''), count: Number(lv?.count ?? 0), percent: toNum(lv?.percent) }));
      } else if (payload?.frequency) {
        // backend shape: { counts: {category: n, ...}, total, unique }
        const countsObj = payload.frequency.counts || payload.frequency;
        if (countsObj && typeof countsObj === 'object') {
          levels = Object.entries(countsObj).map(([k, v]: [string, any]) => ({ value: String(k), count: Number(v) }));
        }
      }
      out[key] = {
        type: 'categorical',
        levels,
        summary: payload?.summary
          ? { total: toNum(payload.summary.total), valid: toNum(payload.summary.valid), missing: toNum(payload.summary.missing) }
          : payload?.frequency
            ? { total: toNum(payload.frequency.total), valid: undefined, missing: undefined }
            : undefined,
      } as ExploreCategorical;
      return;
    }

    // fallback: try treat as numeric
    out[key] = { type: 'numeric', descriptive: adaptNumericStats(payload) } as ExploreNumeric;
  });

  return out;
};


// Per-module rules for Explore（单变量 + 可选单分组）
export const exploreRules: Rules = {
  name: '探索分析',
  description: '单变量探索；可选单个分组（仅分类型）',
  requiredVars: ['dependent'],
  optionalVars: [],
  supportsGrouping: true,
  isSuitable: (col: ColumnMeta, role: string, ctx) => {
    if (role === 'grouping') {
      const thr = Math.max(20, Math.floor((ctx?.totalRows ?? 0) * 0.1));
      return sharedRuleHelpers.requireCategorical(col, thr).ok;
    }
    // dependent：数值或分类型均可
    return !!col;
  },
  explain: (col: ColumnMeta, role: string, ctx) => {
    if (role === 'grouping') {
      const thr = Math.max(20, Math.floor((ctx?.totalRows ?? 0) * 0.1));
      return sharedRuleHelpers.requireCategorical(col, thr, col?.unique_count);
    }
    return { ok: true };
  },
};

