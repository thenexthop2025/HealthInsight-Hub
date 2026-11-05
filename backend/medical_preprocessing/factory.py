"""
医学数据预处理工厂类
提供统一的医学数据预处理接口
"""

import pandas as pd
import numpy as np
from typing import Dict, Any
from .data_quality_checker import MedicalDataQualityChecker
from .data_cleaner import MedicalDataCleaner


class MedicalPreprocessingFactory:
    """医学数据预处理工厂类"""
    
    def __init__(self, data: pd.DataFrame):
        self.data = data
        self.quality_checker = MedicalDataQualityChecker(data)
        self.data_cleaner = MedicalDataCleaner(data)
    
    def _convert_numpy_types(self, obj):
        """将numpy类型转换为Python原生类型"""
        if isinstance(obj, dict):
            return {key: self._convert_numpy_types(value) for key, value in obj.items()}
        elif isinstance(obj, list):
            return [self._convert_numpy_types(item) for item in obj]
        elif isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.bool_):
            return bool(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif hasattr(obj, 'item'):  # 处理其他numpy标量类型
            return obj.item()
        elif hasattr(obj, 'name'):  # 处理pandas dtype对象
            return str(obj)
        else:
            return obj
    
    def run_quality_check(self) -> Dict[str, Any]:
        """运行数据质量检查"""
        quality_report = self.quality_checker.check_medical_data_quality()
        
        result = {
            "preprocessing_type": "quality_check",
            "quality_report": quality_report,
            "data_info": {
                "shape": self.data.shape,
                "columns": list(self.data.columns),
                "dtypes": self.data.dtypes.to_dict()
            }
        }
        
        return self._convert_numpy_types(result)
    
    def run_data_cleaning(self, cleaning_config: Dict[str, Any] = None) -> Dict[str, Any]:
        """运行数据清洗"""
        if cleaning_config is None:
            cleaning_config = {
                "handle_missing": True,
                "missing_strategy": "medical_fill",
                "handle_outliers": True,
                "outlier_strategy": "remove",
                "standardize_medical_vars": True,
                "handle_duplicates": True,
                "convert_types": True
            }
        
        cleaning_result = self.data_cleaner.clean_medical_data(cleaning_config)
        
        result = {
            "preprocessing_type": "data_cleaning",
            "cleaning_result": cleaning_result,
            "cleaning_summary": self.data_cleaner.get_cleaning_summary()
        }
        
        return self._convert_numpy_types(result)
    
    def run_full_preprocessing(self, cleaning_config: Dict[str, Any] = None) -> Dict[str, Any]:
        """运行完整的预处理流程"""
        # 1. 质量检查
        quality_result = self.run_quality_check()
        
        # 2. 数据清洗
        cleaning_result = self.run_data_cleaning(cleaning_config)
        
        result = {
            "preprocessing_type": "full_preprocessing",
            "quality_check": quality_result,
            "data_cleaning": cleaning_result,
            "summary": {
                "original_shape": self.data.shape,
                "final_shape": cleaning_result["cleaning_result"]["cleaned_shape"],
                "quality_score": quality_result["quality_report"]["overall_score"],
                "total_operations": len(cleaning_result["cleaning_summary"]["operations"])
            }
        }
        
        return self._convert_numpy_types(result)
    
    def get_data_info(self) -> Dict[str, Any]:
        """获取数据基本信息"""
        result = {
            "shape": self.data.shape,
            "columns": list(self.data.columns),
            "dtypes": self.data.dtypes.to_dict(),
            "memory_usage": self.data.memory_usage(deep=True).sum(),
            "missing_values": self.data.isnull().sum().to_dict(),
            "missing_percentage": (self.data.isnull().sum() / len(self.data) * 100).to_dict(),
            "duplicate_rows": self.data.duplicated().sum()
        }
        
        return self._convert_numpy_types(result)
