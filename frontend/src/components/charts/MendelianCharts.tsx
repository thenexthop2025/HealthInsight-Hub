import React from 'react';
import { Empty } from 'antd';
import ReportEChart from './ReportEChart';
import { reportPalette } from '../../theme/reportTheme';

interface Analysis {
  id: string;
  analysis_type: string;
  results?: any;
}

interface MendelianChartsProps {
  analysis: Analysis;
  chartType: string;
  results?: any; // adapted results optional
}

const MendelianCharts: React.FC<MendelianChartsProps> = ({ analysis, chartType, results: injected }) => {
  const hasInline = !!analysis.results;
  const results = injected || (typeof analysis.results === 'string' ? (() => { try { return JSON.parse(analysis.results); } catch { return null; } })() : analysis.results);
  if (!hasInline && !results) return <Empty description="暂无孟德尔随机化结果" />;

  if (chartType === 'scatter' && Array.isArray(results?.scatter)) {
    const data = results.scatter.map((p: any) => [p.x, p.y]);
    const xs = data.map((d: number[]) => d[0]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const ivw = results?.ivw;
    const egger = results?.egger;
    const series: any[] = [
      { name: 'SNP', type: 'scatter', data, symbolSize: 6, itemStyle: { color: reportPalette.blue } }
    ];
    if (ivw && typeof ivw.beta === 'number') {
      series.push({
        name: 'IVW 拟合', type: 'line', showSymbol: false, lineStyle: { color: '#ff7f0e' },
        data: [ [minX, ivw.beta * minX], [maxX, ivw.beta * maxX] ]
      });
    }
    if (egger && typeof egger.slope === 'number' && typeof egger.intercept === 'number') {
      const f = (x: number) => egger.intercept + egger.slope * x;
      series.push({
        name: 'Egger 拟合', type: 'line', showSymbol: false, lineStyle: { color: '#d62728', type: 'dashed' },
        data: [ [minX, f(minX)], [maxX, f(maxX)] ]
      });
    }
    const option = {
      tooltip: { trigger: 'item', formatter: (p: any) => {
        if (Array.isArray(p.value)) return `X: ${p.value[0].toFixed(3)}<br/>Y: ${p.value[1].toFixed(3)}`;
        return p.seriesName;
      } },
      legend: { top: 10 },
      xAxis: { type: 'value', name: '暴露效应' },
      yAxis: { type: 'value', name: '结局效应' },
      series
    } as any;
    return <div style={{ width: '100%', minHeight: 420 }}><ReportEChart option={option} style={{ width: '100%', height: 420 }} notMerge /></div>;
  }

  if (chartType === 'funnel' && Array.isArray(results?.funnel)) {
    const data = results.funnel.map((p: any) => [p.se, p.beta]);
    const option = {
      tooltip: { trigger: 'item', formatter: (p: any) => `SE: ${p.value[0].toFixed(3)}<br/>Beta: ${p.value[1].toFixed(3)}` },
      xAxis: { type: 'value', name: '标准误' },
      yAxis: { type: 'value', name: '效应值' },
      series: [{ type: 'scatter', data, symbolSize: 6, itemStyle: { color: '#52c41a' } }],
    } as any;
    return <div style={{ width: '100%', minHeight: 420 }}><ReportEChart option={option} style={{ width: '100%', height: 420 }} notMerge /></div>;
  }

  if (chartType === 'forest' && Array.isArray(results?.forest)) {
    const names = results.forest.map((r: any) => r.study);
    const effects = results.forest.map((r: any) => r.effect ?? 0);
    const lows = results.forest.map((r: any) => Array.isArray(r.ci) ? r.ci[0] : null);
    const highs = results.forest.map((r: any) => Array.isArray(r.ci) ? r.ci[1] : null);
    const series: any[] = [
      { type: 'scatter', data: effects, symbolSize: 8, itemStyle: { color: reportPalette.blue } },
      { type: 'custom', renderItem: (params: any, api: any) => {
          const idx = api.value(2);
          const y = api.coord([0, idx])[1];
          const x0 = api.coord([api.value(0), idx])[0];
          const x1 = api.coord([api.value(1), idx])[0];
          return { type: 'line', shape: { x1: x0, y1: y, x2: x1, y2: y }, style: { stroke: '#595959', lineWidth: 2 } };
        }, encode: { x: [0,1], y: 2 }, data: lows.map((lo: number, i: number) => [lo, highs[i], i]) }
    ];
    const option = {
      tooltip: { trigger: 'axis' },
      title: { text: 'MR 森林图（比值/效应）' },
      yAxis: { type: 'category', data: names, inverse: true },
      xAxis: { type: 'value', name: '效应' },
      series
    } as any;
    return <div style={{ width: '100%', minHeight: 420 }}><ReportEChart option={option} style={{ width: '100%', height: 420 }} notMerge onChartReady={(c:any)=>setTimeout(()=>c?.resize&&c.resize(),0)} /></div>;
  }

  return <Empty description="暂无可视化" />;
};

export default MendelianCharts;
