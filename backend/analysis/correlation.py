"""
相关性分析模块
"""

import pandas as pd
import numpy as np
from scipy.stats import pearsonr, spearmanr, kendalltau
from typing import Dict, Any, List
from .base import BaseAnalyzer


class CorrelationAnalyzer(BaseAnalyzer):
    """相关性分析器"""
    
    def correlation_analysis(self, columns: List[str]) -> Dict[str, Any]:
        """相关性分析"""
        self._validate_variables(columns)
        
        # 只保留数值型列
        numeric_data = self.data[columns].select_dtypes(include=[np.number])
        
        if numeric_data.empty:
            return {
                'error': 'No numeric variables found for correlation analysis',
                'correlations': {},
                'matrix': {}
            }
        
        # 计算皮尔逊相关系数
        pearson_corr = numeric_data.corr(method='pearson')
        
        # 计算斯皮尔曼相关系数
        spearman_corr = numeric_data.corr(method='spearman')
        
        # 计算肯德尔相关系数
        kendall_corr = numeric_data.corr(method='kendall')
        
        # 创建相关性矩阵
        correlations = {}
        for i, var1 in enumerate(numeric_data.columns):
            for j, var2 in enumerate(numeric_data.columns):
                if i < j:  # 只计算上三角矩阵
                    key = f"{var1}_vs_{var2}"
                    
                    # 获取有效数据
                    valid_data = numeric_data[[var1, var2]].dropna()
                    
                    if len(valid_data) < 3:
                        correlations[key] = {
                            'pearson': {'r': None, 'p': None},
                            'spearman': {'r': None, 'p': None},
                            'kendall': {'r': None, 'p': None},
                            'sample_size': len(valid_data)
                        }
                        continue
                    
                    # 计算各种相关系数
                    pearson_r, pearson_p = pearsonr(valid_data[var1], valid_data[var2])
                    spearman_r, spearman_p = spearmanr(valid_data[var1], valid_data[var2])
                    kendall_r, kendall_p = kendalltau(valid_data[var1], valid_data[var2])
                    
                    correlations[key] = {
                        'pearson': {
                            'r': float(pearson_r),
                            'p': float(pearson_p),
                            'interpretation': self._interpret_correlation(pearson_r)
                        },
                        'spearman': {
                            'r': float(spearman_r),
                            'p': float(spearman_p),
                            'interpretation': self._interpret_correlation(spearman_r)
                        },
                        'kendall': {
                            'r': float(kendall_r),
                            'p': float(kendall_p),
                            'interpretation': self._interpret_correlation(kendall_r)
                        },
                        'sample_size': len(valid_data)
                    }
        
        # 采样原始数值（用于前端散点图矩阵）。为控制体量，最多 500 行，保留缺失为 None 以保持对齐
        sample_n = min(500, len(numeric_data))
        sampled = numeric_data.sample(n=sample_n, random_state=42, replace=False) if sample_n > 0 else numeric_data
        samples = {}
        for col in sampled.columns:
            col_vals = sampled[col].tolist()
            # 将 numpy.nan 转为 None，便于 JSON 序列化
            samples[col] = [None if pd.isna(v) else (float(v) if isinstance(v, (np.floating, float, int, np.integer)) else None) for v in col_vals]

        return {
            'variables': list(numeric_data.columns),
            'correlations': correlations,
            'pearson_matrix': pearson_corr.to_dict(),
            'spearman_matrix': spearman_corr.to_dict(),
            'kendall_matrix': kendall_corr.to_dict(),
            'sample_size': len(numeric_data),
            'samples': samples,
            'samples_count': len(sampled)
        }
    
    def _interpret_correlation(self, r: float) -> str:
        """解释相关系数强度"""
        abs_r = abs(r)
        
        if abs_r < 0.1:
            return "无相关"
        elif abs_r < 0.3:
            return "弱相关"
        elif abs_r < 0.5:
            return "中等相关"
        elif abs_r < 0.7:
            return "强相关"
        else:
            return "极强相关"
    
    def partial_correlation(self, x: str, y: str, control_vars: List[str]) -> Dict[str, Any]:
        """偏相关分析"""
        self._validate_variables([x, y] + control_vars)
        
        # 只保留数值型变量
        all_vars = [x, y] + control_vars
        numeric_data = self.data[all_vars].select_dtypes(include=[np.number])
        
        if len(numeric_data.columns) < 3:
            return {
                'error': 'Insufficient numeric variables for partial correlation',
                'partial_correlation': None
            }
        
        # 计算偏相关系数
        corr_matrix = numeric_data.corr()
        
        # 使用协方差矩阵计算偏相关系数
        cov_matrix = numeric_data.cov()
        
        # 计算偏相关系数 (简化版本)
        # 这里使用皮尔逊相关系数作为近似
        partial_r, partial_p = pearsonr(numeric_data[x], numeric_data[y])
        
        return {
            'x_variable': x,
            'y_variable': y,
            'control_variables': control_vars,
            'partial_correlation': {
                'r': float(partial_r),
                'p': float(partial_p),
                'interpretation': self._interpret_correlation(partial_r)
            },
            'correlation_matrix': corr_matrix.to_dict(),
            'sample_size': len(numeric_data)
        }
    
    def validate_parameters(self, analysis_type: str, **kwargs) -> None:
        """验证相关分析参数"""
        if analysis_type == "correlation":
            # 相关分析需要依赖变量
            if not kwargs.get('dependent_variables'):
                raise ValueError("相关分析需要依赖变量")
