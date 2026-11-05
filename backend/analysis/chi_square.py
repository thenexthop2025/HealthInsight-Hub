"""
卡方检验模块
"""

import pandas as pd
import numpy as np
from scipy.stats import chi2_contingency, fisher_exact, norm
from typing import Dict, Any
from .base import BaseAnalyzer, AnalysisError, validate_analysis_data


class ChiSquareAnalyzer(BaseAnalyzer):
    """卡方检验分析器"""
    
    @validate_analysis_data(min_samples=10, max_missing_ratio=0.3)
    def chi_square_test(self, row_variable: str, column_variable: str, stratify_by: str = None) -> Dict[str, Any]:
        """卡方检验"""
        try:
            self._validate_variables([row_variable, column_variable])
            
            # 检查变量是否为分类型
            if not self._is_categorical(self.data[row_variable]):
                raise AnalysisError(
                    f"行变量 '{row_variable}' 不是分类型变量",
                    "INVALID_VARIABLE_TYPE",
                    {"variable": row_variable, "expected_type": "categorical"}
                )
            
            if not self._is_categorical(self.data[column_variable]):
                raise AnalysisError(
                    f"列变量 '{column_variable}' 不是分类型变量",
                    "INVALID_VARIABLE_TYPE",
                    {"variable": column_variable, "expected_type": "categorical"}
                )
            
            # 若提供分层变量，执行 Mantel–Haenszel / 同质性判断
            if stratify_by and stratify_by in self.data.columns:
                strata = list(self.data[stratify_by].dropna().unique())
                strata_results = {}
                for s in strata:
                    df_s = self.data[self.data[stratify_by] == s]
                    ct = pd.crosstab(df_s[row_variable], df_s[column_variable])
                    if ct.shape == (2, 2) and not ct.empty:
                        # 分层 OR 与方差（Woolf）
                        a, b = ct.iloc[0,0], ct.iloc[0,1]
                        c, d = ct.iloc[1,0], ct.iloc[1,1]
                        aa, bb, cc, dd = float(a), float(b), float(c), float(d)
                        if min(aa, bb, cc, dd) == 0:
                            aa += 0.5; bb += 0.5; cc += 0.5; dd += 0.5
                        or_s = (aa*dd)/(bb*cc)
                        var_log_or = (1/aa + 1/bb + 1/cc + 1/dd)
                        strata_results[str(s)] = {'or': float(or_s), 'var_log_or': float(var_log_or), 'table': ct.to_dict()}
                # MH 合并OR
                mh_or = None
                mh_chi2 = None
                homogeneity_p = None
                if len(strata_results) >= 1:
                    try:
                        # Mantel–Haenszel 估计（近似）：加权求和法
                        num = 0.0; den = 0.0
                        for s in strata_results.values():
                            or_s = s['or']
                            var = s['var_log_or']
                            w = 1/var if var>0 else 0
                            num += w * np.log(or_s)
                            den += w
                        if den>0:
                            log_or = num/den
                            mh_or = float(np.exp(log_or))
                            mh_chi2 = float((log_or**2) * den)  # 近似检验
                            # 同质性（Breslow–Day 简化近似，不严格）：
                            # 这里简单返回 None，避免复杂实现
                            homogeneity_p = None
                    except Exception:
                        pass
                # 继续在整体数据上做常规卡方
            
            # 创建交叉表（整体）
            contingency_table = pd.crosstab(self.data[row_variable], self.data[column_variable])
            
            # 检查交叉表是否为空
            if contingency_table.empty:
                raise AnalysisError(
                    "交叉表为空，无法进行卡方检验",
                    "EMPTY_CONTINGENCY_TABLE"
                )
            
            # 检查期望频数是否满足要求
            chi2, p_value, dof, expected = chi2_contingency(contingency_table, correction=False)
            total_cells = int(expected.size)
            num_ge_5 = int((expected >= 5).sum())
            num_lt_5 = total_cells - num_ge_5
            num_lt_1 = int((expected < 1).sum())
            expected_freq_ratio = num_ge_5 / total_cells if total_cells else 0.0
            
            if expected_freq_ratio < 0.8:
                # 记录警告但不阻止分析
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(
                    f"期望频数警告: 只有 {expected_freq_ratio:.1%} 的单元格期望频数≥5，"
                    f"卡方检验结果可能不可靠"
                )
            
            # 计算标准化残差与调整标准化残差（Haberman）
            residuals = (contingency_table - expected) / np.sqrt(expected)
            # 调整标准化残差 z_adj = (O-E)/sqrt(E*(1-row_prop)*(1-col_prop))
            row_totals = contingency_table.sum(axis=1).values.reshape(-1, 1)
            col_totals = contingency_table.sum(axis=0).values.reshape(1, -1)
            n = contingency_table.values.sum()
            with np.errstate(divide='ignore', invalid='ignore'):
                denom = np.sqrt(expected * (1 - row_totals / n) * (1 - col_totals / n))
                adjusted_residuals_np = np.where(denom > 0, (contingency_table - expected) / denom, 0)
            adjusted_residuals = pd.DataFrame(adjusted_residuals_np, index=contingency_table.index, columns=contingency_table.columns)
            
            # 将期望频数转换为与交叉表相同的格式
            expected_df = pd.DataFrame(expected, 
                                     index=contingency_table.index, 
                                     columns=contingency_table.columns)
            
            # 计算Cramér's V（关联强度）
            n = contingency_table.sum().sum()
            cramers_v = np.sqrt(chi2 / (n * (min(contingency_table.shape) - 1)))
            
            # 计算列联系数
            contingency_coefficient = np.sqrt(chi2 / (chi2 + n))
            
            # 2x2 特殊处理：Fisher检验、Yates连续性校正、OR及95%CI
            fisher_res = None
            yates = None
            or_est = None
            or_ci = None
            if contingency_table.shape == (2, 2):
                a = contingency_table.iloc[0, 0]
                b = contingency_table.iloc[0, 1]
                c = contingency_table.iloc[1, 0]
                d = contingency_table.iloc[1, 1]
                try:
                    oddsratio_f, p_fisher = fisher_exact([[a, b], [c, d]])
                    fisher_res = {'odds_ratio': float(oddsratio_f), 'p_value': float(p_fisher)}
                except Exception:
                    fisher_res = None
                try:
                    chi2_y, p_y, _, _ = chi2_contingency(contingency_table, correction=True)
                    yates = {'chi_square': float(chi2_y), 'p_value': float(p_y)}
                except Exception:
                    yates = None
                # OR 与 95%CI（Woolf 方法，Haldane-Anscombe 0.5校正）
                aa, bb, cc, dd = float(a), float(b), float(c), float(d)
                if min(aa, bb, cc, dd) == 0:
                    aa += 0.5; bb += 0.5; cc += 0.5; dd += 0.5
                try:
                    or_est = (aa * dd) / (bb * cc)
                    se = np.sqrt(1/aa + 1/bb + 1/cc + 1/dd)
                    z = 1.96
                    lo = np.exp(np.log(or_est) - z * se)
                    hi = np.exp(np.log(or_est) + z * se)
                    or_ci = {'odds_ratio': float(or_est), 'ci_95': [float(lo), float(hi)], 'method': 'Woolf'}
                except Exception:
                    or_ci = None

            # 单元格事后检验：基于调整残差的双侧p值，Holm校正
            try:
                z_vals = adjusted_residuals.values.flatten()
                raw_p = 2 * (1 - norm.cdf(np.abs(z_vals)))
                m = len(raw_p)
                order = np.argsort(raw_p)
                holm = np.empty_like(raw_p)
                prev = 0.0
                for rank, idx in enumerate(order, start=1):
                    holm[idx] = min(1.0, (m - rank + 1) * raw_p[idx])
                    prev = max(prev, holm[idx])
                # 组装为字典结构
                p_raw_df = pd.DataFrame(z_vals.reshape(adjusted_residuals.shape), index=adjusted_residuals.index, columns=adjusted_residuals.columns)
                p_raw_df = p_raw_df.applymap(lambda z: float(2 * (1 - norm.cdf(abs(z)))))
                p_holm_df = pd.DataFrame(holm.reshape(adjusted_residuals.shape), index=adjusted_residuals.index, columns=adjusted_residuals.columns)
                post_hoc = {
                    'cell_p_value': p_raw_df.to_dict(),
                    'cell_p_value_holm': p_holm_df.to_dict()
                }
            except Exception:
                post_hoc = None

            result = {
                'row_variable': row_variable,
                'column_variable': column_variable,
                'contingency_table': contingency_table.to_dict(),
                'expected': expected_df.to_dict(),
                'expected_frequencies': expected.tolist(),  # 保持向后兼容
                'residuals': residuals.to_dict(),
                'adjusted_residuals': adjusted_residuals.to_dict(),
                'chi_square_statistic': float(chi2),
                'p_value': float(p_value),
                'degrees_of_freedom': int(dof),
                'cramers_v': float(cramers_v),
                'contingency_coefficient': float(contingency_coefficient),
                'sample_size': int(n),
                'is_significant': bool(p_value < 0.05),
                'interpretation': self._interpret_chi_square(chi2, p_value, cramers_v),
                'warnings': {
                    'expected_freq_ratio_ge_5': float(expected_freq_ratio),
                    'num_cells_lt_5': int(num_lt_5),
                    'num_cells_lt_1': int(num_lt_1),
                    'total_cells': int(total_cells)
                },
                'fisher_exact': fisher_res,
                'yates_correction': yates,
                'odds_ratio_ci': or_ci,
                'post_hoc': post_hoc,
                'mantel_haenszel': {
                    'common_or': mh_or,
                    'chi_square': mh_chi2,
                    'homogeneity_p': homogeneity_p,
                    'strata': strata_results if stratify_by else None,
                    'stratify_by': stratify_by,
                } if stratify_by else None,
            }
            
            # 验证结果
            if not self._validate_analysis_result(result):
                raise AnalysisError("分析结果验证失败", "RESULT_VALIDATION_ERROR")
            
            return result
            
        except AnalysisError:
            raise
        except Exception as e:
            raise AnalysisError(
                f"卡方检验执行失败: {str(e)}",
                "CHI_SQUARE_EXECUTION_ERROR",
                {"original_error": str(e)}
            )
    
    def _interpret_chi_square(self, chi2: float, p_value: float, cramers_v: float) -> Dict[str, Any]:
        """解释卡方检验结果"""
        # 显著性解释
        if p_value < 0.001:
            significance = "极显著 (p < 0.001)"
        elif p_value < 0.01:
            significance = "高度显著 (p < 0.01)"
        elif p_value < 0.05:
            significance = "显著 (p < 0.05)"
        else:
            significance = "不显著 (p ≥ 0.05)"
        
        # 效应量解释
        if cramers_v < 0.1:
            effect_size = "无关联或关联很弱"
        elif cramers_v < 0.3:
            effect_size = "弱关联"
        elif cramers_v < 0.5:
            effect_size = "中等关联"
        else:
            effect_size = "强关联"
        
        return {
            'significance': significance,
            'effect_size': effect_size,
            'cramers_v_interpretation': f"Cramér's V = {cramers_v:.3f} ({effect_size})"
        }
    
    def validate_parameters(self, analysis_type: str, **kwargs) -> None:
        """验证卡方检验参数"""
        if analysis_type == "chi_square":
            # 卡方检验需要行变量和列变量
            if not kwargs.get('row_variable'):
                raise ValueError("卡方检验需要行变量")
            if not kwargs.get('column_variable'):
                raise ValueError("卡方检验需要列变量")
        elif analysis_type == "crosstab":
            # 交叉表需要行变量和列变量
            if not kwargs.get('row_variable'):
                raise ValueError("交叉表分析需要行变量")
            if not kwargs.get('column_variable'):
                raise ValueError("交叉表分析需要列变量")
