from __future__ import annotations

from typing import Dict, List

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Analysis


from .base import SectionBuilder, metric, tidy_p_value
from .factory import register_handler
from ..data import AnalysisSection
from ..utils import (
    interpret_r_squared, 
    interpret_odds_ratio, 
    calculate_sample_size_adequacy,
    format_ci
)
import math


class RegressionSectionBuilder(SectionBuilder):
    def build(self) -> List[AnalysisSection]:
        is_logistic = "logistic" in self.analysis.analysis_type.lower()
        is_linear = "linear" in self.analysis.analysis_type.lower()
        
        section = self.header(
            "回归分析",
            section_type=self.analysis.analysis_type,
            method="回归模型量化变量对结局的影响，并输出模型性能与诊断信息。",
        )
        
        # 样本量信息
        model_perf = self.results.get("model_performance") or self.results.get("model_summary")
        sample_size = model_perf.get("sample_size") if model_perf else None
        if not sample_size:
            # 尝试从参数中获取
            sample_size = self.parameters.get("sample_size")
        
        metrics = []
        
        # 添加样本量信息
        if sample_size:
            metrics.append(metric("样本量", str(sample_size)))
        
        if model_perf:
            # R² 和解释
            if "r_squared" in model_perf:
                r2 = model_perf['r_squared']
                r2_interp = interpret_r_squared(r2)
                metrics.append(metric("R²", f"{r2:.3f}", interpretation=r2_interp))
            if "adj_r_squared" in model_perf:
                metrics.append(metric("调整R²", f"{model_perf['adj_r_squared']:.3f}"))
            
            # 分类模型的性能指标
            if "accuracy" in model_perf:
                metrics.append(metric("准确率", f"{model_perf['accuracy']:.2%}"))
            if "auc" in model_perf and model_perf["auc"] is not None:
                auc = model_perf["auc"]
                auc_interp = "判别优秀" if auc > 0.8 else "判别良好" if auc > 0.7 else "判别一般"
                metrics.append(metric("AUC", f"{auc:.3f}", interpretation=auc_interp))
        
        section.metrics = metrics

        # 处理系数表
        coefficients = self.results.get("coefficients")
        if isinstance(coefficients, list):
            # 确定是否需要OR列
            if is_logistic:
                headers = ["变量", "系数(β)", "OR值", "95% CI", "P值", "临床意义"]
            else:
                headers = ["变量", "系数(β)", "标准误", "P值", "显著性"]
            
            rows = []
            significant_terms = []
            var_count = 0
            
            for coef in coefficients:
                var = coef.get("variable")
                if not var or var.lower().startswith("intercept") or var.lower() == "const":
                    continue
                
                var_count += 1
                value = coef.get("coefficient")
                p_value = coef.get("p_value")
                
                if is_logistic and value is not None:
                    # 逻辑回归：计算OR和解释
                    or_value = math.exp(value)
                    ci_lower = coef.get("conf_low", math.exp(value - 1.96 * coef.get("std_err", 0.5)))
                    ci_upper = coef.get("conf_high", math.exp(value + 1.96 * coef.get("std_err", 0.5)))
                    
                    ci_text, ci_interp = format_ci(ci_lower, ci_upper, crosses_null=1.0)
                    or_interp = interpret_odds_ratio(or_value)
                    
                    row = [
                        var,
                        f"{value:.3f}",
                        f"{or_value:.2f}",
                        ci_text.replace("95% CI ", ""),
                        tidy_p_value("p", p_value).value,
                        or_interp if p_value < 0.05 else "--"
                    ]
                    
                    if p_value is not None and p_value < 0.05:
                        direction = "保护性" if or_value < 1 else "危险性"
                        significant_terms.append(f"{var}（{direction}因素，OR={or_value:.2f}）")
                else:
                    # 线性回归
                    std_err = coef.get("std_err", 0)
                    row = [
                        var,
                        f"{value:.3f}" if isinstance(value, (int, float)) else str(value),
                        f"{std_err:.3f}" if std_err else "--",
                        tidy_p_value("p", p_value).value,
                        "显著" if p_value is not None and p_value < 0.05 else "",
                    ]
                    
                    if p_value is not None and p_value < 0.05:
                        direction = "正向" if (value or 0) > 0 else "负向"
                        significant_terms.append(f"{var}（{direction}影响）")
                
                rows.append(row)
            
            if rows:
                section.tables.append({"headers": headers, "rows": rows})
            
            # 样本量充分性评估
            if sample_size and var_count > 0:
                outcome_type = "binary" if is_logistic else "continuous"
                adequacy = calculate_sample_size_adequacy(sample_size, var_count, outcome_type)
                if "偏小" in adequacy or "不稳定" in adequacy:
                    section.warnings.append(adequacy)
            
            # 结论
            if significant_terms:
                section.conclusion = "主要显著因素：" + "、".join(significant_terms) + "。"
            elif rows:
                section.conclusion = "模型未发现显著因素，建议增加样本量或调整变量选择。"
        
        # 添加模型整体评价
        if model_perf:
            interp_parts = []
            if "r_squared" in model_perf:
                interp_parts.append(f"模型拟合度{interpret_r_squared(model_perf['r_squared'])}")
            if "auc" in model_perf and model_perf["auc"] is not None:
                interp_parts.append(f"判别能力{('优秀' if model_perf['auc'] > 0.8 else '良好')}")
            if interp_parts and not section.interpretation:
                section.interpretation = "，".join(interp_parts) + "。"
        
        return [section]


@register_handler("linear_regression")
@register_handler("logistic_regression")
@register_handler("logistic_regression_multinomial")
@register_handler("logistic_regression_ordinal")
@register_handler("logistic_regression_conditional")
def build_regression(analysis: 'Analysis', parameters: Dict, results: Dict) -> List[AnalysisSection]:
    return RegressionSectionBuilder(analysis, parameters, results).build()
