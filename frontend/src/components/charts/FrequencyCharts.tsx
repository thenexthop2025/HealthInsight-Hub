import React from 'react';
import { Empty, Table } from 'antd';
import ReportEChart from './ReportEChart';
import { reportPalette } from '../../theme/reportTheme';

interface Analysis {
  id: string;
  analysis_type: string;
  results?: any;
}

interface FrequencyChartsProps {
  analysis: Analysis;
  chartType: string;
  results?: any; // adapted results optional
}

const FrequencyCharts: React.FC<FrequencyChartsProps> = ({ analysis, chartType, results: injected }) => {
  const hasInline = !!analysis.results;
  if (!hasInline && !injected) {
    return <Empty description="暂无分析结果" />;
  }

  const results = injected || (typeof analysis.results === 'string' 
    ? JSON.parse(analysis.results) 
    : analysis.results);

  const entries: Array<[string, any]> =
    results && typeof results === 'object' ? Object.entries(results) : [];
  
  if (entries.length === 0) {
    return <Empty description="暂无频率分析结果" />;
  }

  // 渲染单个频率图表
  const renderSingleFrequencyChart = (variable: string, data: any, chartType: string) => {
    const levels: Array<any> = (data && data.levels) || [];
    if (levels.length === 0) {
      return <Empty description="该变量无有效数据" />;
    }

    // 饼图
    if (chartType === 'pie') {
      const option = {
        title: { text: `${variable} - 比例`, left: 'center' },
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { orient: 'vertical', left: 'left' },
        series: [
          {
            type: 'pie',
            radius: '60%',
            data: levels.map((item) => ({
              name: item.value,
              value: Number(item.count || 0),
            })),
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
          },
        ],
      };
      return (
        <div style={{ width: '100%', minHeight: 420 }}>
          <ReportEChart
            key={`chart-${analysis.id}-${chartType}-${analysis.analysis_type}-${variable}`}
            option={option}
            style={{ width: '100%', height: 420 }}
            notMerge
            onChartReady={(chart: any) => setTimeout(() => chart?.resize && chart.resize(), 0)}
          />
        </div>
      );
    }

    // 频数表
    if (chartType === 'table') {
      const columns = [
        { title: '取值', dataIndex: 'value', key: 'value' },
        { title: '计数', dataIndex: 'count', key: 'count' },
        { title: '百分比(%)', dataIndex: 'percent', key: 'percent' },
        { title: '有效百分比(%)', dataIndex: 'valid_percent', key: 'valid_percent' },
        {
          title: '累计有效百分比(%)',
          dataIndex: 'cumulative_valid_percent',
          key: 'cumulative_valid_percent',
        },
      ];
      const dataSource = levels.map((item: any, index: number) => ({
        key: `${item.value}-${index}`,
        value: item.value,
        count: item.count,
        percent: (item.percent ?? 0).toFixed(2),
        valid_percent: (item.valid_percent ?? 0).toFixed(2),
        cumulative_valid_percent: (item.cumulative_valid_percent ?? 0).toFixed(2),
      }));
      return <Table columns={columns} dataSource={dataSource} pagination={false} size="small" />;
    }

    // 柱状图（默认）
    const option = {
      title: { 
        text: `${variable} - 频数分布`, 
        left: 'center',
        top: 10,
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold'
        }
      },
      tooltip: { trigger: 'axis' },
      legend: { 
        data: ['频数', '有效百分比'],
        top: 40,
        left: 'center'
      },
      grid: {
        left: '8%',
        right: '8%',
        top: '20%',
        bottom: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: levels.map((item: any) => item.value),
        axisLabel: { 
          rotate: 45,
          interval: 0,
          fontSize: 12,
          margin: 20
        },
      },
      yAxis: [
        { type: 'value', name: '频数' },
        { type: 'value', name: '有效百分比(%)', min: 0, max: 100 },
      ],
      series: [
        {
          name: '频数',
          type: 'bar',
          data: levels.map((item: any) => Number(item.count || 0)),
          itemStyle: { color: reportPalette.primary },
        },
        {
          name: '有效百分比',
          type: 'line',
          yAxisIndex: 1,
          data: levels.map((item: any) => Number(item.valid_percent || 0)),
        },
      ],
    };
    return (
      <div style={{ width: '100%', minHeight: 420 }}>
        <ReportEChart
          key={`chart-${analysis.id}-${chartType || 'default'}-${analysis.analysis_type}-${variable}`}
          option={option}
          style={{ width: '100%', height: 420 }}
          notMerge
          onChartReady={(chart: any) => setTimeout(() => chart?.resize && chart.resize(), 0)}
        />
      </div>
    );
  };

  // 如果只有一个变量，使用原来的逻辑
  if (entries.length === 1) {
    const [variable, data] = entries[0];
    return (
      <div style={{ width: '100%', height: 420 }}>
        {renderSingleFrequencyChart(variable, data, chartType || 'bar')}
      </div>
    );
  }

  // 多个变量时，显示所有变量的图表
  return (
    <div>
      {entries.map(([variable, data], index) => {
        const levels: Array<any> = (data && data.levels) || [];
        if (levels.length === 0) {
          return (
            <div key={`${variable}-${index}`} style={{ marginBottom: 24 }}>
              <Empty description={`${variable} 无有效数据`} />
            </div>
          );
        }
        return (
          <div key={`${variable}-${index}`} style={{ marginBottom: 24 }}>
            <div style={{ width: '100%', height: 400 }}>
              {renderSingleFrequencyChart(variable, data, chartType || 'bar')}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FrequencyCharts;
