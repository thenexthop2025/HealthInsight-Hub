import { adaptCrosstab } from '../crosstab';
import { adaptChiSquare } from '../chi_square';

// Simple smoke tests using console.assert to avoid framework dependency

(() => {
  const rawCrosstab = {
    counts: {
      A: { X: 10, Y: 5 },
      B: { X: 3, Y: 12 },
    }
  };
  const adapted = adaptCrosstab(rawCrosstab);
  console.assert(adapted.counts.A.X === 10, 'Crosstab A/X should be 10');
  console.assert(adapted.counts.B.Y === 12, 'Crosstab B/Y should be 12');
  console.assert(adapted.grand_total === 30, 'Crosstab grand total should be 30');
})();

(() => {
  const rawChi = {
    contingency_table: {
      A: { X: 10, Y: 5 },
      B: { X: 3, Y: 12 },
    },
    expected: {
      A: { X: 6.5, Y: 8.5 },
      B: { X: 6.5, Y: 8.5 },
    },
    residuals: {
      A: { X: 1.37, Y: -1.20 },
      B: { X: -1.37, Y: 1.20 },
    },
    chi_square_statistic: 4.2,
    p_value: 0.041,
    degrees_of_freedom: 1,
  };
  const adapted = adaptChiSquare(rawChi);
  console.assert(adapted.contingency_table.A.X === 10, 'Chi A/X contingency');
  console.assert(adapted.expected.A.Y === 8.5, 'Chi expected A/Y');
  console.assert(Math.abs(adapted.residuals.A.Y + 1.20) < 1e-6, 'Chi residuals A/Y');
  console.assert(adapted.chi_square_statistic === 4.2, 'Chi statistic');
  console.assert(adapted.p_value === 0.041, 'Chi p-value');
  console.assert(adapted.degrees_of_freedom === 1, 'Chi df');
})();


