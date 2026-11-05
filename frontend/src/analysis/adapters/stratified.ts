import type { Rules, ColumnMeta } from './types';
/**
 * Adapter for Stratified analysis results
 * Expected to provide per-stratum summary to support forest/funnel/bar charts.
 */

export interface StratifiedAdaptedEntry {
  stratum: string;
  effect?: number;
  ci?: [number, number];
  weight?: number;
  counts?: Record<string, number>;
  n?: number;
  n0?: number;
  n1?: number;
  notes?: string;
}

export interface StratifiedAdapted {
  measure?: string;
  overall?: { effect?: number; ci?: [number, number]; measure?: string };
  overall_fixed?: { effect?: number; ci?: [number, number]; measure?: string };
  overall_random?: { effect?: number; ci?: [number, number]; measure?: string };
  heterogeneity?: { Q: number; df: number; p_value: number; I2: number };
  auto_binarized?: Record<string, string>;
  notes?: string[];
  strata: StratifiedAdaptedEntry[];
}

const toNum = (v: any): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

export const adaptStratified = (raw: any): StratifiedAdapted => {
  if (!raw || typeof raw !== 'object') return { strata: [] };
  const strataSrc = raw.strata || raw.groups || raw.by_stratum || [];
  const strata: StratifiedAdaptedEntry[] = Array.isArray(strataSrc)
    ? strataSrc.map((s: any) => ({
        stratum: String(s.stratum ?? s.name ?? s.group ?? ''),
        effect: s.effect !== undefined ? toNum(s.effect) : undefined,
        ci: s.ci ? [toNum(s.ci[0]), toNum(s.ci[1])] : undefined,
        weight: s.weight !== undefined ? toNum(s.weight) : undefined,
        counts: s.counts
          ? Object.fromEntries(
              Object.entries(s.counts).map(([k, v]) => [k, toNum(v)])
            )
          : undefined,
        n: s.n !== undefined ? toNum(s.n) : undefined,
        n0: s.n0 !== undefined ? toNum(s.n0) : undefined,
        n1: s.n1 !== undefined ? toNum(s.n1) : undefined,
        notes: s.notes ? String(s.notes) : undefined,
      }))
    : [];
  const toOverall = (obj: any) =>
    obj
      ? {
          effect: obj.effect !== undefined ? toNum(obj.effect) : undefined,
          ci: Array.isArray(obj.ci)
            ? ([toNum(obj.ci[0]), toNum(obj.ci[1])] as [number, number])
            : undefined,
          measure: obj.measure ? String(obj.measure) : undefined,
        }
      : undefined;
  const hetero = raw.heterogeneity
    ? {
        Q: toNum(raw.heterogeneity.Q),
        df: toNum(raw.heterogeneity.df),
        p_value: toNum(raw.heterogeneity.p_value),
        I2: toNum(raw.heterogeneity.I2),
      }
    : undefined;
  return {
    measure: raw.measure ? String(raw.measure) : undefined,
    overall: toOverall(raw.overall),
    overall_fixed: toOverall(raw.overall_fixed),
    overall_random: toOverall(raw.overall_random),
    heterogeneity: hetero,
    auto_binarized: raw.auto_binarized || undefined,
    notes: Array.isArray(raw.notes) ? raw.notes.map((n: any) => String(n)) : undefined,
    strata,
  };
};

export const stratifiedRules: Rules = {
  name: '分层分析',
  description: '按分层变量估计效应',
  requiredVars: ['dependent', 'independent', 'stratum'],
  optionalVars: [],
  supportsGrouping: false,
  isSuitable: (col: ColumnMeta, role: string, ctx) => {
    if (!col) return false;
    const unique = col.unique_count ?? 0;
    const isBinary = unique <= 2;
    if (role === 'stratum') {
      return !col.is_numeric || isBinary;
    }
    if (role === 'dependent' || role === 'independent') {
      return !!col.is_numeric || isBinary;
    }
    return !!col.is_numeric;
  },
  explain: (col: ColumnMeta, role: string) => {
    if (!col) return { ok: false, reason: '无效变量' };
    const unique = col.unique_count ?? 0;
    const isBinary = unique <= 2;
    if (role === 'stratum') {
      const ok = !col.is_numeric || isBinary;
      return {
        ok,
        reason: ok ? undefined : '分层变量建议为分类型（或二分类数值变量）',
      };
    }
    if (role === 'dependent' || role === 'independent') {
      const ok = !!col.is_numeric || isBinary;
      return {
        ok,
        reason: ok ? undefined : '需数值型或二分类变量',
      };
    }
    return { ok: !!col?.is_numeric, reason: !!col?.is_numeric ? undefined : '需数值型变量' };
  },
};
