import React from 'react';
import { ROCCurve, ConfusionMatrix, CoefficientsBar } from './common';

const ConditionalLogisticCharts: React.FC<{ analysis: any; chartType: string; results: any }>
  = ({ chartType, results }) => {
  switch (chartType) {
    case 'roc':
      return <ROCCurve results={results} />;
    case 'cm':
      return <ConfusionMatrix results={results} />;
    case 'coefficients':
      return <CoefficientsBar results={results} />;
    default:
      return <CoefficientsBar results={results} />;
  }
};

export default ConditionalLogisticCharts;


