import type { Rules, ColumnMeta } from './types';
import { sharedRuleHelpers } from './types';

/**
 * Adapter for Crosstab analysis results
 * Normalizes to { counts: Record<row, Record<col, number>>, grand_total?: number }
 */

export interface CrosstabAdapted {
  counts: Record<string, Record<string, number>>;
  grand_total?: number;
}

const toNum = (v: any): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

export const adaptCrosstab = (raw: any): CrosstabAdapted => {
  if (!raw || typeof raw !== 'object') return { counts: {} };

  // common shapes: { counts: {row: {col: n}} } or direct { row: {col: n} }
  const counts = raw.counts || raw.contingency_table || raw.table || raw;
  const out: Record<string, Record<string, number>> = {};

  Object.entries(counts || {}).forEach(([row, cols]: [string, any]) => {
    if (!cols || typeof cols !== 'object') return;
    out[row] = {};
    Object.entries(cols).forEach(([col, val]: [string, any]) => {
      out[row][col] = toNum(val);
    });
  });

  // try compute grand total if provided or derivable
  const grand = Object.values(out).reduce((s, cols) => s + Object.values(cols).reduce((t: number, v: any) => t + toNum(v), 0), 0);

  return { counts: out, grand_total: grand };
};

// Per-module variable rules for Crosstab

export const crosstabRules: Rules = {
  name: '交叉表分析',
  description: '两个分类变量的列联计数',
  requiredVars: ['dependent', 'independent'],
  optionalVars: [],
  supportsGrouping: false,
  isSuitable: (col: ColumnMeta, role: string, ctx) => {
    const thr = Math.max(20, Math.floor((ctx?.totalRows ?? 0) * 0.1));
    return sharedRuleHelpers.requireCategorical(col, thr).ok;
  },
  explain: (col: ColumnMeta, role: string, ctx) => {
    const thr = Math.max(20, Math.floor((ctx?.totalRows ?? 0) * 0.1));
    return sharedRuleHelpers.requireCategorical(col, thr, col?.unique_count);
  },
};


