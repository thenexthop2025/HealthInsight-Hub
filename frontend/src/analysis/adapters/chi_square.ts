import type { Rules, ColumnMeta } from './types';
/**
 * Adapter for Chi-square test results
 * Normalizes to a stable shape used by charts and tables.
 */

export interface ChiSquareAdapted {
  contingency_table: Record<string, Record<string, number>>;
  expected: Record<string, Record<string, number>>;
  residuals: Record<string, Record<string, number>>;
  adjusted_residuals?: Record<string, Record<string, number>>;
  chi_square_statistic?: number;
  p_value?: number;
  degrees_of_freedom?: number;
  cramers_v?: number;
  contingency_coefficient?: number;
  sample_size?: number;
  fisher_exact?: { odds_ratio: number; p_value: number } | null;
  yates_correction?: { chi_square: number; p_value: number } | null;
  odds_ratio_ci?: { odds_ratio: number; ci_95: [number, number]; method: string } | null;
  warnings?: any;
  post_hoc?: { cell_p_value?: any; cell_p_value_holm?: any } | null;
  mantel_haenszel?: {
    common_or?: number | null;
    chi_square?: number | null;
    homogeneity_p?: number | null;
    stratify_by?: string | null;
    strata?: any;
  } | null;
}

const toNum = (v: any): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

const normalizeTable = (table: any): Record<string, Record<string, number>> => {
  const out: Record<string, Record<string, number>> = {};
  Object.entries(table || {}).forEach(([row, cols]: [string, any]) => {
    if (!cols || typeof cols !== 'object') return;
    out[row] = {};
    Object.entries(cols).forEach(([col, val]: [string, any]) => {
      out[row][col] = toNum(val);
    });
  });
  return out;
};

export const adaptChiSquare = (raw: any): ChiSquareAdapted => {
  if (!raw || typeof raw !== 'object') {
    return { contingency_table: {}, expected: {}, residuals: {} };
  }

  // accept multiple field names
  const contingency = normalizeTable(raw.contingency_table || raw.counts || raw.table || {});
  const expected = normalizeTable(raw.expected || raw.expected_counts || {});
  const residuals = normalizeTable(raw.residuals || raw.standardized_residuals || {});
  const adjusted = normalizeTable(raw.adjusted_residuals || {});

  return {
    contingency_table: contingency,
    expected,
    residuals,
    adjusted_residuals: adjusted,
    chi_square_statistic: toNum(raw.chi_square_statistic ?? raw.chi2 ?? raw.statistic),
    p_value: typeof raw.p_value === 'number' ? raw.p_value : parseFloat(String(raw.p_value ?? NaN)),
    degrees_of_freedom: toNum(raw.degrees_of_freedom ?? raw.df),
    cramers_v: raw.cramers_v !== undefined ? toNum(raw.cramers_v) : undefined,
    contingency_coefficient: raw.contingency_coefficient !== undefined ? toNum(raw.contingency_coefficient) : undefined,
    sample_size: raw.sample_size !== undefined ? toNum(raw.sample_size) : undefined,
    fisher_exact: raw.fisher_exact || null,
    yates_correction: raw.yates_correction || null,
    odds_ratio_ci: raw.odds_ratio_ci || null,
    warnings: raw.warnings,
    post_hoc: raw.post_hoc || null,
    mantel_haenszel: raw.mantel_haenszel || null,
  };
};

export const chiSquareRules: Rules = {
  name: '卡方检验',
  description: '分类变量独立性检验',
  requiredVars: ['dependent', 'independent'],
  optionalVars: [],
  supportsGrouping: false,
  isSuitable: (col: ColumnMeta) => !col?.is_numeric,
  explain: (col: ColumnMeta) => ({ ok: !col?.is_numeric, reason: !col?.is_numeric ? undefined : '需分类型变量' }),
};
