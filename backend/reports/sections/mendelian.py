from __future__ import annotations

from typing import Dict, List

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Analysis


from .base import SectionBuilder, metric
from .factory import register_handler
from ..data import AnalysisSection


class MendelianSectionBuilder(SectionBuilder):
    def build(self) -> List[AnalysisSection]:
        if not isinstance(self.results, dict):
            return []
        section = self.header(
            "孟德尔随机化分析",
            section_type="mendelian_randomization",
            method="基于遗传工具变量推断暴露与结局的因果效应。",
        )
        results = self.results or {}
        ivw = results.get("ivw") or {}
        if ivw:
            beta = ivw.get("beta")
            ci = ivw.get("ci")
            if beta is not None:
                ci_text = f"[{ci[0]:.2f}, {ci[1]:.2f}]" if ci else "--"
                section.metrics.append(metric("IVW 效应", f"{beta:.2f}", interpretation=f"95% CI {ci_text}", emphasize=True))
        egger = results.get("egger") or {}
        if egger:
            intercept = egger.get("intercept")
            slope = egger.get("slope")
            if intercept is not None:
                section.metrics.append(metric("Egger 截距", f"{intercept:.2f}"))
            if slope is not None:
                section.metrics.append(metric("Egger 斜率", f"{slope:.2f}"))
        if section.metrics:
            primary = section.metrics[0]
            try:
                effect_value = float(primary.value)
            except (TypeError, ValueError):
                effect_value = None
            if effect_value is not None:
                direction = "正向" if effect_value >= 0 else "负向"
                section.conclusion = f"MR 结果提示总体效应为 {effect_value:.2f}，呈{direction}关系。"
        return [section]


@register_handler("mendelian_randomization")
def build_mendelian(analysis: 'Analysis', parameters: Dict, results: Dict) -> List[AnalysisSection]:
    return MendelianSectionBuilder(analysis, parameters, results).build()
