"""
医学数据质量检查器
专注于医学数据的质量验证和评估
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from scipy import stats
import logging

logger = logging.getLogger(__name__)


class MedicalDataQualityChecker:
    """医学数据质量检查器"""
    
    def __init__(self, data: pd.DataFrame):
        self.data = data.copy()
        self.quality_report = {}
    
    def check_medical_data_quality(self) -> Dict[str, Any]:
        """检查医学数据质量"""
        report = {
            "overall_score": 0,
            "data_completeness": {},
            "variable_analysis": {},
            "medical_validations": {},
            "recommendations": []
        }
        
        # 1. 数据完整性检查
        completeness = self._check_data_completeness()
        report["data_completeness"] = completeness
        
        # 2. 变量分析
        variable_analysis = self._analyze_medical_variables()
        report["variable_analysis"] = variable_analysis
        
        # 3. 医学数据特有验证
        medical_validations = self._validate_medical_data()
        report["medical_validations"] = medical_validations
        
        # 4. 计算总体质量分数
        overall_score = self._calculate_quality_score(completeness, variable_analysis, medical_validations)
        report["overall_score"] = overall_score
        
        # 5. 生成建议
        recommendations = self._generate_recommendations(completeness, variable_analysis, medical_validations)
        report["recommendations"] = recommendations
        
        self.quality_report = report
        return self._convert_numpy_types(report)
    
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
    
    def _check_data_completeness(self) -> Dict[str, Any]:
        """检查数据完整性"""
        total_rows = len(self.data)
        completeness = {
            "total_rows": total_rows,
            "missing_data_summary": {},
            "column_completeness": {},
            "critical_columns": []
        }
        
        # 检查每列的缺失情况
        for col in self.data.columns:
            missing_count = self.data[col].isnull().sum()
            missing_ratio = missing_count / total_rows if total_rows > 0 else 0
            
            completeness["column_completeness"][col] = {
                "missing_count": int(missing_count),
                "missing_ratio": round(missing_ratio, 3),
                "completeness_ratio": round(1 - missing_ratio, 3)
            }
            
            # 识别关键列（缺失率过高）
            if missing_ratio > 0.3:  # 超过30%缺失
                completeness["critical_columns"].append({
                    "column": col,
                    "missing_ratio": missing_ratio,
                    "severity": "high" if missing_ratio > 0.5 else "medium"
                })
        
        # 总体缺失数据统计
        total_missing = self.data.isnull().sum().sum()
        total_cells = total_rows * len(self.data.columns)
        completeness["missing_data_summary"] = {
            "total_missing_cells": int(total_missing),
            "total_cells": int(total_cells),
            "overall_missing_ratio": round(total_missing / total_cells, 3) if total_cells > 0 else 0
        }
        
        return completeness
    
    def _analyze_medical_variables(self) -> Dict[str, Any]:
        """分析医学变量"""
        analysis = {
            "variable_types": {},
            "numeric_analysis": {},
            "categorical_analysis": {},
            "temporal_analysis": {}
        }
        
        for col in self.data.columns:
            series = self.data[col].dropna()
            if len(series) == 0:
                continue
            
            # 判断变量类型
            var_type = self._classify_medical_variable(col, series)
            analysis["variable_types"][col] = var_type
            
            if var_type == "numeric":
                numeric_stats = self._analyze_numeric_variable(series)
                analysis["numeric_analysis"][col] = numeric_stats
            
            elif var_type == "categorical":
                categorical_stats = self._analyze_categorical_variable(series)
                analysis["categorical_analysis"][col] = categorical_stats
            
            elif var_type == "temporal":
                temporal_stats = self._analyze_temporal_variable(series)
                analysis["temporal_analysis"][col] = temporal_stats
        
        return analysis
    
    def _classify_medical_variable(self, col_name: str, series: pd.Series) -> str:
        """分类医学变量"""
        col_lower = col_name.lower()
        
        # 年龄相关
        if any(keyword in col_lower for keyword in ['age', '年龄', '岁']):
            return "numeric"
        
        # 性别相关
        if any(keyword in col_lower for keyword in ['gender', 'sex', '性别']):
            return "categorical"
        
        # 时间相关
        if any(keyword in col_lower for keyword in ['date', 'time', '日期', '时间']):
            return "temporal"
        
        # 疾病相关
        if any(keyword in col_lower for keyword in ['disease', 'illness', '疾病', '病']):
            return "categorical"
        
        # 根据数据类型判断
        if pd.api.types.is_numeric_dtype(series):
            return "numeric"
        elif pd.api.types.is_datetime64_any_dtype(series):
            return "temporal"
        else:
            return "categorical"
    
    def _analyze_numeric_variable(self, series: pd.Series) -> Dict[str, Any]:
        """分析数值变量"""
        stats_dict = {
            "count": len(series),
            "mean": series.mean(),
            "median": series.median(),
            "std": series.std(),
            "min": series.min(),
            "max": series.max(),
            "skewness": series.skew(),
            "kurtosis": series.kurtosis(),
            "outliers": self._detect_outliers(series),
            "normality_test": self._test_normality(series)
        }
        return stats_dict
    
    def _analyze_categorical_variable(self, series: pd.Series) -> Dict[str, Any]:
        """分析分类变量"""
        value_counts = series.value_counts()
        stats_dict = {
            "count": len(series),
            "unique_count": series.nunique(),
            "most_frequent": value_counts.index[0] if not value_counts.empty else None,
            "most_frequent_count": value_counts.iloc[0] if not value_counts.empty else 0,
            "value_distribution": value_counts.head(10).to_dict(),
            "entropy": self._calculate_entropy(series)
        }
        return stats_dict
    
    def _analyze_temporal_variable(self, series: pd.Series) -> Dict[str, Any]:
        """分析时间变量"""
        try:
            if not pd.api.types.is_datetime64_any_dtype(series):
                series = pd.to_datetime(series, errors='coerce')
            
            stats_dict = {
                "count": len(series.dropna()),
                "date_range": {
                    "start": series.min().isoformat() if not series.empty else None,
                    "end": series.max().isoformat() if not series.empty else None
                },
                "time_span_days": (series.max() - series.min()).days if not series.empty else 0
            }
            return stats_dict
        except:
            return {"error": "无法解析时间格式"}
    
    def _detect_outliers(self, series: pd.Series) -> Dict[str, Any]:
        """检测异常值"""
        Q1 = series.quantile(0.25)
        Q3 = series.quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        
        outliers = series[(series < lower_bound) | (series > upper_bound)]
        
        return {
            "outlier_count": len(outliers),
            "outlier_ratio": len(outliers) / len(series),
            "lower_bound": lower_bound,
            "upper_bound": upper_bound,
            "outlier_values": outliers.tolist()[:10]  # 只返回前10个异常值
        }
    
    def _test_normality(self, series: pd.Series) -> Dict[str, Any]:
        """正态性检验"""
        if len(series) < 3:
            return {"error": "样本量太小"}
        
        try:
            # Shapiro-Wilk检验（适用于小样本）
            if len(series) <= 5000:
                shapiro_stat, shapiro_p = stats.shapiro(series)
                return {
                    "shapiro_wilk": {
                        "statistic": shapiro_stat,
                        "p_value": shapiro_p,
                        "is_normal": shapiro_p > 0.05
                    }
                }
            else:
                # Kolmogorov-Smirnov检验（适用于大样本）
                ks_stat, ks_p = stats.kstest(series, 'norm', args=(series.mean(), series.std()))
                return {
                    "kolmogorov_smirnov": {
                        "statistic": ks_stat,
                        "p_value": ks_p,
                        "is_normal": ks_p > 0.05
                    }
                }
        except Exception as e:
            return {"error": str(e)}
    
    def _calculate_entropy(self, series: pd.Series) -> float:
        """计算信息熵"""
        value_counts = series.value_counts()
        probabilities = value_counts / len(series)
        entropy = -sum(p * np.log2(p) for p in probabilities if p > 0)
        return entropy
    
    def _validate_medical_data(self) -> Dict[str, Any]:
        """验证医学数据"""
        validations = {
            "age_validation": self._validate_age_data(),
            "gender_validation": self._validate_gender_data(),
            "value_ranges": self._validate_value_ranges(),
            "consistency_checks": self._check_data_consistency()
        }
        return validations
    
    def _validate_age_data(self) -> Dict[str, Any]:
        """验证年龄数据"""
        age_columns = [col for col in self.data.columns if 'age' in col.lower() or '年龄' in col]
        validation = {}
        
        for col in age_columns:
            series = self.data[col].dropna()
            if len(series) == 0:
                continue
            
            numeric_series = pd.to_numeric(series, errors='coerce')
            invalid_ages = numeric_series[(numeric_series < 0) | (numeric_series > 150)]
            
            validation[col] = {
                "valid_count": len(numeric_series) - len(invalid_ages),
                "invalid_count": len(invalid_ages),
                "invalid_values": invalid_ages.tolist()[:5],
                "age_range": {
                    "min": numeric_series.min(),
                    "max": numeric_series.max()
                }
            }
        
        return validation
    
    def _validate_gender_data(self) -> Dict[str, Any]:
        """验证性别数据"""
        gender_columns = [col for col in self.data.columns if any(keyword in col.lower() for keyword in ['gender', 'sex', '性别'])]
        validation = {}
        
        for col in gender_columns:
            series = self.data[col].dropna()
            if len(series) == 0:
                continue
            
            unique_values = series.unique()
            validation[col] = {
                "unique_values": unique_values.tolist(),
                "value_counts": series.value_counts().to_dict(),
                "standardized": self._is_standardized_gender(unique_values)
            }
        
        return validation
    
    def _is_standardized_gender(self, values) -> bool:
        """检查性别数据是否标准化"""
        standardized_values = {'男', '女', 'male', 'female', 'm', 'f', '1', '0'}
        return all(str(v).lower() in standardized_values for v in values)
    
    def _validate_value_ranges(self) -> Dict[str, Any]:
        """验证数值范围"""
        numeric_columns = self.data.select_dtypes(include=[np.number]).columns
        validation = {}
        
        for col in numeric_columns:
            series = self.data[col].dropna()
            if len(series) == 0:
                continue
            
            validation[col] = {
                "range": {
                    "min": series.min(),
                    "max": series.max()
                },
                "extreme_values": series[series > series.quantile(0.99)].tolist()[:5]
            }
        
        return validation
    
    def _check_data_consistency(self) -> Dict[str, Any]:
        """检查数据一致性"""
        consistency = {
            "duplicate_rows": int(self.data.duplicated().sum()),
            "duplicate_ratio": self.data.duplicated().sum() / len(self.data),
            "column_consistency": {}
        }
        
        # 检查每列的一致性
        for col in self.data.columns:
            series = self.data[col].dropna()
            if len(series) == 0:
                continue
            
            # 检查数据类型一致性
            if pd.api.types.is_numeric_dtype(series):
                non_numeric = pd.to_numeric(series, errors='coerce').isna().sum()
                consistency["column_consistency"][col] = {
                    "type_consistency": non_numeric == 0,
                    "non_numeric_count": int(non_numeric)
                }
        
        return consistency
    
    def _calculate_quality_score(self, completeness, variable_analysis, medical_validations) -> float:
        """计算质量分数"""
        score = 100
        
        # 数据完整性扣分
        overall_missing_ratio = completeness["missing_data_summary"]["overall_missing_ratio"]
        score -= overall_missing_ratio * 30  # 缺失率每1%扣3分
        
        # 关键列缺失扣分
        for critical_col in completeness["critical_columns"]:
            if critical_col["severity"] == "high":
                score -= 20
            else:
                score -= 10
        
        # 数据一致性扣分
        duplicate_ratio = medical_validations["consistency_checks"]["duplicate_ratio"]
        score -= duplicate_ratio * 20  # 重复率每1%扣2分
        
        return max(0, min(100, score))
    
    def _generate_recommendations(self, completeness, variable_analysis, medical_validations) -> List[str]:
        """生成建议"""
        recommendations = []
        
        # 基于缺失数据的建议
        overall_missing = completeness["missing_data_summary"]["overall_missing_ratio"]
        if overall_missing > 0.1:
            recommendations.append(f"数据缺失率较高({overall_missing:.1%})，建议检查数据收集过程")
        
        # 基于关键列的建议
        for critical_col in completeness["critical_columns"]:
            recommendations.append(f"列'{critical_col['column']}'缺失率过高({critical_col['missing_ratio']:.1%})，建议重点关注")
        
        # 基于重复数据的建议
        duplicate_ratio = medical_validations["consistency_checks"]["duplicate_ratio"]
        if duplicate_ratio > 0.05:
            recommendations.append(f"重复数据比例较高({duplicate_ratio:.1%})，建议检查数据录入")
        
        # 基于性别数据的建议
        for col, validation in medical_validations["gender_validation"].items():
            if not validation["standardized"]:
                recommendations.append(f"性别列'{col}'数据格式不统一，建议标准化")
        
        return recommendations
