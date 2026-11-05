/**
 * Analysis result adapters registry
 * Each adapter normalizes backend payloads into a stable, typed shape
 * for the corresponding analysis module.
 */

// 延迟引用以降低循环依赖风险：在使用时 require（CRA/webpack 允许）

export type AnalysisAdapter = (raw: any) => any;
export type { ColumnMeta, SuitabilityCtx, Suitability, Rules } from './types';

const registry: Record<string, AnalysisAdapter> = {
  crosstab: (raw) => require('./crosstab').adaptCrosstab(raw),
  chi_square: (raw) => require('./chi_square').adaptChiSquare(raw),
  descriptive: (raw) => require('./descriptive').adaptDescriptive(raw),
  explore: (raw) => require('./explore').adaptExplore(raw),
  frequency: (raw) => require('./frequency').adaptFrequency(raw),
  correlation: (raw) => require('./correlation').adaptCorrelation(raw),
  logistic_regression: (raw) => require('./regression').adaptLogisticBinary(raw),
  logistic_regression_multinomial: (raw) => require('./regression').adaptLogisticMultinomial(raw),
  logistic_regression_ordinal: (raw) => require('./regression').adaptLogisticOrdinal(raw),
  logistic_regression_conditional: (raw) => require('./regression').adaptLogisticConditional(raw),
  linear_regression: (raw) => require('./regression').adaptLinear(raw),
  stratified: (raw) => require('./stratified').adaptStratified(raw),
  mendelian_randomization: (raw) => require('./mendelian').adaptMendelian(raw),
};

export const adaptResult = (analysisType: string, raw: any): any => {
  try {
    const adapter = registry[analysisType];
    if (!adapter) return raw;
    return adapter(raw);
  } catch {
    return raw;
  }
};


