import React from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsReactProps } from 'echarts-for-react';

type Props = EChartsReactProps;

export const ReportEChart: React.FC<Props> = ({ style, theme, notMerge = true, lazyUpdate = true, opts, ...rest }) => {
  const mergedStyle = {
    background: 'transparent',
    ...(style || {}),
  };

  const mergedOpts = {
    renderer: 'canvas' as const,
    ...(opts || {}),
  };

  return (
    <ReactECharts
      theme={theme || 'reportTheme'}
      notMerge={notMerge}
      lazyUpdate={lazyUpdate}
      opts={mergedOpts}
      style={mergedStyle}
      {...rest}
    />
  );
};

export default ReportEChart;
