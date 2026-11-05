from __future__ import annotations

from typing import Dict, List

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Analysis


from .base import SectionBuilder, metric
from .factory import register_handler
from ..data import AnalysisSection
from ..utils import format_p_value, significance_marker


class DescriptiveSectionBuilder(SectionBuilder):
    def build(self) -> List[AnalysisSection]:
        sections: List[AnalysisSection] = []
        results = self.results or {}
        if not isinstance(results, dict):
            return sections

        method_text = "变量分布、集中趋势与离散程度，用于把握总体特征。"

        for variable, payload in results.items():
            if not isinstance(payload, dict):
                continue
            
            # 处理分组统计（explore类型）
            if payload.get("type") == "numeric_grouped" and "grouped_stats" in payload:
                section = self.header(
                    f"{variable}",
                    section_type="descriptive",
                    method="按分组变量进行的描述性统计分析",
                )
                
                grouped_stats = payload.get("grouped_stats", {})
                group_var = payload.get("group_by", "分组")
                
                # 构建分组统计表格
                if grouped_stats:
                    headers = ["分组", "样本量", "均值", "标准差", "中位数", "最小值", "最大值"]
                    rows = []
                    for group_name, stats in grouped_stats.items():
                        row = [
                            f"{group_var}={group_name}",
                            str(int(stats.get("count", 0))),
                            f"{stats.get('mean', 0):.3f}",
                            f"{stats.get('std', 0):.3f}",
                            f"{stats.get('median', 0):.3f}",
                            f"{stats.get('min', 0):.3f}",
                            f"{stats.get('max', 0):.3f}",
                        ]
                        rows.append(row)
                    section.tables.append({"headers": headers, "rows": rows})
                    
                    # 添加总结
                    total_n = sum(int(s.get("count", 0)) for s in grouped_stats.values())
                    section.conclusion = f"共分析 {total_n} 例样本，按 {group_var} 分为 {len(grouped_stats)} 组进行比较。"
                
                sections.append(section)
                continue
            
            # 处理普通描述性统计
            section = self.header(
                f"{variable} 的描述性统计",
                section_type="descriptive",
                method=method_text,
            )
            descriptive = payload.get("descriptive") or payload.get("overall") or payload
            if not descriptive:
                continue

            metrics = []
            if descriptive.get("mean") is not None:
                metrics.append(metric("均值", f"{descriptive['mean']:.2f}"))
            if descriptive.get("median") is not None:
                metrics.append(metric("中位数", f"{descriptive['median']:.2f}"))
            if descriptive.get("std") is not None:
                metrics.append(metric("标准差", f"{descriptive['std']:.2f}"))
            if descriptive.get("min") is not None and descriptive.get("max") is not None:
                metrics.append(metric("取值范围", f"{descriptive['min']:.2f} – {descriptive['max']:.2f}"))
            section.metrics = metrics

            count = descriptive.get("count") or descriptive.get("sample_size")
            summary_parts = []
            if count:
                summary_parts.append(f"样本量 {int(count)}")
            if descriptive.get("mean") is not None:
                summary_parts.append(f"均值 {descriptive['mean']:.2f}")
            if descriptive.get("std") is not None:
                summary_parts.append(f"标准差 {descriptive['std']:.2f}")
            if descriptive.get("median") is not None:
                summary_parts.append(f"中位数 {descriptive['median']:.2f}")
            if summary_parts:
                section.conclusion = "，".join(summary_parts) + "。"

            diagnostics = payload.get("diagnostics", {})
            normality = diagnostics.get("normality")
            if normality and normality.get("p_value") is not None:
                p_value = normality["p_value"]
                marker = significance_marker(p_value)
                section.interpretation = (
                    f"正态性检验 p = {format_p_value(p_value)} {marker}。"
                    f"{'数据分布接近正态' if p_value >= 0.05 else '数值分布偏离正态，应采用稳健统计或转换处理。'}"
                )
            sections.append(section)
        return sections


@register_handler("descriptive")
@register_handler("explore")
@register_handler("pp_plot")
def build_descriptive(analysis: 'Analysis', parameters: Dict, results: Dict) -> List[AnalysisSection]:
    return DescriptiveSectionBuilder(analysis, parameters, results).build()
