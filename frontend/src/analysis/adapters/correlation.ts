import type { Rules, ColumnMeta } from './types';
/**
 * Adapter for Correlation analysis results
 */

export interface CorrelationAdapted {
  variables: string[];
  correlations: Record<string, {
    pearson?: { r: number; p: number };
    spearman?: { r: number; p: number };
    kendall?: { r: number; p: number };
    sample_size?: number;
  }>;
}

const toNum = (v: any): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

export const adaptCorrelation = (raw: any): CorrelationAdapted => {
  if (!raw || typeof raw !== 'object') return { variables: [], correlations: {} };
  const out: CorrelationAdapted = { variables: raw.variables || [], correlations: {} };
  const src = raw.correlations || raw.results || raw;
  Object.entries(src || {}).forEach(([pair, v]: [string, any]) => {
    out.correlations[pair] = {
      pearson: v?.pearson ? { r: toNum(v.pearson.r), p: toNum(v.pearson.p) } : undefined,
      spearman: v?.spearman ? { r: toNum(v.spearman.r), p: toNum(v.spearman.p) } : undefined,
      kendall: v?.kendall ? { r: toNum(v.kendall.r), p: toNum(v.kendall.p) } : undefined,
      sample_size: v?.sample_size !== undefined ? toNum(v.sample_size) : undefined,
    };
  });
  return out;
};

export const correlationRules: Rules = {
  name: '相关性分析',
  description: '连续变量（及部分二值/等级变量）之间的相关性',
  requiredVars: ['dependent'],
  optionalVars: [],
  supportsGrouping: false,
  isSuitable: (col: ColumnMeta) => {
    // 允许：数值型；或非数值但唯一值很少（视为二值/等级变量）
    if (col?.is_numeric) return true;
    const u = col?.unique_count ?? 0;
    return u > 1 && u <= 10; // 阈值：≤10 视作可使用秩相关/点二列
  },
  explain: (col: ColumnMeta) => {
    if (col?.is_numeric) return { ok: true };
    const u = col?.unique_count ?? 0;
    const ok = u > 1 && u <= 10;
    return { ok, reason: ok ? undefined : '建议选择连续变量或少数等级变量(≤10个唯一值)' };
  },
};
