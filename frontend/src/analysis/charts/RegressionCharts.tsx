/**
 * 回归分析图表组件
 */

import React from 'react';
import ReportEChart from '../../components/charts/ReportEChart';
import { Empty } from 'antd';
import { reportPalette } from '../../theme/reportTheme';
import { Analysis, RegressionResults, LogisticRegressionResults } from '../types/analysis';
import type { EChartsInstance } from 'echarts-for-react';

interface RegressionChartsProps {
  analysis: Analysis;
  chartType: string;
  results: RegressionResults | LogisticRegressionResults;
}

export const RegressionCharts: React.FC<RegressionChartsProps> = ({
  analysis,
  chartType,
  results
}) => {
  const renderEChart = (option: any) => (
    <ReportEChart
      option={option}
      notMerge
      lazyUpdate={false}
      onChartReady={(chart: EChartsInstance) => {
        try { chart.resize(); } catch {}
        setTimeout(() => { try { chart.resize(); } catch {} }, 120);
      }}
      style={{ height: 400 }}
    />
  );
  const renderScatterPlot = () => {
    // 类型守卫：检查是否为线性回归结果
    if (!('actual_values' in results)) {
      return <Empty description="暂无散点图数据" />;
    }
    
    const linearResults = results as RegressionResults;
    const actualValues = linearResults.actual_values || [];
    const predictions = linearResults.predictions || [];
    const dependentVar = linearResults.dependent_variable || 'y';
    const independentVars = linearResults.independent_variables || [];
    
    if (actualValues.length === 0 || predictions.length === 0) {
      return <Empty description="暂无散点图数据" />;
    }

    const scatterData = actualValues.map((actual: number, index: number) => [
      actual, predictions[index] || 0
    ]);

    const option = {
      title: {
        text: '线性回归 - 实际值 vs 预测值',
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const [actual, predicted] = params.data;
          return `实际值: ${actual.toFixed(3)}<br/>预测值: ${predicted.toFixed(3)}`;
        }
      },
      xAxis: {
        type: 'value',
        name: '实际值',
        nameLocation: 'middle',
        nameGap: 30
      },
      yAxis: {
        type: 'value',
        name: '预测值',
        nameLocation: 'middle',
        nameGap: 50
      },
      series: [{
        name: '数据点',
        type: 'scatter',
        data: scatterData,
        symbolSize: 6,
        itemStyle: {
          color: reportPalette.blue,
          opacity: 0.7
        }
      }]
    };

    return renderEChart(option);
  };

  const renderResidualsPlot = () => {
    // 类型守卫：检查是否为线性回归结果
    if (!('residuals' in results)) {
      return <Empty description="暂无残差图数据" />;
    }
    
    const linearResults = results as RegressionResults;
    const residuals = linearResults.residuals?.values || [];
    const predictions = linearResults.predictions || [];
    
    if (residuals.length === 0 || predictions.length === 0) {
      return <Empty description="暂无残差图数据" />;
    }

    const residualData = residuals.map((residual: number, index: number) => [
      predictions[index] || 0, residual
    ]);

    const option = {
      title: {
        text: '线性回归 - 残差图',
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const [predicted, residual] = params.data;
          return `预测值: ${predicted.toFixed(3)}<br/>残差: ${residual.toFixed(3)}`;
        }
      },
      xAxis: {
        type: 'value',
        name: '预测值',
        nameLocation: 'middle',
        nameGap: 30
      },
      yAxis: {
        type: 'value',
        name: '残差',
        nameLocation: 'middle',
        nameGap: 50
      },
      series: [{
        name: '残差',
        type: 'scatter',
        data: residualData,
        symbolSize: 6,
        itemStyle: {
          color: '#52c41a',
          opacity: 0.7
        }
      }]
    };

    return renderEChart(option);
  };

  const renderCoefficientsPlot = () => {
    const coefficients: any[] = Array.isArray((results as any)?.coefficients)
      ? ((results as any).coefficients as any[])
      : [];
    
    const filtered = coefficients.filter((c: any) => typeof c?.coefficient === 'number');
    if (filtered.length === 0) return <Empty description="暂无系数数据" />;

    const coefficientData = filtered.map((coef: any) => ({
      name: String(coef.variable ?? ''),
      value: typeof coef.coefficient === 'number' ? coef.coefficient : 0,
      pValue: typeof coef.p_value === 'number' ? coef.p_value : null,
      significant: !!coef.significant
    }));

    const option = {
      title: {
        text: '回归系数图',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const data = params[0];
          const coef = coefficientData[data.dataIndex];
          const p = typeof coef.pValue === 'number' ? coef.pValue.toFixed(4) : 'N/A';
          return `${coef.name}<br/>系数: ${coef.value.toFixed(4)}<br/>p值: ${p}<br/>显著性: ${coef.significant ? '是' : '否'}`;
        }
      },
      xAxis: {
        type: 'category',
        data: coefficientData.map((coef: any) => coef.name),
        axisLabel: {
          rotate: 45
        }
      },
      yAxis: {
        type: 'value',
        name: '系数值'
      },
      series: [{
        name: '回归系数',
        type: 'bar',
        data: coefficientData.map((coef: any) => ({
          value: coef.value,
          itemStyle: {
            color: coef.significant ? '#f5222d' : '#d9d9d9'
          }
        })),
        label: {
          show: true,
          position: 'top',
          formatter: (params: any) => {
            const coef = coefficientData[params.dataIndex];
            return typeof coef.value === 'number' ? coef.value.toFixed(3) : '';
          }
        }
      }]
    };

    return renderEChart(option);
  };

  const renderROCCurve = () => {
    // 更宽松的兼容：
    // - 结构1：predictions={ test_probabilities:number[][], test_actual:number[] }
    // - 结构2：predictions:number[] (概率) 且 actual_values:number[]
    let proba2D: number[][] = [];
    let actual: number[] = [];

    const anyRes: any = results as any;
    if (anyRes?.predictions && Array.isArray(anyRes.predictions.test_probabilities)) {
      proba2D = anyRes.predictions.test_probabilities as number[][];
      actual = Array.isArray(anyRes.predictions.test_actual) ? anyRes.predictions.test_actual : [];
    } else if (Array.isArray(anyRes?.predictions) && Array.isArray(anyRes?.actual_values)) {
      const probs1D = anyRes.predictions as number[];
      proba2D = probs1D.map((p: number) => [1 - Number(p || 0), Number(p || 0)]);
      actual = anyRes.actual_values as number[];
    }

    if (proba2D.length === 0 || actual.length === 0) {
      return <Empty description="暂无ROC曲线数据" />;
    }

    // 计算ROC曲线数据
    const thresholds = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const rocData = thresholds.map(threshold => {
      const predictions = proba2D.map((prob: number[]) => 
        prob[1] >= threshold ? 1 : 0
      );
      
      const tp = predictions.filter((pred: number, i: number) => pred === 1 && actual[i] === 1).length;
      const fp = predictions.filter((pred: number, i: number) => pred === 1 && actual[i] === 0).length;
      const tn = predictions.filter((pred: number, i: number) => pred === 0 && actual[i] === 0).length;
      const fn = predictions.filter((pred: number, i: number) => pred === 0 && actual[i] === 1).length;
      
      const tpr = tp / (tp + fn); // 真正率
      const fpr = fp / (fp + tn); // 假正率
      
      return [fpr, tpr];
    });

    const option = {
      title: {
        text: 'ROC曲线',
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const [fpr, tpr] = params.data;
          return `假正率: ${fpr.toFixed(3)}<br/>真正率: ${tpr.toFixed(3)}`;
        }
      },
      xAxis: {
        type: 'value',
        name: '假正率 (FPR)',
        nameLocation: 'middle',
        nameGap: 30,
        min: 0,
        max: 1
      },
      yAxis: {
        type: 'value',
        name: '真正率 (TPR)',
        nameLocation: 'middle',
        nameGap: 50,
        min: 0,
        max: 1
      },
      series: [
        {
          name: 'ROC曲线',
          type: 'line',
          data: rocData,
          smooth: true,
          lineStyle: {
            color: reportPalette.blue,
            width: 2
          },
          itemStyle: {
            color: reportPalette.blue
          }
        },
        {
          name: '随机分类器',
          type: 'line',
          data: [[0, 0], [1, 1]],
          lineStyle: {
            color: '#d9d9d9',
            type: 'dashed'
          },
          itemStyle: {
            color: '#d9d9d9'
          }
        }
      ]
    };

    return renderEChart(option);
  };

  const renderConfusionMatrix = () => {
    const cm = (results as any)?.diagnostics?.confusion_matrix || (results as any)?.confusion_matrix;
    if (!cm || !Array.isArray(cm) || cm.length === 0) {
      return <Empty description="暂无混淆矩阵数据" />;
    }
    const n = cm.length;
    const labels = Array.from({ length: n }, (_, i) => `类${i}`);
    const data = [] as Array<[number, number, number]>;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        data.push([j, i, Number(cm[i][j])]);
      }
    }
    const option = {
      title: { text: '混淆矩阵', left: 'center' },
      tooltip: { position: 'top' },
      xAxis: { type: 'category', data: labels, name: '预测', nameLocation: 'middle', nameGap: 24 },
      yAxis: { type: 'category', data: labels, name: '实际', nameLocation: 'middle', nameGap: 40 },
      visualMap: { min: 0, max: Math.max(...data.map(d => d[2])), calculable: true, orient: 'horizontal', left: 'center', bottom: 0 },
      series: [{ type: 'heatmap', data, label: { show: true }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }]
    } as any;
    return renderEChart(option);
  };

  const renderFeatureImportance = () => {
    // 特征重要性图实现（机器学习）
    return <Empty description="特征重要性图（待实现）" />;
  };

  // 根据分析类型和图表类型渲染对应图表
  const analysisType = analysis.analysis_type;
  const isLogisticVariant = (
    analysisType === 'logistic_regression' ||
    analysisType === 'logistic_regression_multinomial' ||
    analysisType === 'logistic_regression_ordinal' ||
    analysisType === 'logistic_regression_conditional'
  );
  
  if (isLogisticVariant) {
    switch (chartType) {
      case 'roc':
        return analysisType === 'logistic_regression' ? renderROCCurve() : <Empty description="仅二分类逻辑回归支持ROC" />;
      case 'cm':
        return renderConfusionMatrix();
      case 'coefficients':
        return renderCoefficientsPlot();
      case 'table':
        return <Empty description="逻辑回归表（待实现）" />;
      default:
        return analysisType === 'logistic_regression' ? renderROCCurve() : renderCoefficientsPlot();
    }
  }
  
  if (analysisType === 'linear_regression') {
    switch (chartType) {
      case 'scatter':
      case 'actual_vs_pred': // 新命名映射
        return renderScatterPlot();
      case 'residuals':
      case 'residuals_vs_fitted': // 新命名映射
      case 'qq': // 暂时回退到残差图
        return renderResidualsPlot();
      case 'coefficients':
      case 'coef_forest': // 新命名映射
        return renderCoefficientsPlot();
      case 'table':
        return <Empty description="线性回归表（待实现）" />;
      default:
        return renderScatterPlot();
    }
  }
  
  if (analysisType === 'machine_learning') {
    switch (chartType) {
      case 'confusion_matrix':
        return renderConfusionMatrix();
      case 'feature_importance':
        return renderFeatureImportance();
      case 'table':
        return <Empty description="机器学习性能表（待实现）" />;
      default:
        return renderConfusionMatrix();
    }
  }

  return <Empty description="暂不支持此分析类型的图表" />;
};
