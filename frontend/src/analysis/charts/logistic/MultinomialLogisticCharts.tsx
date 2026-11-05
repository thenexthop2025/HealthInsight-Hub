import React from 'react';
import { ConfusionMatrix, CoefficientsBar } from './common';

const MultinomialLogisticCharts: React.FC<{ analysis: any; chartType: string; results: any }>
  = ({ chartType, results }) => {
  switch (chartType) {
    case 'cm':
      return <ConfusionMatrix results={results} />;
    case 'coefficients':
      return <CoefficientsBar results={results} />;
    default:
      return <ConfusionMatrix results={results} />;
  }
};

export default MultinomialLogisticCharts;


