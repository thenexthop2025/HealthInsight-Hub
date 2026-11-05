"""
数据清洗模块
处理缺失值、异常值、重复数据等
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Union
from scipy import stats
from .base import BasePreprocessor, PreprocessingError, validate_preprocessing_data


class DataCleaner(BasePreprocessor):
    """数据清洗器"""
    
    @validate_preprocessing_data(min_rows=1, min_cols=1)
    def handle_missing_values(self, strategy: str = 'drop', **kwargs) -> pd.DataFrame:
        """处理缺失值"""
        original_missing = self.data.isnull().sum().sum()
        
        if strategy == 'drop':
            # 删除包含缺失值的行
            self.data = self.data.dropna()
            self.log_operation("drop_missing_values", {
                "strategy": strategy,
                "original_missing": int(original_missing),
                "remaining_missing": int(self.data.isnull().sum().sum())
            })
        
        elif strategy == 'drop_columns':
            # 删除缺失值比例过高的列
            threshold = kwargs.get('threshold', 0.5)
            missing_ratio = self.data.isnull().sum() / len(self.data)
            columns_to_drop = missing_ratio[missing_ratio > threshold].index.tolist()
            self.data = self.data.drop(columns=columns_to_drop)
            self.log_operation("drop_columns_with_missing", {
                "strategy": strategy,
                "threshold": threshold,
                "dropped_columns": columns_to_drop,
                "original_missing": int(original_missing)
            })
        
        elif strategy == 'fill_mean':
            # 用均值填充数值列
            numeric_columns = self.data.select_dtypes(include=[np.number]).columns
            for col in numeric_columns:
                mean_value = self.data[col].mean()
                if not pd.isna(mean_value):
                    self.data[col] = self.data[col].fillna(mean_value)
            self.log_operation("fill_missing_with_mean", {
                "strategy": strategy,
                "numeric_columns": list(numeric_columns),
                "original_missing": int(original_missing)
            })
        
        elif strategy == 'fill_median':
            # 用中位数填充数值列
            numeric_columns = self.data.select_dtypes(include=[np.number]).columns
            for col in numeric_columns:
                median_value = self.data[col].median()
                if not pd.isna(median_value):
                    self.data[col] = self.data[col].fillna(median_value)
            self.log_operation("fill_missing_with_median", {
                "strategy": strategy,
                "numeric_columns": list(numeric_columns),
                "original_missing": int(original_missing)
            })
        
        elif strategy == 'fill_mode':
            # 用众数填充分类型列
            categorical_columns = self.data.select_dtypes(include=['object']).columns
            for col in categorical_columns:
                mode_value = self.data[col].mode()
                if not mode_value.empty:
                    self.data[col] = self.data[col].fillna(mode_value[0])
            self.log_operation("fill_missing_with_mode", {
                "strategy": strategy,
                "categorical_columns": list(categorical_columns),
                "original_missing": int(original_missing)
            })
        
        elif strategy == 'fill_forward':
            # 前向填充
            self.data = self.data.fillna(method='ffill')
            self.log_operation("fill_missing_forward", {
                "strategy": strategy,
                "original_missing": int(original_missing)
            })
        
        elif strategy == 'fill_backward':
            # 后向填充
            self.data = self.data.fillna(method='bfill')
            self.log_operation("fill_missing_backward", {
                "strategy": strategy,
                "original_missing": int(original_missing)
            })
        
        else:
            raise PreprocessingError(f"不支持的缺失值处理策略: {strategy}", "INVALID_STRATEGY")
        
        return self.data
    
    @validate_preprocessing_data(min_rows=1, min_cols=1)
    def remove_duplicates(self, subset: Optional[List[str]] = None, keep: str = 'first') -> pd.DataFrame:
        """删除重复数据"""
        original_count = len(self.data)
        duplicate_count = self.data.duplicated(subset=subset).sum()
        
        self.data = self.data.drop_duplicates(subset=subset, keep=keep)
        
        self.log_operation("remove_duplicates", {
            "subset": subset,
            "keep": keep,
            "original_count": original_count,
            "duplicate_count": int(duplicate_count),
            "final_count": len(self.data)
        })
        
        return self.data
    
    @validate_preprocessing_data(min_rows=1, min_cols=1)
    def detect_outliers(self, method: str = 'iqr', columns: Optional[List[str]] = None) -> Dict[str, Any]:
        """检测异常值"""
        if columns is None:
            columns = self.data.select_dtypes(include=[np.number]).columns.tolist()
        
        outliers_info = {}
        
        for col in columns:
            if col not in self.data.columns:
                continue
            
            series = self.data[col].dropna()
            if len(series) == 0:
                continue
            
            if method == 'iqr':
                # 四分位数方法
                Q1 = series.quantile(0.25)
                Q3 = series.quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                
                outliers = series[(series < lower_bound) | (series > upper_bound)]
                
            elif method == 'zscore':
                # Z分数方法
                z_scores = np.abs(stats.zscore(series))
                threshold = 3  # 3个标准差
                outliers = series[z_scores > threshold]
                lower_bound = series.mean() - threshold * series.std()
                upper_bound = series.mean() + threshold * series.std()
            
            elif method == 'modified_zscore':
                # 修正Z分数方法
                median = series.median()
                mad = np.median(np.abs(series - median))
                modified_z_scores = 0.6745 * (series - median) / mad
                threshold = 3.5
                outliers = series[np.abs(modified_z_scores) > threshold]
                lower_bound = median - threshold * mad / 0.6745
                upper_bound = median + threshold * mad / 0.6745
            
            else:
                raise PreprocessingError(f"不支持的异常值检测方法: {method}", "INVALID_METHOD")
            
            outliers_info[col] = {
                "method": method,
                "outlier_count": len(outliers),
                "outlier_percentage": len(outliers) / len(series) * 100,
                "lower_bound": lower_bound,
                "upper_bound": upper_bound,
                "outlier_values": outliers.tolist()
            }
        
        self.log_operation("detect_outliers", {
            "method": method,
            "columns": columns,
            "outliers_info": outliers_info
        })
        
        return outliers_info
    
    @validate_preprocessing_data(min_rows=1, min_cols=1)
    def remove_outliers(self, method: str = 'iqr', columns: Optional[List[str]] = None) -> pd.DataFrame:
        """删除异常值"""
        outliers_info = self.detect_outliers(method=method, columns=columns)
        original_count = len(self.data)
        
        for col, info in outliers_info.items():
            if info['outlier_count'] > 0:
                series = self.data[col]
                outliers = series[(series < info['lower_bound']) | (series > info['upper_bound'])]
                self.data = self.data[~self.data[col].isin(outliers)]
        
        self.log_operation("remove_outliers", {
            "method": method,
            "columns": columns,
            "original_count": original_count,
            "final_count": len(self.data),
            "outliers_info": outliers_info
        })
        
        return self.data
    
    @validate_preprocessing_data(min_rows=1, min_cols=1)
    def standardize_text(self, columns: Optional[List[str]] = None) -> pd.DataFrame:
        """标准化文本数据"""
        if columns is None:
            columns = self.data.select_dtypes(include=['object']).columns.tolist()
        
        for col in columns:
            if col not in self.data.columns:
                continue
            
            # 去除首尾空格
            self.data[col] = self.data[col].astype(str).str.strip()
            
            # 转换为小写
            self.data[col] = self.data[col].str.lower()
            
            # 替换多个空格为单个空格
            self.data[col] = self.data[col].str.replace(r'\s+', ' ', regex=True)
        
        self.log_operation("standardize_text", {
            "columns": columns
        })
        
        return self.data
    
    @validate_preprocessing_data(min_rows=1, min_cols=1)
    def convert_data_types(self, type_mapping: Dict[str, str]) -> pd.DataFrame:
        """转换数据类型"""
        conversion_log = {}
        
        for col, target_type in type_mapping.items():
            if col not in self.data.columns:
                continue
            
            original_type = str(self.data[col].dtype)
            
            try:
                if target_type == 'numeric':
                    self.data[col] = pd.to_numeric(self.data[col], errors='coerce')
                elif target_type == 'integer':
                    self.data[col] = pd.to_numeric(self.data[col], errors='coerce').astype('Int64')
                elif target_type == 'float':
                    self.data[col] = pd.to_numeric(self.data[col], errors='coerce').astype('float64')
                elif target_type == 'categorical':
                    self.data[col] = self.data[col].astype('category')
                elif target_type == 'datetime':
                    self.data[col] = pd.to_datetime(self.data[col], errors='coerce')
                elif target_type == 'boolean':
                    self.data[col] = self.data[col].astype('boolean')
                elif target_type == 'string':
                    self.data[col] = self.data[col].astype('string')
                
                conversion_log[col] = {
                    "original_type": original_type,
                    "target_type": target_type,
                    "success": True
                }
                
            except Exception as e:
                conversion_log[col] = {
                    "original_type": original_type,
                    "target_type": target_type,
                    "success": False,
                    "error": str(e)
                }
        
        self.log_operation("convert_data_types", {
            "type_mapping": type_mapping,
            "conversion_log": conversion_log
        })
        
        return self.data

