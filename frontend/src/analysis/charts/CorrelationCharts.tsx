/**
 * 相关性分析图表组件
 */

import React from 'react';
import { Empty } from 'antd';
import ReportEChart from '../../components/charts/ReportEChart';
import { Analysis } from '../types/analysis';

interface CorrelationChartsProps {
  analysis: Analysis;
  chartType: string;
  results: any;
}

export const CorrelationCharts: React.FC<CorrelationChartsProps> = ({
  analysis,
  chartType,
  results
}) => {
  const variables = results?.variables || [];
  const correlations = results?.correlations || {};
  const pearsonMatrix = results?.pearson_matrix || {};
  const spearmanMatrix = results?.spearman_matrix || {};

  if (variables.length === 0) {
    return <Empty description="暂无相关性分析结果" />;
  }

  const renderHeatmap = () => {
    const data: any[] = [];
    const maxValue = 1;
    const minValue = -1;

    // 构建热力图数据
    for (let i = 0; i < variables.length; i++) {
      for (let j = 0; j < variables.length; j++) {
        const value = pearsonMatrix[variables[i]]?.[variables[j]] || 0;
        data.push([j, i, value]);
      }
    }

    const option = {
      title: {
        text: '相关性热力图',
        left: 'center'
      },
      tooltip: {
        position: 'top',
        formatter: function(params: any) {
          if (!params.data || !Array.isArray(params.data) || params.data.length < 3) {
            return '无数据';
          }
          const [x, y, value] = params.data;
          return `${variables[y]} × ${variables[x]}<br/>相关系数: ${value.toFixed(3)}`;
        }
      },
      grid: {
        height: '60%',
        top: '10%'
      },
      xAxis: {
        type: 'category',
        data: variables,
        splitArea: { show: true }
      },
      yAxis: {
        type: 'category',
        data: variables,
        splitArea: { show: true }
      },
      visualMap: {
        min: minValue,
        max: maxValue,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '5%',
        text: ['强正相关', '强负相关'],
        inRange: {
          color: ['#d73027', '#f46d43', '#fdae61', '#fee090', '#ffffcc', '#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695']
        }
      },
      series: [{
        name: '相关系数',
        type: 'heatmap',
        data: data,
        label: {
          show: true,
          formatter: function(params: any) {
            const value = params.data[2];
            return value.toFixed(2);
          }
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };

    return <ReportEChart option={option} style={{ height: 400 }} />;
  };

  const renderScatterMatrix = () => {
    // 散点图矩阵实现
    return <Empty description="散点图矩阵（待实现）" />;
  };

  const renderCorrelationTable = () => {
    // 相关性表格实现
    return <Empty description="相关性表格（待实现）" />;
  };

  // 根据图表类型渲染对应图表
  switch (chartType) {
    case 'heatmap':
      return renderHeatmap();
    case 'scatter':
      return renderScatterMatrix();
    case 'table':
      return renderCorrelationTable();
    default:
      return renderHeatmap(); // 默认显示热力图
  }
};
