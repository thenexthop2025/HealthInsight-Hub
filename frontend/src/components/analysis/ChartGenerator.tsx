import React from 'react';
import { Empty } from 'antd';
import DescriptiveCharts from '../charts/DescriptiveCharts';
import FrequencyCharts from '../charts/FrequencyCharts';
import CrosstabCharts from '../charts/CrosstabCharts';
import CorrelationCharts from '../charts/CorrelationCharts';
import LinearRegressionCharts from '../../analysis/charts/LinearRegressionCharts';
import BinaryLogisticCharts from '../../analysis/charts/logistic/BinaryLogisticCharts';
import MultinomialLogisticCharts from '../../analysis/charts/logistic/MultinomialLogisticCharts';
import OrdinalLogisticCharts from '../../analysis/charts/logistic/OrdinalLogisticCharts';
import ConditionalLogisticCharts from '../../analysis/charts/logistic/ConditionalLogisticCharts';
import ChiSquareCharts from '../charts/ChiSquareCharts';
import StratifiedCharts from '../charts/StratifiedCharts';
import MendelianCharts from '../charts/MendelianCharts';
import ExploreCharts from '../charts/ExploreCharts';
import { adaptResult } from '../../analysis/adapters/registry';

interface Analysis {
  id: string;
  analysis_type: string;
  results?: any;
}

interface ChartGeneratorProps {
  analysis: Analysis;
  chartType?: string;
}

const ChartGenerator: React.FC<ChartGeneratorProps> = ({ analysis, chartType }) => {
  if (!analysis.results) {
    return <Empty description="暂无分析结果" />;
  }

  const safeParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch (_) {
      try {
        // 兼容后端可能返回的 NaN/Infinity 等非 JSON 值
        const sanitized = s
          .replace(/\bNaN\b/g, 'null')
          .replace(/\bInfinity\b/g, 'null')
          .replace(/\b-?Infinity\b/g, 'null');
        return JSON.parse(sanitized);
      } catch {
        return null;
      }
    }
  };

  const results = typeof analysis.results === 'string' 
    ? safeParse(analysis.results)
    : analysis.results;

  const actualType = analysis.analysis_type;
  
  // 如果没有指定图表类型，使用第一个可用的图表类型
  if (!chartType) {
    const chartConfigs = getChartConfig(actualType);
    if (chartConfigs.length > 0) {
      chartType = chartConfigs[0].type;
    } else {
      return <Empty description="暂无可用图表" />;
    }
  }

  // 根据分析类型和图表类型生成对应的图表
  const adapted = adaptResult(actualType, results || {});
  const chartComponent = generateChartByType(analysis, actualType, chartType, adapted);
  
  return chartComponent || <Empty description="图表生成失败" />;
};

// 获取图表类型配置
const getChartConfig = (analysisType: string) => {
  const configs: Record<string, Array<{ type: string; name: string }>> = {
    descriptive: [
      { type: 'boxplot', name: '箱线图' },
      { type: 'histogram', name: '直方图' },
    ],
    frequency: [
      { type: 'bar', name: '柱状图' },
      { type: 'pie', name: '饼图' },
    ],
    crosstab: [
      { type: 'heatmap', name: '热力图' },
      { type: 'mosaic', name: '马赛克图' },
      { type: 'stacked_bar', name: '堆叠柱状图' },
      { type: 'residuals', name: '残差图' },
    ],
    correlation: [
      { type: 'heatmap', name: '相关性热力图' },
      { type: 'scatter', name: '散点图矩阵' },
      { type: 'network', name: '网络图' },
    ],
    linear_regression: [
      { type: 'residuals_vs_fitted', name: '拟合值-残差图' },
      { type: 'qq', name: '残差Q-Q图' },
      { type: 'actual_vs_pred', name: '实际值-预测值' },
      { type: 'coef_forest', name: '系数森林图' },
    ],
    logistic_regression: [
      { type: 'roc', name: 'ROC曲线' },
      { type: 'cm', name: '混淆矩阵' },
      { type: 'coefficients', name: '系数图' },
    ],
    logistic_regression_multinomial: [
      { type: 'cm', name: '混淆矩阵' },
      { type: 'coefficients', name: '系数图' },
    ],
    logistic_regression_ordinal: [
      { type: 'coefficients', name: '系数图' },
    ],
    logistic_regression_conditional: [
      { type: 'cm', name: '混淆矩阵' },
      { type: 'coefficients', name: '系数图' },
      { type: 'roc', name: 'ROC曲线' },
    ],
    chi_square: [
      { type: 'heatmap', name: '热力图' },
      { type: 'mosaic', name: '马赛克图' },
      { type: 'stacked_bar', name: '堆叠柱状图' },
      { type: 'residuals', name: '残差图' },
    ],
    stratified: [
      { type: 'forest', name: '森林图' },
      { type: 'funnel', name: '漏斗图' },
      { type: 'bar', name: '分层柱状图' },
    ],
    mendelian_randomization: [
      { type: 'scatter', name: '散点图' },
      { type: 'funnel', name: '漏斗图' },
      { type: 'forest', name: '森林图' },
    ],
    explore: [
      { type: 'histogram', name: '直方图' },
      { type: 'boxplot', name: '箱线图' },
      { type: 'qq', name: 'Q-Q图' },
    ],
  };
  return configs[analysisType] || [];
};

// 根据分析类型和图表类型生成图表
const generateChartByType = (analysis: Analysis, analysisType: string, chartType: string, adaptedResults: any) => {
  switch (analysisType) {
    case 'descriptive':
      return <DescriptiveCharts analysis={analysis} chartType={chartType} results={adaptedResults} />;
    case 'frequency':
      return <FrequencyCharts analysis={analysis} chartType={chartType} results={adaptedResults} />;
    case 'crosstab': {
      return <CrosstabCharts analysis={analysis} chartType={chartType} results={adaptedResults} />;
    }
    case 'correlation':
      return <CorrelationCharts analysis={analysis} chartType={chartType} results={adaptedResults} />;
    case 'linear_regression':
      return <LinearRegressionCharts analysis={analysis} chartType={chartType} results={adaptedResults} />;
    case 'logistic_regression':
      return <BinaryLogisticCharts analysis={analysis} chartType={chartType} results={adaptedResults} />;
    case 'logistic_regression_multinomial':
      return <MultinomialLogisticCharts analysis={analysis} chartType={chartType} results={adaptedResults} />;
    case 'logistic_regression_ordinal':
      return <OrdinalLogisticCharts analysis={analysis} chartType={chartType} results={adaptedResults} />;
    case 'logistic_regression_conditional':
      return <ConditionalLogisticCharts analysis={analysis} chartType={chartType} results={adaptedResults} />;
    case 'chi_square': {
      return <ChiSquareCharts analysis={analysis} chartType={chartType} results={adaptedResults} />;
    }
    case 'stratified':
      return <StratifiedCharts analysis={analysis} chartType={chartType} results={adaptedResults} />;
    case 'mendelian_randomization':
      return <MendelianCharts analysis={analysis} chartType={chartType} />;
    case 'explore':
      return <ExploreCharts analysis={analysis} chartType={chartType} results={adaptedResults} />;
    default:
      return <Empty description="不支持的分析类型" />;
  }
};


export default ChartGenerator;
