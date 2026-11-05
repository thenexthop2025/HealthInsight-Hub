from __future__ import annotations

from typing import Dict, List

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Analysis


from .base import SectionBuilder, metric
from .factory import register_handler
from ..data import AnalysisSection
from ..utils import interpret_heterogeneity_i2, interpret_odds_ratio, format_ci


class StratifiedSectionBuilder(SectionBuilder):
    def build(self) -> List[AnalysisSection]:
        if not isinstance(self.results, dict):
            return []
        section = self.header(
            "分层分析",
            section_type="stratified",
            method="分层分析控制混杂因素，汇总各层效应并评估异质性。",
        )
        results = self.results or {}
        
        # 总体效应
        overall = results.get("overall") or results.get("overall_fixed") or {}
        if overall:
            measure = overall.get("measure", "OR")
            effect = overall.get("effect")
            ci = overall.get("ci")
            
            if effect is not None and ci:
                ci_text, ci_interp = format_ci(ci[0], ci[1], crosses_null=1.0)
                
                # 添加临床解释
                clinical_interp = ""
                if measure == "OR" and effect is not None:
                    clinical_interp = interpret_odds_ratio(effect)
                
                section.metrics.append(
                    metric(
                        f"总体{measure}", 
                        f"{effect:.2f}", 
                        interpretation=f"{ci_text}，{ci_interp}"
                    )
                )
                
                if clinical_interp:
                    section.metrics.append(
                        metric("临床意义", clinical_interp)
                    )
        
        # 异质性评估
        heterogeneity = results.get("heterogeneity")
        if heterogeneity:
            i2 = heterogeneity.get('I2', 0)
            i2_interp = interpret_heterogeneity_i2(i2)
            q_p = heterogeneity.get('p_value', 0)
            
            section.metrics.append(metric("I²", f"{i2:.1f}%", interpretation=i2_interp))
            section.metrics.append(metric("Q检验 p", f"{q_p:.3f}"))
            
            # 异质性解释
            if i2 >= 50:
                section.interpretation = (
                    f"各层间存在{i2_interp}（I²={i2:.1f}%），提示效应估计在不同分层间差异较大，"
                    "需谨慎解释总体效应，建议探索异质性来源。"
                )
            elif i2 >= 25:
                section.interpretation = f"各层间异质性处于中等水平（I²={i2:.1f}%），总体效应估计具有一定稳健性。"
            else:
                section.interpretation = f"各层间异质性较低（I²={i2:.1f}%），总体效应估计较为稳健。"
        
        # 分层详情表
        strata = results.get("strata") or []
        if strata:
            headers = ["分层", "效应值", "95% CI 下限", "95% CI 上限", "样本量"]
            rows = []
            for s in strata:
                effect = s.get('effect') or 0
                ci = s.get('ci') or [0, 0]
                n = s.get('n', '--')
                rows.append([
                    s.get("stratum", "--"), 
                    f"{effect:.2f}", 
                    f"{ci[0]:.2f}", 
                    f"{ci[1]:.2f}",
                    str(n) if n != '--' else '--'
                ])
            section.tables.append({"headers": headers, "rows": rows})
        
        # 总结
        if overall and overall.get("effect") is not None:
            effect_val = overall.get("effect")
            measure = overall.get("measure", "OR")
            ci = overall.get("ci")
            
            ci_contains_null = ci and ci[0] <= 1.0 <= ci[1] if measure == "OR" else False
            
            if ci_contains_null:
                section.conclusion = (
                    f"分层汇总的总体{measure}为{effect_val:.2f}，"
                    f"但95% CI包含无效值1.0，结果不确定。"
                )
            else:
                direction = "保护性" if effect_val < 1 else "危险性"
                section.conclusion = (
                    f"分层汇总的总体{measure}为{effect_val:.2f}（95% CI [{ci[0]:.2f}, {ci[1]:.2f}]），"
                    f"提示{direction}效应。"
                )
                
                if measure == "OR":
                    or_interp = interpret_odds_ratio(effect_val)
                    section.conclusion += f"临床意义为{or_interp}。"
        
        # 分层数量警告
        if len(strata) < 2:
            section.warnings.append("分层数量过少（<2层），可能无法充分控制混杂因素")
        elif len(strata) > 10:
            section.warnings.append("分层数量较多（>10层），部分层样本量可能不足，需注意估计精度")
        
        return [section]


@register_handler("stratified")
def build_stratified(analysis: 'Analysis', parameters: Dict, results: Dict) -> List[AnalysisSection]:
    return StratifiedSectionBuilder(analysis, parameters, results).build()
