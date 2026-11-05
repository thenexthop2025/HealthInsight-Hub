import React from 'react';
import { Empty } from 'antd';
import ReportEChart from './ReportEChart';
import { reportPalette } from '../../theme/reportTheme';

interface Analysis {
  id: string | number;
  analysis_type: string;
  results?: any;
}

interface DescriptiveChartsProps {
  analysis: Analysis;
  chartType: string;
  results?: any;
}

type ParsedRow = {
  key: string;
  label: string;
  stats: Record<string, any>;
};

const toNumber = (value: any): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const formatLabel = (value: string): string => {
  if (!value) return value;
  // 将 "变量 | group=值" 替换成两行，保持可读
  if (value.includes('|')) {
    return value.replace('|', '\n|');
  }
  // 对特别长的标签进行折行
  if (value.length > 20) {
    return value.replace(/(.{1,20})/g, '$1\n');
  }
  return value;
};

const extractRows = (raw: any): ParsedRow[] => {
  if (!raw || typeof raw !== 'object') return [];

  return Object.entries(raw).flatMap(([variable, payload]: [string, any]) => {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    const rows: ParsedRow[] = [];
    const variableName = payload.variable || variable;

    if (payload.descriptive) {
      rows.push({
        key: `${variable}-overall`,
        label: variableName,
        stats: payload.descriptive,
      });
    }

    if (payload.grouped_stats && typeof payload.grouped_stats === 'object') {
      const groupBy = payload.group_by || payload.grouping_variable;
      Object.entries(payload.grouped_stats).forEach(([groupKey, stats], idx) => {
        rows.push({
          key: `${variable}-group-${groupKey}-${idx}`,
          label: groupBy ? `${variableName} | ${groupBy}=${groupKey}` : `${variableName} | 组=${groupKey}`,
          stats: stats as Record<string, any>,
        });
      });
    }

    if (!payload.descriptive && !payload.grouped_stats) {
      rows.push({
        key: `${variable}-generic`,
        label: variableName,
        stats: payload as Record<string, any>,
      });
    }

    return rows;
  });
};

const DescriptiveCharts: React.FC<DescriptiveChartsProps> = ({ analysis, chartType, results: injected }) => {
  const rawResults = injected ?? (typeof analysis.results === 'string' ? safeParse(analysis.results) : analysis.results);

  if (!rawResults) {
    return <Empty description="暂无分析结果" />;
  }

  const rows = extractRows(rawResults).filter((row) => {
    const stats = row.stats || {};
    return stats && (stats.count === undefined || Number(stats.count) > 0);
  });

  if (rows.length === 0) {
    return <Empty description="暂无可展示的统计结果" />;
  }

  if (chartType === 'histogram') {
    return renderHistogram(analysis, rows);
  }

  // 默认箱线图
  return renderBoxplot(analysis, rows);
};

const safeParse = (payload: string) => {
  try {
    return JSON.parse(payload);
  } catch {
    try {
      return JSON.parse(payload.replace(/\bNaN\b/g, 'null'));
    } catch {
      return null;
    }
  }
};

const renderBoxplot = (analysis: Analysis, rows: ParsedRow[]) => {
  const filteredRows = rows.filter((row) => {
    const stats = row.stats || {};
    const min = toNumber(stats.min);
    const q1 = toNumber(stats.q1 ?? stats.q25);
    const median = toNumber(stats.median);
    const q3 = toNumber(stats.q3 ?? stats.q75);
    const max = toNumber(stats.max);
    return [min, q1, median, q3, max].every((v) => typeof v === 'number');
  });

  if (filteredRows.length === 0) {
    return <Empty description="暂无箱线图数据" />;
  }

  const option = {
    title: { text: '描述性统计 - 箱线图', left: 'center', top: 8 },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const row = filteredRows[params.dataIndex];
        const data = params.data as number[];
        return `${row.label}<br/>min: ${data[0]}<br/>Q1: ${data[1]}<br/>median: ${data[2]}<br/>Q3: ${data[3]}<br/>max: ${data[4]}`;
      },
    },
    xAxis: {
      type: 'category',
      data: filteredRows.map((row) => row.label),
      axisLabel: {
        rotate: 30,
        interval: 0,
        formatter: (value: string) => formatLabel(value),
        margin: 16,
      },
    },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'boxplot',
        itemStyle: { color: reportPalette.primary },
        data: filteredRows.map((row) => {
          const stats = row.stats || {};
          return [
            toNumber(stats.min),
            toNumber(stats.q1 ?? stats.q25),
            toNumber(stats.median),
            toNumber(stats.q3 ?? stats.q75),
            toNumber(stats.max),
          ];
        }),
      },
    ],
  } as const;

  return (
    <div style={{ width: '100%', minHeight: 420 }}>
      <ReportEChart
        key={`chart-${analysis.id}-boxplot-${analysis.analysis_type}`}
        option={option}
        style={{ width: '100%', height: 420 }}
        notMerge
        onChartReady={(chart: any) => setTimeout(() => chart?.resize && chart.resize(), 0)}
      />
    </div>
  );
};

const renderHistogram = (analysis: Analysis, rows: ParsedRow[]) => {
  const numericRows = rows.filter((row) => {
    const stats = row.stats || {};
    const min = toNumber(stats.min);
    const max = toNumber(stats.max);
    const std = toNumber(stats.std);
    return typeof min === 'number' && typeof max === 'number' && typeof std === 'number' && std > 0 && max > min;
  });

  if (numericRows.length === 0) {
    return <Empty description="暂无直方图数据" />;
  }

  const series = numericRows.map((row, idx) => {
    const stats = row.stats || {};
    const mean = toNumber(stats.mean) ?? 0;
    const std = toNumber(stats.std) ?? 1;
    const count = toNumber(stats.count) ?? 0;
    const min = toNumber(stats.min) ?? mean - 3 * std;
    const max = toNumber(stats.max) ?? mean + 3 * std;

    const bins = 20;
    const binWidth = (max - min) / bins;
    const data = Array.from({ length: bins }, (_, i) => {
      const x0 = min + i * binWidth;
      const x1 = x0 + binWidth;
      const center = (x0 + x1) / 2;
      const density = Math.exp(-0.5 * Math.pow((center - mean) / std, 2)) / (std * Math.sqrt(2 * Math.PI));
      return {
        name: center.toFixed(2),
        value: Math.max(0, density * count * binWidth),
      };
    });

    return {
      name: row.label,
      type: 'bar',
      data,
      itemStyle: { color: `hsl(${(idx * 137.5) % 360}, 70%, 50%)` },
      barWidth: '80%',
    };
  });

  const option = {
    title: { text: '描述性统计 - 数据分布直方图', left: 'center', top: 8 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        if (!Array.isArray(params)) return '';
        const { axisValue, seriesName, value } = params[0];
        return `${seriesName}<br/>区间中心: ${axisValue}<br/>频数: ${Number(value).toFixed(2)}`;
      },
    },
    legend: { type: 'scroll', top: 42, left: 16, right: 16 },
    grid: { top: 90, left: 60, right: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      name: '区间中心',
      axisLabel: {
        rotate: 30,
        interval: 0,
        formatter: (value: string) => formatLabel(value),
        margin: 16,
      },
    },
    yAxis: { type: 'value', name: '频数' },
    series,
  } as const;

  return (
    <div style={{ width: '100%', minHeight: 420 }}>
      <ReportEChart
        key={`chart-${analysis.id}-histogram-${analysis.analysis_type}`}
        option={option}
        style={{ width: '100%', height: 420 }}
        notMerge
        onChartReady={(chart: any) => setTimeout(() => chart?.resize && chart.resize(), 0)}
      />
    </div>
  );
};

export default DescriptiveCharts;
