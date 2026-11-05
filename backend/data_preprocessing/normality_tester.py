"""
正态性检验器
提供Shapiro-Wilk、Kolmogorov-Smirnov等正态性检验方法
"""

import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class NormalityTester:
    """正态性检验器"""
    
    def __init__(self):
        self.logger = logger
        # 小于该阈值的 p 值用显示字符串表示，避免前端四舍五入成 0
        self.display_p_min = 1e-16

    def _format_p_for_display(self, p: float) -> Dict[str, Any]:
        """返回用于展示和保留精度的 p 值。
        - p_exact: 原始 p 值（float）
        - p_value: 给前端数值列使用的安全值（不小于阈值，避免显示 0）
        - p_display: 友好的字符串，小于阈值时显示 "< 1e-16"
        """
        try:
            p_exact = float(p)
        except Exception:
            return {"p_exact": None, "p_value": None, "p_display": None}

        if np.isnan(p_exact):
            return {"p_exact": None, "p_value": None, "p_display": None}

        if p_exact < self.display_p_min:
            return {
                "p_exact": p_exact,
                "p_value": float(self.display_p_min),
                "p_display": f"< {self.display_p_min:g}",
            }
        else:
            # 保留 4 位有效数字的字符串展示
            return {
                "p_exact": p_exact,
                "p_value": p_exact,
                "p_display": f"{p_exact:.4g}",
            }
    
    def shapiro_wilk_test(self, data: pd.Series) -> Dict[str, Any]:
        """
        Shapiro-Wilk正态性检验
        
        Args:
            data: 数据序列
            
        Returns:
            检验结果字典
        """
        try:
            # 移除缺失值
            clean_data = data.dropna()
            
            if len(clean_data) < 3:
                return {
                    'test_name': 'Shapiro-Wilk',
                    'statistic': None,
                    'p_value': None,
                    'is_normal': None,
                    'error': '数据点太少，无法进行检验'
                }
            
            # 限制样本大小（Shapiro-Wilk适用于小样本）
            if len(clean_data) > 5000:
                # 随机抽样
                sample_data = clean_data.sample(n=5000, random_state=42)
            else:
                sample_data = clean_data
            
            statistic, p_value = stats.shapiro(sample_data)
            p_fmt = self._format_p_for_display(p_value)

            return {
                'test_name': 'Shapiro-Wilk',
                'statistic': float(statistic),
                'p_value': p_fmt['p_value'],      # 用于数值列，避免显示 0
                'p_exact': p_fmt['p_exact'],      # 保留原始精度
                'p_display': p_fmt['p_display'],  # 友好展示
                'is_normal': p_value > 0.05,
                'sample_size': len(sample_data),
                'original_size': len(clean_data)
            }
            
        except Exception as e:
            self.logger.error(f"Shapiro-Wilk检验出错: {e}")
            return {
                'test_name': 'Shapiro-Wilk',
                'statistic': None,
                'p_value': None,
                'is_normal': None,
                'error': str(e)
            }
    
    def kolmogorov_smirnov_test(self, data: pd.Series) -> Dict[str, Any]:
        """
        Kolmogorov-Smirnov正态性检验
        
        Args:
            data: 数据序列
            
        Returns:
            检验结果字典
        """
        try:
            # 移除缺失值
            clean_data = data.dropna()
            
            if len(clean_data) < 3:
                return {
                    'test_name': 'Kolmogorov-Smirnov',
                    'statistic': None,
                    'p_value': None,
                    'is_normal': None,
                    'error': '数据点太少，无法进行检验'
                }
            
            # 标准化数据
            mean_val = clean_data.mean()
            std_val = clean_data.std()
            
            if std_val == 0:
                return {
                    'test_name': 'Kolmogorov-Smirnov',
                    'statistic': None,
                    'p_value': None,
                    'is_normal': None,
                    'error': '标准差为0，无法进行检验'
                }
            
            standardized_data = (clean_data - mean_val) / std_val
            
            # 进行KS检验
            statistic, p_value = stats.kstest(standardized_data, 'norm')
            p_fmt = self._format_p_for_display(p_value)

            return {
                'test_name': 'Kolmogorov-Smirnov',
                'statistic': float(statistic),
                'p_value': p_fmt['p_value'],
                'p_exact': p_fmt['p_exact'],
                'p_display': p_fmt['p_display'],
                'is_normal': p_value > 0.05,
                'sample_size': len(clean_data)
            }
            
        except Exception as e:
            self.logger.error(f"Kolmogorov-Smirnov检验出错: {e}")
            return {
                'test_name': 'Kolmogorov-Smirnov',
                'statistic': None,
                'p_value': None,
                'is_normal': None,
                'error': str(e)
            }
    
    def anderson_darling_test(self, data: pd.Series) -> Dict[str, Any]:
        """
        Anderson-Darling正态性检验
        
        Args:
            data: 数据序列
            
        Returns:
            检验结果字典
        """
        try:
            # 移除缺失值
            clean_data = data.dropna()
            
            if len(clean_data) < 3:
                return {
                    'test_name': 'Anderson-Darling',
                    'statistic': None,
                    'p_value': None,
                    'is_normal': None,
                    'error': '数据点太少，无法进行检验'
                }
            
            # 进行AD检验
            result = stats.anderson(clean_data, dist='norm')
            
            # 获取临界值（5%显著性水平）
            critical_value = result.critical_values[2] if len(result.critical_values) > 2 else result.critical_values[-1]
            is_normal = result.statistic < critical_value
            
            return {
                'test_name': 'Anderson-Darling',
                'statistic': float(result.statistic),
                'critical_value': float(critical_value),
                'is_normal': is_normal,
                'sample_size': len(clean_data)
            }
            
        except Exception as e:
            self.logger.error(f"Anderson-Darling检验出错: {e}")
            return {
                'test_name': 'Anderson-Darling',
                'statistic': None,
                'p_value': None,
                'is_normal': None,
                'error': str(e)
            }
    
    def comprehensive_normality_test(self, data: pd.Series) -> Dict[str, Any]:
        """
        综合正态性检验
        
        Args:
            data: 数据序列
            
        Returns:
            综合检验结果
        """
        try:
            # 移除缺失值
            clean_data = data.dropna()
            
            if len(clean_data) < 3:
                return {
                    'overall_is_normal': None,
                    'tests': [],
                    'error': '数据点太少，无法进行检验'
                }
            
            # 执行多种检验
            shapiro_result = self.shapiro_wilk_test(clean_data)
            ks_result = self.kolmogorov_smirnov_test(clean_data)
            ad_result = self.anderson_darling_test(clean_data)
            
            tests = [shapiro_result, ks_result, ad_result]
            
            # 计算综合结果（多数投票）
            valid_tests = [t for t in tests if t.get('is_normal') is not None]
            
            if not valid_tests:
                overall_is_normal = None
            else:
                normal_count = sum(1 for t in valid_tests if t['is_normal'])
                overall_is_normal = normal_count > len(valid_tests) / 2
            
            return {
                'overall_is_normal': overall_is_normal,
                'tests': tests,
                'sample_size': len(clean_data),
                'normal_count': normal_count if valid_tests else 0,
                'total_tests': len(valid_tests)
            }
            
        except Exception as e:
            self.logger.error(f"综合正态性检验出错: {e}")
            return {
                'overall_is_normal': None,
                'tests': [],
                'error': str(e)
            }

