import React, { useState } from 'react';
import { Empty, Checkbox, Space } from 'antd';
import ReportEChart from './ReportEChart';
import { reportPalette } from '../../theme/reportTheme';

interface Analysis {
  id: string;
  analysis_type: string;
  results?: any;
}

interface StratifiedChartsProps {
  analysis: Analysis;
  chartType: string;
  results?: any; // adapted results optional
}

const StratifiedCharts: React.FC<StratifiedChartsProps> = ({ analysis, chartType, results: injected }) => {
  const hasInline = !!analysis.results;
  const results = injected || (typeof analysis.results === 'string' ? (() => { try { return JSON.parse(analysis.results); } catch { return null; } })() : analysis.results);
  // forest 开关（需要在顶层声明，避免 hooks 条件调用警告）
  const [showFixed, setShowFixed] = useState(true);
  const [showRandom, setShowRandom] = useState(true);
  if (!hasInline && !results) return <Empty description="暂无分层结果" />;

  // 专业森林图（点+线），显示 overall 与 measure（OR/MD）
  if (chartType === 'forest' && Array.isArray(results?.strata)) {
    const names = results.strata.map((s: any) => s.stratum);
    const points = results.strata.map((s: any, idx: number) => [s.effect ?? 0, idx]);
    const ranges = results.strata.map((s: any, idx: number) => [
      Array.isArray(s.ci) ? s.ci[0] : null,
      Array.isArray(s.ci) ? s.ci[1] : null,
      idx,
    ]);
    const measure = results.measure || 'Effect';
    const overallRandom = results.overall_random;
    const overallFixed = results.overall_fixed;
    const hetero = results.heterogeneity;
    const mergeIndex = names.length;
    const series: any[] = [
      {
        type: 'scatter',
        data: points,
        symbolSize: 8,
        itemStyle: { color: reportPalette.accent },
      },
      {
        type: 'custom',
        renderItem: (params: any, api: any) => {
          const idx = api.value(2);
          const y = api.coord([0, idx])[1];
          const x0 = api.coord([api.value(0), idx])[0];
          const x1 = api.coord([api.value(1), idx])[0];
          return { type: 'line', shape: { x1: x0, y1: y, x2: x1, y2: y }, style: { stroke: '#595959', lineWidth: 2 } };
        },
        encode: { x: [0,1], y: 2 },
        data: ranges,
      },
    ];
    if (overallRandom && Array.isArray(overallRandom.ci) && showRandom) {
      series.push({
        name: '随机效应',
        type: 'scatter',
        data: [[overallRandom.effect, mergeIndex]],
        symbolSize: 10,
        itemStyle: { color: '#d62728' },
      });
      series.push({
        name: '随机效应CI',
        type: 'custom',
        renderItem: (p: any, api: any) => {
          const idx = api.value(2);
          const y = api.coord([0, idx])[1];
          const x0 = api.coord([api.value(0), idx])[0];
          const x1 = api.coord([api.value(1), idx])[0];
          return { type: 'line', shape: { x1: x0, y1: y, x2: x1, y2: y }, style: { stroke: '#d62728', lineWidth: 3 } };
        },
        encode: { x: [0,1], y: 2 },
        data: [[overallRandom.ci[0], overallRandom.ci[1], mergeIndex]],
      });
    }
    if (overallFixed && Array.isArray(overallFixed.ci) && showFixed) {
      series.push({
        name: '固定效应',
        type: 'scatter',
        data: [[overallFixed.effect, mergeIndex]],
        symbolSize: 10,
        itemStyle: { color: '#ff7f0e' },
      });
      series.push({
        name: '固定效应CI',
        type: 'custom',
        renderItem: (p: any, api: any) => {
          const idx = api.value(2);
          const y = api.coord([0, idx])[1];
          const x0 = api.coord([api.value(0), idx])[0];
          const x1 = api.coord([api.value(1), idx])[0];
          return { type: 'line', shape: { x1: x0, y1: y, x2: x1, y2: y }, style: { stroke: '#ff7f0e', lineWidth: 3 } };
        },
        encode: { x: [0,1], y: 2 },
        data: [[overallFixed.ci[0], overallFixed.ci[1], mergeIndex]],
      });
    }
    const option = {
      tooltip: { trigger: 'axis' },
      title: { text: `森林图（${measure}）` },
      legend: { top: 24 },
      yAxis: { type: 'category', data: [...names, '合并'], inverse: true },
      xAxis: { type: 'value', name: measure },
      series,
      graphic: hetero ? [
        { type: 'text', left: 10, top: 36, style: { text: `异质性: Q=${(hetero.Q??0).toFixed(2)}, df=${hetero.df ?? '-'}, p=${(hetero.p_value??0).toFixed(4)}, I²=${(hetero.I2??0).toFixed(1)}%`, fill: '#666' } }
      ] : undefined
    } as any;
    return (
      <div style={{ width: '100%', minHeight: 420 }}>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <Space size={12}>
            <Checkbox checked={showFixed} onChange={(e) => setShowFixed(e.target.checked)}>显示固定效应</Checkbox>
            <Checkbox checked={showRandom} onChange={(e) => setShowRandom(e.target.checked)}>显示随机效应</Checkbox>
          </Space>
        </div>
        <ReportEChart option={option} style={{ width: '100%', height: 420 }} notMerge onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)} />
      </div>
    );
  }

  // 漏斗图（标准误 vs 效应，或权重 vs 效应）
  if (chartType === 'funnel' && Array.isArray(results?.strata)) {
    const data = results.strata.map((s: any) => [ (s.weight ? 1/Math.sqrt(s.weight) : 0), s.effect ?? 0, s ]);
    const option = {
      tooltip: { trigger: 'item', formatter: (p: any) => {
        const s = p.value[2] || {};
        const n = s.n ?? (s.n0 && s.n1 ? s.n0 + s.n1 : undefined);
        return `SE≈${p.value[0].toFixed(4)}<br/>效应: ${p.value[1].toFixed(4)}${n?`<br/>样本量: ${n}`:''}`;
      } },
      xAxis: { type: 'value', name: 'SE' },
      yAxis: { type: 'value', name: results.measure || 'Effect' },
      series: [{ type: 'scatter', data, symbolSize: 6, itemStyle: { color: '#52c41a' } }],
    } as any;
    return <div style={{ width: '100%', minHeight: 420 }}><ReportEChart option={option} style={{ width: '100%', height: 420 }} notMerge onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)} /></div>;
  }

  // 分层柱状图：各层效应柱 + 误差线（95%CI），并给出0参考线
  if (chartType === 'bar' && Array.isArray(results?.strata)) {
    const names = results.strata.map((s: any) => s.stratum);
    const effects = results.strata.map((s: any) => (typeof s.effect === 'number' ? s.effect : 0));
    const lows = results.strata.map((s: any) => (Array.isArray(s.ci) ? s.ci[0] : null));
    const highs = results.strata.map((s: any) => (Array.isArray(s.ci) ? s.ci[1] : null));
    const measure = results.measure || 'Effect';
    // y范围包含所有CI，并覆盖0作为参考
    const allVals = [...effects, ...lows.filter((v: any) => v !== null), ...highs.filter((v: any) => v !== null)];
    const minV = Math.min(0, ...(allVals.length ? allVals : [0]));
    const maxV = Math.max(0, ...(allVals.length ? allVals : [0]));
    const option = {
      tooltip: { trigger: 'axis', formatter: (p: any) => {
        const idx = p?.[0]?.dataIndex ?? 0;
        const lo = lows[idx];
        const hi = highs[idx];
        const eff = effects[idx];
        return `${names[idx]}<br/>${measure}: ${eff.toFixed(4)}${(lo!=null&&hi!=null)?`<br/>95%CI: [${lo.toFixed(4)}, ${hi.toFixed(4)}]`:''}`;
      } },
      xAxis: { type: 'category', data: names },
      yAxis: { type: 'value', name: measure, min: minV, max: maxV },
      series: [
        { type: 'bar', data: effects, itemStyle: { color: reportPalette.accent } },
        { type: 'custom', renderItem: (params: any, api: any) => {
            const lo = api.value(0); const hi = api.value(1); const idx = api.value(2);
            if (lo == null || hi == null) return null;
            const x = api.coord([idx, 0])[0];
            const y0 = api.coord([0, lo])[1];
            const y1 = api.coord([0, hi])[1];
            return { type: 'line', shape: { x1: x, y1: y0, x2: x, y2: y1 }, style: { stroke: '#555', lineWidth: 2 } };
          }, encode: { x: 2, y: [0,1] }, data: lows.map((lo:any,i:number)=>[lo, highs[i], i]) }
      ],
      markLine: { silent: true, data: [{ yAxis: 0 }], lineStyle: { color: '#999', type: 'dashed' } }
    } as any;
    return <div style={{ width: '100%', minHeight: 420 }}><ReportEChart option={option} style={{ width: '100%', height: 420 }} notMerge onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)} /></div>;
  }

  return <Empty description="暂无可视化" />;
};

export default StratifiedCharts;
