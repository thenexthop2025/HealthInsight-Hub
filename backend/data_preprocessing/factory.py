"""
数据预处理工厂类
统一管理各种数据预处理功能
"""

from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
import logging
from dataclasses import dataclass

from scipy import stats

from .variable_analyzer import VariableAnalyzer
from .normality_tester import NormalityTester
from .descriptive_stats import DescriptiveStatsCalculator

logger = logging.getLogger(__name__)


@dataclass
class TransformationResult:
    """存储单个正态化变换的评估结果"""

    method: str
    display_name: str
    overall_is_normal: Optional[bool]
    tests: List[Dict[str, Any]]
    sample_size: int
    parameters: Dict[str, Any]
    note: Optional[str] = None


class DataPreprocessingFactory:
    """数据预处理工厂类"""
    
    def __init__(self):
        self.logger = logger
        self.variable_analyzer = VariableAnalyzer()
        self.normality_tester = NormalityTester()
        self.descriptive_calculator = DescriptiveStatsCalculator()
    
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
        else:
            return obj
    
    def analyze_variables(self, df: pd.DataFrame, variable_names: List[str]) -> Dict[str, Any]:
        """
        分析多个变量
        
        Args:
            df: 数据框
            variable_names: 变量名列表
            
        Returns:
            分析结果
        """
        try:
            results = []
            
            for var_name in variable_names:
                if var_name not in df.columns:
                    self.logger.warning(f"变量 '{var_name}' 不存在于数据框中")
                    continue
                
                # 变量类型分析
                var_analysis = self.variable_analyzer.analyze_variable_type(df, var_name)
                
                series = df[var_name]

                # 正态性检验（仅定量变量）
                normality_result = None
                if var_analysis['data_type'] == 'quantitative':
                    normality_result = self.normality_tester.comprehensive_normality_test(series)
                
                # 描述性统计
                descriptive_stats = self.descriptive_calculator.calculate_comprehensive_stats(
                    series,
                    var_analysis['data_type']
                )

                normalization_suggestions: List[TransformationResult] = []
                transformation_recommendation: Optional[str] = None

                if (
                    var_analysis['data_type'] == 'quantitative'
                    and normality_result
                    and normality_result.get('overall_is_normal') is False
                ):
                    normalization_suggestions = self._generate_normalization_suggestions(series)
                    transformation_recommendation = self._compose_transformation_recommendation(
                        normalization_suggestions
                    )
                
                # 生成分析建议
                recommendation = self.descriptive_calculator.generate_analysis_recommendation(
                    var_analysis['data_type'],
                    normality_result.get('overall_is_normal') if normality_result else None,
                    descriptive_stats,
                    transformation_recommendation=transformation_recommendation
                )
                
                # 获取原始数据（限制数量避免内存问题）
                raw_data = series.dropna().head(1000).tolist()
                
                # 整合结果
                result = {
                    'variable': var_name,
                    'variable_analysis': self._convert_numpy_types(var_analysis),
                    'normality_test': self._convert_numpy_types(normality_result) if normality_result else None,
                    'descriptive_stats': self._convert_numpy_types(descriptive_stats),
                    'recommendation': recommendation,
                    'is_normal': normality_result.get('overall_is_normal') if normality_result else None,
                    'raw_data': raw_data,
                    'normalization_suggestions': [
                        {
                            'method': suggestion.method,
                            'display_name': suggestion.display_name,
                            'overall_is_normal': suggestion.overall_is_normal,
                            'sample_size': suggestion.sample_size,
                            'tests': self._convert_numpy_types(suggestion.tests),
                            'parameters': self._convert_numpy_types(suggestion.parameters),
                            'note': suggestion.note,
                        }
                        for suggestion in normalization_suggestions
                    ] if normalization_suggestions else []
                }
                
                results.append(result)
            
            return {
                'success': True,
                'results': results,
                'total_variables': len(variable_names),
                'analyzed_variables': len(results)
            }
            
        except Exception as e:
            self.logger.error(f"分析变量时出错: {e}")
            return {
                'success': False,
                'error': str(e),
                'results': []
            }
    
    def get_variable_info(self, df: pd.DataFrame, dataset_id: int) -> Dict[str, Any]:
        """
        获取数据集变量信息
        
        Args:
            df: 数据框
            dataset_id: 数据集ID
            
        Returns:
            变量信息
        """
        try:
            # 获取所有数值型和分类型列
            numeric_columns = df.select_dtypes(include=['number']).columns.tolist()
            categorical_columns = df.select_dtypes(include=['object', 'category']).columns.tolist()
            
            # 分析所有列
            all_columns = list(df.columns)
            column_analysis = []
            
            for col_name in all_columns:
                try:
                    analysis = self.variable_analyzer.analyze_variable_type(df, col_name)
                    column_analysis.append({
                        'name': col_name,
                        'is_numeric': analysis['is_numeric'],
                        'is_categorical': analysis['is_categorical'],
                        'data_type': analysis['data_type'],
                        'unique_count': analysis['unique_count'],
                        'null_count': analysis['null_count'],
                        'null_ratio': analysis['null_ratio']
                    })
                except Exception as e:
                    self.logger.warning(f"分析列 '{col_name}' 时出错: {e}")
                    column_analysis.append({
                        'name': col_name,
                        'is_numeric': False,
                        'is_categorical': False,
                        'data_type': 'unknown',
                        'unique_count': 0,
                        'null_count': 0,
                        'null_ratio': 0,
                        'error': str(e)
                    })
            
            return {
                'success': True,
                'dataset_id': dataset_id,
                'total_columns': len(all_columns),
                'numeric_columns': numeric_columns,
                'categorical_columns': categorical_columns,
                'columns': column_analysis
            }
            
        except Exception as e:
            self.logger.error(f"获取变量信息时出错: {e}")
            return {
                'success': False,
                'error': str(e),
                'dataset_id': dataset_id
            }
    
    def perform_normality_test(
        self,
        df: pd.DataFrame,
        variable_name: str,
        transformation: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        执行正态性检验
        
        Args:
            df: 数据框
            variable_name: 变量名
            
        Returns:
            正态性检验结果
        """
        try:
            if variable_name not in df.columns:
                return {
                    'success': False,
                    'error': f"变量 '{variable_name}' 不存在"
                }
            
            # 检查是否为定量变量
            var_analysis = self.variable_analyzer.analyze_variable_type(df, variable_name)
            if var_analysis['data_type'] != 'quantitative':
                return {
                    'success': False,
                    'error': f"变量 '{variable_name}' 不是定量变量，无法进行正态性检验"
                }
            
            data_series = df[variable_name]

            if transformation:
                transformed, note, params = self.apply_transformation(data_series, transformation)
                if transformed is None:
                    return {
                        'success': False,
                        'error': note or f"无法应用变换 '{transformation}'"
                    }
                normality_result = self.normality_tester.comprehensive_normality_test(transformed)
                normality_result['transformation'] = transformation
                if params:
                    normality_result['transformation_parameters'] = params
                if note:
                    normality_result['transformation_note'] = note
            else:
                # 执行正态性检验
                normality_result = self.normality_tester.comprehensive_normality_test(data_series)

            normality_result = self._convert_numpy_types(normality_result)
            
            return {
                'success': True,
                'variable': variable_name,
                'normality_test': normality_result
            }
            
        except Exception as e:
            self.logger.error(f"正态性检验时出错: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_descriptive_stats(self, df: pd.DataFrame, variable_name: str) -> Dict[str, Any]:
        """
        获取描述性统计
        
        Args:
            df: 数据框
            variable_name: 变量名
            
        Returns:
            描述性统计结果
        """
        try:
            if variable_name not in df.columns:
                return {
                    'success': False,
                    'error': f"变量 '{variable_name}' 不存在"
                }
            
            # 分析变量类型
            var_analysis = self.variable_analyzer.analyze_variable_type(df, variable_name)
            
            # 计算描述性统计
            descriptive_stats = self.descriptive_calculator.calculate_comprehensive_stats(
                df[variable_name], 
                var_analysis['data_type']
            )
            
            return {
                'success': True,
                'variable': variable_name,
                'data_type': var_analysis['data_type'],
                'descriptive_stats': descriptive_stats
            }
            
        except Exception as e:
            self.logger.error(f"获取描述性统计时出错: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_frequency_analysis(self, df: pd.DataFrame, variable_name: str) -> Dict[str, Any]:
        """
        获取频数分析
        
        Args:
            df: 数据框
            variable_name: 变量名
            
        Returns:
            频数分析结果
        """
        try:
            if variable_name not in df.columns:
                return {
                    'success': False,
                    'error': f"变量 '{variable_name}' 不存在"
                }
            
            # 分析变量类型
            var_analysis = self.variable_analyzer.analyze_variable_type(df, variable_name)
            
            if var_analysis['data_type'] != 'qualitative':
                return {
                    'success': False,
                    'error': f"变量 '{variable_name}' 不是定性变量，无法进行频数分析"
                }
            
            # 计算频数统计
            descriptive_stats = self.descriptive_calculator.calculate_qualitative_stats(df[variable_name])
            
            return {
                'success': True,
                'variable': variable_name,
                'frequency_analysis': descriptive_stats
            }
            
        except Exception as e:
            self.logger.error(f"频数分析时出错: {e}")
            return {
                'success': False,
                'error': str(e)
            }

    # -------------------- 正态化处理辅助方法 --------------------

    def _generate_normalization_suggestions(self, series: pd.Series) -> List[TransformationResult]:
        """针对非正态分布的定量变量生成常用正态化处理建议"""
        suggestions: List[TransformationResult] = []

        clean_series = series.dropna()
        if clean_series.empty:
            return suggestions

        candidates = [
            ('log', '对数变换 log(x)', self._transform_log),
            ('sqrt', '平方根变换 sqrt(x)', self._transform_sqrt),
            ('box_cox', 'Box-Cox 变换', self._transform_boxcox),
            ('yeo_johnson', 'Yeo-Johnson 变换', self._transform_yeojohnson),
        ]

        for method, display_name, handler in candidates:
            try:
                transformed, note, params = handler(clean_series)
            except Exception as exc:  # 捕获意外错误
                self.logger.warning(f"应用变换 {method} 时出错: {exc}")
                transformed, note, params = None, f"变换失败：{exc}", {}

            if transformed is None:
                suggestions.append(
                    TransformationResult(
                        method=method,
                        display_name=display_name,
                        overall_is_normal=None,
                        tests=[],
                        sample_size=0,
                        parameters=params,
                        note=note,
                    )
                )
                continue

            normality = self.normality_tester.comprehensive_normality_test(transformed)
            suggestions.append(
                TransformationResult(
                    method=method,
                    display_name=display_name,
                    overall_is_normal=normality.get('overall_is_normal'),
                    tests=normality.get('tests', []),
                    sample_size=normality.get('sample_size', len(transformed)),
                    parameters=params,
                    note=note,
                )
            )

        return suggestions

    def _transform_log(self, series: pd.Series):
        if (series <= 0).any():
            return None, '存在非正值，无法进行对数变换', {}
        transformed = np.log(series)
        return transformed, None, {}

    def _transform_sqrt(self, series: pd.Series):
        if (series < 0).any():
            return None, '存在负值，无法进行平方根变换', {}
        transformed = np.sqrt(series)
        return transformed, None, {}

    def _transform_boxcox(self, series: pd.Series):
        if (series <= 0).any():
            return None, 'Box-Cox 变换要求所有值 > 0', {}
        transformed_values, fitted_lambda = stats.boxcox(series)
        transformed = pd.Series(transformed_values, index=series.index)
        return transformed, None, {'lambda': float(fitted_lambda)}

    def _transform_yeojohnson(self, series: pd.Series):
        transformed_values, fitted_lambda = stats.yeojohnson(series)
        transformed = pd.Series(transformed_values, index=series.index)
        return transformed, None, {'lambda': float(fitted_lambda)}

    def apply_transformation(
        self,
        series: pd.Series,
        method: str,
    ) -> (Optional[pd.Series], Optional[str], Dict[str, Any]):
        """应用指定方法进行正态化变换，供单次重检使用"""
        method = method.lower()
        clean_series = series.dropna()

        if clean_series.empty:
            return None, '数据为空，无法应用变换', {}

        if method == 'log':
            return self._transform_log(clean_series)
        if method == 'sqrt':
            return self._transform_sqrt(clean_series)
        if method == 'box_cox':
            return self._transform_boxcox(clean_series)
        if method == 'yeo_johnson':
            return self._transform_yeojohnson(clean_series)

        return None, f"未知的变换方法: {method}", {}

    def _compose_transformation_recommendation(
        self,
        suggestions: List[TransformationResult]
    ) -> Optional[str]:
        """结合各变换的评估结果，生成额外说明"""
        if not suggestions:
            return None

        successful = [s for s in suggestions if s.overall_is_normal is True]
        if successful:
            names = ', '.join(s.display_name for s in successful)
            return f"建议尝试 {names}，变换后正态性检验通过。"

        improved = [
            s for s in suggestions
            if s.overall_is_normal is True
            or any(test.get('is_normal') for test in s.tests if isinstance(test, dict))
        ]
        if improved:
            names = ', '.join(s.display_name for s in improved)
            return f"可尝试 {names}，部分检验有改善，仍需结合业务判断。"

        return '常见变换后仍未达到正态分布，建议考虑稳健统计或非参数方法。'
