"""
描述性统计分析模块
负责频率分析、描述性统计汇总、P-P 图等功能
"""

import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any, List, Optional
from .base import BaseAnalyzer


class DescriptiveAnalyzer(BaseAnalyzer):
    """描述性统计分析器"""
    
    def frequency_analysis(self, variables: List[str]) -> Dict[str, Any]:
        """频率分析"""
        self._validate_variables(variables)
        results = {}
        
        for var in variables:
            series = self.data[var]
            total = int(len(series))
            valid = int(series.notna().sum())
            missing = int(total - valid)
            
            if valid == 0:
                results[var] = {
                    'variable': var,
                    'summary': {
                        'total': total,
                        'valid': valid,
                        'missing': missing
                    },
                    'levels': [],
                    'missing': None
                }
                continue
            
            # 计算频数分布
            value_counts = series.value_counts(dropna=False)
            levels = []
            cumulative = 0
            
            for value, count in value_counts.items():
                percent = (count / total) * 100
                valid_percent = (count / valid) * 100 if valid > 0 else 0
                cumulative += valid_percent
                
                levels.append({
                    'value': str(value),
                    'count': int(count),
                    'percent': round(percent, 2),
                    'valid_percent': round(valid_percent, 2),
                    'cumulative_valid_percent': round(cumulative, 2)
                })
            
            results[var] = {
                'variable': var,
                'summary': {
                    'total': total,
                    'valid': valid,
                    'missing': missing
                },
                'levels': levels,
                'missing': None
            }
        
        return results
    
    def descriptive_summary(
        self,
        dependent_variables: List[str],
        grouping_variables: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """描述性统计汇总"""
        self._validate_variables(dependent_variables)
        if grouping_variables:
            self._validate_variables(grouping_variables)

        if grouping_variables:
            return self._group_descriptive_summary(dependent_variables, grouping_variables)

        results: Dict[str, Any] = {}

        for var in dependent_variables:
            series = self.data[var]
            if self._is_numeric(series):
                metrics = self._calculate_descriptive_metrics(series)
                if metrics.get('q25') is not None and metrics.get('q75') is not None:
                    metrics['q1'] = metrics.get('q25')
                    metrics['q3'] = metrics.get('q75')
                results[var] = {
                    'type': 'numeric',
                    'descriptive': metrics,
                }
            else:
                total = int(len(series))
                valid = int(series.notna().sum())
                missing = int(total - valid)
                value_counts = series.value_counts(dropna=False)
                levels = []
                cumulative = 0.0
                for value, count in value_counts.items():
                    percent = (count / total * 100) if total else 0
                    valid_percent = (count / valid * 100) if valid else 0
                    cumulative += valid_percent
                    levels.append({
                        'value': str(value),
                        'count': int(count),
                        'percent': round(percent, 2),
                        'valid_percent': round(valid_percent, 2),
                        'cumulative_valid_percent': round(cumulative, 2),
                    })

                results[var] = {
                    'type': 'categorical',
                    'levels': levels,
                    'summary': {
                        'total': total,
                        'valid': valid,
                        'missing': missing,
                    },
                }

        return results

    def _group_descriptive_summary(
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
                    overall = self._calculate_descriptive_metrics(self.data[dep_var])
                    if overall.get('q25') is not None and overall.get('q75') is not None:
                        overall['q1'] = overall.get('q25')
                        overall['q3'] = overall.get('q75')

                    results[key] = {
                        'type': 'numeric_grouped',
                        'dependent_variable': dep_var,
                        'independent_variable': indep_var,
                        'grouped_stats': grouped.to_dict('index'),
                        'group_by': indep_var,
                        'overall': overall,
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
    
    def pp_plot_analysis(self, variable: str) -> Dict[str, Any]:
        """P-P图分析（正态性检验）"""
        self._validate_variables([variable])
        
        series = self.data[variable].dropna()
        if len(series) == 0:
            return {
                'variable': variable,
                'error': 'No valid data points',
                'is_normal': False
            }
        
        # 标准化数据
        standardized = (series - series.mean()) / series.std()
        
        # 计算理论分位数
        n = len(standardized)
        theoretical_quantiles = stats.norm.ppf(np.arange(1, n + 1) / (n + 1))
        
        # 计算实际分位数
        actual_quantiles = np.sort(standardized)
        
        # 计算相关系数
        correlation = np.corrcoef(theoretical_quantiles, actual_quantiles)[0, 1]
        
        # 判断是否正态分布（相关系数 > 0.95 认为接近正态）
        is_normal = bool(correlation > 0.95)
        
        return {
            'variable': variable,
            'correlation': float(correlation),
            'is_normal': is_normal,
            'theoretical_quantiles': theoretical_quantiles.tolist(),
            'actual_quantiles': actual_quantiles.tolist(),
            'sample_size': n
        }
    
    def crosstab_analysis(self, row_variable: str, column_variable: str, include_totals: bool = True) -> Dict[str, Any]:
        """交叉表分析"""
        self._validate_variables([row_variable, column_variable])
        
        # 创建交叉表
        crosstab = pd.crosstab(self.data[row_variable], self.data[column_variable])
        
        # 将 numpy 类型安全转换为 Python 原生，避免 JSON 序列化错误
        def _py(v):
            try:
                return v.item() if hasattr(v, 'item') else v
            except Exception:
                return v
        counts = {str(k): {str(kk): _py(vv) for kk, vv in d.items()} for k, d in crosstab.to_dict('index').items()}
        row_totals = {str(k): _py(v) for k, v in crosstab.sum(axis=1).to_dict().items()}
        column_totals = {str(k): _py(v) for k, v in crosstab.sum(axis=0).to_dict().items()}
        grand_total = _py(crosstab.sum().sum())
        
        result = {
            'row_variable': row_variable,
            'column_variable': column_variable,
            'counts': counts,
            'row_totals': row_totals,
            'column_totals': column_totals,
            'grand_total': grand_total
        }
        
        if include_totals:
            # 添加行百分比
            row_percent = crosstab.div(crosstab.sum(axis=1), axis=0) * 100
            result['row_percentages'] = {str(k): {str(kk): _py(vv) for kk, vv in d.items()} for k, d in row_percent.round(2).to_dict('index').items()}
            
            # 添加列百分比
            column_percent = crosstab.div(crosstab.sum(axis=0), axis=1) * 100
            result['column_percentages'] = {str(k): {str(kk): _py(vv) for kk, vv in d.items()} for k, d in column_percent.round(2).to_dict('index').items()}
        
        return result
    
    def validate_parameters(self, analysis_type: str, **kwargs) -> None:
        """验证描述性/交叉表等分析的参数（兼容多命名）"""
        if analysis_type == "frequency":
            return
        elif analysis_type == "pp_plot":
            # PP图分析需要依赖变量
            if not kwargs.get('dependent_variables'):
                raise ValueError("PP图分析需要依赖变量")
            return
        elif analysis_type == "descriptive":
            if not kwargs.get('dependent_variables'):
                raise ValueError("描述性统计需要依赖变量")
            return
        elif analysis_type == "crosstab":
            # 完全独立：仅允许专用命名
            if not kwargs.get('row_variable'):
                raise ValueError("交叉表分析需要行变量")
            if not kwargs.get('column_variable'):
                raise ValueError("交叉表分析需要列变量")
            return
