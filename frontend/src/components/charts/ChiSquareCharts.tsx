import React, { useState } from 'react';
import { Empty, Select, Space } from 'antd';
import ReportEChart from './ReportEChart';

interface Analysis {
  id: string;
  analysis_type: string;
  results?: any;
}

interface ChiSquareChartsProps {
  analysis: Analysis;
  chartType: string;
  results?: any; // adapted results optional
}

const ChiSquareCharts: React.FC<ChiSquareChartsProps> = ({ analysis, chartType, results: injected }) => {
  const hasInline = !!analysis?.results;
  const results = injected || (typeof analysis.results === 'string'
    ? (() => { try { return JSON.parse(analysis.results); } catch { return null; } })()
    : analysis.results);

  const contingency = results?.contingency_table || results?.counts || {};
  const expected = results?.expected || {};
  const residuals = (chartType === 'residuals' && results?.adjusted_residuals) ? results.adjusted_residuals : (results?.residuals || results?.standardized_residuals || {});
  const rows = Object.keys(contingency);
  const cols = rows.length ? Object.keys(contingency[rows[0]] || {}) : [];

  // 计数 / 行百分比 / 列百分比 切换（仅用于非残差图）
  const [displayMode, setDisplayMode] = useState<'count' | 'row%' | 'col%'>('count');
  const tableForDisplay = (() => {
    if (chartType === 'residuals') return contingency; // 残差图始终基于残差，不受百分比切换影响
    if (displayMode === 'count') return contingency;
    const out: any = {};
    if (displayMode === 'row%') {
      rows.forEach(r => {
        const rowSum = cols.reduce((s, c) => s + Number(contingency?.[r]?.[c] ?? 0), 0) || 1;
        out[r] = {};
        cols.forEach(c => {
          out[r][c] = Number((((contingency?.[r]?.[c] ?? 0) / rowSum) * 100).toFixed(2));
        });
      });
    } else {
      // col%
      const colSums = cols.map(c => rows.reduce((s, r) => s + Number(contingency?.[r]?.[c] ?? 0), 0) || 1);
      rows.forEach(r => {
        out[r] = {};
        cols.forEach((c, j) => {
          out[r][c] = Number((((contingency?.[r]?.[c] ?? 0) / colSums[j]) * 100).toFixed(2));
        });
      });
    }
    return out;
  })();

  const toMatrix = (table: any) => rows.flatMap((r, i) => cols.map((c, j) => [j, i, Number(table?.[r]?.[c] ?? 0)]));

  const base = {
    grid: { left: 60, right: 20, top: 30, bottom: 50 },
    xAxis: { type: 'category', data: cols, axisLabel: { rotate: 30 } },
    yAxis: { type: 'category', data: rows },
  } as any;

  // 堆叠柱状图：x 为列类别，系列为行类别，按显示模式（计数/行%/列%）取数据
  if (chartType === 'stacked_bar') {
    const isPercent = displayMode !== 'count';
    const option = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: rows },
      grid: { left: 60, right: 20, top: 30, bottom: 50 },
      xAxis: { type: 'category', data: cols },
      yAxis: { type: 'value', name: isPercent ? '(%)' : '', max: isPercent ? 100 : undefined },
      series: rows.map((r: string) => ({
        name: r,
        type: 'bar',
        stack: 'total',
        data: cols.map((c: string) => Number((tableForDisplay?.[r]?.[c]) ?? 0)),
        emphasis: { focus: 'series' }
      }))
    } as any;
    return (
      <div style={{ width: '100%', minHeight: 420 }}>
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <Space size={8}>
            <span>显示</span>
            <Select size="small" value={displayMode} onChange={setDisplayMode} style={{ width: 120 }}
              options={[
                { value: 'count', label: '计数' },
                { value: 'row%', label: '行百分比' },
                { value: 'col%', label: '列百分比' },
              ]}
            />
          </Space>
        </div>
        <ReportEChart option={option} style={{ width: '100%', height: 420 }} notMerge onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)} />
      </div>
    );
  }

  const noData = (!hasInline && !injected) || !results || rows.length === 0 || cols.length === 0;
  if (noData) {
    return <Empty description="暂无卡方结果" />;
  }

  if (chartType === 'residuals') {
    // 标准化残差：中心在0，正负不同颜色；视觉映射从负到正
    const matrix = toMatrix(residuals);
    const maxAbs = Math.max(1, ...matrix.map(m => Math.abs(m[2])));
    const option = {
      ...base,
      // 为右侧视觉映射预留足够空间，避免遮挡
      grid: { left: 60, right: 120, top: 30, bottom: 50 },
      tooltip: {
        formatter: (p: any) => {
          const z = p.value[2];
          const sig = Math.abs(z) >= 2.58 ? '极显著(|z|≥2.58)' : (Math.abs(z) >= 1.96 ? '显著(|z|≥1.96)' : '不显著');
          return `${rows[p.value[1]]} / ${cols[p.value[0]]}<br/>调整残差: ${z.toFixed(2)}<br/>结论: ${sig}`;
        }
      },
      // 使用连续型对称色带，0 处为近白蓝，避免看起来“空白”；并加边框增强对比
      visualMap: [{
        min: -maxAbs,
        max: maxAbs,
        orient: 'vertical',
        right: 20,
        top: 'middle',
        calculable: true,
        inRange: { color: ['#2c7bb6', '#e6f0ff', '#d73027'] },
      }],
      series: [{
        type: 'heatmap',
        data: matrix,
        label: { show: true, color: '#333', formatter: (p: any) => p.value[2].toFixed(1) },
        itemStyle: { borderColor: '#d9d9d9', borderWidth: 1 }
      }]
    } as any;
    return <div style={{ width: '100%', minHeight: 420 }}><ReportEChart option={option} style={{ width: '100%', height: 420 }} notMerge onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)} /></div>;
  }

  // 观察/期望频数：并排对比两张热力图，便于区分
  if (chartType === 'expected_vs_observed') {
    const obsMatrix = toMatrix(tableForDisplay);
    const expMatrix = toMatrix(expected);
    const obsMax = Math.max(1, ...obsMatrix.map(m => m[2]));
    const expMax = Math.max(1, ...expMatrix.map(m => m[2]));
    const option = {
      grid: [
        // 调整两图间距（更窄）并为右侧 visualMap 预留空间
        { left: 60, right: '54%', top: 36, bottom: 50 },
        { left: '56%', right: 100, top: 36, bottom: 50 },
      ],
      xAxis: [
        { type: 'category', data: cols, axisLabel: { rotate: 30 } },
        { type: 'category', data: cols, axisLabel: { rotate: 30 }, gridIndex: 1 },
      ],
      yAxis: [
        { type: 'category', data: rows },
        { type: 'category', data: rows, gridIndex: 1 },
      ],
      tooltip: { formatter: (p: any) => `${rows[p.value[1]]} / ${cols[p.value[0]]}: ${p.value[2]}` },
      visualMap: [
        // 左图的视觉映射放在两图之间（不遮挡左图）
        { min: 0, max: obsMax, orient: 'vertical', left: '50%', top: 'middle' },
        // 右图的视觉映射放在最右侧
        { min: 0, max: expMax, orient: 'vertical', right: 20, top: 'middle' },
      ],
      title: [
        // 让标题与各自图表区域居中对齐
        { left: '27%', top: 6, text: '观察频数' },
        { left: '77%', top: 6, text: '期望频数' },
      ],
      series: [
        { type: 'heatmap', data: obsMatrix, label: { show: true } },
        { type: 'heatmap', data: expMatrix, label: { show: true }, xAxisIndex: 1, yAxisIndex: 1 },
      ],
    } as any;
    return <div style={{ width: '100%', minHeight: 420 }}><ReportEChart option={option} style={{ width: '100%', height: 420 }} notMerge onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)} /></div>;
  }

  // 马赛克图：基于观察频数，列宽按列总频数比例，行高按列内占比；按调整残差着色
  if (chartType === 'mosaic') {
    const grand = rows.reduce((s, r) => s + cols.reduce((t, c) => t + Number(contingency?.[r]?.[c] ?? 0), 0), 0);
    if (!grand) return <Empty description="无有效数据" />;
    const colTotals = cols.map(c => rows.reduce((s, r) => s + Number(contingency?.[r]?.[c] ?? 0), 0));
    const rowTotals = rows.map(r => cols.reduce((s, c) => s + Number(contingency?.[r]?.[c] ?? 0), 0));
    const colWidths = colTotals.map(t => (t / grand));

    let xCursor = 0;
    const data: any[] = [];
    cols.forEach((c, ci) => {
      const colTotal = colTotals[ci] || 1;
      let yCursor = 0;
      rows.forEach((r, ri) => {
        const count = Number(contingency?.[r]?.[c] ?? 0);
        const h = colTotal ? (count / colTotal) : 0;
        const w = colWidths[ci];
        // 优先使用后端提供的调整残差
        const zFromBackend = results?.adjusted_residuals?.[r]?.[c];
        let z: number;
        if (typeof zFromBackend === 'number') {
          z = zFromBackend;
        } else {
          // 近似计算
          const expected = (rowTotals[ri] * colTotals[ci]) / grand;
          const rowProp = rowTotals[ri] / grand;
          const colProp = colTotals[ci] / grand;
          const denom = Math.sqrt(Math.max(expected * (1 - rowProp) * (1 - colProp), 1e-12));
          z = denom > 0 ? (count - expected) / denom : 0;
        }
        if (w > 0 && h > 0) data.push([xCursor, yCursor, w, h, r, c, count, z]);
        yCursor += h;
      });
      xCursor += colWidths[ci];
    });

    const colorForResidual = (z: number) => {
      if (z <= -2.58) return '#313695';
      if (z > -2.58 && z <= -1.96) return '#4575b4';
      if (z >= 2.58) return '#a50026';
      if (z >= 1.96) return '#d73027';
      return '#e6f0ff'; // 中性值也有可见底色
    };

    const option = {
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
        renderItem: (params: any, api: any) => {
          const x = api.value(0); const y = api.value(1); const w = api.value(2); const h = api.value(3); const z = api.value(7);
          const cnt = api.value(6);
          const cs = params.coordSys;
          const x0 = cs.x + x * cs.width;
          const y0 = cs.y + (1 - y - h) * cs.height;
          const width = w * cs.width;
          const height = h * cs.height;
          // 文本位置
          const cx = x0 + width / 2;
          const cy = y0 + height / 2;
          return {
            type: 'group',
            children: [
              { type: 'rect', shape: { x: x0, y: y0, width, height }, style: { fill: colorForResidual(z), stroke: '#cccccc', lineWidth: 1 } },
              { type: 'text', style: { x: cx, y: cy, text: String(cnt), textAlign: 'center', textVerticalAlign: 'middle', fill: '#333' }}
            ]
          } as any;
        },
        data,
        itemStyle: { opacity: 0.95 },
        emphasis: { itemStyle: { opacity: 1 } }
      }],
    } as any;
    return <div style={{ width: '100%', minHeight: 420 }}><ReportEChart option={option} style={{ width: '100%', height: 420 }} notMerge onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)} /></div>;
  }

  // 默认：观察频数热力图
  const table = tableForDisplay;
  const matrix = toMatrix(table);
  const maxVal = Math.max(1, ...matrix.map(m => m[2]));
  const option = {
    ...base,
    grid: { left: 60, right: 90, top: 30, bottom: 50 },
    tooltip: { formatter: (p: any) => `${rows[p.value[1]]} / ${cols[p.value[0]]}: ${p.value[2]}` },
    visualMap: { min: 0, max: maxVal, orient: 'vertical', right: 20, top: 'middle' },
    series: [{ type: 'heatmap', data: matrix, label: { show: true } }]
  } as any;
  return (
    <div style={{ width: '100%', minHeight: 420 }}>
      {chartType !== 'residuals' && (
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <Space size={8}>
            <span>显示</span>
            <Select size="small" value={displayMode} onChange={setDisplayMode} style={{ width: 120 }}
              options={[
                { value: 'count', label: '计数' },
                { value: 'row%', label: '行百分比' },
                { value: 'col%', label: '列百分比' },
              ]}
            />
          </Space>
        </div>
      )}
      <ReportEChart option={option} style={{ width: '100%', height: 420 }} notMerge onChartReady={(c: any) => setTimeout(() => c?.resize && c.resize(), 0)} />
    </div>
  );
};

export default ChiSquareCharts;
