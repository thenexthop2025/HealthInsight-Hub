"""
基础分析类
提供所有分析方法的通用功能和接口
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Union
import warnings
import logging
from functools import wraps
warnings.filterwarnings('ignore')

# 配置日志
logger = logging.getLogger(__name__)


class AnalysisError(Exception):
    """分析错误异常类"""
    def __init__(self, message: str, error_code: str = "ANALYSIS_ERROR", details: Dict = None):
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        super().__init__(self.message)


def validate_analysis_data(min_samples: int = 10, max_missing_ratio: float = 0.5):
    """数据验证装饰器"""
    def decorator(func):
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            try:
                # 检查数据质量
                quality_check = self._validate_data_quality(min_samples, max_missing_ratio)
                if not quality_check['is_valid']:
                    raise AnalysisError(
                        f"数据质量检查失败: {quality_check['message']}",
                        "DATA_QUALITY_ERROR",
                        quality_check
                    )
                
                # 执行原函数
                result = func(self, *args, **kwargs)
                
                # 验证结果
                if result and 'error' in result:
                    logger.warning(f"分析函数返回错误: {result['error']}")
                
                return result
                
            except AnalysisError:
                raise
            except Exception as e:
                logger.error(f"分析执行失败: {str(e)}", exc_info=True)
                raise AnalysisError(
                    f"分析执行失败: {str(e)}",
                    "ANALYSIS_EXECUTION_ERROR",
                    {"original_error": str(e)}
                )
        return wrapper
    return decorator


class BaseAnalyzer:
    """统计分析基础类"""
    
    def __init__(self, data: pd.DataFrame):
        if data is None or data.empty:
            raise AnalysisError("数据不能为空", "EMPTY_DATA_ERROR")
        
        self.data = data.copy()
        self.results = {}
        self._original_shape = data.shape
        logger.info(f"初始化分析器，数据形状: {self._original_shape}")
    
    @staticmethod
    def _safe_number(value: Any) -> Optional[float]:
        """安全转换为数字"""
        if value is None:
            return None
        if pd.isna(value):
            return None
        return float(value)
    
    def _calculate_descriptive_metrics(self, series: pd.Series) -> Dict[str, Any]:
        """计算描述性统计指标"""
        numeric_series = pd.to_numeric(series, errors='coerce')
        missing_count = int(series.shape[0] - numeric_series.dropna().shape[0])
        numeric_series = numeric_series.dropna()
        
        if numeric_series.empty:
            return {
                'count': 0,
                'missing_count': missing_count,
                'mean': None,
                'std': None,
                'min': None,
                'max': None,
                'median': None,
                'q25': None,
                'q75': None,
                'skewness': None,
                'kurtosis': None
            }
        
        return {
            'count': len(numeric_series),
            'missing_count': missing_count,
            'mean': self._safe_number(numeric_series.mean()),
            'std': self._safe_number(numeric_series.std()),
            'min': self._safe_number(numeric_series.min()),
            'max': self._safe_number(numeric_series.max()),
            'median': self._safe_number(numeric_series.median()),
            'q25': self._safe_number(numeric_series.quantile(0.25)),
            'q75': self._safe_number(numeric_series.quantile(0.75)),
            'skewness': self._safe_number(numeric_series.skew()),
            'kurtosis': self._safe_number(numeric_series.kurtosis())
        }
    
    def _validate_variables(self, variables: List[str]) -> None:
        """验证变量是否存在"""
        missing_vars = [var for var in variables if var not in self.data.columns]
        if missing_vars:
            raise ValueError(f"Variables not found in dataset: {missing_vars}")
    
    def _get_numeric_columns(self) -> List[str]:
        """获取数值型列"""
        return self.data.select_dtypes(include=[np.number]).columns.tolist()
    
    def _get_categorical_columns(self) -> List[str]:
        """获取分类型列"""
        return self.data.select_dtypes(include=['object', 'category']).columns.tolist()
    
    def _is_numeric(self, series: pd.Series) -> bool:
        """判断序列是否为数值型"""
        return pd.api.types.is_numeric_dtype(series)
    
    def _is_categorical(self, series: pd.Series) -> bool:
        """判断序列是否为分类型"""
        if series.dtype == 'object' or series.dtype.name == 'category':
            return True
        
        # 数值型但唯一值较少的情况
        if self._is_numeric(series):
            unique_count = series.nunique()
            total_count = len(series)
            return unique_count < 20 or (unique_count / total_count) < 0.1
        
        return False
    
    def _validate_data_quality(self, min_samples: int = 10, max_missing_ratio: float = 0.5) -> Dict[str, Any]:
        """数据质量检查"""
        issues = []
        
        # 检查样本量
        if len(self.data) < min_samples:
            issues.append(f"样本量不足，当前: {len(self.data)}, 最少需要: {min_samples}")
        
        # 检查缺失值比例
        missing_ratio = self.data.isnull().sum().sum() / (self.data.shape[0] * self.data.shape[1])
        if missing_ratio > max_missing_ratio:
            issues.append(f"缺失值比例过高: {missing_ratio:.2%}, 最大允许: {max_missing_ratio:.2%}")
        
        # 检查是否有完全缺失的列
        completely_missing_cols = self.data.columns[self.data.isnull().all()].tolist()
        if completely_missing_cols:
            issues.append(f"以下列完全缺失: {completely_missing_cols}")
        
        # 检查是否有重复的行
        duplicate_rows = self.data.duplicated().sum()
        if duplicate_rows > len(self.data) * 0.1:  # 如果重复行超过10%
            issues.append(f"重复行过多: {duplicate_rows} 行")
        
        return {
            'is_valid': len(issues) == 0,
            'message': '; '.join(issues) if issues else '数据质量良好',
            'issues': issues,
            'sample_size': len(self.data),
            'missing_ratio': missing_ratio,
            'duplicate_rows': duplicate_rows
        }
    
    def _handle_missing_values(self, data: pd.DataFrame, strategy: str = 'drop') -> pd.DataFrame:
        """处理缺失值"""
        if strategy == 'drop':
            return data.dropna()
        elif strategy == 'fill_mean':
            numeric_cols = data.select_dtypes(include=[np.number]).columns
            data[numeric_cols] = data[numeric_cols].fillna(data[numeric_cols].mean())
            return data
        elif strategy == 'fill_median':
            numeric_cols = data.select_dtypes(include=[np.number]).columns
            data[numeric_cols] = data[numeric_cols].fillna(data[numeric_cols].median())
            return data
        elif strategy == 'fill_mode':
            for col in data.columns:
                if data[col].dtype == 'object':
                    mode_value = data[col].mode()
                    if not mode_value.empty:
                        data[col] = data[col].fillna(mode_value[0])
            return data
        else:
            return data
    
    def _check_sample_size(self, data: pd.DataFrame, min_size: int = 10) -> bool:
        """检查样本量是否足够"""
        return len(data) >= min_size
    
    def _validate_analysis_result(self, result: Dict[str, Any]) -> bool:
        """验证分析结果的有效性"""
        if not isinstance(result, dict):
            return False
        
        # 检查是否有错误
        if 'error' in result and result['error']:
            return False
        
        # 检查关键字段是否存在
        required_fields = ['sample_size']
        for field in required_fields:
            if field not in result:
                logger.warning(f"分析结果缺少必要字段: {field}")
        
        return True
    
    def validate_parameters(self, analysis_type: str, **kwargs) -> None:
        """验证分析参数 - 子类需要实现自己的验证逻辑"""
        raise NotImplementedError(f"validate_parameters not implemented for {self.__class__.__name__}")
