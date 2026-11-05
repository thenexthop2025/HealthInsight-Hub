import React from 'react';
import { Empty } from 'antd';
import ReportEChart from './ReportEChart';
import { reportPalette } from '../../theme/reportTheme';

interface Analysis {
  id: string;
  analysis_type: string;
  results?: any;
}

interface RegressionChartsProps {
  analysis: Analysis;
  chartType: string;
  results?: any; // adapted results optional
}

const RegressionCharts: React.FC<RegressionChartsProps> = ({ analysis, chartType, results: injected }) => {
  const hasInline = !!analysis.results;
  const results = injected || (typeof analysis.results === 'string' ? (() => { try { return JSON.parse(analysis.results); } catch { return null; } })() : analysis.results);
  if (!hasInline && !results) return <Empty description="暂无回归结果" />;

  // 线性回归：拟合值-残差
  if (chartType === 'residuals_vs_fitted' && Array.isArray(results?.predictions) && Array.isArray(results?.residuals?.values)) {
    const data = results.predictions.map((p: number, i: number) => [p, results.residuals.values[i]]);
    const option = {
      tooltip: { trigger: 'item', formatter: (p: any) => `拟合: ${p.value[0].toFixed(3)}<br/>残差: ${p.value[1].toFixed(3)}` },
      xAxis: { type: 'value', name: '拟合值' },
      yAxis: { type: 'value', name: '残差' },
      series: [{ type: 'scatter', data, symbolSize: 5, itemStyle: { color: reportPalette.blue } }],
    } as any;
    return (
      <div style={{ width: '100%', minHeight: 420 }}>
        <ReportEChart
          option={option}
          style={{ width: '100%', height: 420 }}
          notMerge
          onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)}
        />
      </div>
    );
  }

  // 线性回归：残差 Q-Q 图（近似，以分位数对比）
  if (chartType === 'qq' && Array.isArray(results?.residuals?.values)) {
    const res: number[] = results.residuals.values.slice().sort((a: number, b: number) => a - b);
    const n = res.length;
    if (n < 5) return <Empty description="样本过少，无法绘制Q-Q图" />;
    const quant = (p: number) => {
      const idx = Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))));
      return res[idx];
    };
    const data = Array.from({ length: n }, (_, i) => {
      const p = (i + 0.5) / n;
      const theo = Math.sqrt(2) * erfinv(2 * p - 1); // 标准正态分位(近似)
      return [theo, res[i]];
    });
    const option = {
      tooltip: { trigger: 'item', formatter: (p: any) => `理论分位: ${p.value[0].toFixed(3)}<br/>残差分位: ${p.value[1].toFixed(3)}` },
      xAxis: { type: 'value', name: '理论分位 (N(0,1))' },
      yAxis: { type: 'value', name: '样本分位(残差)' },
      series: [{ type: 'scatter', data, symbolSize: 5, itemStyle: { color: '#52c41a' } }],
    } as any;
    return (
      <div style={{ width: '100%', minHeight: 420 }}>
        <ReportEChart
          option={option}
          style={{ width: '100%', height: 420 }}
          notMerge
          onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)}
        />
      </div>
    );
  }

  // 线性回归：实际值 vs 预测值
  if (chartType === 'actual_vs_pred' && Array.isArray(results?.predictions) && Array.isArray(results?.actual_values)) {
    const data = results.actual_values.map((a: number, i: number) => [a, results.predictions[i]]);
    const option = {
      tooltip: { trigger: 'item', formatter: (p: any) => `实际: ${p.value[0].toFixed(3)}<br/>预测: ${p.value[1].toFixed(3)}` },
      xAxis: { type: 'value', name: '实际值' },
      yAxis: { type: 'value', name: '预测值' },
      series: [{ type: 'scatter', data, symbolSize: 5, itemStyle: { color: '#722ed1' } }],
    } as any;
    return (
      <div style={{ width: '100%', minHeight: 420 }}>
        <ReportEChart
          option={option}
          style={{ width: '100%', height: 420 }}
          notMerge
          onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)}
        />
      </div>
    );
  }

  // 通用：系数森林图（线性/逻辑）
  if (chartType === 'coef_forest' && Array.isArray(results?.coefficients)) {
    const coefs = results.coefficients.filter((c: any) => c.variable && c.confidence_interval);
    if (coefs.length === 0) return <Empty description="缺少系数或置信区间" />;
    const names = coefs.map((c: any) => c.variable);
    const points = coefs.map((c: any) => (typeof c.odds_ratio === 'number' ? c.odds_ratio : c.coefficient));
    const lows = coefs.map((c: any) => c.confidence_interval[0]);
    const highs = coefs.map((c: any) => c.confidence_interval[1]);
    const isOR = typeof coefs[0].odds_ratio === 'number';
    const option = {
      tooltip: { trigger: 'item' },
      xAxis: { type: 'value', name: isOR ? 'OR' : '系数' },
      yAxis: { type: 'category', data: names },
      series: [
        { type: 'scatter', data: points, symbolSize: 8, itemStyle: { color: reportPalette.blue } },
        { type: 'custom', renderItem: (params: any, api: any) => {
            const idx = api.value(2);
            const y = api.coord([0, idx])[1];
            const x0 = api.coord([api.value(0), idx])[0];
            const x1 = api.coord([api.value(1), idx])[0];
            return { type: 'line', shape: { x1: x0, y1: y, x2: x1, y2: y }, style: { stroke: '#595959', lineWidth: 2 } };
          },
          encode: { x: [0,1], y: 2 },
          data: lows.map((lo: number, i: number) => [lo, highs[i], i])
        },
      ],
    } as any;
    return (
      <div style={{ width: '100%', minHeight: 420 }}>
        <ReportEChart
          option={option}
          style={{ width: '100%', height: 420 }}
          notMerge
          onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)}
        />
      </div>
    );
  }

  // 逻辑回归：ROC 曲线
  if (chartType === 'roc') {
    // 兼容两种结构：
    // 1) results.predictions.test_probabilities / results.predictions.test_actual（后端逻辑回归返回）
    // 2) results.predictions (number[][]) / results.actual_values (number[])
    const proba: number[][] | undefined = Array.isArray(results?.predictions?.test_probabilities)
      ? results.predictions.test_probabilities
      : (Array.isArray(results?.predictions) && Array.isArray(results?.predictions[0]) ? results.predictions : undefined);
    const yTrue: number[] | undefined = Array.isArray(results?.predictions?.test_actual)
      ? results.predictions.test_actual
      : (Array.isArray(results?.actual_values) ? results.actual_values : undefined);
    if (!proba || !yTrue || proba.length !== yTrue.length) return <Empty description="缺少概率或真实标签" />;
    // 简单ROC计算
    const pairs = proba.map((p, i) => ({ score: p[1] ?? p[0], y: yTrue[i] } as any)).sort((a, b) => b.score - a.score);
    let tp = 0, fp = 0; const P = pairs.filter(p => p.y === 1).length; const N = pairs.filter(p => p.y === 0).length;
    const roc = [[0,0]] as Array<[number, number]>;
    let last = Infinity;
    pairs.forEach(p => { if (p.score !== last) roc.push([fp/N, tp/P]); last = p.score; if (p.y===1) tp++; else fp++; });
    roc.push([1,1]);
    const option = { xAxis: { type:'value', name:'FPR' }, yAxis:{ type:'value', name:'TPR' }, series:[{ type:'line', data: roc, smooth:true }] } as any;
    return (
      <div style={{ width: '100%', minHeight: 420 }}>
        <ReportEChart
          option={option}
          style={{ width: '100%', height: 420 }}
          notMerge
          onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)}
        />
      </div>
    );
  }

  // 逻辑回归：混淆矩阵
  if (chartType === 'cm' && Array.isArray(results?.diagnostics?.confusion_matrix)) {
    const m = results.diagnostics.confusion_matrix as number[][];
    const option = {
      tooltip: { trigger: 'item' },
      xAxis: { type: 'category', data: ['预测0','预测1'] },
      yAxis: { type: 'category', data: ['实际0','实际1'] },
      visualMap: { min: 0, max: Math.max(...m.flat()), orient: 'vertical', right: 10, top: 'middle' },
      series: [{ type: 'heatmap', data: [[0,0,m[0][0]],[1,0,m[0][1]],[0,1,m[1][0]],[1,1,m[1][1]]], label: { show: true } }]
    } as any;
    return (
      <div style={{ width: '100%', minHeight: 420 }}>
        <ReportEChart
          option={option}
          style={{ width: '100%', height: 420 }}
          notMerge
          onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)}
        />
      </div>
    );
  }

  return <Empty description="暂无可视化" />;
};

export default RegressionCharts;

// 误差函数的逆（近似实现）
function erfinv(x: number): number {
  const a = 0.147; // Abramowitz-Stegun 常数
  const ln = Math.log(1 - x*x);
  const t = 2/(Math.PI*a) + ln/2;
  const s = Math.sqrt(t*t - ln/a);
  return (x<0?-1:1) * Math.sqrt(s - t);
}
