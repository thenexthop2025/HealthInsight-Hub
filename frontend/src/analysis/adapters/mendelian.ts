import type { Rules, ColumnMeta } from './types';
/**
 * Adapter for Mendelian randomization results
 */

export interface MendelianAdapted {
  scatter?: Array<{ x: number; y: number; label?: string }>;
  funnel?: Array<{ se: number; beta: number; label?: string }>;
  forest?: Array<{ study: string; effect: number; ci: [number, number] }>; 
}

const toNum = (v: any): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

export const adaptMendelian = (raw: any): MendelianAdapted => {
  if (!raw || typeof raw !== 'object') return {};
  const scatter = Array.isArray(raw.scatter)
    ? raw.scatter.map((p: any) => ({ x: toNum(p.x ?? p.exposure ?? 0), y: toNum(p.y ?? p.outcome ?? 0), label: p.label }))
    : undefined;
  const funnel = Array.isArray(raw.funnel)
    ? raw.funnel.map((p: any) => ({ se: toNum(p.se ?? p.stderr ?? 0), beta: toNum(p.beta ?? 0), label: p.label }))
    : undefined;
  const forest = Array.isArray(raw.forest)
    ? raw.forest.map((r: any) => ({ study: String(r.study ?? r.name ?? ''), effect: toNum(r.effect ?? 0), ci: [toNum(r.ci?.[0] ?? r.lcl ?? 0), toNum(r.ci?.[1] ?? r.ucl ?? 0)] }))
    : undefined;
  return { scatter, funnel, forest };
};

export const mendelianRules: Rules = {
  name: '孟德尔随机化',
  description: '工具变量因果推断',
  requiredVars: ['exposure', 'outcome', 'instrument'],
  optionalVars: [],
  supportsGrouping: false,
  isSuitable: (col: ColumnMeta, role: string) => {
    if (role === 'instrument') return !!col?.is_numeric && (col?.unique_count ?? 0) > 2;
    return !!col?.is_numeric;
  },
  explain: (col: ColumnMeta, role: string) => {
    if (role === 'instrument') {
      const ok = !!col?.is_numeric && (col?.unique_count ?? 0) > 2;
      return { ok, reason: ok ? undefined : '工具变量需数值且唯一值>2' };
    }
    return { ok: !!col?.is_numeric, reason: !!col?.is_numeric ? undefined : '需数值型变量' };
  },
};
