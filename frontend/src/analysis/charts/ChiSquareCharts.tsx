/**
 * 卡方检验图表组件
 */

import React from 'react';
import { Empty } from 'antd';
import ReportEChart from '../../components/charts/ReportEChart';
import { reportPalette } from '../../theme/reportTheme';
import { Analysis, ChiSquareResults } from '../types/analysis';

interface ChiSquareChartsProps {
  analysis: Analysis;
  chartType: string;
  results: ChiSquareResults;
}

export const ChiSquareCharts: React.FC<ChiSquareChartsProps> = ({
  analysis,
  chartType,
  results
}) => {
  const contingencyTable = results.contingency_table || {};
  const expected = results.expected || {};
  const residuals = results.residuals || {};
  const categories = Object.keys(contingencyTable);
  const subcategories = Object.keys(contingencyTable[categories[0]] || {});

  if (categories.length === 0) {
    return <Empty description="暂无卡方检验结果" />;
  }

  const renderHeatmap = () => {
    const observedData: number[][] = [];
    const expectedData: number[][] = [];
    const xAxisData: string[] = [];
    const yAxisData: string[] = [];

    categories.forEach((cat, i) => {
      yAxisData.push(cat);
      const observedRow: number[] = [];
      const expectedRow: number[] = [];
      subcategories.forEach((subcat, j) => {
        if (i === 0) xAxisData.push(subcat);
        observedRow.push(contingencyTable[cat]?.[subcat] || 0);
        expectedRow.push(expected[cat]?.[subcat] || 0);
      });
      observedData.push(observedRow);
      expectedData.push(expectedRow);
    });

    const maxValue = Math.max(
      Math.max(...observedData.flat()),
      Math.max(...expectedData.flat())
    );

    const option = {
      title: {
        text: '卡方检验 - 观察频数与期望频数热力图',
        left: 'center'
      },
      tooltip: {
        position: 'top',
        formatter: function(params: any) {
          if (!params.data || !Array.isArray(params.data) || params.data.length < 4) {
            return '无数据';
          }
          const [x, y, observed, expected] = params.data;
          return `${yAxisData[y]} × ${xAxisData[x]}<br/>观察频数: ${observed}<br/>期望频数: ${expected.toFixed(2)}`;
        }
      },
      grid: {
        height: '60%',
        top: '10%'
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        splitArea: { show: true }
      },
      yAxis: {
        type: 'category',
        data: yAxisData,
        splitArea: { show: true }
      },
      visualMap: {
        min: 0,
        max: maxValue,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '5%',
        text: ['高', '低'],
        inRange: {
          color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffcc', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
        }
      },
      series: [
        {
          name: '期望频数',
          type: 'heatmap',
          data: expectedData.map((row, i) =>
            row.map((value, j) => [j, i, value])
          ).flat(),
          itemStyle: {
            opacity: 0.6
          },
          label: {
            show: false
          }
        },
        {
          name: '观察频数',
          type: 'heatmap',
          data: observedData.map((row, i) =>
            row.map((value, j) => [j, i, value, expectedData[i][j]])
          ).flat(),
          label: {
            show: true,
            color: '#fff',
            fontWeight: 'bold'
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ],
      legend: {
        data: ['观察频数', '期望频数'],
        top: 'bottom'
      }
    };

    return <ReportEChart option={option} style={{ height: 400 }} />;
  };

  const renderBarChart = () => {
    const seriesData = subcategories.map(subcat => ({
      name: subcat,
      type: 'bar',
      data: categories.map(cat => contingencyTable[cat]?.[subcat] || 0)
    }));

    const option = {
      title: { text: '卡方检验 - 观察频数条形图', left: 'center' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: subcategories, top: 'bottom' },
      xAxis: { type: 'category', data: categories },
      yAxis: { type: 'value', name: '频数' },
      series: seriesData
    };

    return <ReportEChart option={option} style={{ height: 400 }} />;
  };

  const renderExpectedVsObserved = () => {
    const observedData: number[] = [];
    const expectedData: number[] = [];
    const labels: string[] = [];

    categories.forEach(cat => {
      subcategories.forEach(subcat => {
        const observed = contingencyTable[cat]?.[subcat] || 0;
        const expectedVal = expected[cat]?.[subcat] || 0;
        observedData.push(observed);
        expectedData.push(expectedVal);
        labels.push(`${cat}×${subcat}`);
      });
    });

    const option = {
      title: { text: '卡方检验 - 观察频数 vs 期望频数', left: 'center' },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['观察频数', '期望频数'], top: 'bottom' },
      xAxis: { type: 'category', data: labels, axisLabel: { rotate: 45 } },
      yAxis: { type: 'value', name: '频数' },
      series: [
        { name: '观察频数', type: 'bar', data: observedData, itemStyle: { color: '#5470c6' } },
        { name: '期望频数', type: 'bar', data: expectedData, itemStyle: { color: '#91cc75' } }
      ]
    };

    return <ReportEChart option={option} style={{ height: 400 }} />;
  };

  const renderResiduals = () => {
    const residualData: number[] = [];
    const labels: string[] = [];

    categories.forEach(cat => {
      subcategories.forEach(subcat => {
        const residual = residuals[cat]?.[subcat] || 0;
        residualData.push(residual);
        labels.push(`${cat}×${subcat}`);
      });
    });

    const option = {
      title: { text: '卡方检验 - 标准化残差图', left: 'center' },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: function(params: any) {
          if (!params || !Array.isArray(params) || params.length === 0) {
            return '无数据';
          }
          const param = params[0];
          return `${param.name}<br/>标准化残差: ${Number(param.data).toFixed(3)}`;
        }
      },
      xAxis: { type: 'category', data: labels, axisLabel: { rotate: 45 } },
      yAxis: { type: 'value', name: '标准化残差' },
      series: [{
        name: '标准化残差',
        type: 'bar',
        data: residualData,
        itemStyle: {
          color: function(params: any) {
            const value = params.data;
            return value < 0 ? '#5470c6' : '#ee6666'; // Blue for negative, Red for positive
          }
        }
      }]
    };

    return <ReportEChart option={option} style={{ height: 400 }} />;
  };

  const renderMosaic = () => {
    // 马赛克图 - 使用堆叠条形图实现
    const total = Object.values(contingencyTable).reduce((sum: number, row: any) =>
      sum + Object.values(row).reduce((rowSum: number, val: any) => rowSum + (val || 0), 0), 0
    );

    const rowTotals = categories.map(cat => 
      Object.values(contingencyTable[cat] || {}).reduce((sum: number, val: any) => sum + (val || 0), 0)
    );
    const colTotals = subcategories.map(subcat => 
      categories.reduce((sum: number, cat: string) => sum + (contingencyTable[cat]?.[subcat] || 0), 0)
    );

    const option = {
      title: {
        text: '卡方检验 - 马赛克图',
        subtext: '矩形面积反映联合概率，宽度反映行边际分布'
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          if (!params || !Array.isArray(params) || params.length === 0) {
            return '无数据';
          }
          const param = params[0];
          const data = param.data;
          if (typeof data === 'object' && data.name) {
            return `${data.name}<br/>观察频数: ${data.value}<br/>期望频数: ${data.expected.toFixed(2)}<br/>标准化残差: ${data.residual.toFixed(3)}`;
          }
          return `${param.name}: ${param.data}`;
        }
      },
      legend: {
        data: categories,
        top: 'bottom'
      },
      xAxis: {
        type: 'category',
        data: subcategories
      },
      yAxis: {
        type: 'value',
        name: '频数'
      },
      series: categories.map((cat, i) => ({
        name: cat,
        type: 'bar',
        stack: 'total',
        data: subcategories.map((subcat, j) => {
          const observed = contingencyTable[cat]?.[subcat] || 0;
          const expectedVal = expected[cat]?.[subcat] || 0;
          const residual = residuals[cat]?.[subcat] || 0;
          return {
            value: observed,
            expected: expectedVal,
            residual: residual,
            name: `${cat}×${subcat}`
          };
        })
      }))
    };

    return <ReportEChart option={option} style={{ height: 400 }} />;
  };

  const renderStackedBar = () => {
    const option = {
      title: { text: '卡方检验 - 堆叠柱状图' },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          if (!params || !Array.isArray(params) || params.length === 0) {
            return '无数据';
          }
          const data = params[0];
          const category = categories[data.dataIndex];
          const subcategory = data.seriesName;
          const value = data.value;
          const total = categories.reduce((sum, cat) => sum + (contingencyTable[cat]?.[subcategory] || 0), 0);
          const percentage = total > 0 ? ((value / total) * 100).toFixed(2) : '0.00';
          return `${category} - ${subcategory}: ${value} (${percentage}%)`;
        }
      },
      legend: {
        data: subcategories,
        top: 'bottom'
      },
      xAxis: {
        type: 'category',
        data: categories
      },
      yAxis: {
        type: 'value',
        name: '频数'
      },
      series: subcategories.map((subcat, index) => ({
        name: subcat,
        type: 'bar',
        stack: 'total',
        data: categories.map(cat => contingencyTable[cat]?.[subcat] || 0),
        itemStyle: {
          color: [reportPalette.primary, reportPalette.blue, reportPalette.accent, reportPalette.danger, reportPalette.gray400][index % 5]
        }
      }))
    };

    return <ReportEChart option={option} style={{ height: 400 }} />;
  };

  // 根据图表类型渲染对应图表
  switch (chartType) {
    case 'heatmap':
      return renderHeatmap();
    case 'bar_chart':
      return renderBarChart();
    case 'expected_vs_observed':
      return renderExpectedVsObserved();
    case 'residuals':
      return renderResiduals();
    case 'mosaic':
      return renderMosaic();
    case 'stacked_bar':
      return renderStackedBar();
    default:
      return renderHeatmap(); // 默认显示热力图
  }
};
