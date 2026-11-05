import React from 'react';
import { Empty } from 'antd';
import ReportEChart from './ReportEChart';

interface Analysis {
  id: string;
  analysis_type: string;
  results?: any;
}

interface CrosstabChartsProps {
  analysis: Analysis;
  chartType: string;
  results?: any; // adapted results optional
}

const CrosstabCharts: React.FC<CrosstabChartsProps> = ({ analysis, chartType, results: injected }) => {
  const hasInline = !!analysis?.results;
  if (!hasInline && !injected) {
    return <Empty description="暂无交叉表结果" />;
  }

  const results = injected || (typeof analysis.results === 'string'
    ? (() => { try { return JSON.parse(analysis.results); } catch { return null; } })()
    : analysis.results);

  if (!results || !results.counts) {
    return <Empty description="无有效交叉表数据" />;
  }

  const rows = Object.keys(results.counts || {});
  const cols = rows.length ? Object.keys(results.counts[rows[0]] || {}) : [];

  const toMatrix = () => {
    const data: Array<[number, number, number]> = [];
    rows.forEach((r, i) => {
      cols.forEach((c, j) => {
        const v = Number(results.counts?.[r]?.[c] ?? 0);
        data.push([j, i, v]);
      });
    });
    return data;
  };

  const heatmapOption = {
    tooltip: { position: 'top' },
    grid: { left: 60, right: 20, top: 30, bottom: 50 },
    xAxis: { type: 'category', data: cols, axisLabel: { rotate: 30 } },
    yAxis: { type: 'category', data: rows },
    visualMap: { min: 0, max: Math.max(1, Math.max(...toMatrix().map(d => d[2]))), orient: 'horizontal', left: 'center', bottom: 0 },
    series: [
      { type: 'heatmap', data: toMatrix(), label: { show: true }, emphasis: { itemStyle: { shadowBlur: 10 } } }
    ]
  } as any;

  const stackedOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: rows },
    grid: { left: 60, right: 20, top: 30, bottom: 50 },
    xAxis: { type: 'category', data: cols },
    yAxis: { type: 'value' },
    series: rows.map((r: string) => ({
      name: r,
      type: 'bar',
      stack: 'total',
      data: cols.map((c: string) => Number(results.counts?.[r]?.[c] ?? 0))
    }))
  } as any;

  // 残差热力图（标准化残差）：(O - E) / sqrt(E)
  const residualsOption = (() => {
    // 基础数据
    const rowTotals = rows.map(r => cols.reduce((s, c) => s + Number(results.counts?.[r]?.[c] ?? 0), 0));
    const colTotals = cols.map(c => rows.reduce((s, r) => s + Number(results.counts?.[r]?.[c] ?? 0), 0));
    const grand = rowTotals.reduce((s, v) => s + v, 0);

    const data: Array<[number, number, number, number, number]> = [];// [x(j), y(i), residual, observed, expected]
    let maxAbs = 0;
    rows.forEach((r, i) => {
      cols.forEach((c, j) => {
        const obs = Number(results.counts?.[r]?.[c] ?? 0);
        const exp = grand ? (rowTotals[i] * colTotals[j]) / grand : 0;
        const res = exp > 0 ? (obs - exp) / Math.sqrt(exp) : 0;
        maxAbs = Math.max(maxAbs, Math.abs(res));
        data.push([j, i, res, obs, exp]);
      });
    });

    if (maxAbs === 0) maxAbs = 1; // 避免颜色尺为 0

    return {
      tooltip: {
        formatter: (p: any) => {
          const res = p.value[2];
          const obs = p.value[3];
          const exp = p.value[4];
          return `${cols[p.value[0]]} / ${rows[p.value[1]]}<br/>观察频数: ${obs}<br/>期望频数: ${exp.toFixed(2)}<br/>标准化残差: ${res.toFixed(2)}`;
        }
      },
      grid: { left: 60, right: 20, top: 30, bottom: 50 },
      xAxis: { type: 'category', data: cols, axisLabel: { rotate: 30 } },
      yAxis: { type: 'category', data: rows },
      visualMap: {
        min: -maxAbs,
        max: maxAbs,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: ['#4575b4', '#f7f7f7', '#d73027'] }, // 蓝-白-红 对称色带
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: { show: true, formatter: (p: any) => p.value[2].toFixed(1) },
          emphasis: { itemStyle: { shadowBlur: 10 } }
        }
      ]
    } as any;
  })();

  // 马赛克图：专业实现（custom series）。并按调整残差着色，增强可读性。
  // 宽度按列总频数 / 总样本数，列内各矩形高度按该列条件比例。
  const mosaicOption = (() => {
    const grand = Number(results.grand_total ?? 0) || rows.reduce((s, r) => s + cols.reduce((t, c) => t + Number(results.counts?.[r]?.[c] ?? 0), 0), 0);
    if (!grand) return {};
    const colTotals = cols.map(c => rows.reduce((s, r) => s + Number(results.counts?.[r]?.[c] ?? 0), 0));
    const rowTotals = rows.map(r => cols.reduce((s, c) => s + Number(results.counts?.[r]?.[c] ?? 0), 0));
    const colWidths = colTotals.map(t => (t / grand));

    // 构造矩形数据 [x, y, w, h, rowName, colName, count]
    let xCursor = 0;
    const data: any[] = [];
    let maxAbs = 0;
    cols.forEach((c, ci) => {
      const colTotal = colTotals[ci] || 1; // 避免除零
      let yCursor = 0;
      rows.forEach((r, ri) => {
        const count = Number(results.counts?.[r]?.[c] ?? 0);
        const h = colTotal ? (count / colTotal) : 0;
        const w = colWidths[ci];
        // 计算调整残差 (近似)：(O-E)/sqrt(E*(1-row_prop)*(1-col_prop))
        const expected = (rowTotals[ri] * colTotals[ci]) / grand;
        const rowProp = rowTotals[ri] / grand;
        const colProp = colTotals[ci] / grand;
        const denom = Math.sqrt(Math.max(expected * (1 - rowProp) * (1 - colProp), 1e-12));
        const z = denom > 0 ? (count - expected) / denom : 0;
        maxAbs = Math.max(maxAbs, Math.abs(z));
        if (w > 0 && h > 0) {
          data.push([xCursor, yCursor, w, h, r, c, count, z]);
        }
        yCursor += h;
      });
      xCursor += colWidths[ci];
    });

    const colorForResidual = (z: number) => {
      if (z <= -2.58) return '#313695';
      if (z > -2.58 && z <= -1.96) return '#4575b4';
      if (z >= 2.58) return '#a50026';
      if (z >= 1.96) return '#d73027';
      return '#f7f7f7';
    };

    const renderItem = (params: any, api: any) => {
      const x = api.value(0);
      const y = api.value(1);
      const w = api.value(2);
      const h = api.value(3);
      const z = api.value(7);
      const coordSys = params.coordSys;
      const x0 = coordSys.x + x * coordSys.width;
      const y0 = coordSys.y + (1 - y - h) * coordSys.height; // y 轴从下到上
      const width = w * coordSys.width;
      const height = h * coordSys.height;
      return {
        type: 'rect',
        shape: { x: x0, y: y0, width, height },
        style: api.style({ fill: colorForResidual(z) }),
      } as any;
    };

    return {
      tooltip: {
        formatter: (p: any) => {
          const row = p.value[4];
          const col = p.value[5];
          const cnt = p.value[6];
          const z = p.value[7];
          const sig = Math.abs(z) >= 2.58 ? '极显著(|z|≥2.58)' : (Math.abs(z) >= 1.96 ? '显著(|z|≥1.96)' : '不显著');
          return `${col} / ${row}: ${cnt}<br/>调整残差: ${z.toFixed(2)}<br/>结论: ${sig}`;
        }
      },
      xAxis: { type: 'value', min: 0, max: 1, axisLabel: { show: false }, splitLine: { show: false } },
      yAxis: { type: 'value', min: 0, max: 1, axisLabel: { show: false }, splitLine: { show: false } },
      series: [{
        type: 'custom',
        renderItem,
        encode: {},
        data,
        itemStyle: { opacity: 0.9 },
        emphasis: { itemStyle: { opacity: 1 } }
      }],
      // 在顶部显示列标签
      graphic: [
        ...(() => {
          const gfx: any[] = [];
          let x = 0;
          cols.forEach((c, ci) => {
            const w = colWidths[ci];
            gfx.push({
              type: 'text',
              left: `${(x + w / 2) * 100}%`,
              top: 10,
              style: { text: c, textAlign: 'center', fill: '#333' }
            });
            x += w;
          });
          return gfx;
        })()
      ]
    } as any;
  })();

  const option = chartType === 'stacked_bar' 
    ? stackedOption 
    : chartType === 'mosaic' 
      ? mosaicOption 
      : chartType === 'residuals' 
        ? residualsOption 
        : heatmapOption;

  return (
    <div style={{ width: '100%', minHeight: 420 }}>
      <ReportEChart 
        option={option} 
        style={{ width: '100%', height: 420 }} 
        notMerge 
        onChartReady={(chart: any) => setTimeout(() => chart?.resize && chart.resize(), 0)}
      />
    </div>
  );
};

export default CrosstabCharts;
