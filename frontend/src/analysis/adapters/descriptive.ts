import type { Rules, ColumnMeta } from './types';
/**
 * Adapter for Descriptive/Explore analysis results
 * Normalizes to per-variable object with either `descriptive` or `overall` and optional `grouped_stats`.
 */

export type DescriptiveAdapted = Record<string, any>;

const isMetrics = (obj: any): boolean => {
  if (!obj || typeof obj !== 'object') return false;
  // 具备常见统计量字段之一即可视为“指标对象”
  return (
    'mean' in obj || 'std' in obj || 'min' in obj || 'max' in obj || 'median' in obj || 'count' in obj
  );
};

export const adaptDescriptive = (raw: any): DescriptiveAdapted => {
  if (!raw || typeof raw !== 'object') return {};

  const out: Record<string, any> = {};
  Object.entries(raw).forEach(([variable, payload]: [string, any]) => {
    if (!payload || typeof payload !== 'object') {
      out[variable] = payload;
      return;
    }
    // accept several shapes and normalize keys
    const descriptiveRaw = payload.descriptive || payload.descriptive_stats || payload.overall;
    const grouped = payload.grouped_stats || payload.by_group;
    const groupBy = payload.group_by || payload.grouping_variable;
    const normalized: any = { variable };
    if (isMetrics(descriptiveRaw)) normalized.descriptive = descriptiveRaw;
    if (grouped) normalized.grouped_stats = grouped;
    if (groupBy) normalized.group_by = groupBy;
    out[variable] = normalized;
  });

  return out;
};

// Per-module rules for Descriptive/Explore（共享此规则）

export const descriptiveRules: Rules = {
  name: '描述性分析',
  description: '单变量/分组的描述统计',
  requiredVars: [],
  optionalVars: ['dependent'],
  supportsGrouping: true,
  isSuitable: (_col: ColumnMeta) => true,
  explain: (_col: ColumnMeta) => ({ ok: true }),
};
