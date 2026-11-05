export type ColumnMeta = { name: string; is_numeric: boolean; is_categorical: boolean; unique_count?: number };
export type SuitabilityCtx = { totalRows?: number };
export type Suitability = { ok: boolean; reason?: string };

export type Rules = {
  name: string;
  description: string;
  requiredVars: Array<'dependent'|'independent'|'exposure'|'outcome'|'instrument'|'stratum'>;
  optionalVars: Array<'dependent'|'independent'>;
  supportsGrouping: boolean;
  isSuitable: (col: ColumnMeta, role: string, ctx?: SuitabilityCtx) => boolean;
  explain: (col: ColumnMeta, role: string, ctx?: SuitabilityCtx) => Suitability;
};

export const sharedRuleHelpers = {
  requireNumeric: (col: ColumnMeta): Suitability => ({ ok: !!col?.is_numeric, reason: col?.is_numeric ? undefined : '需数值型变量' }),
  requireCategorical: (col: ColumnMeta, thr: number, unique?: number): Suitability => {
    const u = unique ?? (col?.unique_count ?? 0);
    const ok = !!(col?.is_categorical || (!col?.is_numeric && u <= thr));
    return { ok, reason: ok ? undefined : `需分类型或唯一值≤${thr}（当前${u}）` };
  },
};


