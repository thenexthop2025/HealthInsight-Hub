/**
 * 描述性统计图表组件
 */

import React from 'react';
import DescriptiveChartsComponent from '../../components/charts/DescriptiveCharts';
import { Analysis } from '../types/analysis';

interface DescriptiveChartsProps {
  analysis: Analysis;
  chartType: string;
  results: any;
}

export const DescriptiveCharts: React.FC<DescriptiveChartsProps> = (props) => (
  <DescriptiveChartsComponent {...props} />
);
