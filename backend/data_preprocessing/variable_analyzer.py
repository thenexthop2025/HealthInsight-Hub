"""
变量分析器
负责判断变量类型（定量/定性）
"""

import pandas as pd
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

class VariableAnalyzer:
    """变量分析器"""
    
    def __init__(self):
        self.logger = logger
    
    def analyze_variable_type(self, df: pd.DataFrame, column_name: str) -> Dict[str, Any]:
        """
        分析变量类型
        
        Args:
            df: 数据框
            column_name: 列名
            
        Returns:
            包含变量类型信息的字典
        """
        try:
            if column_name not in df.columns:
                raise ValueError(f"列 '{column_name}' 不存在")
            
            column = df[column_name]
            total_rows = len(df)
            
            # 基本统计信息
            unique_count = column.nunique()
            null_count = column.isnull().sum()
            null_ratio = null_count / total_rows if total_rows > 0 else 0
            
            # 判断数据类型
            is_numeric_dtype = pd.api.types.is_numeric_dtype(column)
            unique_ratio = unique_count / total_rows if total_rows > 0 else 0
            
            # 定量/定性判断逻辑
            is_categorical = (
                column.dtype == 'object' or  # 字符串类型
                (is_numeric_dtype and unique_count < 20) or  # 数值但唯一值少
                (is_numeric_dtype and unique_ratio < 0.1)  # 数值但唯一值比例小
            )
            
            is_quantitative = is_numeric_dtype and not is_categorical
            
            # 获取值范围（仅定量变量）
            value_range = None
            if is_quantitative:
                try:
                    value_range = {
                        'min': float(column.min()),
                        'max': float(column.max()),
                        'mean': float(column.mean()),
                        'std': float(column.std())
                    }
                except (ValueError, TypeError):
                    value_range = None
            
            # 获取类别信息（仅定性变量）
            categories = None
            if is_categorical:
                try:
                    categories = column.value_counts().head(10).to_dict()
                except Exception:
                    categories = None
            
            return {
                'column_name': column_name,
                'data_type': 'quantitative' if is_quantitative else 'qualitative',
                'is_numeric': is_numeric_dtype,
                'is_categorical': is_categorical,
                'unique_count': unique_count,
                'null_count': null_count,
                'null_ratio': null_ratio,
                'value_range': value_range,
                'categories': categories,
                'total_rows': total_rows
            }
            
        except Exception as e:
            self.logger.error(f"分析变量类型时出错: {e}")
            raise
    
    def analyze_multiple_variables(self, df: pd.DataFrame, column_names: List[str]) -> List[Dict[str, Any]]:
        """
        分析多个变量
        
        Args:
            df: 数据框
            column_names: 列名列表
            
        Returns:
            变量分析结果列表
        """
        results = []
        for column_name in column_names:
            try:
                result = self.analyze_variable_type(df, column_name)
                results.append(result)
            except Exception as e:
                self.logger.error(f"分析变量 '{column_name}' 时出错: {e}")
                # 添加错误信息但继续处理其他变量
                results.append({
                    'column_name': column_name,
                    'error': str(e),
                    'data_type': 'unknown'
                })
        
        return results

