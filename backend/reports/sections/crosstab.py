from __future__ import annotations

from typing import Dict, List

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Analysis


from .base import SectionBuilder, metric
from .factory import register_handler
from ..data import AnalysisSection
from ..utils import format_p_value, significance_marker


class CrosstabSectionBuilder(SectionBuilder):
    def build(self) -> List[AnalysisSection]:
        counts = self.results.get("counts")
        if not counts:
            return []
        if not isinstance(counts, dict):
            return []

        section = self.header(
            "交叉表分析",
            section_type="crosstab",
            method="列联表展示两个分类变量的联合分布，用于比较组间差异。",
        )
        chi_square = self.results.get("chi_square", {})
        p_value = None
        if chi_square:
            p_value = chi_square.get("p_value")
            if p_value is not None:
                marker = significance_marker(p_value)
                interpretation = "变量间存在显著关联" if p_value < 0.05 else "未观察到显著关联"
                section.metrics = [
                    metric("卡方统计量", f"{chi_square.get('chi2', 0):.2f}"),
                    metric("自由度", str(chi_square.get("degrees_of_freedom", 0))),
                    metric("P值", format_p_value(p_value) + (f" {marker}" if marker else ""), interpretation=interpretation, emphasize=p_value < 0.05),
                ]
        columns = list(next(iter(counts.values())).keys())
        headers = [" "] + columns
        rows = []
        for row_label, row_values in counts.items():
            rows.append([row_label] + [str(row_values.get(col, 0)) for col in columns])
        section.tables.append({"headers": headers, "rows": rows})

        if p_value is not None:
            significance = "存在显著关联" if p_value < 0.05 else "未见显著关联"
            section.conclusion = f"交叉表检验结果显示两变量之间{significance}。"
        return [section]


@register_handler("crosstab")
def build_crosstab(analysis: 'Analysis', parameters: Dict, results: Dict) -> List[AnalysisSection]:
    return CrosstabSectionBuilder(analysis, parameters, results).build()
