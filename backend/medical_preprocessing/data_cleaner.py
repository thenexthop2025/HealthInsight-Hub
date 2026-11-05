"""
医学数据清洗器
专注于医学数据的清洗和修复
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)


class MedicalDataCleaner:
    """医学数据清洗器"""
    
    def __init__(self, data: pd.DataFrame):
        self.data = data.copy()
        self.cleaning_log = []
    
    def clean_medical_data(self, cleaning_config: Dict[str, Any]) -> Dict[str, Any]:
        """清洗医学数据"""
        original_shape = self.data.shape
        
        # 1. 处理缺失值
        if cleaning_config.get("handle_missing", True):
            self._handle_missing_values(cleaning_config.get("missing_strategy", "medical_fill"))
        
        # 2. 处理异常值
        if cleaning_config.get("handle_outliers", True):
            self._handle_outliers(cleaning_config.get("outlier_strategy", "cap"))
        
        # 3. 标准化医学变量
        if cleaning_config.get("standardize_medical_vars", True):
            self._standardize_medical_variables()
        
        # 4. 处理重复数据
        if cleaning_config.get("handle_duplicates", True):
            self._handle_duplicates()
        
        # 5. 数据类型转换
        if cleaning_config.get("convert_types", True):
            self._convert_medical_data_types()
        
        result = {
            "original_shape": original_shape,
            "cleaned_shape": self.data.shape,
            "cleaning_log": self.cleaning_log,
            "cleaned_data": self.data.to_dict('records')  # 转换为字典列表，避免numpy类型
        }
        
        return self._convert_numpy_types(result)
    
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
    
    def _handle_missing_values(self, strategy: str):
        """处理缺失值"""
        original_missing = self.data.isnull().sum().sum()
        
        if strategy == "drop":
            self.data = self.data.dropna()
            self._log_operation("drop_missing_values", {
                "strategy": strategy,
                "original_missing": int(original_missing),
                "remaining_missing": int(self.data.isnull().sum().sum())
            })
        
        elif strategy == "medical_fill":
            # 医学数据特有的填充策略
            self._medical_fill_missing_values()
            self._log_operation("medical_fill_missing_values", {
                "strategy": strategy,
                "original_missing": int(original_missing)
            })
        
        elif strategy == "drop_high_missing":
            # 删除缺失率过高的列
            threshold = 0.3  # 30%阈值
            missing_ratio = self.data.isnull().sum() / len(self.data)
            columns_to_drop = missing_ratio[missing_ratio > threshold].index.tolist()
            self.data = self.data.drop(columns=columns_to_drop)
            self._log_operation("drop_high_missing_columns", {
                "strategy": strategy,
                "threshold": threshold,
                "dropped_columns": columns_to_drop
            })
    
    def _medical_fill_missing_values(self):
        """医学数据特有的缺失值填充"""
        for col in self.data.columns:
            if self.data[col].isnull().sum() == 0:
                continue
            
            col_lower = col.lower()
            
            # 年龄列：用中位数填充
            if 'age' in col_lower or '年龄' in col_lower:
                median_age = self.data[col].median()
                if not pd.isna(median_age):
                    self.data[col] = self.data[col].fillna(median_age)
            
            # 性别列：用众数填充
            elif any(keyword in col_lower for keyword in ['gender', 'sex', '性别']):
                mode_gender = self.data[col].mode()
                if not mode_gender.empty:
                    self.data[col] = self.data[col].fillna(mode_gender[0])
            
            # 疾病相关列：用"未知"填充
            elif any(keyword in col_lower for keyword in ['disease', 'illness', '疾病', '病']):
                self.data[col] = self.data[col].fillna("未知")
            
            # 数值列：用中位数填充
            elif pd.api.types.is_numeric_dtype(self.data[col]):
                median_val = self.data[col].median()
                if not pd.isna(median_val):
                    self.data[col] = self.data[col].fillna(median_val)
            
            # 其他列：用众数填充
            else:
                mode_val = self.data[col].mode()
                if not mode_val.empty:
                    self.data[col] = self.data[col].fillna(mode_val[0])
    
    def _handle_outliers(self, strategy: str):
        """处理异常值"""
        numeric_columns = self.data.select_dtypes(include=[np.number]).columns
        
        for col in numeric_columns:
            # 跳过二分类变量（只有0和1的列）
            unique_values = self.data[col].unique()
            if len(unique_values) <= 2 and set(unique_values).issubset({0, 1, np.nan}):
                continue
            
            # 跳过常量列（所有值相同）
            if self.data[col].nunique() <= 1:
                continue
            
            if strategy == "remove":
                # 删除异常值
                Q1 = self.data[col].quantile(0.25)
                Q3 = self.data[col].quantile(0.75)
                IQR = Q3 - Q1
                
                # 只有当IQR > 0时才进行异常值检测
                if IQR > 0:
                    lower_bound = Q1 - 1.5 * IQR
                    upper_bound = Q3 + 1.5 * IQR
                    
                    outlier_mask = (self.data[col] < lower_bound) | (self.data[col] > upper_bound)
                    outlier_count = outlier_mask.sum()
                    
                    if outlier_count > 0:
                        self.data = self.data[~outlier_mask]
                        self._log_operation("remove_outliers", {
                            "column": col,
                            "outlier_count": int(outlier_count),
                            "strategy": strategy
                        })
            
            elif strategy == "cap":
                # 限制异常值
                Q1 = self.data[col].quantile(0.25)
                Q3 = self.data[col].quantile(0.75)
                IQR = Q3 - Q1
                
                # 只有当IQR > 0时才进行异常值限制
                if IQR > 0:
                    lower_bound = Q1 - 1.5 * IQR
                    upper_bound = Q3 + 1.5 * IQR
                    
                    original_min = self.data[col].min()
                    original_max = self.data[col].max()
                    
                    self.data[col] = self.data[col].clip(lower=lower_bound, upper=upper_bound)
                    
                    capped_count = ((self.data[col] == lower_bound) | (self.data[col] == upper_bound)).sum()
                    if capped_count > 0:
                        self._log_operation("cap_outliers", {
                            "column": col,
                            "capped_count": int(capped_count),
                            "strategy": strategy,
                            "bounds": {"lower": lower_bound, "upper": upper_bound}
                        })
    
    def _standardize_medical_variables(self):
        """标准化医学变量"""
        # 标准化性别变量
        gender_columns = [col for col in self.data.columns 
                         if any(keyword in col.lower() for keyword in ['gender', 'sex', '性别'])]
        
        for col in gender_columns:
            if col not in self.data.columns:
                continue
            
            # 转换为小写并标准化
            self.data[col] = self.data[col].astype(str).str.lower().str.strip()
            
            # 标准化性别值
            gender_mapping = {
                'male': '男', 'm': '男', '1': '男',
                'female': '女', 'f': '女', '0': '女'
            }
            
            self.data[col] = self.data[col].replace(gender_mapping)
            
            self._log_operation("standardize_gender", {
                "column": col,
                "unique_values": self.data[col].unique().tolist()
            })
        
        # 标准化年龄变量
        age_columns = [col for col in self.data.columns 
                      if 'age' in col.lower() or '年龄' in col]
        
        for col in age_columns:
            if col not in self.data.columns:
                continue
            
            # 确保年龄为数值类型
            self.data[col] = pd.to_numeric(self.data[col], errors='coerce')
            
            # 限制年龄范围（0-150岁）
            self.data[col] = self.data[col].clip(lower=0, upper=150)
            
            self._log_operation("standardize_age", {
                "column": col,
                "age_range": {
                    "min": self.data[col].min(),
                    "max": self.data[col].max()
                }
            })
    
    def _handle_duplicates(self):
        """处理重复数据"""
        original_count = len(self.data)
        duplicate_count = self.data.duplicated().sum()
        
        if duplicate_count > 0:
            self.data = self.data.drop_duplicates()
            
            self._log_operation("remove_duplicates", {
                "original_count": original_count,
                "duplicate_count": int(duplicate_count),
                "final_count": len(self.data)
            })
    
    def _convert_medical_data_types(self):
        """转换医学数据类型"""
        type_conversions = {}
        
        for col in self.data.columns:
            col_lower = col.lower()
            original_type = str(self.data[col].dtype)
            
            # 年龄列转换为整数
            if 'age' in col_lower or '年龄' in col_lower:
                self.data[col] = pd.to_numeric(self.data[col], errors='coerce')
                # 先填充缺失值，再转换为整数
                if self.data[col].isnull().any():
                    self.data[col] = self.data[col].fillna(self.data[col].median())
                # 使用更安全的整数转换
                self.data[col] = self.data[col].round().astype('Int64')
                type_conversions[col] = {"from": original_type, "to": "Int64"}
            
            # 性别列转换为分类
            elif any(keyword in col_lower for keyword in ['gender', 'sex', '性别']):
                self.data[col] = self.data[col].astype('category')
                type_conversions[col] = {"from": original_type, "to": "category"}
            
            # 疾病相关列转换为分类
            elif any(keyword in col_lower for keyword in ['disease', 'illness', '疾病', '病']):
                self.data[col] = self.data[col].astype('category')
                type_conversions[col] = {"from": original_type, "to": "category"}
            
            # 数值列保持数值类型
            elif pd.api.types.is_numeric_dtype(self.data[col]):
                self.data[col] = pd.to_numeric(self.data[col], errors='coerce')
                type_conversions[col] = {"from": original_type, "to": "numeric"}
        
        if type_conversions:
            self._log_operation("convert_data_types", {
                "conversions": type_conversions
            })
    
    def _log_operation(self, operation: str, details: Dict[str, Any]):
        """记录清洗操作"""
        log_entry = {
            "operation": operation,
            "timestamp": pd.Timestamp.now().isoformat(),
            "data_shape": self.data.shape,
            "details": details
        }
        self.cleaning_log.append(log_entry)
        logger.info(f"数据清洗操作: {operation}, 数据形状: {self.data.shape}")
    
    def get_cleaning_summary(self) -> Dict[str, Any]:
        """获取清洗摘要"""
        result = {
            "total_operations": len(self.cleaning_log),
            "operations": self.cleaning_log,
            "final_data_info": {
                "shape": self.data.shape,
                "columns": list(self.data.columns),
                "dtypes": self.data.dtypes.to_dict(),
                "missing_values": self.data.isnull().sum().to_dict()
            }
        }
        return self._convert_numpy_types(result)
