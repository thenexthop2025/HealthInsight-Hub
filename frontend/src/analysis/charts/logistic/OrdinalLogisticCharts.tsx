import React from 'react';
import { CoefficientsBar } from './common';

const OrdinalLogisticCharts: React.FC<{ analysis: any; chartType: string; results: any }>
  = ({ chartType, results }) => {
  switch (chartType) {
    case 'coefficients':
      return <CoefficientsBar results={results} />;
    default:
      return <CoefficientsBar results={results} />;
  }
};

export default OrdinalLogisticCharts;

