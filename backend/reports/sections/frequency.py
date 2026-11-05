from __future__ import annotations

from typing import Dict, List

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Analysis


from .base import SectionBuilder, metric
from .factory import register_handler
from ..data import AnalysisSection


class FrequencySectionBuilder(SectionBuilder):
    def build(self) -> List[AnalysisSection]:
        sections: List[AnalysisSection] = []
        results = self.results or {}
        if not isinstance(results, dict):
            return sections

        method_text = "分类变量各水平的数量分布，衡量样本结构及缺失情况。"

        for variable, payload in results.items():
            if not isinstance(payload, dict):
                continue
            section = self.header(
                f"{variable} 的频数分析",
                section_type="frequency",
                method=method_text,
            )
            summary = (payload or {}).get("summary", {})
            metrics = []
            if summary:
                metrics.append(metric("有效样本", str(summary.get("valid", 0))))
                metrics.append(metric("缺失", str(summary.get("missing", 0)), interpretation="建议评估缺失机制" if summary.get("missing", 0) else None))
                metrics.append(metric("总计", str(summary.get("total", 0))))
            section.metrics = metrics

            levels = payload.get("levels") or []
            if levels:
                headers = ["取值", "计数", "百分比(%)", "有效%", "累计有效%"]
                rows = [
                    [
                        str(level.get("value")),
                        str(level.get("count", 0)),
                        f"{level.get('percent', 0):.2f}",
                        f"{level.get('valid_percent', 0):.2f}",
                        f"{level.get('cumulative_valid_percent', 0):.2f}",
                    ]
                    for level in levels
                ]
                section.tables.append({"headers": headers, "rows": rows})

                top_level = max(levels, key=lambda item: item.get("count", 0))
                level_name = str(top_level.get("value"))
                count = int(top_level.get("count", 0))
                percent = top_level.get("percent")
                percent_text = f"，占 {percent:.2f}%" if percent is not None else ""
                section.conclusion = f"'{level_name}' 为最常见水平，共 {count} 例{percent_text}。"
            sections.append(section)
        return sections


@register_handler("frequency")
def build_frequency(analysis: 'Analysis', parameters: Dict, results: Dict) -> List[AnalysisSection]:
    return FrequencySectionBuilder(analysis, parameters, results).build()
