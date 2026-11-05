import React from 'react';
import { Empty } from 'antd';
import ReportEChart from '../../../components/charts/ReportEChart';

// 通用：混淆矩阵
export const ConfusionMatrix: React.FC<{ results: any; title?: string }>
  = ({ results, title = '混淆矩阵' }) => {
  const cm = results?.diagnostics?.confusion_matrix || results?.confusion_matrix;
  if (!cm || !Array.isArray(cm) || cm.length === 0) return <Empty description="暂无混淆矩阵数据" />;
  const n = cm.length;
  const labels = Array.from({ length: n }, (_, i) => `类${i}`);
  const data: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) data.push([j, i, Number(cm[i][j])]);
  }
  const option: any = {
    title: { text: title, left: 'center' },
    tooltip: { position: 'top' },
    xAxis: { type: 'category', data: labels, name: '预测', nameLocation: 'middle', nameGap: 24 },
    yAxis: { type: 'category', data: labels, name: '实际', nameLocation: 'middle', nameGap: 40 },
    visualMap: { min: 0, max: Math.max(...data.map(d => d[2])), calculable: true, orient: 'horizontal', left: 'center', bottom: 0 },
    series: [{ type: 'heatmap', data, label: { show: true } }]
  };
  return <ReportEChart option={option} style={{ height: 400 }} />;
};

// 通用：ROC
export const ROCCurve: React.FC<{ results: any }>= ({ results }) => {
  let proba2D: number[][] = [];
  let actual: number[] = [];
  const anyRes: any = results;
  if (anyRes?.predictions && Array.isArray(anyRes.predictions.test_probabilities)) {
    proba2D = anyRes.predictions.test_probabilities as number[][];
    actual = Array.isArray(anyRes.predictions.test_actual) ? anyRes.predictions.test_actual : [];
  } else if (Array.isArray(anyRes?.predictions) && Array.isArray(anyRes?.actual_values)) {
    const probs1D = anyRes.predictions as number[];
    proba2D = probs1D.map((p: number) => [1 - Number(p || 0), Number(p || 0)]);
    actual = anyRes.actual_values as number[];
  }
  if (proba2D.length === 0 || actual.length === 0) return <Empty description="暂无ROC曲线数据" />;

  const thresholds = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const rocData = thresholds.map((th) => {
    const preds = proba2D.map((pr) => (pr[1] >= th ? 1 : 0));
    const tp = preds.filter((p, i) => p === 1 && actual[i] === 1).length;
    const fp = preds.filter((p, i) => p === 1 && actual[i] === 0).length;
    const tn = preds.filter((p, i) => p === 0 && actual[i] === 0).length;
    const fn = preds.filter((p, i) => p === 0 && actual[i] === 1).length;
    const tpr = tp / Math.max(tp + fn, 1);
    const fpr = fp / Math.max(fp + tn, 1);
    return [fpr, tpr];
  });

  const option: any = {
    title: { text: 'ROC曲线', left: 'center' },
    tooltip: { trigger: 'item', formatter: (p: any) => {
      const [fpr, tpr] = p.data; return `假正率: ${fpr.toFixed(3)}<br/>真正率: ${tpr.toFixed(3)}`;
    } },
    xAxis: { type: 'value', name: '假正率 (FPR)', min: 0, max: 1, nameLocation: 'middle', nameGap: 30 },
    yAxis: { type: 'value', name: '真正率 (TPR)', min: 0, max: 1, nameLocation: 'middle', nameGap: 50 },
    series: [
      { name: 'ROC', type: 'line', data: rocData, smooth: true, lineStyle: { width: 2 } },
      { name: '随机', type: 'line', data: [[0,0],[1,1]], lineStyle: { type: 'dashed' } }
    ]
  };
  return <ReportEChart option={option} style={{ height: 400 }} />;
};

// 通用：系数图
export const CoefficientsBar: React.FC<{ results: any; title?: string }>
  = ({ results, title = '回归系数图' }) => {
  const arr: any[] = Array.isArray(results?.coefficients) ? (results.coefficients as any[]) : [];
  const filtered = arr.filter((c: any) => typeof c?.coefficient === 'number');
  if (filtered.length === 0) return <Empty description="暂无系数数据" />;
  const data = filtered.map((c: any) => ({
    name: String(c?.variable ?? ''),
    value: Number(c?.coefficient ?? 0),
    significant: !!c?.significant,
    p: typeof c?.p_value === 'number' ? c.p_value : null,
  }));
  const option: any = {
    title: { text: title, left: 'center' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p: any) => {
      const it = data[p[0].dataIndex];
      return `${it.name}<br/>系数: ${it.value.toFixed(4)}${it.p!==null?`<br/>p: ${it.p.toFixed(4)}`:''}`;
    }},
    xAxis: { type: 'category', data: data.map(d => d.name), axisLabel: { rotate: 45 } },
    yAxis: { type: 'value', name: '系数值' },
    series: [{ type: 'bar', data: data.map(d => ({ value: d.value, itemStyle: { color: d.significant ? '#f5222d' : '#91caff' } })),
      label: { show: true, position: 'top', formatter: (p: any) => data[p.dataIndex].value.toFixed(3) } }]
  };
  return <ReportEChart option={option} style={{ height: 400 }} />;
};

