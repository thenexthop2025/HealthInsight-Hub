import React from 'react';
import { Empty } from 'antd';
import ReportEChart from '../../components/charts/ReportEChart';

interface Props {
  analysis: any;
  chartType: string;
  results: any;
}

const LinearRegressionCharts: React.FC<Props> = ({ chartType, results }) => {
  const renderE = (option: any) => (
    <ReportEChart option={option} notMerge lazyUpdate={false} style={{ height: 400 }} />
  );

  const renderScatter = () => {
    const actualValues = results?.actual_values || [];
    const predictions = results?.predictions || [];
    if (!Array.isArray(actualValues) || !Array.isArray(predictions) || actualValues.length === 0) {
      return <Empty description="暂无散点图数据" />;
    }
    const data = actualValues.map((a: number, i: number) => [a, predictions[i] ?? 0]);
    return renderE({
      title: { text: '线性回归 - 实际值 vs 预测值', left: 'center' },
      tooltip: { trigger: 'item', formatter: (p: any) => {
        const [a, y] = p.data; return `实际值: ${a.toFixed(3)}<br/>预测值: ${y.toFixed(3)}`; } },
      xAxis: { type: 'value', name: '实际值', nameLocation: 'middle', nameGap: 30 },
      yAxis: { type: 'value', name: '预测值', nameLocation: 'middle', nameGap: 50 },
      series: [{ type: 'scatter', data, symbolSize: 6 }]
    });
  };

  const renderResiduals = () => {
    const residuals = results?.residuals?.values || [];
    const predictions = results?.predictions || [];
    if (!Array.isArray(residuals) || residuals.length === 0) return <Empty description="暂无残差图数据" />;
    const data = residuals.map((r: number, i: number) => [predictions[i] ?? 0, r]);
    return renderE({
      title: { text: '线性回归 - 残差图', left: 'center' },
      tooltip: { trigger: 'item', formatter: (p: any) => {
        const [yhat, r] = p.data; return `预测值: ${yhat.toFixed(3)}<br/>残差: ${r.toFixed(3)}`; } },
      xAxis: { type: 'value', name: '预测值', nameLocation: 'middle', nameGap: 30 },
      yAxis: { type: 'value', name: '残差', nameLocation: 'middle', nameGap: 50 },
      series: [{ type: 'scatter', data, symbolSize: 6 }]
    });
  };

  // 近似标准正态分位函数（Peter J. Acklam 算法系数简化版）
  const normInv = (p: number): number => {
    // 防止边界
    const pa = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
    const a1 = -3.969683028665376e+01, a2 = 2.209460984245205e+02, a3 = -2.759285104469687e+02,
          a4 = 1.383577518672690e+02, a5 = -3.066479806614716e+01, a6 = 2.506628277459239e+00;
    const b1 = -5.447609879822406e+01, b2 = 1.615858368580409e+02, b3 = -1.556989798598866e+02,
          b4 = 6.680131188771972e+01, b5 = -1.328068155288572e+01;
    const c1 = -7.784894002430293e-03, c2 = -3.223964580411365e-01, c3 = -2.400758277161838e+00,
          c4 = -2.549732539343734e+00, c5 = 4.374664141464968e+00, c6 = 2.938163982698783e+00;
    const d1 = 7.784695709041462e-03, d2 = 3.224671290700398e-01, d3 = 2.445134137142996e+00,
          d4 = 3.754408661907416e+00;
    const plow = 0.02425, phigh = 1 - plow;
    let q, r;
    if (pa < plow) {
      q = Math.sqrt(-2 * Math.log(pa));
      return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
             ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }
    if (phigh < pa) {
      q = Math.sqrt(-2 * Math.log(1 - pa));
      return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
              ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }
    q = pa - 0.5; r = q * q;
    return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
           (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
  };

  const renderQQ = () => {
    const residuals = Array.isArray(results?.residuals?.values) ? results.residuals.values.slice() : [];
    if (residuals.length === 0) return <Empty description="暂无Q-Q数据" />;
    const n = residuals.length;
    // 标准化残差（与理论标准正态量纲一致）
    const mean = residuals.reduce((s: number, v: number) => s + v, 0) / n;
    const sd = Math.sqrt(residuals.reduce((s: number, v: number) => s + Math.pow(v - mean, 2), 0) / Math.max(n - 1, 1)) || 1;
    const z = residuals.map((v: number) => (v - mean) / sd);
    const sorted = z.slice().sort((a: number, b: number) => a - b);
    const theo = sorted.map((_v: number, i: number) => normInv((i + 0.5) / n));
    const data = sorted.map((v: number, i: number) => [theo[i], v]);
    return renderE({
      title: { text: '残差Q-Q图', left: 'center' },
      tooltip: { trigger: 'item', formatter: (p: any) => {
        const [t, v] = p.data; return `理论分位: ${t.toFixed(3)}<br/>残差分位: ${v.toFixed(3)}`; } },
      xAxis: { type: 'value', name: '理论正态分位', nameLocation: 'middle', nameGap: 30 },
      yAxis: { type: 'value', name: '样本残差分位', nameLocation: 'middle', nameGap: 50 },
      series: [
        { type: 'scatter', data, symbolSize: 6 },
        // 参考线 y = x
        { type: 'line', data: [[theo[0], theo[0]], [theo[n-1], theo[n-1]]], showSymbol: false, lineStyle: { type: 'dashed' } }
      ]
    });
  };

  const renderCoefficients = () => {
    const coefficients = Array.isArray(results?.coefficients) ? results.coefficients : [];
    if (coefficients.length === 0) return <Empty description="暂无系数数据" />;
    const data = coefficients.map((c: any) => ({ name: String(c.variable ?? ''), value: Number(c.coefficient ?? 0), p: c.p_value }));
    return renderE({
      title: { text: '回归系数图', left: 'center' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p: any) => {
        const it = data[p[0].dataIndex];
        return `${it.name}<br/>系数: ${it.value.toFixed(4)}${typeof it.p === 'number' ? `<br/>p值: ${it.p.toFixed(4)}` : ''}`; } },
      xAxis: { type: 'category', data: data.map((d: { name: string }) => d.name), axisLabel: { rotate: 45 } },
      yAxis: { type: 'value', name: '系数值' },
      series: [{ type: 'bar', data: data.map((d: { value: number }) => d.value) }]
    });
  };

  const renderCoefForest = () => {
    const coefficients = Array.isArray(results?.coefficients) ? results.coefficients : [];
    if (coefficients.length === 0) return <Empty description="暂无系数数据" />;
    const rows: Array<{ name: string; est: number; lo: number; hi: number }> = coefficients
      .filter((c: any) => String(c.variable).toLowerCase() !== 'const' && String(c.variable).toLowerCase() !== 'intercept')
      .map((c: any) => ({
        name: String(c.variable ?? ''),
        est: Number(c.coefficient ?? 0),
        lo: Number((c.robust_confidence_interval?.[0] ?? c.confidence_interval?.[0]) ?? NaN),
        hi: Number((c.robust_confidence_interval?.[1] ?? c.confidence_interval?.[1]) ?? NaN),
      }));
    if (rows.length === 0) return <Empty description="暂无可绘制的系数" />;
    const cats = rows.map((r: { name: string }) => r.name);
    return renderE({
      title: { text: '系数森林图', left: 'center' },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line' },
        formatter: (p: any) => {
          const idx = p[0]?.dataIndex ?? 0;
          const r = rows[idx];
          return `${r.name}<br/>系数: ${r.est.toFixed(4)}<br/>95%CI: [${isFinite(r.lo)?r.lo.toFixed(4):'-'}, ${isFinite(r.hi)?r.hi.toFixed(4):'-'}]`;
        }
      },
      xAxis: { type: 'category', data: cats, axisLabel: { rotate: 30 } },
      yAxis: { type: 'value', name: '系数', splitLine: { show: true } },
      series: [
        {
          type: 'candlestick',
          name: 'CI',
          data: rows.map((r: { est: number; lo: number; hi: number }) => [r.est, r.est, isFinite(r.lo)?r.lo:r.est, isFinite(r.hi)?r.hi:r.est]),
          itemStyle: { color: '#69b1ff', color0: '#69b1ff', borderColor: '#69b1ff', borderColor0: '#69b1ff' }
        },
        {
          type: 'scatter',
          name: '估计值',
          data: rows.map((r: { name: string; est: number }) => [r.name, r.est]),
          symbolSize: 8,
          itemStyle: { color: '#1f4fff' }
        }
      ]
    });
  };

  switch (chartType) {
    case 'actual_vs_pred':
    case 'scatter':
      return renderScatter();
    case 'residuals':
    case 'residuals_vs_fitted':
      return renderResiduals();
    case 'qq':
      return renderQQ();
    case 'coefficients':
    case 'coef_forest':
      return chartType === 'coef_forest' ? renderCoefForest() : renderCoefficients();
    default:
      return renderScatter();
  }
};

export default LinearRegressionCharts;

