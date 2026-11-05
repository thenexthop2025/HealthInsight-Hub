import React, { useEffect } from 'react';
import { Empty } from 'antd';
import ReportEChart from './ReportEChart';
import { reportPalette } from '../../theme/reportTheme';

interface Analysis {
  id: string;
  analysis_type: string;
  results?: any;
}

interface ExploreChartsProps {
  analysis: Analysis;
  chartType: string;
  results?: any; // injected adapted results
}

const toNum = (value: any): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const formatLabel = (value: string): string => {
  if (!value) return value;
  if (value.includes('|')) {
    return value.replace('|', '\n|');
  }
  if (value.length > 20) {
    return value.replace(/(.{1,20})/g, '$1\n');
  }
  return value;
};

const buildBoxTuple = (stats: any): number[] | null => {
  if (!stats) return null;
  const min = toNum(stats.min);
  const q1 = toNum(stats.q1 ?? stats.q25);
  const median = toNum(stats.median);
  const q3 = toNum(stats.q3 ?? stats.q75);
  const max = toNum(stats.max);
  const parts = [min, q1, median, q3, max];
  if (parts.some((v) => v === null)) {
    return null;
  }
  return parts as number[];
};

const ExploreCharts: React.FC<ExploreChartsProps> = ({ analysis, chartType, results: injected }) => {
  // 防止首次渲染容器宽度未就绪导致的小图：打开后主动触发一次全局resize
  useEffect(() => {
    const t = setTimeout(() => {
      try { window.dispatchEvent(new Event('resize')); } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [chartType, analysis?.id]);
  if (!analysis?.results && !injected) return <Empty description="暂无分析结果" />;

  const safeParse = (s: string) => {
    try { return JSON.parse(s); } catch { try { return JSON.parse(s.replace(/\bNaN\b/g, 'null')); } catch { return null; } }
  };
  const results = injected ?? (typeof analysis.results === 'string' ? safeParse(analysis.results) : analysis.results);
  if (!results || typeof results !== 'object') return <Empty description="结果为空" />;

  // 统一将 explore 的结果解析为：{ [变量] : { type: 'numeric'|'categorical'|'numeric_grouped', ... } }
  const entries: Array<[string, any]> = Object.entries(results);
  if (entries.length === 0) return <Empty description="暂无探索结果" />;

  const renderNumeric = (name: string, payload: any, idx: number) => {
    const stats = payload?.descriptive || payload?.overall || {};
    const mean = toNum(stats.mean) ?? 0;
    const std = toNum(stats.std) ?? 0;
    const min = toNum(stats.min);
    const max = toNum(stats.max);
    const effectiveMin = min ?? mean - 3 * std;
    const effectiveMax = max ?? mean + 3 * std;
    const raw = payload?.raw_data?.values as number[] | undefined;

    // 不适合绘制的场景（稳健处理）
    const degenerate = !Number.isFinite(std) || std === 0 || effectiveMin >= effectiveMax;

    if (chartType === 'scatter') {
      // 单变量“散点图”实现为 strip plot：x 为样本取值，y 轻微抖动
      const samples = Array.isArray(raw) && raw.length > 0 ? raw : [];
      if (samples.length === 0) return <Empty description="无原始样本，无法绘制散点图" />;
      const data = samples
        .filter((v: any) => typeof v === 'number' && Number.isFinite(v))
        .map((v: number) => [v, Math.random() * 0.8 + 0.1]);
      const option = {
        title: { text: `${name} - 散点图(单变量分布)` },
        tooltip: { trigger: 'item', formatter: (p:any)=>`值: ${p.data[0].toFixed(3)}` },
        xAxis: { type: 'value', name: name },
        yAxis: { type: 'value', show: false },
        series: [{ type: 'scatter', data, symbolSize: 6, opacity: 0.7 }],
      } as any;
      return <ReportEChart key={`scatter-${analysis.id}-${idx}`} option={option} style={{ width: '100%', height: 420 }} onChartReady={(c:any)=>c.resize()} />;
    }

    if (chartType === 'boxplot') {
      const tuple = buildBoxTuple(stats);
      if (!tuple) return <Empty description="缺少分位数信息，无法绘制箱线图" />;
      const option = {
        title: { text: `${name} - 箱线图` },
        tooltip: {
          trigger: 'item',
          formatter: (p: any) => {
            const data = p.data as number[];
            return `${name}<br/>min:${data[0]}<br/>Q1:${data[1]}<br/>median:${data[2]}<br/>Q3:${data[3]}<br/>max:${data[4]}`;
          },
        },
        xAxis: {
          type: 'category',
          data: [name],
          axisLabel: {
            interval: 0,
            rotate: 30,
            formatter: (val: string) => formatLabel(val),
            margin: 16,
          },
        },
        yAxis: { type: 'value' },
        series: [{ type: 'boxplot', data: [tuple], itemStyle: { color: reportPalette.primary } }],
      };
      return <ReportEChart key={`box-${analysis.id}-${idx}`} option={option} style={{ width: '100%', height: 420 }} onChartReady={(c:any)=>c.resize()} />;
    }

    if (chartType === 'qq') {
      // Q-Q 图：优先使用后端采样原始值构造样本分位
      if (!Number.isFinite(std) || std === 0) {
        return <Empty description="标准差为0，无法绘制Q-Q图" />;
      }
      const n = Math.min(100, Math.max(20, Array.isArray(raw) ? raw.length : Number(stats.count || 0)));
      if (!n || n < 20) {
        return <Empty description="样本量较小（<20），暂不绘制Q-Q图" />;
      }
      const xs = Array.from({ length: n }, (_, i) => (i + 0.5) / n);
      const normInv = (p: number) => mean + std * Math.sqrt(2) * erfinv(2 * p - 1);
      const erfinv = (x: number) => {
        // 数值近似
        const a = 0.147;
        const ln = Math.log(1 - x * x);
        const s = (2 / (Math.PI * a) + ln / 2);
        return (Math.sign(x) * Math.sqrt(Math.sqrt(s * s - ln / a) - s));
      };
      const theoretical = xs.map(normInv);
      let sample: number[];
      if (Array.isArray(raw) && raw.length >= n) {
        const sorted = [...raw].filter(v => typeof v === 'number' && Number.isFinite(v)).sort((a,b)=>a-b);
        const step = Math.floor(sorted.length / n);
        sample = Array.from({ length: n }, (_, i) => sorted[Math.min(sorted.length - 1, i * step)]);
      } else {
        sample = xs.map((p) => effectiveMin + p * (effectiveMax - effectiveMin));
      }
      const option = {
        title: { text: `${name} - Q-Q图` },
        xAxis: { type: 'value' }, yAxis: { type: 'value' },
        series: [
          { type: 'scatter', data: theoretical.map((t, i) => [t, sample[i]]), tooltip: { formatter: (p:any)=>`theoretical:${p.data[0].toFixed(3)}<br/>sample:${p.data[1].toFixed(3)}` } },
          // 45°参考线
          { type: 'line', data: [ [Math.min(...theoretical), Math.min(...theoretical)], [Math.max(...theoretical), Math.max(...theoretical)] ], lineStyle: { type: 'dashed', color: '#999' }, silent: true, tooltip: { show: false } }
        ]
      };
      return <ReportEChart key={`qq-${analysis.id}-${idx}`} option={option} style={{ width: '100%', height: 420 }} onChartReady={(c:any)=>c.resize()} />;
    }

    // 默认：直方图（优先使用后端采样原始值，否则用近似密度）
    if (degenerate) return <Empty description="数据无离散度，直方图不适用" />;
    const minVal = effectiveMin;
    const maxVal = effectiveMax;
    const bins = 20;
    const span = Math.max(1e-9, maxVal - minVal);
    const binWidth = span / bins;
    const hist: Array<{ name: string; value: number }> = [];
    if (Array.isArray(raw) && raw.length > 0) {
      const edges = Array.from({ length: bins + 1 }, (_, i) => minVal + i * binWidth);
      const counts = Array(bins).fill(0);
      for (const v of raw) {
        if (typeof v !== 'number' || Number.isNaN(v)) continue;
        const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - minVal) / binWidth)));
        counts[idx] += 1;
      }
      for (let i = 0; i < bins; i++) {
        const x0 = edges[i]; const x1 = edges[i + 1]; const xc = (x0 + x1) / 2;
        hist.push({ name: xc.toFixed(2), value: counts[i] });
      }
    } else {
      for (let i = 0; i < bins; i++) {
      const x0 = minVal + i * binWidth; const x1 = x0 + binWidth; const xc = (x0 + x1) / 2;
        const density = std > 0 ? Math.exp(-0.5 * Math.pow((xc - mean) / std, 2)) / (std * Math.sqrt(2 * Math.PI)) : 0;
        hist.push({ name: xc.toFixed(2), value: +(density * binWidth * 100).toFixed(3) });
      }
    }
    const option = {
      title: { text: `${name} - 直方图` }, tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: hist.map(d => d.name) }, yAxis: { type: 'value', name: '频数' },
      series: [{ type: 'bar', data: hist.map(d => d.value), tooltip: { formatter: (p:any)=>`bin中心:${p.name}<br/>count:${p.value}<br/>mean:${mean.toFixed(3)}<br/>std:${std.toFixed(3)}` } }]
    };
    return <ReportEChart key={`hist-${analysis.id}-${idx}`} option={option} style={{ width: '100%', height: 420 }} onChartReady={(c:any)=>c.resize()} />;
  };

  const renderCategorical = (name: string, payload: any) => {
    const levels = payload?.levels || payload?.frequency || [];
    if (!Array.isArray(levels) || levels.length === 0) return <Empty description="无分类数据" />;
    const option = {
      title: { text: `${name} - 频数分布` }, tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: levels.map((lv: any) => lv.value) }, yAxis: { type: 'value' },
      series: [{ type: 'bar', data: levels.map((lv: any) => Number(lv.count || 0)) }]
    };
    return <ReportEChart option={option} style={{ width: '100%', height: 420 }} onChartReady={(c:any)=>c.resize()} />;
  };

  const renderNumericGrouped = (name: string, payload: any, idx: number) => {
    const groups = Object.keys(payload.by_group || payload.grouped_stats || {});
    const statsList = groups.map((g: string) => ({ group: g, ...(payload.by_group?.[g] || payload.grouped_stats?.[g] || {}) }));

    if (chartType === 'scatter') {
      const samplesObj = payload?.group_samples || {};
      const groupsWithSamples = Object.keys(samplesObj).filter(g => Array.isArray(samplesObj[g]) && samplesObj[g].length > 0);
      if (groupsWithSamples.length === 0) return <Empty description="分组散点图缺少分组样本" />;
      const series:any[] = groupsWithSamples.map((g: string) => {
        const arr = (samplesObj[g] as number[]).filter(v => typeof v === 'number' && Number.isFinite(v));
        const data = arr.map((v: number) => [v, g]);
        return { name: g, type: 'scatter', data, symbolSize: 6, emphasis: { focus: 'series' } };
      });
      const option = {
        title: { text: `${name} - 分组散点图（按 ${payload.group_by}）` },
        tooltip: { trigger: 'item', formatter: (p:any)=>`${payload.group_by}=${p.data[1]}<br/>值: ${(+p.data[0]).toFixed(3)}` },
        xAxis: { type: 'value', name: name },
        yAxis: { type: 'category', data: groupsWithSamples, name: payload.group_by },
        legend: { top: 24 },
        series,
      } as any;
      return <ReportEChart option={option} style={{ width: '100%', height: 420 }} key={`scatter-${analysis.id}-${idx}`} onChartReady={(c:any)=>c.resize()} />;
    }

    if (chartType === 'qq') {
      const samplesObj = payload?.group_samples || {};
      const groupsWithSamples = Object.keys(samplesObj).filter(g => Array.isArray(samplesObj[g]) && samplesObj[g].length >= 20);
      if (groupsWithSamples.length === 0) return <Empty description="分组Q-Q图缺少足够的分组样本(每组≥20)" />;
      const mean = Number((payload.overall?.mean ?? statsList[0]?.mean) ?? 0);
      const std = Number((payload.overall?.std ?? statsList[0]?.std) ?? 1) || 1;
      const series:any[] = groupsWithSamples.map((g: string) => {
        const arr = [...samplesObj[g]].sort((a:number,b:number)=>a-b);
        const n = arr.length;
        const xs = Array.from({ length: n }, (_, i) => (i + 0.5) / n);
        const erfinv = (x: number) => { const a=0.147; const ln=Math.log(1-x*x); const s=(2/(Math.PI*a)+ln/2); return (Math.sign(x)*Math.sqrt(Math.sqrt(s*s-ln/a)-s)); };
        const normInv = (p:number) => mean + std * Math.sqrt(2) * erfinv(2*p - 1);
        const theoretical = xs.map(normInv);
        const data = theoretical.map((t, i) => [t, arr[i]]);
        return { name: g, type: 'scatter', data };
      });
      const option = {
        title: { text: `${name} - 分组Q-Q图（按 ${payload.group_by}）` },
        tooltip: { trigger: 'item' },
        legend: { top: 24 },
        xAxis: { type: 'value' }, yAxis: { type: 'value' },
        series: [
          ...series,
          { type: 'line', data: [[-3, -3], [3, 3]], lineStyle: { type: 'dashed', color: '#999' }, silent: true, tooltip: { show: false } }
        ]
      } as any;
      return <ReportEChart option={option} style={{ width: '100%', height: 420 }} key={`qq-${analysis.id}-${idx}`} onChartReady={(c:any)=>c.resize()} />;
    }

    if (chartType === 'boxplot') {
      const tuples = statsList
        .map(buildBoxTuple)
        .map((tuple, gIdx) => ({ tuple, label: groups[gIdx] }))
        .filter((entry) => entry.tuple);

      if (tuples.length === 0) {
        return <Empty description="分组统计缺少分位数信息，无法绘制箱线图" />;
      }

      const option = {
        title: { text: `${name} - 分组箱线图（按 ${payload.group_by}）` },
        tooltip: {
          trigger: 'item',
          formatter: (p: any) => {
            const data = p.data as number[];
            return `${p.name}<br/>min:${data[0]}<br/>Q1:${data[1]}<br/>median:${data[2]}<br/>Q3:${data[3]}<br/>max:${data[4]}`;
          },
        },
        xAxis: {
          type: 'category',
          data: tuples.map((entry) => entry.label),
          axisLabel: {
            interval: 0,
            rotate: 30,
            formatter: (val: string) => formatLabel(val),
            margin: 16,
          },
        },
        yAxis: { type: 'value' },
        series: [{
          type: 'boxplot',
          itemStyle: { color: reportPalette.primary },
          data: tuples.map((entry) => entry.tuple as number[]),
        }],
      } as const;

      return <ReportEChart option={option} style={{ width: '100%', height: 420 }} key={`box-${analysis.id}-${idx}`} onChartReady={(c:any)=>c.resize()} />;
    }

    // 分组直方图
    const colors = ['#5470C6','#91CC75','#EE6666','#73C0DE','#3BA272','#FC8452','#9A60B4','#EA7CCC'];
    const series = statsList.map((s, sIdx) => {
      const smin = Number(s.min ?? 0), smax = Number(s.max ?? 0), smean = Number(s.mean ?? 0), sstd = Number(s.std ?? 0);
      const bins = 15; const span = Math.max(1e-9, smax - smin); const bw = span / bins;
      const data: number[] = [];
      for (let i=0;i<bins;i++){
        const x0 = smin + i*bw; const x1 = x0 + bw; const xc = (x0+x1)/2;
        const density = sstd>0 ? Math.exp(-0.5*Math.pow((xc-smean)/sstd,2))/(sstd*Math.sqrt(2*Math.PI)) : 0;
        data.push(+(density*bw*100).toFixed(3));
      }
      return { name: String(s.group), type: 'bar', itemStyle: { color: colors[sIdx%colors.length] }, data };
    });
    const axisCategories = (() => {
      const firstStats = statsList[0];
      const smin = Number(firstStats.min ?? 0), smax = Number(firstStats.max ?? 0);
      const bins = 15; const span = Math.max(1e-9, smax - smin); const bw = span / bins;
      return Array.from({ length: bins }, (_, i) => {
        const x0 = smin + i * bw; const x1 = x0 + bw;
        return ((x0 + x1) / 2).toFixed(2);
      });
    })();
    const option = {
      title: { text: `${name} - 分组直方图（按 ${payload.group_by}）` },
      tooltip: { trigger: 'axis' },
      legend: { top: 24 },
      xAxis: { type: 'category', data: axisCategories },
      yAxis: { type: 'value', name: '频数(%)' },
      series,
    } as const;
    return <ReportEChart option={option} style={{ width: '100%', height: 420 }} key={`hist-${analysis.id}-${idx}`} onChartReady={(c:any)=>c.resize()} />;
  };

  const renderEntry = (name: string, payload: any, idx: number) => {
    if (!payload || typeof payload !== 'object') {
      return <Empty description="无数据" />;
    }

    if (payload?.type === 'numeric_grouped' || payload?.by_group || payload?.grouped_stats) {
      return renderNumericGrouped(name, payload, idx);
    }

    if (payload?.type === 'numeric' || payload?.descriptive || payload?.overall) {
      return renderNumeric(name, payload, idx);
    }

    return renderCategorical(name, payload);
  };

  return (
    <div style={{ width: '100%' }}>
      {entries.map(([name, payload], idx) => (
        <div key={`${name}-${idx}`} style={{ marginBottom: 32 }}>
          <h4 style={{ margin: '0 0 12px 8px' }}>{name}</h4>
          {renderEntry(name, payload, idx)}
        </div>
      ))}
    </div>
  );
};

export default ExploreCharts;
