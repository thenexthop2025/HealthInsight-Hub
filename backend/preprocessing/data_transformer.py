"""
数据转换模块
提供数据变换、特征工程、数据标准化等功能
"""

import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Union, Tuple
from sklearn.preprocessing import StandardScaler, MinMaxScaler, RobustScaler, LabelEncoder, OneHotEncoder
from sklearn.feature_selection import SelectKBest, f_classif, f_regression
from .base import BasePreprocessor, PreprocessingError, validate_preprocessing_data


class DataTransformer(BasePreprocessor):
    """数据转换器"""
    
    @validate_preprocessing_data(min_rows=1, min_cols=1)
    def normalize_data(self, method: str = 'standard', columns: Optional[List[str]] = None) -> pd.DataFrame:
        """数据标准化"""
        if columns is None:
            columns = self.data.select_dtypes(include=[np.number]).columns.tolist()
        
        if not columns:
            raise PreprocessingError("没有找到数值列进行标准化", "NO_NUMERIC_COLUMNS")
        
        scaler = None
        if method == 'standard':
            scaler = StandardScaler()
        elif method == 'minmax':
            scaler = MinMaxScaler()
        elif method == 'robust':
            scaler = RobustScaler()
        else:
            raise PreprocessingError(f"不支持的标准化方法: {method}", "INVALID_METHOD")
        
        # 只对指定的列进行标准化
        for col in columns:
            if col not in self.data.columns:
                continue
            
            series = self.data[col].dropna()
            if len(series) == 0:
                continue
            
            # 标准化
            scaled_values = scaler.fit_transform(series.values.reshape(-1, 1)).flatten()
            
            # 创建新的DataFrame来保持索引对齐
            scaled_series = pd.Series(index=series.index, data=scaled_values)
            self.data[col] = self.data[col].fillna(scaled_series)
        
        self.log_operation("normalize_data", {
            "method": method,
            "columns": columns
        })
        
        return self.data
    
    @validate_preprocessing_data(min_rows=1, min_cols=1)
    def encode_categorical(self, method: str = 'label', columns: Optional[List[str]] = None) -> pd.DataFrame:
        """编码分类变量"""
        if columns is None:
            columns = self.data.select_dtypes(include=['object', 'category']).columns.tolist()
        
        if not columns:
            raise PreprocessingError("没有找到分类列进行编码", "NO_CATEGORICAL_COLUMNS")
        
        encoding_log = {}
        
        for col in columns:
            if col not in self.data.columns:
                continue
            
            series = self.data[col].dropna()
            if len(series) == 0:
                continue
            
            original_values = series.unique()
            
            if method == 'label':
                # 标签编码
                encoder = LabelEncoder()
                encoded_values = encoder.fit_transform(series)
                self.data[col] = self.data[col].fillna(pd.Series(index=series.index, data=encoded_values))
                
                encoding_log[col] = {
                    "method": method,
                    "original_categories": len(original_values),
                    "encoded_categories": len(encoder.classes_),
                    "mapping": dict(zip(encoder.classes_, encoder.transform(encoder.classes_)))
                }
            
            elif method == 'onehot':
                # 独热编码
                encoder = OneHotEncoder(sparse_output=False, drop='first')
                encoded_matrix = encoder.fit_transform(series.values.reshape(-1, 1))
                
                # 创建新的列名
                new_columns = [f"{col}_{cat}" for cat in encoder.categories_[0][1:]]  # 去掉第一个类别
                
                # 创建新的DataFrame
                encoded_df = pd.DataFrame(
                    encoded_matrix,
                    index=series.index,
                    columns=new_columns
                )
                
                # 删除原列，添加新列
                self.data = self.data.drop(columns=[col])
                self.data = pd.concat([self.data, encoded_df], axis=1)
                
                encoding_log[col] = {
                    "method": method,
                    "original_categories": len(original_values),
                    "new_columns": new_columns,
                    "encoded_categories": len(new_columns)
                }
            
            else:
                raise PreprocessingError(f"不支持的编码方法: {method}", "INVALID_METHOD")
        
        self.log_operation("encode_categorical", {
            "method": method,
            "columns": columns,
            "encoding_log": encoding_log
        })
        
        return self.data
    
    @validate_preprocessing_data(min_rows=1, min_cols=1)
    def create_features(self, feature_configs: List[Dict[str, Any]]) -> pd.DataFrame:
        """创建新特征"""
        feature_log = []
        
        for config in feature_configs:
            feature_type = config.get("type")
            feature_name = config.get("name")
            source_columns = config.get("source_columns", [])
            params = config.get("params", {})
            
            if not feature_name:
                continue
            
            try:
                if feature_type == "sum":
                    # 求和特征
                    self.data[feature_name] = self.data[source_columns].sum(axis=1)
                    feature_log.append({
                        "name": feature_name,
                        "type": feature_type,
                        "source_columns": source_columns,
                        "status": "success"
                    })
                
                elif feature_type == "mean":
                    # 均值特征
                    self.data[feature_name] = self.data[source_columns].mean(axis=1)
                    feature_log.append({
                        "name": feature_name,
                        "type": feature_type,
                        "source_columns": source_columns,
                        "status": "success"
                    })
                
                elif feature_type == "product":
                    # 乘积特征
                    self.data[feature_name] = self.data[source_columns].prod(axis=1)
                    feature_log.append({
                        "name": feature_name,
                        "type": feature_type,
                        "source_columns": source_columns,
                        "status": "success"
                    })
                
                elif feature_type == "ratio":
                    # 比率特征
                    if len(source_columns) == 2:
                        numerator = source_columns[0]
                        denominator = source_columns[1]
                        self.data[feature_name] = self.data[numerator] / (self.data[denominator] + 1e-8)  # 避免除零
                        feature_log.append({
                            "name": feature_name,
                            "type": feature_type,
                            "source_columns": source_columns,
                            "status": "success"
                        })
                
                elif feature_type == "difference":
                    # 差值特征
                    if len(source_columns) == 2:
                        col1, col2 = source_columns
                        self.data[feature_name] = self.data[col1] - self.data[col2]
                        feature_log.append({
                            "name": feature_name,
                            "type": feature_type,
                            "source_columns": source_columns,
                            "status": "success"
                        })
                
                elif feature_type == "polynomial":
                    # 多项式特征
                    column = source_columns[0] if source_columns else None
                    degree = params.get("degree", 2)
                    if column and column in self.data.columns:
                        self.data[feature_name] = self.data[column] ** degree
                        feature_log.append({
                            "name": feature_name,
                            "type": feature_type,
                            "source_columns": [column],
                            "degree": degree,
                            "status": "success"
                        })
                
                elif feature_type == "log":
                    # 对数特征
                    column = source_columns[0] if source_columns else None
                    if column and column in self.data.columns:
                        self.data[feature_name] = np.log1p(self.data[column])  # log1p避免log(0)
                        feature_log.append({
                            "name": feature_name,
                            "type": feature_type,
                            "source_columns": [column],
                            "status": "success"
                        })
                
                elif feature_type == "sqrt":
                    # 平方根特征
                    column = source_columns[0] if source_columns else None
                    if column and column in self.data.columns:
                        self.data[feature_name] = np.sqrt(np.abs(self.data[column]))
                        feature_log.append({
                            "name": feature_name,
                            "type": feature_type,
                            "source_columns": [column],
                            "status": "success"
                        })
                
                else:
                    feature_log.append({
                        "name": feature_name,
                        "type": feature_type,
                        "status": "failed",
                        "error": f"不支持的特征类型: {feature_type}"
                    })
            
            except Exception as e:
                feature_log.append({
                    "name": feature_name,
                    "type": feature_type,
                    "status": "failed",
                    "error": str(e)
                })
        
        self.log_operation("create_features", {
            "feature_configs": feature_configs,
            "feature_log": feature_log
        })
        
        return self.data
    
    @validate_preprocessing_data(min_rows=1, min_cols=1)
    def select_features(self, method: str = 'k_best', target_column: str = None, k: int = 10) -> pd.DataFrame:
        """特征选择"""
        if method == 'k_best':
            if not target_column or target_column not in self.data.columns:
                raise PreprocessingError("k_best方法需要指定目标列", "TARGET_COLUMN_REQUIRED")
            
            # 分离特征和目标
            feature_columns = [col for col in self.data.columns if col != target_column]
            X = self.data[feature_columns].select_dtypes(include=[np.number])
            y = self.data[target_column]
            
            if X.empty:
                raise PreprocessingError("没有找到数值特征列", "NO_NUMERIC_FEATURES")
            
            # 处理缺失值
            X = X.fillna(X.mean())
            
            # 特征选择
            selector = SelectKBest(score_func=f_classif if y.dtype == 'object' else f_regression, k=min(k, X.shape[1]))
            X_selected = selector.fit_transform(X, y)
            
            # 获取选中的特征名
            selected_features = X.columns[selector.get_support()].tolist()
            
            # 保留选中的特征和目标列
            columns_to_keep = selected_features + [target_column]
            self.data = self.data[columns_to_keep]
            
            self.log_operation("select_features", {
                "method": method,
                "target_column": target_column,
                "k": k,
                "original_features": len(feature_columns),
                "selected_features": selected_features,
                "selected_count": len(selected_features)
            })
        
        else:
            raise PreprocessingError(f"不支持的特征选择方法: {method}", "INVALID_METHOD")
        
        return self.data
    
    @validate_preprocessing_data(min_rows=1, min_cols=1)
    def transform_skewed_data(self, method: str = 'log', columns: Optional[List[str]] = None) -> pd.DataFrame:
        """变换偏斜数据"""
        if columns is None:
            numeric_cols = self.data.select_dtypes(include=[np.number]).columns
            # 只处理偏斜度大于1的列
            skewed_cols = []
            for col in numeric_cols:
                series = self.data[col].dropna()
                if len(series) > 0:
                    skewness = series.skew()
                    if abs(skewness) > 1:
                        skewed_cols.append(col)
            columns = skewed_cols
        
        if not columns:
            self.log_operation("transform_skewed_data", {
                "method": method,
                "message": "没有找到需要变换的偏斜列"
            })
            return self.data
        
        transformation_log = {}
        
        for col in columns:
            if col not in self.data.columns:
                continue
            
            series = self.data[col].dropna()
            if len(series) == 0:
                continue
            
            original_skewness = series.skew()
            
            try:
                if method == 'log':
                    # 对数变换
                    self.data[col] = np.log1p(self.data[col])
                    new_series = self.data[col].dropna()
                    new_skewness = new_series.skew()
                
                elif method == 'sqrt':
                    # 平方根变换
                    self.data[col] = np.sqrt(np.abs(self.data[col]))
                    new_series = self.data[col].dropna()
                    new_skewness = new_series.skew()
                
                elif method == 'box_cox':
                    # Box-Cox变换
                    from scipy.stats import boxcox
                    # 确保数据为正数
                    positive_data = self.data[col] - self.data[col].min() + 1
                    transformed_data, _ = boxcox(positive_data)
                    self.data[col] = transformed_data
                    new_series = self.data[col].dropna()
                    new_skewness = new_series.skew()
                
                else:
                    raise PreprocessingError(f"不支持的变换方法: {method}", "INVALID_METHOD")
                
                transformation_log[col] = {
                    "method": method,
                    "original_skewness": original_skewness,
                    "new_skewness": new_skewness,
                    "improvement": abs(original_skewness) - abs(new_skewness)
                }
            
            except Exception as e:
                transformation_log[col] = {
                    "method": method,
                    "error": str(e),
                    "status": "failed"
                }
        
        self.log_operation("transform_skewed_data", {
            "method": method,
            "columns": columns,
            "transformation_log": transformation_log
        })
        
        return self.data

