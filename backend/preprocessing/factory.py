"""
数据预处理工厂类
提供统一的数据预处理接口
"""

import pandas as pd
from typing import Dict, Any, List, Optional
from .base import BasePreprocessor
from .data_cleaner import DataCleaner
from .data_validator import DataValidator
from .data_transformer import DataTransformer


class PreprocessingFactory:
    """数据预处理工厂类"""
    
    def __init__(self, data: pd.DataFrame):
        self.data = data
        self.cleaner = DataCleaner(data)
        self.validator = DataValidator(data)
        self.transformer = DataTransformer(data)
    
    def run_preprocessing(self, preprocessing_type: str, **kwargs) -> Dict[str, Any]:
        """运行数据预处理"""
        if preprocessing_type == "clean_missing":
            return self._clean_missing_values(**kwargs)
        elif preprocessing_type == "remove_duplicates":
            return self._remove_duplicates(**kwargs)
        elif preprocessing_type == "detect_outliers":
            return self._detect_outliers(**kwargs)
        elif preprocessing_type == "remove_outliers":
            return self._remove_outliers(**kwargs)
        elif preprocessing_type == "standardize_text":
            return self._standardize_text(**kwargs)
        elif preprocessing_type == "convert_types":
            return self._convert_data_types(**kwargs)
        elif preprocessing_type == "validate_quality":
            return self._validate_data_quality(**kwargs)
        elif preprocessing_type == "validate_consistency":
            return self._validate_consistency(**kwargs)
        elif preprocessing_type == "validate_business_rules":
            return self._validate_business_rules(**kwargs)
        elif preprocessing_type == "normalize":
            return self._normalize_data(**kwargs)
        elif preprocessing_type == "encode_categorical":
            return self._encode_categorical(**kwargs)
        elif preprocessing_type == "create_features":
            return self._create_features(**kwargs)
        elif preprocessing_type == "select_features":
            return self._select_features(**kwargs)
        elif preprocessing_type == "transform_skewed":
            return self._transform_skewed_data(**kwargs)
        else:
            raise ValueError(f"Unsupported preprocessing type: {preprocessing_type}")
    
    def _clean_missing_values(self, **kwargs) -> Dict[str, Any]:
        """清洗缺失值"""
        strategy = kwargs.get('strategy', 'drop')
        result_data = self.cleaner.handle_missing_values(strategy=strategy, **kwargs)
        
        return {
            "preprocessing_type": "clean_missing",
            "strategy": strategy,
            "result_data": result_data,
            "data_info": self.cleaner.get_data_info(),
            "preprocessing_log": self.cleaner.preprocessing_log
        }
    
    def _remove_duplicates(self, **kwargs) -> Dict[str, Any]:
        """删除重复数据"""
        subset = kwargs.get('subset')
        keep = kwargs.get('keep', 'first')
        result_data = self.cleaner.remove_duplicates(subset=subset, keep=keep)
        
        return {
            "preprocessing_type": "remove_duplicates",
            "subset": subset,
            "keep": keep,
            "result_data": result_data,
            "data_info": self.cleaner.get_data_info(),
            "preprocessing_log": self.cleaner.preprocessing_log
        }
    
    def _detect_outliers(self, **kwargs) -> Dict[str, Any]:
        """检测异常值"""
        method = kwargs.get('method', 'iqr')
        columns = kwargs.get('columns')
        outliers_info = self.cleaner.detect_outliers(method=method, columns=columns)
        
        return {
            "preprocessing_type": "detect_outliers",
            "method": method,
            "columns": columns,
            "outliers_info": outliers_info,
            "data_info": self.cleaner.get_data_info()
        }
    
    def _remove_outliers(self, **kwargs) -> Dict[str, Any]:
        """删除异常值"""
        method = kwargs.get('method', 'iqr')
        columns = kwargs.get('columns')
        result_data = self.cleaner.remove_outliers(method=method, columns=columns)
        
        return {
            "preprocessing_type": "remove_outliers",
            "method": method,
            "columns": columns,
            "result_data": result_data,
            "data_info": self.cleaner.get_data_info(),
            "preprocessing_log": self.cleaner.preprocessing_log
        }
    
    def _standardize_text(self, **kwargs) -> Dict[str, Any]:
        """标准化文本"""
        columns = kwargs.get('columns')
        result_data = self.cleaner.standardize_text(columns=columns)
        
        return {
            "preprocessing_type": "standardize_text",
            "columns": columns,
            "result_data": result_data,
            "data_info": self.cleaner.get_data_info(),
            "preprocessing_log": self.cleaner.preprocessing_log
        }
    
    def _convert_data_types(self, **kwargs) -> Dict[str, Any]:
        """转换数据类型"""
        type_mapping = kwargs.get('type_mapping', {})
        result_data = self.cleaner.convert_data_types(type_mapping=type_mapping)
        
        return {
            "preprocessing_type": "convert_data_types",
            "type_mapping": type_mapping,
            "result_data": result_data,
            "data_info": self.cleaner.get_data_info(),
            "preprocessing_log": self.cleaner.preprocessing_log
        }
    
    def _validate_data_quality(self, **kwargs) -> Dict[str, Any]:
        """验证数据质量"""
        quality_report = self.validator.validate_data_quality()
        
        return {
            "preprocessing_type": "validate_data_quality",
            "quality_report": quality_report,
            "data_info": self.validator.get_data_info()
        }
    
    def _validate_consistency(self, **kwargs) -> Dict[str, Any]:
        """验证数据一致性"""
        rules = kwargs.get('rules')
        consistency_report = self.validator.validate_data_consistency(rules=rules)
        
        return {
            "preprocessing_type": "validate_consistency",
            "rules": rules,
            "consistency_report": consistency_report,
            "data_info": self.validator.get_data_info()
        }
    
    def _validate_business_rules(self, **kwargs) -> Dict[str, Any]:
        """验证业务规则"""
        rules = kwargs.get('rules', [])
        validation_report = self.validator.validate_business_rules(rules=rules)
        
        return {
            "preprocessing_type": "validate_business_rules",
            "rules": rules,
            "validation_report": validation_report,
            "data_info": self.validator.get_data_info()
        }
    
    def _normalize_data(self, **kwargs) -> Dict[str, Any]:
        """数据标准化"""
        method = kwargs.get('method', 'standard')
        columns = kwargs.get('columns')
        result_data = self.transformer.normalize_data(method=method, columns=columns)
        
        return {
            "preprocessing_type": "normalize",
            "method": method,
            "columns": columns,
            "result_data": result_data,
            "data_info": self.transformer.get_data_info(),
            "preprocessing_log": self.transformer.preprocessing_log
        }
    
    def _encode_categorical(self, **kwargs) -> Dict[str, Any]:
        """编码分类变量"""
        method = kwargs.get('method', 'label')
        columns = kwargs.get('columns')
        result_data = self.transformer.encode_categorical(method=method, columns=columns)
        
        return {
            "preprocessing_type": "encode_categorical",
            "method": method,
            "columns": columns,
            "result_data": result_data,
            "data_info": self.transformer.get_data_info(),
            "preprocessing_log": self.transformer.preprocessing_log
        }
    
    def _create_features(self, **kwargs) -> Dict[str, Any]:
        """创建新特征"""
        feature_configs = kwargs.get('feature_configs', [])
        result_data = self.transformer.create_features(feature_configs=feature_configs)
        
        return {
            "preprocessing_type": "create_features",
            "feature_configs": feature_configs,
            "result_data": result_data,
            "data_info": self.transformer.get_data_info(),
            "preprocessing_log": self.transformer.preprocessing_log
        }
    
    def _select_features(self, **kwargs) -> Dict[str, Any]:
        """特征选择"""
        method = kwargs.get('method', 'k_best')
        target_column = kwargs.get('target_column')
        k = kwargs.get('k', 10)
        result_data = self.transformer.select_features(method=method, target_column=target_column, k=k)
        
        return {
            "preprocessing_type": "select_features",
            "method": method,
            "target_column": target_column,
            "k": k,
            "result_data": result_data,
            "data_info": self.transformer.get_data_info(),
            "preprocessing_log": self.transformer.preprocessing_log
        }
    
    def _transform_skewed_data(self, **kwargs) -> Dict[str, Any]:
        """变换偏斜数据"""
        method = kwargs.get('method', 'log')
        columns = kwargs.get('columns')
        result_data = self.transformer.transform_skewed_data(method=method, columns=columns)
        
        return {
            "preprocessing_type": "transform_skewed",
            "method": method,
            "columns": columns,
            "result_data": result_data,
            "data_info": self.transformer.get_data_info(),
            "preprocessing_log": self.transformer.preprocessing_log
        }
    
    def get_data_info(self) -> Dict[str, Any]:
        """获取数据信息"""
        return self.cleaner.get_data_info()
    
    def detect_data_types(self) -> Dict[str, str]:
        """检测数据类型"""
        return self.cleaner.detect_data_types()
    
    def get_column_statistics(self, column: str) -> Dict[str, Any]:
        """获取列统计信息"""
        return self.cleaner.get_column_statistics(column)

