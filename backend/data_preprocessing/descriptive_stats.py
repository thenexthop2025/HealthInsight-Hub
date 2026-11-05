"""
描述性统计计算器
提供定量和定性变量的描述性统计
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

class DescriptiveStatsCalculator:
    """描述性统计计算器"""
    
    def __init__(self):
        self.logger = logger
    
    def calculate_quantitative_stats(self, data: pd.Series) -> Dict[str, Any]:
        """
        计算定量变量的描述性统计
        
        Args:
            data: 数据序列
            
        Returns:
            描述性统计结果
        """
        try:
            # 移除缺失值
            clean_data = data.dropna()
            
            if len(clean_data) == 0:
                return {
                    'error': '没有有效数据',
                    'count': 0
                }
            
            # 基本统计量
            count = len(clean_data)
            mean = float(clean_data.mean())
            median = float(clean_data.median())
            mode = clean_data.mode().iloc[0] if not clean_data.mode().empty else None
            std = float(clean_data.std())
            var = float(clean_data.var())
            
            # 分位数
            q1 = float(clean_data.quantile(0.25))
            q3 = float(clean_data.quantile(0.75))
            iqr = q3 - q1
            
            # 极值
            min_val = float(clean_data.min())
            max_val = float(clean_data.max())
            range_val = max_val - min_val
            
            # 偏度和峰度
            skewness = float(clean_data.skew())
            kurtosis = float(clean_data.kurtosis())
            
            # 异常值检测（IQR方法）
            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr
            outliers = clean_data[(clean_data < lower_bound) | (clean_data > upper_bound)]
            outlier_count = len(outliers)
            outlier_ratio = outlier_count / count if count > 0 else 0
            
            return {
                'count': count,
                'mean': mean,
                'median': median,
                'mode': float(mode) if mode is not None else None,
                'std': std,
                'variance': var,
                'min': min_val,
                'max': max_val,
                'range': range_val,
                'q1': q1,
                'q3': q3,
                'iqr': iqr,
                'skewness': skewness,
                'kurtosis': kurtosis,
                'outlier_count': outlier_count,
                'outlier_ratio': outlier_ratio,
                'lower_bound': lower_bound,
                'upper_bound': upper_bound
            }
            
        except Exception as e:
            self.logger.error(f"计算定量统计时出错: {e}")
            return {
                'error': str(e),
                'count': 0
            }
    
    def calculate_qualitative_stats(self, data: pd.Series) -> Dict[str, Any]:
        """
        计算定性变量的描述性统计
        
        Args:
            data: 数据序列
            
        Returns:
            描述性统计结果
        """
        try:
            # 移除缺失值
            clean_data = data.dropna()
            
            if len(clean_data) == 0:
                return {
                    'error': '没有有效数据',
                    'count': 0
                }
            
            # 基本统计量
            count = len(clean_data)
            unique_count = clean_data.nunique()
            
            # 频数统计
            value_counts = clean_data.value_counts()
            frequency_table = []
            
            for value, freq in value_counts.items():
                percentage = (freq / count) * 100
                frequency_table.append({
                    'value': str(value),
                    'count': int(freq),
                    'percentage': round(percentage, 2)
                })
            
            # 最频繁的值
            most_frequent = value_counts.index[0] if not value_counts.empty else None
            most_frequent_count = value_counts.iloc[0] if not value_counts.empty else 0
            most_frequent_percentage = (most_frequent_count / count) * 100 if count > 0 else 0
            
            return {
                'count': count,
                'unique_count': unique_count,
                'frequency_table': frequency_table,
                'most_frequent': {
                    'value': str(most_frequent) if most_frequent is not None else None,
                    'count': int(most_frequent_count),
                    'percentage': round(most_frequent_percentage, 2)
                },
                'entropy': self._calculate_entropy(clean_data)
            }
            
        except Exception as e:
            self.logger.error(f"计算定性统计时出错: {e}")
            return {
                'error': str(e),
                'count': 0
            }
    
    def _calculate_entropy(self, data: pd.Series) -> float:
        """
        计算信息熵
        
        Args:
            data: 数据序列
            
        Returns:
            信息熵值
        """
        try:
            value_counts = data.value_counts()
            probabilities = value_counts / len(data)
            entropy = -sum(p * np.log2(p) for p in probabilities if p > 0)
            return float(entropy)
        except Exception:
            return 0.0
    
    def calculate_comprehensive_stats(self, data: pd.Series, variable_type: str) -> Dict[str, Any]:
        """
        计算综合描述性统计
        
        Args:
            data: 数据序列
            variable_type: 变量类型 ('quantitative' 或 'qualitative')
            
        Returns:
            综合统计结果
        """
        try:
            if variable_type == 'quantitative':
                return self.calculate_quantitative_stats(data)
            elif variable_type == 'qualitative':
                return self.calculate_qualitative_stats(data)
            else:
                return {
                    'error': f'未知的变量类型: {variable_type}',
                    'count': 0
                }
                
        except Exception as e:
            self.logger.error(f"计算综合统计时出错: {e}")
            return {
                'error': str(e),
                'count': 0
            }
    
    def generate_analysis_recommendation(
        self,
        variable_type: str,
        is_normal: Optional[bool] = None,
        stats: Optional[Dict[str, Any]] = None,
        transformation_recommendation: Optional[str] = None,
    ) -> str:
        """
        生成分析建议
        
        Args:
            variable_type: 变量类型
            is_normal: 是否正态分布（仅定量变量）
            stats: 统计结果
            
        Returns:
            分析建议文本
        """
        try:
            if variable_type == 'qualitative':
                return '定性资料：建议使用频数和率进行描述，可进行卡方检验等非参数检验'

            elif variable_type == 'quantitative':
                if is_normal is None:
                    base = '定量资料：建议先进行正态性检验，然后选择合适的描述和检验方法'
                elif is_normal:
                    base = '定量资料（正态分布）：建议使用均值和标准差进行描述，可进行t检验、方差分析等参数检验'
                else:
                    base = '定量资料（非正态分布）：建议使用中位数、四分位数、极值进行描述，可进行Mann-Whitney U检验、Kruskal-Wallis检验等非参数检验'

                if is_normal is False and transformation_recommendation:
                    return f"{base} {transformation_recommendation}"
                return base
            
            else:
                return '未知变量类型：无法提供分析建议'
                
        except Exception as e:
            self.logger.error(f"生成分析建议时出错: {e}")
            return '生成分析建议时出错'
