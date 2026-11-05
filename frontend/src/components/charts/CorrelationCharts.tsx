import React, { useEffect } from 'react';
import { Empty } from 'antd';
import ReportEChart from './ReportEChart';

interface Analysis {
  id: string;
  analysis_type: string;
  results?: any;
}

interface CorrelationChartsProps {
  analysis: Analysis;
  chartType: string;
  results?: any; // adapted results optional
}

const CorrelationCharts: React.FC<CorrelationChartsProps> = ({ analysis, chartType, results: injected }) => {
  const hasInline = !!analysis.results;
  const results = injected || (typeof analysis.results === 'string' ? (() => { try { return JSON.parse(analysis.results); } catch { return null; } })() : analysis.results);

  // 尺寸就绪兜底：在任意情况下都调用 Hook
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    return () => clearTimeout(t);
  }, []);

  if (!hasInline && !results) return <Empty description="暂无相关性结果" />;

  // 适配器输出：{ variables: string[]; correlations: { 'A|B': { pearson?:{r,p}, spearman?:{r,p} } } }
  // 优先使用后端提供的变量列表；否则从相关性结果键名推导
  const variables: string[] = (results?.variables as string[]) || Object.keys(results?.correlations || {}).reduce((set: string[], k: string) => {
    const [a, b] = k.split(/\||,|->|-/).map((s) => String(s).trim());
    if (a && !set.includes(a)) set.push(a);
    if (b && !set.includes(b)) set.push(b);
    return set;
  }, []);

  const corrs: Record<string, any> = results?.correlations || {};
  const pearsonMatrix: Record<string, Record<string, number>> | undefined = results?.pearson_matrix;
  const getPairKey = (a: string, b: string) => {
    const tryKeys = [
      `${a}|${b}`, `${b}|${a}`,
      `${a}-${b}`, `${b}-${a}`,
      `${a},${b}`, `${b},${a}`,
      `${a}_vs_${b}`, `${b}_vs_${a}`
    ];
    for (const k of tryKeys) { if (corrs[k]) return k; }
    return '';
  };
  const getR = (a: string, b: string): number => {
    if (a === b) return 1;
    // 1) 优先 correlations 键匹配
    const k = getPairKey(a, b);
    if (k) {
      const v = corrs[k].pearson || corrs[k].spearman || corrs[k].kendall || {};
      const r = typeof v.r === 'number' ? v.r : undefined;
      if (typeof r === 'number' && Number.isFinite(r)) return r;
    }
    // 2) 退回矩阵（若存在则覆盖所有缺失对）
    const pm = pearsonMatrix?.[a]?.[b];
    if (typeof pm === 'number' && Number.isFinite(pm)) return pm;
    return 0;
  };

  if (chartType === 'heatmap') {
    const rows = variables;
    const cols = variables;
    const matrix: Array<[number, number, number]> = [];
    rows.forEach((r, i) => cols.forEach((c, j) => matrix.push([j, i, getR(r, c)])));

    const option = {
      tooltip: { position: 'top' },
      grid: { left: 60, right: 80, top: 30, bottom: 50 },
      xAxis: { type: 'category', data: cols, axisLabel: { rotate: 45 } },
      yAxis: { type: 'category', data: rows },
      // 采用类似示例的配色：黄→绿→青→蓝→紫（反向 viridis）
      visualMap: {
        min: -1,
        max: 1,
        orient: 'vertical',
        right: 10,
        top: 'middle',
        inRange: {
          color: ['#fde725', '#5ec962', '#21918c', '#3b528b', '#440154']
        }
      },
      series: [ { type: 'heatmap', data: matrix, label: { show: true, formatter: (p: any) => (p?.value?.[2] ?? 0).toFixed(2) } } ]
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

  if (chartType === 'network') {
    const threshold = 0.3;
    const nodes = variables.map((v) => ({ id: v, name: v, value: v }));
    const links: Array<{ source: string; target: string; value: number }> = [];
    for (let i = 0; i < variables.length; i++) {
      for (let j = i + 1; j < variables.length; j++) {
        const r = getR(variables[i], variables[j]);
        if (Math.abs(r) >= threshold) links.push({ source: variables[i], target: variables[j], value: r });
      }
    }
    const option = {
      tooltip: { 
        formatter: (p: any) => {
          const d = p?.data || {};
          if (d.source && d.target) {
            const v = Number(d.value);
            return `${String(d.source)} ↔ ${String(d.target)}<br/>r=${Number.isFinite(v) ? v.toFixed(2) : 'N/A'}`;
          }
          return String(d.name ?? '');
        }
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          data: nodes,
          links,
          label: { show: true },
          force: { repulsion: 120, edgeLength: 80 },
          lineStyle: {
            width: 2,
            color: (p: any) => (p.value >= 0 ? '#d73027' : '#4575b4')
          }
        }
      ]
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

  // 散点矩阵：基于后端 samples 渲染（上限变量数以防过密）
  if (chartType === 'scatter') {
    const samples: Record<string, any[]> | undefined = results?.samples;
    if (!samples) return <Empty description="结果未包含原始样本，暂无法绘制散点矩阵" />;
    const vars = variables.filter((v) => Array.isArray(samples[v]));
    const maxVars = Math.min(vars.length, 5); // 控制单屏密度
    if (maxVars === 0) return <Empty description="可用数值变量不足，无法绘制散点矩阵" />;

    const sel = vars.slice(0, maxVars);

    const toNum = (x: any) => {
      const n = Number(x);
      return Number.isFinite(n) ? n : null;
    };
    const makePairs = (xArr: any[], yArr: any[]) => {
      const out: Array<[number, number]> = [];
      const n = Math.min(xArr.length, yArr.length);
      for (let i = 0; i < n; i++) {
        const xv = toNum(xArr[i]);
        const yv = toNum(yArr[i]);
        if (xv !== null && yv !== null) out.push([xv as number, yv as number]);
      }
      return out;
    };

    const gap = 2; // 百分比间隙
    const cellW = (100 / maxVars) - gap;
    const cellH = (100 / maxVars) - gap;
    const baseTop = 8; // 上边距百分比
    const baseLeft = 6; // 左边距百分比

    const grids: any[] = [];
    const xAxes: any[] = [];
    const yAxes: any[] = [];
    const series: any[] = [];

    let gi = 0;
    for (let r = 0; r < maxVars; r++) {
      for (let c = 0; c < maxVars; c++) {
        const left = `${baseLeft + c * (cellW + gap)}%`;
        const top = `${baseTop + r * (cellH + gap)}%`;
        grids.push({ left, top, width: `${cellW}%`, height: `${cellH}%` });
        xAxes.push({
          gridIndex: gi,
          type: 'value',
          scale: true,
          axisLabel: { show: r === maxVars - 1 },
          name: sel[c],
          nameLocation: 'middle',
          nameGap: 18,
          nameTextStyle: { fontSize: 10 },
        });
        yAxes.push({
          gridIndex: gi,
          type: 'value',
          scale: true,
          axisLabel: { show: c === 0 },
          name: sel[r],
          nameLocation: 'middle',
          nameGap: 28,
          nameRotate: 90,
          nameTextStyle: { fontSize: 10 },
        });
        // 仅绘制下三角，避免重复
        if (r > c) {
          const data = makePairs(samples[sel[c]] || [], samples[sel[r]] || []);
          series.push({
            type: 'scatter',
            xAxisIndex: gi,
            yAxisIndex: gi,
            symbolSize: 3,
            data,
            emphasis: { focus: 'series' },
            tooltip: {
              formatter: (p: any) => `${sel[c]}: ${p.value[0].toFixed(3)}<br/>${sel[r]}: ${p.value[1].toFixed(3)}`,
            },
          });
        } else if (r === c) {
          // 对角线：用密度近似（小柱状）
          const arr = (samples[sel[r]] || []).map(toNum).filter((v: any) => v !== null) as number[];
          if (arr.length > 0) {
            const min = Math.min(...arr);
            const max = Math.max(...arr);
            const bins = 12;
            const step = (max - min) / (bins || 1) || 1;
            const hist = new Array(bins).fill(0);
            arr.forEach((v) => {
              const idx = Math.max(0, Math.min(bins - 1, Math.floor((v - min) / step)));
              hist[idx] += 1;
            });
            const x = Array.from({ length: bins }, (_, i) => min + i * step + step / 2);
            const barData = x.map((xx, i) => [xx, hist[i]]);
            series.push({
              type: 'bar',
              xAxisIndex: gi,
              yAxisIndex: gi,
              data: barData,
              barWidth: '60%',
              itemStyle: { color: '#8ecae6' },
              tooltip: { formatter: (p: any) => `${sel[r]}: ${p.value[0].toFixed(3)}<br/>频数: ${p.value[1]}` },
            });
          }
        }
        gi += 1;
      }
    }

    const option = {
      animation: false,
      grid: grids,
      xAxis: xAxes,
      yAxis: yAxes,
      series,
    } as any;

    return (
      <div style={{ width: '100%', minHeight: 520 }}>
        <ReportEChart
          option={option}
          style={{ width: '100%', height: 520 }}
          notMerge
          onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)}
        />
      </div>
    );
  }

  return <Empty description="不支持的图表类型" />;
};

export default CorrelationCharts;
