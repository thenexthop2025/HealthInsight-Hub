"""
数据验证模块
验证数据质量、完整性、一致性等
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Union, Tuple
from .base import BasePreprocessor, PreprocessingError, validate_preprocessing_data


class DataValidator(BasePreprocessor):
    """数据验证器"""
    
    @validate_preprocessing_data(min_rows=1, min_cols=1)
    def validate_data_quality(self) -> Dict[str, Any]:
        """验证数据质量"""
        quality_report = {
            "overall_score": 0,
            "issues": [],
            "warnings": [],
            "recommendations": [],
            "column_analysis": {}
        }
        
        total_issues = 0
        total_checks = 0
        
        # 1. 检查缺失值
        missing_ratio = self.data.isnull().sum() / len(self.data)
        high_missing_cols = missing_ratio[missing_ratio > 0.5].index.tolist()
        
        if high_missing_cols:
            quality_report["issues"].append({
                "type": "high_missing_values",
                "message": f"以下列缺失值比例过高: {high_missing_cols}",
                "severity": "high",
                "affected_columns": high_missing_cols
            })
            total_issues += len(high_missing_cols)
        total_checks += 1
        
        # 2. 检查重复行
        duplicate_count = self.data.duplicated().sum()
        duplicate_ratio = duplicate_count / len(self.data)
        
        if duplicate_ratio > 0.1:
            quality_report["issues"].append({
                "type": "high_duplicates",
                "message": f"重复行比例过高: {duplicate_ratio:.2%}",
                "severity": "medium",
                "duplicate_count": int(duplicate_count)
            })
            total_issues += 1
        elif duplicate_ratio > 0.05:
            quality_report["warnings"].append({
                "type": "moderate_duplicates",
                "message": f"重复行比例较高: {duplicate_ratio:.2%}",
                "duplicate_count": int(duplicate_count)
            })
        total_checks += 1
        
        # 3. 检查列名
        invalid_col_names = []
        for col in self.data.columns:
            if not col or col.strip() == '':
                invalid_col_names.append(col)
            elif col.startswith('Unnamed:'):
                invalid_col_names.append(col)
        
        if invalid_col_names:
            quality_report["issues"].append({
                "type": "invalid_column_names",
                "message": f"发现无效列名: {invalid_col_names}",
                "severity": "medium",
                "affected_columns": invalid_col_names
            })
            total_issues += len(invalid_col_names)
        total_checks += 1
        
        # 4. 检查数据类型一致性
        for col in self.data.columns:
            series = self.data[col].dropna()
            if len(series) == 0:
                continue
            
            column_issues = []
            
            # 检查数值列
            if pd.api.types.is_numeric_dtype(series):
                # 检查是否有无穷大值
                if np.isinf(series).any():
                    column_issues.append("包含无穷大值")
                
                # 检查是否有异常大的值
                if series.max() > 1e10:
                    column_issues.append("包含异常大的数值")
            
            # 检查文本列
            elif series.dtype == 'object':
                # 检查是否有异常长的文本
                max_length = series.astype(str).str.len().max()
                if max_length > 1000:
                    column_issues.append(f"包含异常长的文本 (最长: {max_length} 字符)")
                
                # 检查是否有特殊字符
                special_chars = series.astype(str).str.contains(r'[^\w\s]', regex=True).sum()
                if special_chars > len(series) * 0.5:
                    column_issues.append("包含大量特殊字符")
            
            if column_issues:
                quality_report["column_analysis"][col] = {
                    "issues": column_issues,
                    "data_type": str(series.dtype),
                    "missing_count": self.data[col].isnull().sum(),
                    "unique_count": series.nunique()
                }
                total_issues += len(column_issues)
        
        total_checks += len(self.data.columns)
        
        # 5. 检查数据范围
        numeric_cols = self.data.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            series = self.data[col].dropna()
            if len(series) == 0:
                continue
            
            # 检查数值范围是否合理
            if series.min() < -1e6 or series.max() > 1e6:
                quality_report["warnings"].append({
                    "type": "extreme_values",
                    "message": f"列 '{col}' 包含极值: min={series.min()}, max={series.max()}",
                    "column": col,
                    "min_value": series.min(),
                    "max_value": series.max()
                })
        
        # 计算总体质量分数
        quality_score = max(0, (total_checks - total_issues) / total_checks * 100)
        quality_report["overall_score"] = round(quality_score, 2)
        
        # 生成建议
        if high_missing_cols:
            quality_report["recommendations"].append("考虑删除缺失值比例过高的列")
        
        if duplicate_ratio > 0.05:
            quality_report["recommendations"].append("考虑删除重复行")
        
        if invalid_col_names:
            quality_report["recommendations"].append("重命名无效的列名")
        
        if quality_score < 70:
            quality_report["recommendations"].append("数据质量较低，建议进行数据清洗")
        
        self.log_operation("validate_data_quality", {
            "quality_score": quality_score,
            "total_issues": total_issues,
            "total_checks": total_checks
        })
        
        return quality_report
    
    @validate_preprocessing_data(min_rows=1, min_cols=1)
    def validate_data_consistency(self, rules: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """验证数据一致性"""
        consistency_report = {
            "overall_consistent": True,
            "violations": [],
            "column_consistency": {}
        }
        
        # 默认规则
        default_rules = {
            "check_duplicates": True,
            "check_data_types": True,
            "check_value_ranges": True,
            "check_required_columns": []
        }
        
        if rules:
            default_rules.update(rules)
        
        # 1. 检查重复数据
        if default_rules["check_duplicates"]:
            duplicate_mask = self.data.duplicated()
            if duplicate_mask.any():
                consistency_report["violations"].append({
                    "type": "duplicate_rows",
                    "message": f"发现 {duplicate_mask.sum()} 行重复数据",
                    "severity": "medium",
                    "count": int(duplicate_mask.sum())
                })
                consistency_report["overall_consistent"] = False
        
        # 2. 检查数据类型一致性
        if default_rules["check_data_types"]:
            for col in self.data.columns:
                series = self.data[col].dropna()
                if len(series) == 0:
                    continue
                
                # 检查数值列是否包含非数值
                if pd.api.types.is_numeric_dtype(series):
                    non_numeric = pd.to_numeric(series, errors='coerce').isna().sum()
                    if non_numeric > 0:
                        consistency_report["column_consistency"][col] = {
                            "issue": "contains_non_numeric_values",
                            "count": int(non_numeric),
                            "percentage": non_numeric / len(series) * 100
                        }
                        consistency_report["overall_consistent"] = False
        
        # 3. 检查必需列
        required_columns = default_rules["check_required_columns"]
        missing_required = [col for col in required_columns if col not in self.data.columns]
        if missing_required:
            consistency_report["violations"].append({
                "type": "missing_required_columns",
                "message": f"缺少必需列: {missing_required}",
                "severity": "high",
                "missing_columns": missing_required
            })
            consistency_report["overall_consistent"] = False
        
        # 4. 检查值范围
        if default_rules["check_value_ranges"]:
            numeric_cols = self.data.select_dtypes(include=[np.number]).columns
            for col in numeric_cols:
                series = self.data[col].dropna()
                if len(series) == 0:
                    continue
                
                # 检查是否有异常值
                Q1 = series.quantile(0.25)
                Q3 = series.quantile(0.75)
                IQR = Q3 - Q1
                outliers = series[(series < Q1 - 1.5 * IQR) | (series > Q3 + 1.5 * IQR)]
                
                if len(outliers) > len(series) * 0.1:  # 超过10%的异常值
                    consistency_report["column_consistency"][col] = {
                        "issue": "high_outlier_ratio",
                        "outlier_count": len(outliers),
                        "outlier_percentage": len(outliers) / len(series) * 100
                    }
        
        self.log_operation("validate_data_consistency", {
            "overall_consistent": consistency_report["overall_consistent"],
            "violation_count": len(consistency_report["violations"])
        })
        
        return consistency_report
    
    @validate_preprocessing_data(min_rows=1, min_cols=1)
    def validate_business_rules(self, rules: List[Dict[str, Any]]) -> Dict[str, Any]:
        """验证业务规则"""
        validation_report = {
            "passed_rules": [],
            "failed_rules": [],
            "overall_valid": True
        }
        
        for rule in rules:
            rule_name = rule.get("name", "unnamed_rule")
            rule_type = rule.get("type")
            rule_params = rule.get("params", {})
            
            try:
                if rule_type == "column_exists":
                    # 检查列是否存在
                    column = rule_params.get("column")
                    if column not in self.data.columns:
                        validation_report["failed_rules"].append({
                            "name": rule_name,
                            "type": rule_type,
                            "message": f"列 '{column}' 不存在"
                        })
                        validation_report["overall_valid"] = False
                    else:
                        validation_report["passed_rules"].append(rule_name)
                
                elif rule_type == "value_range":
                    # 检查值范围
                    column = rule_params.get("column")
                    min_val = rule_params.get("min_value")
                    max_val = rule_params.get("max_value")
                    
                    if column in self.data.columns:
                        series = self.data[column].dropna()
                        if len(series) > 0:
                            if min_val is not None and series.min() < min_val:
                                validation_report["failed_rules"].append({
                                    "name": rule_name,
                                    "type": rule_type,
                                    "message": f"列 '{column}' 最小值 {series.min()} 小于预期 {min_val}"
                                })
                                validation_report["overall_valid"] = False
                            elif max_val is not None and series.max() > max_val:
                                validation_report["failed_rules"].append({
                                    "name": rule_name,
                                    "type": rule_type,
                                    "message": f"列 '{column}' 最大值 {series.max()} 大于预期 {max_val}"
                                })
                                validation_report["overall_valid"] = False
                            else:
                                validation_report["passed_rules"].append(rule_name)
                
                elif rule_type == "not_null":
                    # 检查非空
                    column = rule_params.get("column")
                    if column in self.data.columns:
                        null_count = self.data[column].isnull().sum()
                        if null_count > 0:
                            validation_report["failed_rules"].append({
                                "name": rule_name,
                                "type": rule_type,
                                "message": f"列 '{column}' 包含 {null_count} 个空值"
                            })
                            validation_report["overall_valid"] = False
                        else:
                            validation_report["passed_rules"].append(rule_name)
                
                elif rule_type == "unique_values":
                    # 检查唯一值
                    column = rule_params.get("column")
                    if column in self.data.columns:
                        unique_count = self.data[column].nunique()
                        expected_unique = rule_params.get("expected_unique")
                        if expected_unique is not None and unique_count != expected_unique:
                            validation_report["failed_rules"].append({
                                "name": rule_name,
                                "type": rule_type,
                                "message": f"列 '{column}' 唯一值数量 {unique_count} 不等于预期 {expected_unique}"
                            })
                            validation_report["overall_valid"] = False
                        else:
                            validation_report["passed_rules"].append(rule_name)
                
            except Exception as e:
                validation_report["failed_rules"].append({
                    "name": rule_name,
                    "type": rule_type,
                    "message": f"规则验证出错: {str(e)}"
                })
                validation_report["overall_valid"] = False
        
        self.log_operation("validate_business_rules", {
            "total_rules": len(rules),
            "passed_rules": len(validation_report["passed_rules"]),
            "failed_rules": len(validation_report["failed_rules"]),
            "overall_valid": validation_report["overall_valid"]
        })
        
        return validation_report

