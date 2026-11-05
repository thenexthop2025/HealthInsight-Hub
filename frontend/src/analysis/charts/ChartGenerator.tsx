/**
 * 图表生成器
 */

import React from 'react';
import { Empty } from 'antd';
import { Analysis, AnalysisType } from '../types/analysis';
import { resolveAnalysisType } from '../config/analysisConfig';
import { DescriptiveCharts } from './DescriptiveCharts';
import { ChiSquareCharts } from './ChiSquareCharts';
import { CorrelationCharts } from './CorrelationCharts';
import { RegressionCharts } from './RegressionCharts';
import { generateStatisticsTable as generateStatsTable } from './StatisticsTable';
import { generateFormulas as generateFormulasComponent } from './Formulas';

export const generateChart = (analysis: Analysis, chartType?: string) => {
  if (!analysis.results) {
    return <Empty description="暂无分析结果" />;
  }

  const actualType = resolveAnalysisType(analysis);
  const results = typeof analysis.results === 'string' 
    ? JSON.parse(analysis.results) 
    : analysis.results;

  // 根据分析类型选择对应的图表组件
  switch (actualType) {
    case 'descriptive':
    case 'frequency':
    case 'crosstab':
    case 'explore':
    case 'pp_plot':
      return <DescriptiveCharts 
        analysis={analysis} 
        chartType={chartType || 'bar'} 
        results={results} 
      />;
    
    case 'chi_square':
      return <ChiSquareCharts 
        analysis={analysis} 
        chartType={chartType || 'heatmap'} 
        results={results} 
      />;
    
    case 'correlation':
      return <CorrelationCharts 
        analysis={analysis} 
        chartType={chartType || 'heatmap'} 
        results={results} 
      />;
    
    case 'logistic_regression':
    case 'linear_regression':
      return <RegressionCharts 
        analysis={analysis} 
        chartType={chartType || 'scatter'} 
        results={results} 
      />;
    
    default:
      return <Empty description="暂不支持此分析类型的图表" />;
  }
};

export const generateStatisticsTable = (analysis: Analysis, chartType?: string) => {
  return generateStatsTable(analysis, chartType);
};

export const generateFormulas = (analysis: Analysis) => {
  return generateFormulasComponent(analysis);
};
