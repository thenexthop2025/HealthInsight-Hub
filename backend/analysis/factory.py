"""
统计分析工厂类
提供统一的统计分析接口
"""

import pandas as pd
from typing import Dict, Any, List, Optional
from .descriptive import DescriptiveAnalyzer
from .chi_square import ChiSquareAnalyzer
from .correlation import CorrelationAnalyzer
from .regression import RegressionAnalyzer
from .mendelian import MendelianRandomizationAnalyzer
from .stratified import StratifiedAnalyzer
from .conditional_logistic import ConditionalLogisticAnalyzer
from .exploratory import ExploratoryAnalyzer


class StatisticalAnalysisFactory:
    """统计分析工厂类"""
    
    def __init__(self, data: pd.DataFrame):
        self.data = data
        self.descriptive = DescriptiveAnalyzer(data)
        self.exploratory = ExploratoryAnalyzer(data)
        self.chi_square = ChiSquareAnalyzer(data)
        self.correlation = CorrelationAnalyzer(data)
        self.regression = RegressionAnalyzer(data)
        self.mendelian = MendelianRandomizationAnalyzer(data)
        self.stratified = StratifiedAnalyzer(data)
        self.conditional_logistic = ConditionalLogisticAnalyzer(data)
    
    def run_analysis(self, analysis_type: str, **kwargs) -> Dict[str, Any]:
        """运行统计分析"""
        # 首先进行参数验证
        self._validate_parameters(analysis_type, **kwargs)
        
        if analysis_type == "descriptive":
            return self._run_descriptive_analysis(**kwargs)
        elif analysis_type == "frequency":
            return self._run_frequency_analysis(**kwargs)
        elif analysis_type == "explore":
            return self._run_explore_analysis(**kwargs)
        elif analysis_type == "pp_plot":
            return self._run_pp_plot_analysis(**kwargs)
        elif analysis_type == "crosstab":
            return self._run_crosstab_analysis(**kwargs)
        elif analysis_type == "chi_square":
            return self._run_chi_square_analysis(**kwargs)
        elif analysis_type == "correlation":
            return self._run_correlation_analysis(**kwargs)
        elif analysis_type == "linear_regression":
            return self._run_linear_regression(**kwargs)
        elif analysis_type == "logistic_regression":
            return self._run_logistic_regression(**kwargs)
        elif analysis_type == "logistic_regression_multinomial":
            return self._run_logistic_regression_multinomial(**kwargs)
        elif analysis_type == "logistic_regression_ordinal":
            return self._run_logistic_regression_ordinal(**kwargs)
        elif analysis_type == "stratified":
            return self._run_stratified_analysis(**kwargs)
        elif analysis_type == "mendelian_randomization":
            return self._run_mendelian_randomization(**kwargs)
        elif analysis_type == "logistic_regression_conditional":
            return self._run_conditional_logistic(**kwargs)
        elif analysis_type == "logistic_regression_conditional":
            return self._run_conditional_logistic(**kwargs)
        else:
            raise ValueError(f"Unsupported analysis type: {analysis_type}")
    
    def _validate_parameters(self, analysis_type: str, **kwargs) -> None:
        """验证分析参数"""
        if analysis_type in ["descriptive", "frequency", "pp_plot", "crosstab"]:
            self.descriptive.validate_parameters(analysis_type, **kwargs)
        elif analysis_type == "explore":
            self.exploratory.validate_parameters(analysis_type, **kwargs)
        elif analysis_type in ["chi_square"]:
            self.chi_square.validate_parameters(analysis_type, **kwargs)
        elif analysis_type in ["correlation"]:
            self.correlation.validate_parameters(analysis_type, **kwargs)
        elif analysis_type in [
            "linear_regression",
            "logistic_regression",
            "logistic_regression_multinomial",
            "logistic_regression_ordinal",
        ]:
            self.regression.validate_parameters(analysis_type, **kwargs)
        elif analysis_type == "logistic_regression_conditional":
            self.conditional_logistic.validate_parameters(analysis_type, **kwargs)
        elif analysis_type == "stratified":
            self.stratified.validate_parameters(analysis_type, **kwargs)
        elif analysis_type == "mendelian_randomization":
            self.mendelian.validate_parameters(analysis_type, **kwargs)
    
    def _run_descriptive_analysis(self, **kwargs) -> Dict[str, Any]:
        """运行描述性统计分析"""
        dependent_vars = kwargs.get('dependent_variables', [])
        # 统一：描述性/探索分组统一读取 grouping_variables（向后兼容 independent_variables）
        grouping_vars = kwargs.get('grouping_variables') or kwargs.get('independent_variables') or []
        
        if not dependent_vars:
            raise ValueError("Descriptive analysis requires dependent variables")
        
        return self.descriptive.descriptive_summary(dependent_vars, grouping_vars)
    
    def _run_frequency_analysis(self, **kwargs) -> Dict[str, Any]:
        """运行频率分析"""
        # 优先使用前端传入的变量；未提供则退回到分析全部列
        variables = (
            kwargs.get('dependent_variables')
            or kwargs.get('categorical_variables')
            or kwargs.get('variables')
            or []
        )
        if not variables:
            variables = list(self.data.columns)
        
        return self.descriptive.frequency_analysis(variables)
    
    def _run_explore_analysis(self, **kwargs) -> Dict[str, Any]:
        """运行探索性分析"""
        dependent_vars = kwargs.get('dependent_variables', [])
        # 统一：分组变量优先读取 grouping_variables（向后兼容 independent_variables）
        grouping_vars = kwargs.get('grouping_variables') or kwargs.get('independent_variables') or []
        
        if not dependent_vars:
            raise ValueError("Explore analysis requires dependent variables")
        
        return self.exploratory.explore_analysis(dependent_vars, grouping_vars)
    
    def _run_pp_plot_analysis(self, **kwargs) -> Dict[str, Any]:
        """运行P-P图分析"""
        variable = kwargs.get('variable')
        if not variable:
            raise ValueError("P-P plot analysis requires a variable")
        
        return self.descriptive.pp_plot_analysis(variable)
    
    def _run_crosstab_analysis(self, **kwargs) -> Dict[str, Any]:
        """运行交叉表分析"""
        # 完全独立：仅接受规范字段，不再回退到旧命名
        row_var = kwargs.get('row_variable')
        col_var = kwargs.get('column_variable')
        if not row_var or not col_var:
            raise ValueError("Crosstab analysis requires row and column variables")
        return self.descriptive.crosstab_analysis(row_var, col_var)
    
    def _run_chi_square_analysis(self, **kwargs) -> Dict[str, Any]:
        """运行卡方检验"""
        row_var = kwargs.get('row_variable')
        col_var = kwargs.get('column_variable')
        stratify_by = kwargs.get('stratify_by')
        
        if not row_var or not col_var:
            raise ValueError("Chi-square test requires row and column variables")
        
        return self.chi_square.chi_square_test(row_var, col_var, stratify_by=stratify_by)
    
    def _run_correlation_analysis(self, **kwargs) -> Dict[str, Any]:
        """运行相关性分析"""
        # 支持多种参数名称
        columns = kwargs.get('columns', []) or kwargs.get('dependent_variables', [])
        if not columns:
            raise ValueError("Correlation analysis requires columns")
        
        return self.correlation.correlation_analysis(columns)
    
    def _run_linear_regression(self, **kwargs) -> Dict[str, Any]:
        """运行线性回归分析"""
        dependent_var = kwargs.get('dependent_variable')
        independent_vars = kwargs.get('independent_variables', [])
        control_vars = kwargs.get('control_variables', [])
        
        if not dependent_var or not independent_vars:
            raise ValueError("Linear regression requires dependent and independent variables")
        
        return self.regression.linear_regression(dependent_var, independent_vars, control_vars)
    
    def _run_logistic_regression(self, **kwargs) -> Dict[str, Any]:
        """运行逻辑回归分析"""
        dependent_var = kwargs.get('dependent_variable')
        independent_vars = kwargs.get('independent_variables', [])
        control_vars = kwargs.get('control_variables', [])
        
        if not dependent_var or not independent_vars:
            raise ValueError("Logistic regression requires dependent and independent variables")
        
        return self.regression.logistic_regression(dependent_var, independent_vars, control_vars)

    def _run_logistic_regression_multinomial(self, **kwargs) -> Dict[str, Any]:
        """运行无序多分类逻辑回归"""
        dependent_var = kwargs.get('dependent_variable')
        independent_vars = kwargs.get('independent_variables', [])
        control_vars = kwargs.get('control_variables', [])
        if not dependent_var or not independent_vars:
            raise ValueError("Multinomial logistic regression requires dependent and independent variables")
        return self.regression.logistic_regression_multinomial(dependent_var, independent_vars, control_vars)

    def _run_logistic_regression_ordinal(self, **kwargs) -> Dict[str, Any]:
        """运行有序多分类逻辑回归"""
        dependent_var = kwargs.get('dependent_variable')
        independent_vars = kwargs.get('independent_variables', [])
        control_vars = kwargs.get('control_variables', [])
        if not dependent_var or not independent_vars:
            raise ValueError("Ordinal logistic regression requires dependent and independent variables")
        return self.regression.logistic_regression_ordinal(dependent_var, independent_vars, control_vars)

    def _run_conditional_logistic(self, **kwargs) -> Dict[str, Any]:
        from schemas.conditional_logistic import ConditionalLogisticRequest

        request_obj = kwargs.get("conditional_logistic_request")
        if isinstance(request_obj, ConditionalLogisticRequest):
            request = request_obj
        elif isinstance(request_obj, dict):
            request = ConditionalLogisticRequest(**request_obj)
        else:
            dependent = kwargs.get("dependent_variables") or [kwargs.get("dependent_variable")]
            independent = kwargs.get("independent_variables") or []
            strata_vals = kwargs.get("stratum_variables") or kwargs.get("strata_variable") or []
            stratum_var = strata_vals[0] if isinstance(strata_vals, list) and strata_vals else strata_vals
            if not dependent or not independent or not stratum_var:
                raise ValueError("Conditional logistic regression requires dependent, independent and strata variables")
            request = ConditionalLogisticRequest(
                dependent_variable=dependent[0],
                independent_variables=independent,
                control_variables=kwargs.get("control_variables") or [],
                stratum_variable=stratum_var,
            )
        return self.conditional_logistic.run(request)

    def _run_stratified_analysis(self, **kwargs) -> Dict[str, Any]:
        from schemas.stratified import StratifiedRequest

        request_obj = kwargs.get('stratified_request')
        if isinstance(request_obj, StratifiedRequest):
            request = request_obj
        elif isinstance(request_obj, dict):
            request = StratifiedRequest(**request_obj)
        else:
            dependent = (kwargs.get('dependent_variables') or [])[:1]
            independent = (kwargs.get('independent_variables') or [])[:1]
            strata = kwargs.get('stratum_variables') or kwargs.get('strata_variable') or []
            strata_val = strata[0] if isinstance(strata, list) and strata else strata
            request = StratifiedRequest(
                dependent_variable=dependent[0] if dependent else kwargs.get('dependent_variable', ''),
                independent_variable=independent[0] if independent else '',
                stratum_variable=strata_val or '',
            )
        return self.stratified.run(request)

    def _run_mendelian_randomization(self, **kwargs) -> Dict[str, Any]:
        from schemas.mendelian import MendelianRandomizationRequest

        request_obj = kwargs.get('mendelian_request')
        if isinstance(request_obj, MendelianRandomizationRequest):
            request = request_obj
        elif isinstance(request_obj, dict):
            request = MendelianRandomizationRequest(**request_obj)
        else:
            request = MendelianRandomizationRequest(
                exposure_variable=kwargs.get('exposure_variable'),
                outcome_variable=kwargs.get('outcome_variable'),
                instrument_variables=kwargs.get('instrument_variables') or [],
            )
        return self.mendelian.run(request)
