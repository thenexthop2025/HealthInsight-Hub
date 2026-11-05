"""
回归分析模块
包含线性回归、逻辑回归等功能
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, r2_score, mean_squared_error, roc_auc_score, confusion_matrix
from sklearn.preprocessing import StandardScaler, LabelEncoder
import statsmodels.api as sm
from statsmodels.miscmodels.ordinal_model import OrderedModel
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.diagnostic import het_breuschpagan
from scipy.stats import shapiro
from typing import Dict, Any, List, Optional
from .logistic import run_logistic_binary, run_logistic_multinomial, run_logistic_ordinal
from .base import BaseAnalyzer
from .linear import run_linear


class RegressionAnalyzer(BaseAnalyzer):
    """回归分析器"""
    
    def linear_regression(self, dependent_var: str, independent_vars: List[str], 
                         control_vars: List[str] = None, **kwargs) -> Dict[str, Any]:
        """委托到独立模块的线性回归实现"""
        self._validate_variables([dependent_var] + independent_vars)
        if control_vars:
            self._validate_variables(control_vars)
        return run_linear(self.data, dependent_var, independent_vars, control_vars or [], **kwargs)
    
    def logistic_regression(self, dependent_var: str, independent_vars: List[str], 
                           control_vars: List[str] = None) -> Dict[str, Any]:
        """委托到独立模块的二分类逻辑回归实现"""
        self._validate_variables([dependent_var] + independent_vars)
        if control_vars:
            self._validate_variables(control_vars)
        return run_logistic_binary(self.data, dependent_var, independent_vars, control_vars or [])

    def logistic_regression_multinomial(self, dependent_var: str, independent_vars: List[str],
                                        control_vars: List[str] = None) -> Dict[str, Any]:
        self._validate_variables([dependent_var] + independent_vars)
        if control_vars:
            self._validate_variables(control_vars)
        return run_logistic_multinomial(self.data, dependent_var, independent_vars, control_vars or [])

    def logistic_regression_ordinal(self, dependent_var: str, independent_vars: List[str],
                                     control_vars: List[str] = None) -> Dict[str, Any]:
        self._validate_variables([dependent_var] + independent_vars)
        if control_vars:
            self._validate_variables(control_vars)
        return run_logistic_ordinal(self.data, dependent_var, independent_vars, control_vars or [])

    def _interpret_logistic_coefficient(self, coeff: float) -> str:
        """解释逻辑回归系数"""
        odds_ratio = np.exp(coeff)
        
        if odds_ratio < 0.5:
            return f"强负向影响 (OR = {odds_ratio:.3f})"
        elif odds_ratio < 0.8:
            return f"中等负向影响 (OR = {odds_ratio:.3f})"
        elif odds_ratio < 1.2:
            return f"影响很小 (OR = {odds_ratio:.3f})"
        elif odds_ratio < 2.0:
            return f"中等正向影响 (OR = {odds_ratio:.3f})"
        else:
            return f"强正向影响 (OR = {odds_ratio:.3f})"
    
    def multiple_regression(self, dependent_var: str, independent_vars: List[str]) -> Dict[str, Any]:
        """多元回归分析（线性回归的别名）"""
        return self.linear_regression(dependent_var, independent_vars)
    
    def validate_parameters(self, analysis_type: str, **kwargs) -> None:
        """验证回归分析参数"""
        if analysis_type in [
            "linear_regression",
            "logistic_regression",
            "logistic_regression_multinomial",
            "logistic_regression_ordinal",
        ]:
            # 回归分析需要依赖变量和独立变量
            if not kwargs.get('dependent_variables'):
                raise ValueError("回归分析需要依赖变量")
            if not kwargs.get('independent_variables'):
                raise ValueError("回归分析需要独立变量")
