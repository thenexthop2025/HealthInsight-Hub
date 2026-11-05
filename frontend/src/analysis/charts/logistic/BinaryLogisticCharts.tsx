import React from 'react';
import { ROCCurve, ConfusionMatrix, CoefficientsBar } from './common';

const BinaryLogisticCharts: React.FC<{ analysis: any; chartType: string; results: any }>
  = ({ analysis, chartType, results }) => {
  switch (chartType) {
    case 'roc':
      return <ROCCurve results={results} />;
    case 'cm':
      return <ConfusionMatrix results={results} />;
    case 'coefficients':
      return <CoefficientsBar results={results} />;
    default:
      return <ROCCurve results={results} />;
  }
};

export default BinaryLogisticCharts;

