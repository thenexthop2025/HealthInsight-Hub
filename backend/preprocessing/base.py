"""
数据预处理基础类
提供通用的数据预处理功能和接口
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Union, Tuple
import logging
from functools import wraps

logger = logging.getLogger(__name__)


class PreprocessingError(Exception):
    """数据预处理错误异常类"""
    def __init__(self, message: str, error_code: str = "PREPROCESSING_ERROR", details: Dict = None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


def validate_preprocessing_data(min_rows: int = 1, min_cols: int = 1):
    """数据预处理验证装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            try:
                # 检查数据基本要求
                if len(self.data) < min_rows:
                    raise PreprocessingError(
                        f"数据行数不足，当前: {len(self.data)}, 最少需要: {min_rows}",
                        "INSUFFICIENT_ROWS"
                    )
                
                if len(self.data.columns) < min_cols:
                    raise PreprocessingError(
                        f"数据列数不足，当前: {len(self.data.columns)}, 最少需要: {min_cols}",
                        "INSUFFICIENT_COLUMNS"
                    )
                
                # 执行原函数
                result = func(self, *args, **kwargs)
                
                # 验证结果
                if result is None:
                    logger.warning("预处理函数返回了None")
                
                return result
                
            except PreprocessingError:
                raise
            except Exception as e:
                logger.error(f"数据预处理执行失败: {str(e)}", exc_info=True)
                raise PreprocessingError(
                    f"数据预处理执行失败: {str(e)}",
                    "PREPROCESSING_EXECUTION_ERROR",
                    {"original_error": str(e)}
                )
        return wrapper
    return decorator


class BasePreprocessor:
    """数据预处理基础类"""
    
    def __init__(self, data: pd.DataFrame):
        if data is None or data.empty:
            raise PreprocessingError("数据不能为空", "EMPTY_DATA_ERROR")
        
        self.data = data.copy()
        self.original_shape = data.shape
        self.preprocessing_log = []
        logger.info(f"初始化数据预处理器，数据形状: {self.original_shape}")
    
    def log_operation(self, operation: str, details: Dict[str, Any] = None):
        """记录预处理操作"""
        log_entry = {
            "operation": operation,
            "timestamp": pd.Timestamp.now().isoformat(),
            "data_shape_before": self.data.shape,
            "details": details or {}
        }
        self.preprocessing_log.append(log_entry)
        logger.info(f"预处理操作: {operation}, 数据形状: {self.data.shape}")
    
    def get_data_info(self) -> Dict[str, Any]:
        """获取数据基本信息"""
        return {
            "shape": self.data.shape,
            "columns": list(self.data.columns),
            "dtypes": self.data.dtypes.to_dict(),
            "memory_usage": self.data.memory_usage(deep=True).sum(),
            "missing_values": self.data.isnull().sum().to_dict(),
            "missing_percentage": (self.data.isnull().sum() / len(self.data) * 100).to_dict(),
            "duplicate_rows": self.data.duplicated().sum(),
            "preprocessing_log": self.preprocessing_log
        }
    
    def detect_data_types(self) -> Dict[str, str]:
        """自动检测数据类型"""
        type_mapping = {}
        
        for col in self.data.columns:
            series = self.data[col]
            
            # 检查是否为数值型
            if pd.api.types.is_numeric_dtype(series):
                # 检查是否为整数
                if series.dtype in ['int64', 'int32', 'int16', 'int8']:
                    type_mapping[col] = 'integer'
                # 检查是否为浮点数
                elif series.dtype in ['float64', 'float32', 'float16']:
                    type_mapping[col] = 'float'
                else:
                    type_mapping[col] = 'numeric'
            
            # 检查是否为日期时间型
            elif pd.api.types.is_datetime64_any_dtype(series):
                type_mapping[col] = 'datetime'
            
            # 检查是否为分类型
            elif series.dtype == 'object':
                unique_count = series.nunique()
                total_count = len(series)
                unique_ratio = unique_count / total_count if total_count > 0 else 0
                
                # 如果唯一值比例很小，可能是分类型
                if unique_count < 20 or unique_ratio < 0.1:
                    type_mapping[col] = 'categorical'
                else:
                    type_mapping[col] = 'text'
            
            # 检查是否为布尔型
            elif pd.api.types.is_bool_dtype(series):
                type_mapping[col] = 'boolean'
            
            else:
                type_mapping[col] = 'unknown'
        
        return type_mapping
    
    def get_column_statistics(self, column: str) -> Dict[str, Any]:
        """获取单个列的统计信息"""
        if column not in self.data.columns:
            raise PreprocessingError(f"列 '{column}' 不存在", "COLUMN_NOT_FOUND")
        
        series = self.data[column]
        stats = {
            "column": column,
            "dtype": str(series.dtype),
            "count": len(series),
            "missing_count": series.isnull().sum(),
            "missing_percentage": (series.isnull().sum() / len(series) * 100),
            "unique_count": series.nunique(),
            "duplicate_count": len(series) - series.nunique()
        }
        
        # 数值型统计
        if pd.api.types.is_numeric_dtype(series):
            numeric_series = pd.to_numeric(series, errors='coerce')
            stats.update({
                "mean": numeric_series.mean(),
                "median": numeric_series.median(),
                "std": numeric_series.std(),
                "min": numeric_series.min(),
                "max": numeric_series.max(),
                "skewness": numeric_series.skew(),
                "kurtosis": numeric_series.kurtosis()
            })
        
        # 分类型统计
        elif series.dtype == 'object':
            value_counts = series.value_counts()
            stats.update({
                "most_frequent": value_counts.index[0] if not value_counts.empty else None,
                "most_frequent_count": value_counts.iloc[0] if not value_counts.empty else 0,
                "value_distribution": value_counts.head(10).to_dict()
            })
        
        return stats

