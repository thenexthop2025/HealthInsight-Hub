/**
 * 分析配置
 */

import { ChartConfig, AnalysisType } from '../types/analysis';

export const ANALYSIS_TYPES: Record<AnalysisType, string> = {
  descriptive: '描述性统计',
  frequency: '频率分析',
  crosstab: '交叉表分析',
  explore: '探索性分析',
  pp_plot: 'P-P图',
  correlation: '相关性分析',
  chi_square: '卡方检验',
  logistic_regression: '二分类逻辑回归',
  logistic_regression_multinomial: '无序多分类逻辑回归',
  logistic_regression_ordinal: '有序多分类逻辑回归',
  logistic_regression_conditional: '条件逻辑回归（分层）',
  linear_regression: '线性回归',
  machine_learning: '机器学习',
  stratified: '分层分析',
  mendelian_randomization: '孟德尔随机化'
};

export const DESCRIPTIVE_SUBTYPES = {
  descriptive: '描述性统计',
  frequency: '频率分析',
  crosstab: '交叉表分析',
  explore: '探索性分析',
  pp_plot: 'P-P图'
};

export const getChartConfig = (analysisType: AnalysisType): ChartConfig[] => {
  const configs: Record<AnalysisType, ChartConfig[]> = {
    descriptive: [
      { type: 'boxplot', name: '箱线图', description: '展示分布和分位数' },
      { type: 'histogram', name: '直方图', description: '展示数值分布' }
    ],
    frequency: [
      { type: 'bar', name: '频数柱状图', description: '展示每个类别的频数' },
      { type: 'pie', name: '比例饼图', description: '展示各类别占比' },
      { type: 'table', name: '频率表', description: '统计频数及有效百分比' }
    ],
    crosstab: [
      { type: 'heatmap', name: '热力图', description: '展示交叉表数据' },
      { type: 'bar', name: '堆叠柱状图', description: '展示交叉表分布' },
      { type: 'table', name: '交叉表', description: '原始交叉表数据' }
    ],
    explore: [
      { type: 'histogram', name: '直方图', description: '展示数值分布' },
      { type: 'boxplot', name: '箱线图', description: '展示数据分布特征' },
      { type: 'scatter', name: '散点图', description: '展示变量关系' }
    ],
    pp_plot: [
      { type: 'scatter', name: 'P-P图', description: '正态性检验图' }
    ],
    correlation: [
      { type: 'heatmap', name: '相关性热力图', description: '展示变量间相关性' },
      { type: 'scatter', name: '散点图矩阵', description: '展示变量关系' },
      { type: 'table', name: '相关性表', description: '相关系数矩阵' }
    ],
    chi_square: [
      { type: 'heatmap', name: '观察频数热力图', description: '展示观察频数分布' },
      { type: 'bar_chart', name: '频数条形图', description: '展示各类别频数' },
      { type: 'expected_vs_observed', name: '期望vs观察', description: '对比期望频数与观察频数' },
      { type: 'residuals', name: '残差图', description: '展示标准化残差' },
      { type: 'mosaic', name: '马赛克图', description: '展示联合概率分布' },
      { type: 'stacked_bar', name: '堆叠柱状图', description: '展示交叉表分布' }
    ],
    logistic_regression: [
      { type: 'roc', name: 'ROC曲线', description: '模型性能评估' },
      { type: 'cm', name: '混淆矩阵', description: '分类性能评估' },
      { type: 'coefficients', name: '系数图', description: '展示回归系数/OR' },
      { type: 'table', name: '回归表', description: '回归分析结果' }
    ],
    logistic_regression_multinomial: [
      { type: 'cm', name: '混淆矩阵', description: '分类性能评估' },
      { type: 'coefficients', name: '系数图', description: '展示回归系数' },
      { type: 'table', name: '回归表', description: '回归分析结果' }
    ],
    logistic_regression_ordinal: [
      { type: 'coefficients', name: '系数图', description: '展示回归系数' },
      { type: 'table', name: '回归表', description: '回归分析结果（含阈值）' }
    ],
    logistic_regression_conditional: [
      { type: 'roc', name: 'ROC曲线', description: '模型性能评估' },
      { type: 'cm', name: '混淆矩阵', description: '分类性能评估' },
      { type: 'coefficients', name: '系数图', description: '展示回归系数/OR' },
      { type: 'table', name: '回归表', description: '回归分析结果' }
    ],
    linear_regression: [
      { type: 'scatter', name: '散点图', description: '展示变量关系' },
      { type: 'residuals', name: '残差图', description: '展示残差分布' },
      { type: 'coefficients', name: '系数图', description: '展示回归系数' },
      { type: 'table', name: '回归表', description: '回归分析结果' }
    ],
    machine_learning: [
      { type: 'confusion_matrix', name: '混淆矩阵', description: '分类性能评估' },
      { type: 'feature_importance', name: '特征重要性', description: '展示特征重要性' },
      { type: 'table', name: '性能指标', description: '模型性能指标' }
    ],
    stratified: [
      { type: 'bar', name: '分层柱状图', description: '展示分层结果' },
      { type: 'table', name: '分层表', description: '分层分析结果' }
    ],
    mendelian_randomization: [
      { type: 'scatter', name: '散点图', description: '展示工具变量关系' },
      { type: 'forest', name: '森林图', description: '展示MR结果' },
      { type: 'table', name: 'MR表', description: '孟德尔随机化结果' }
    ]
  };

  return configs[analysisType] || [];
};

export const resolveAnalysisType = (analysis: any): AnalysisType => {
  if (analysis.analysis_type === 'descriptive') {
    const params = analysis.parameters;
    if (typeof params === 'string') {
      try {
        const parsed = JSON.parse(params);
        return parsed.descriptive_subtype || 'descriptive';
      } catch {
        return 'descriptive';
      }
    } else if (params && params.descriptive_subtype) {
      return params.descriptive_subtype;
    }
    return 'descriptive';
  }
  return analysis.analysis_type as AnalysisType;
};
