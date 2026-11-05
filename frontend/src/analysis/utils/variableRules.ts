/**
 * Variable suitability rules and analysis type configuration
 *
 * This module centralizes the rules that determine whether a column
 * can be used as a dependent/independent/grouping/etc variable for each
 * analysis type. Keeping it here avoids scattered hard‑coded logic in components.
 */

export type ColumnMeta = {
  name: string;
  is_numeric: boolean;
  is_categorical: boolean;
  unique_count?: number;
};

export type AnalysisType =
  | 'descriptive'
  | 'frequency'
  | 'crosstab'
  | 'correlation'
  | 'regression'
  | 'chi_square'
  | 'stratified'
  | 'mendelian_randomization'
  | 'explore';

export interface AnalysisTypeConfig {
  name: string;
  description: string;
  /** 必填变量 */
  requiredVars: Array<'dependent' | 'independent' | 'exposure' | 'outcome' | 'instrument' | 'stratum'>;
  /** 可选变量 */
  optionalVars: Array<'dependent' | 'independent'>;
  /** 是否支持分组变量 */
  supportsGrouping: boolean;
}

/**
 * Get analysis type configuration. Keep UI‑agnostic here (no icon/color in util).
 */
export const getAnalysisTypeConfig = (type: AnalysisType): AnalysisTypeConfig => {
  const configs: Record<AnalysisType, AnalysisTypeConfig> = {
    descriptive: {
      name: '描述性分析',
      description: '计算基本统计量，包括均值、标准差、中位数等',
      requiredVars: [],
      optionalVars: ['dependent'],
      supportsGrouping: true,
    },
    frequency: {
      name: '频率分析',
      description: '分析分类变量的频数分布',
      requiredVars: [],
      optionalVars: ['dependent'],
      supportsGrouping: false,
    },
    crosstab: {
      name: '交叉表分析',
      description: '分析两个分类变量之间的关联关系',
      requiredVars: ['dependent', 'independent'],
      optionalVars: [],
      supportsGrouping: false,
    },
    correlation: {
      name: '相关性分析',
      description: '分析数值变量之间的线性相关关系',
      requiredVars: ['dependent'],
      optionalVars: [],
      supportsGrouping: false,
    },
    regression: {
      name: '回归分析',
      description: '建立因变量与自变量的回归模型',
      requiredVars: ['dependent', 'independent'],
      optionalVars: [],
      supportsGrouping: false,
    },
    chi_square: {
      name: '卡方检验',
      description: '检验分类变量之间的独立性',
      requiredVars: ['dependent', 'independent'],
      optionalVars: [],
      supportsGrouping: false,
    },
    stratified: {
      name: '分层分析',
      description: '按分层变量进行分层统计分析',
      requiredVars: ['dependent', 'independent', 'stratum'],
      optionalVars: [],
      supportsGrouping: false,
    },
    mendelian_randomization: {
      name: '孟德尔随机化',
      description: '使用工具变量进行因果推断',
      requiredVars: ['exposure', 'outcome', 'instrument'],
      optionalVars: [],
      supportsGrouping: false,
    },
    explore: {
      name: '探索分析',
      description: '探索性数据分析，包括分布检验和异常值检测',
      requiredVars: ['dependent'],
      optionalVars: ['independent'],
      supportsGrouping: true,
    },
  };
  return configs[type];
};

/**
 * 判断变量是否适合参与指定分析。
 *
 * @param col 列元数据
 * @param analysisType 分析类型
 * @param columnType 变量角色（dependent/independent/stratum/exposure/outcome/instrument/grouping）
 * @param totalRows 数据集行数（用于动态阈值）
 */
export const isVariableSuitable = (
  col: ColumnMeta,
  analysisType: AnalysisType | string,
  columnType: string,
  totalRows: number = 0
): boolean => {
  if (!col || !analysisType) return false;

  const unique = col.unique_count ?? 0;
  const maxDiscreteForCategory = Math.max(50, Math.floor(totalRows * 0.2));
  const tighterDiscrete = Math.max(20, Math.floor(totalRows * 0.1));
  const stratumDiscrete = Math.max(10, Math.floor(totalRows * 0.05));

  switch (analysisType as AnalysisType) {
    case 'descriptive':
      return true; // 描述性分析支持所有变量类型

    case 'frequency':
      return col.is_categorical || (!col.is_numeric && unique <= maxDiscreteForCategory);

    case 'crosstab':
      // 行变量/列变量都应为分类变量（或离散唯一值不高）
      return col.is_categorical || (!col.is_numeric && unique <= tighterDiscrete);

    case 'correlation':
    case 'regression':
      return col.is_numeric;

    case 'chi_square':
      if (columnType === 'dependent' || columnType === 'independent') {
        return col.is_categorical || (!col.is_numeric && unique <= tighterDiscrete);
      }
      return false;

    case 'stratified':
      if (columnType === 'stratum') {
        return col.is_categorical || (!col.is_numeric && unique <= stratumDiscrete);
      }
      return col.is_numeric; // 其他变量默认连续

    case 'mendelian_randomization':
      if (columnType === 'exposure' || columnType === 'outcome') return col.is_numeric;
      if (columnType === 'instrument') return col.is_numeric && unique > 2;
      return col.is_numeric;

    case 'explore':
      if (columnType === 'dependent') return col.is_numeric;
      if (columnType === 'independent') return col.is_numeric || col.is_categorical;
      return false;

    default:
      return false;
  }
};


/**
 * 评估并给出不符合时的原因说明，便于UI做灰显+提示。
 */
export type SuitabilityResult = { ok: boolean; reason?: string };

export const assessVariableSuitability = (
  col: ColumnMeta,
  analysisType: AnalysisType | string,
  columnType: string,
  totalRows: number = 0
): SuitabilityResult => {
  if (!col || !analysisType) return { ok: false, reason: '无效字段' };

  const unique = col.unique_count ?? 0;
  const maxDiscreteForCategory = Math.max(50, Math.floor(totalRows * 0.2));
  const tighterDiscrete = Math.max(20, Math.floor(totalRows * 0.1));
  const stratumDiscrete = Math.max(10, Math.floor(totalRows * 0.05));

  const requireNumeric = () => ({ ok: col.is_numeric, reason: col.is_numeric ? undefined : '需数值型变量' });
  const requireCategorical = (thr: number) => ({
    ok: col.is_categorical || (!col.is_numeric && unique <= thr),
    reason: col.is_categorical || (!col.is_numeric && unique <= thr)
      ? undefined
      : `需分类型或唯一值≤${thr}（当前${unique}）`,
  });

  switch (analysisType as AnalysisType) {
    case 'descriptive':
      return { ok: true };

    case 'frequency':
      return requireCategorical(maxDiscreteForCategory);

    case 'crosstab':
      // 行/列变量均允许，均需分类型或离散唯一值较低
      return requireCategorical(tighterDiscrete);

    case 'correlation':
    case 'regression':
      return requireNumeric();

    case 'chi_square':
      if (columnType === 'dependent' || columnType === 'independent') {
        return requireCategorical(tighterDiscrete);
      }
      return { ok: false, reason: '仅支持两个分类变量' };

    case 'stratified':
      if (columnType === 'stratum') {
        return requireCategorical(stratumDiscrete);
      }
      return requireNumeric();

    case 'mendelian_randomization':
      if (columnType === 'exposure' || columnType === 'outcome') return requireNumeric();
      if (columnType === 'instrument') {
        const ok = col.is_numeric && unique > 2;
        return ok ? { ok } : { ok, reason: '需数值型且唯一值>2的工具变量' };
      }
      return requireNumeric();

    case 'explore':
      if (columnType === 'dependent') return requireNumeric();
      if (columnType === 'independent') return { ok: col.is_numeric || col.is_categorical, reason: '需数值或分类型' };
      return { ok: false, reason: '不支持的变量角色' };

    default:
      return { ok: false, reason: '未知分析类型' };
  }
};


