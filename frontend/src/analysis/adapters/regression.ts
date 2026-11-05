import type { Rules, ColumnMeta } from './types';
/**
 * Adapter for Regression (linear/logistic) results
 */

export interface RegressionAdapted {
  model_summary?: Record<string, number>;
  model_performance?: Record<string, number | null>;
  coefficients?: Array<{
    variable: string;
    coefficient?: number;
    std_error?: number;
    t_statistic?: number;
    p_value?: number;
    odds_ratio?: number;
    significant?: boolean;
    confidence_interval?: [number, number];
  }>;
  residuals?: any;
  predictions?: number[];
  actual_values?: number[];
  diagnostics?: any;
  sample_size?: number;
  training_size?: number;
  test_size?: number;
}

const toNum = (v: any): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
};

export const adaptRegression = (raw: any): RegressionAdapted => {
  if (!raw || typeof raw !== 'object') return {};
  const coefSrc = raw.coefficients || raw.params || [];
  const coefs: RegressionAdapted['coefficients'] = Array.isArray(coefSrc)
    ? coefSrc.map((c: any) => {
        const ci = c.confidence_interval
          ? ([toNum(c.confidence_interval[0]), toNum(c.confidence_interval[1])] as [number, number])
          : undefined;
        return {
          variable: String(c.variable ?? c.name ?? c.term ?? ''),
          coefficient: c.coefficient !== undefined ? toNum(c.coefficient) : undefined,
          std_error: c.std_error !== undefined ? toNum(c.std_error) : undefined,
          t_statistic: c.t_statistic !== undefined ? toNum(c.t_statistic) : undefined,
          p_value: c.p_value !== undefined ? toNum(c.p_value) : undefined,
          odds_ratio: c.odds_ratio !== undefined ? toNum(c.odds_ratio) : undefined,
          significant: !!c.significant,
          confidence_interval: ci,
        };
      })
    : [];

  const modelSummary = raw.model_summary || raw.summary || undefined;
  // 兼容：
  // - 线性回归：predictions 为数值数组
  // - 逻辑回归变体：predictions 为对象，含 test_probabilities/test_actual
  const predictions = (raw && raw.predictions && Array.isArray(raw.predictions.test_probabilities))
    ? {
        test_probabilities: raw.predictions.test_probabilities,
        test_actual: raw.predictions.test_actual,
        test_predictions: raw.predictions.test_predictions,
      }
    : raw.predictions;
  const actualValues = (raw && raw.predictions && Array.isArray(raw.predictions.test_actual))
    ? raw.predictions.test_actual
    : raw.actual_values;
  return {
    model_summary: modelSummary,
    model_performance: raw.model_performance,
    coefficients: coefs,
    residuals: raw.residuals,
    predictions,
    actual_values: actualValues,
    diagnostics: raw.diagnostics || (raw.confusion_matrix ? { confusion_matrix: raw.confusion_matrix } : undefined),
    sample_size: typeof raw.sample_size === 'number' ? raw.sample_size : undefined,
    training_size: typeof raw.training_size === 'number' ? raw.training_size : undefined,
    test_size: typeof raw.test_size === 'number' ? raw.test_size : undefined,
  };
};

// 独立适配器：线性回归
export const adaptLinear = (raw: any): RegressionAdapted => adaptRegression(raw);

// 独立适配器：二分类逻辑回归
export const adaptLogisticBinary = (raw: any): RegressionAdapted => adaptRegression(raw);

// 独立适配器：无序多分类逻辑回归
export const adaptLogisticMultinomial = (raw: any): RegressionAdapted => adaptRegression(raw);

// 独立适配器：有序多分类逻辑回归
export const adaptLogisticOrdinal = (raw: any): RegressionAdapted => adaptRegression(raw);

// 独立适配器：条件逻辑回归
export const adaptLogisticConditional = (raw: any): RegressionAdapted => adaptRegression(raw);

// 线性回归规则：因变量/自变量需数值
export const linearRegressionRules: Rules = {
  name: '线性回归',
  description: '连续因变量线性模型',
  requiredVars: ['dependent', 'independent'],
  optionalVars: [],
  supportsGrouping: false,
  isSuitable: (col: ColumnMeta) => !!col?.is_numeric,
  explain: (col: ColumnMeta) => ({ ok: !!col?.is_numeric, reason: col?.is_numeric ? undefined : '需数值型变量' }),
};

// 逻辑回归规则：
// - 因变量：必须二分类（数值或分类型，唯一值=2）
// - 自变量：数值型，或分类型且唯一值不超过20（将进行哑变量编码）
export const logisticRegressionRules: Rules = {
  name: '逻辑回归',
  description: '二分类因变量的对数几率模型',
  requiredVars: ['dependent', 'independent'],
  optionalVars: [],
  supportsGrouping: false,
  isSuitable: (col: ColumnMeta, role: string) => {
    if (role === 'dependent') {
      const isBinaryNumeric = !!col.is_numeric && (col.unique_count === 2);
      const isBinaryCategorical = !!col.is_categorical && (col.unique_count === 2);
      return isBinaryNumeric || isBinaryCategorical;
    }
    // independent
    const okNumeric = !!col.is_numeric;
    const okCategorical = !!col.is_categorical && (typeof col.unique_count === 'number' ? col.unique_count <= 20 : true);
    return okNumeric || okCategorical;
  },
  explain: (col: ColumnMeta, role: string) => {
    if (role === 'dependent') {
      const ok = (col.is_numeric || col.is_categorical) && col.unique_count === 2;
      return { ok, reason: ok ? undefined : '需二分类（仅两种取值）' };
    }
    const ok = !!col.is_numeric || (!!col.is_categorical && (col.unique_count ?? 0) <= 20);
    return { ok, reason: ok ? undefined : '建议数值或唯一值≤20的分类变量' };
  },
};

// 子类化规则 - 二分类
export const logisticBinaryRules: Rules = {
  name: '二分类逻辑回归',
  description: '因变量需二分类；自变量数值或可哑变量化',
  requiredVars: ['dependent', 'independent'],
  optionalVars: [],
  supportsGrouping: false,
  isSuitable: (col: ColumnMeta, role?: string) => {
    if (role === 'dependent') {
      return (!!col.is_numeric || !!col.is_categorical) && (col.unique_count === 2);
    }
    return !!col.is_numeric || (!!col.is_categorical && (col.unique_count ?? 0) <= 20);
  },
  explain: (col: ColumnMeta, role?: string) => {
    if (role === 'dependent') {
      const ok = (col.is_numeric || col.is_categorical) && col.unique_count === 2;
      return { ok, reason: ok ? undefined : '需二分类（仅两种取值）' };
    }
    const ok = !!col.is_numeric || (!!col.is_categorical && (col.unique_count ?? 0) <= 20);
    return { ok, reason: ok ? undefined : '建议数值或唯一值≤20的分类变量' };
  }
};

// 子类化规则 - 无序多分类
export const logisticMultinomialRules: Rules = {
  name: '无序多分类逻辑回归',
  description: '因变量≥3类别；自变量数值或可哑变量化',
  requiredVars: ['dependent', 'independent'],
  optionalVars: [],
  supportsGrouping: false,
  isSuitable: (col: ColumnMeta, role?: string) => {
    if (role === 'dependent') {
      return (col.is_numeric || col.is_categorical) && (col.unique_count ?? 0) >= 3;
    }
    return !!col.is_numeric || (!!col.is_categorical && (col.unique_count ?? 0) <= 20);
  },
  explain: (col: ColumnMeta, role?: string) => {
    if (role === 'dependent') {
      const ok = (col.is_numeric || col.is_categorical) && (col.unique_count ?? 0) >= 3;
      return { ok, reason: ok ? undefined : '需≥3个类别（无序）' };
    }
    const ok = !!col.is_numeric || (!!col.is_categorical && (col.unique_count ?? 0) <= 20);
    return { ok, reason: ok ? undefined : '建议数值或唯一值≤20的分类变量' };
  }
};

// 子类化规则 - 有序多分类
export const logisticOrdinalRules: Rules = {
  name: '有序多分类逻辑回归',
  description: '因变量为有序类别（≥3）；自变量数值或可哑变量化',
  requiredVars: ['dependent', 'independent'],
  optionalVars: [],
  supportsGrouping: false,
  isSuitable: (col: ColumnMeta, role?: string) => {
    if (role === 'dependent') {
      // 无法从元数据判断“有序”，这里只做类别数校验
      return (!!col.is_numeric || !!col.is_categorical) && (col.unique_count ?? 0) >= 3;
    }
    return !!col.is_numeric || (!!col.is_categorical && (col.unique_count ?? 0) <= 20);
  },
  explain: (col: ColumnMeta, role?: string) => {
    if (role === 'dependent') {
      const ok = (col.is_numeric || col.is_categorical) && (col.unique_count ?? 0) >= 3;
      return { ok, reason: ok ? undefined : '需≥3个有序类别' };
    }
    const ok = !!col.is_numeric || (!!col.is_categorical && (col.unique_count ?? 0) <= 20);
    return { ok, reason: ok ? undefined : '建议数值或唯一值≤20的分类变量' };
  }
};

// 子类化规则 - 条件逻辑回归（分层）
export const logisticConditionalRules: Rules = {
  name: '条件逻辑回归（分层）',
  description: '因变量二值，必须提供分层变量；自变量数值或可哑变量化',
  requiredVars: ['dependent', 'independent', 'stratum'],
  optionalVars: [],
  supportsGrouping: false,
  isSuitable: (col: ColumnMeta, role?: string) => {
    if (!col) return false;
    if (role === 'dependent') {
      return (col.is_numeric || col.is_categorical) && col.unique_count === 2;
    }
    return !!col.is_numeric || (!!col.is_categorical && (col.unique_count ?? 0) <= 20);
  },
  explain: (col: ColumnMeta, role?: string) => {
    if (role === 'dependent') {
      const ok = (col.is_numeric || col.is_categorical) && col.unique_count === 2;
      return { ok, reason: ok ? undefined : '需二分类（仅两种取值）' };
    }
    const ok = !!col.is_numeric || (!!col.is_categorical && (col.unique_count ?? 0) <= 20);
    return { ok, reason: ok ? undefined : '建议数值或唯一值≤20的分类变量' };
  }
};
