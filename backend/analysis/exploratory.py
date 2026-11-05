"""
探索性统计分析模块
负责提供单变量/分组的诊断性统计、原始样本等信息
"""

from typing import Dict, Any, List, Optional

import pandas as pd
from scipy import stats

from .base import BaseAnalyzer


class ExploratoryAnalyzer(BaseAnalyzer):
    """探索性分析器，专注于提供诊断信息与原始样本"""

    def explore_analysis(
        self,
        dependent_variables: List[str],
        grouping_variables: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        self._validate_variables(dependent_variables)
        if grouping_variables:
            self._validate_variables(grouping_variables)

        if grouping_variables:
            return self._group_explore_analysis(dependent_variables, grouping_variables)

        results: Dict[str, Any] = {}
        for var in dependent_variables:
            series = self.data[var]
            total = int(len(series))
            valid_series = series.dropna()
            valid = int(len(valid_series))
            missing = int(total - valid)
            unique_count = int(valid_series.nunique())
            missing_rate = float(missing / total) if total > 0 else 0.0

            diagnostics: Dict[str, Any] = {
                'missing_rate': round(missing_rate, 4),
                'unique_count': unique_count,
            }

            if self._is_numeric(series):
                metrics = self._calculate_descriptive_metrics(series)
                if metrics.get('q25') is not None and metrics.get('q75') is not None:
                    metrics['q1'] = metrics.get('q25')
                    metrics['q3'] = metrics.get('q75')

                normality = None
                try:
                    n = len(valid_series)
                    if n >= 3:
                        if n <= 5000:
                            sample = (
                                valid_series
                                if n <= 5000
                                else valid_series.sample(5000, random_state=42)
                            )
                            _, p = stats.shapiro(sample)
                            normality = {'test': 'shapiro', 'p_value': float(p)}
                        else:
                            standardized = (valid_series - valid_series.mean()) / (
                                valid_series.std() if valid_series.std() != 0 else 1
                            )
                            _, p = stats.kstest(standardized, 'norm')
                            normality = {'test': 'ks', 'p_value': float(p)}
                except Exception:
                    normality = None

                outliers = None
                try:
                    q1 = valid_series.quantile(0.25)
                    q3 = valid_series.quantile(0.75)
                    iqr = q3 - q1
                    lower = q1 - 1.5 * iqr
                    upper = q3 + 1.5 * iqr
                    cnt = int(((valid_series < lower) | (valid_series > upper)).sum())
                    rate = float(cnt / valid) if valid > 0 else 0.0
                    outliers = {'method': 'IQR', 'count': cnt, 'rate': round(rate, 4)}
                except Exception:
                    outliers = None

                diagnostics['normality'] = normality
                diagnostics['outliers'] = outliers

                results[var] = {
                    'type': 'numeric',
                    'descriptive': metrics,
                    'diagnostics': diagnostics,
                    'raw_data': {
                        'values': series.tolist()
                        if len(series) <= 1000
                        else series.sample(1000).tolist(),
                        'sample_size': len(series),
                    },
                }
            else:
                value_counts = series.value_counts()
                results[var] = {
                    'type': 'categorical',
                    'frequency': {
                        'counts': value_counts.to_dict(),
                        'total': len(series),
                        'unique': len(value_counts),
                    },
                    'diagnostics': diagnostics,
                }

        return results

    def _group_explore_analysis(
        self,
        dependent_variables: List[str],
        independent_variables: List[str],
    ) -> Dict[str, Any]:
        results: Dict[str, Any] = {}

        for dep_var in dependent_variables:
            for indep_var in independent_variables:
                key = f"{dep_var}_by_{indep_var}"

                if self._is_numeric(self.data[dep_var]):
                    grouped = self.data.groupby(indep_var)[dep_var].agg([
                        'count',
                        'mean',
                        'std',
                        'min',
                        'max',
                        'median',
                        (lambda s: s.quantile(0.25)),
                        (lambda s: s.quantile(0.75)),
                    ])
                    grouped.columns = [
                        'count',
                        'mean',
                        'std',
                        'min',
                        'max',
                        'median',
                        'q25',
                        'q75',
                    ]
                    grouped = grouped.round(3)

                    group_samples: Dict[str, List[float]] = {}
                    grouped_series = self.data.groupby(indep_var)[dep_var]
                    for g, s in grouped_series:
                        try:
                            s_valid = s.dropna()
                            n = len(s_valid)
                            if n == 0:
                                group_samples[str(g)] = []
                            else:
                                sample = (
                                    s_valid.tolist()
                                    if n <= 500
                                    else s_valid.sample(500, random_state=0).tolist()
                                )
                                group_samples[str(g)] = sample
                        except Exception:
                            group_samples[str(g)] = []

                    results[key] = {
                        'type': 'numeric_grouped',
                        'dependent_variable': dep_var,
                        'independent_variable': indep_var,
                        'grouped_stats': grouped.to_dict('index'),
                        'group_by': indep_var,
                        'group_samples': group_samples,
                        'raw_data': {
                            'values': self.data[dep_var].tolist()
                            if len(self.data) <= 1000
                            else self.data[dep_var].sample(1000, random_state=0).tolist(),
                            'sample_size': len(self.data),
                        },
                    }
                else:
                    crosstab = pd.crosstab(self.data[indep_var], self.data[dep_var])
                    results[key] = {
                        'type': 'categorical_grouped',
                        'dependent_variable': dep_var,
                        'independent_variable': indep_var,
                        'crosstab': crosstab.to_dict('index'),
                        'group_by': indep_var,
                    }

        return results

    def validate_parameters(self, analysis_type: str, **kwargs: Any) -> None:
        if analysis_type != 'explore':
            return
        if not kwargs.get('dependent_variables'):
            raise ValueError('探索分析需要至少一个依赖变量')
