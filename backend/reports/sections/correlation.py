from __future__ import annotations

from typing import Dict, List

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Analysis


from .base import SectionBuilder, metric
from .factory import register_handler
from ..data import AnalysisSection
from ..utils import format_p_value, significance_marker, interpret_correlation


class CorrelationSectionBuilder(SectionBuilder):
    def build(self) -> List[AnalysisSection]:
        sections: List[AnalysisSection] = []
        correlations = self.results.get("correlations") or {}
        if not correlations:
            return sections
        if not isinstance(correlations, dict):
            return sections

        section = self.header(
            "相关性分析",
            section_type="correlation",
            method="衡量连续变量之间的关联强度，辅助变量筛选与多重共线性判断。",
        )
        
        # 计算样本量（如果有）
        sample_size = None
        for pair, stats in correlations.items():
            pearson = stats.get("pearson", {})
            n = pearson.get("n")
            if n:
                sample_size = n
                break
        
        # 添加样本量指标
        if sample_size:
            section.metrics.append(metric("分析样本量", str(sample_size)))
        
        top_pairs = []
        for pair, stats in correlations.items():
            pearson = stats.get("pearson", {})
            r = pearson.get("r")
            p = pearson.get("p")
            if r is None:
                continue
            marker = significance_marker(p)
            # 使用新的解释函数
            strength_interp = interpret_correlation(r)
            top_pairs.append((abs(r), pair, r, p, strength_interp, marker))

        top_pairs.sort(reverse=True)
        highlights = top_pairs[:3]
        
        # 添加前3对相关性最强的变量作为关键指标
        for _, pair, r, p, interp, marker in highlights:
            direction = "正相关" if r > 0 else "负相关"
            section.metrics.append(
                metric(
                    pair.replace("_vs_", " vs "),
                    f"r = {r:.3f} (p={format_p_value(p)}) {marker}".strip(),
                    interpretation=f"{direction}，{interp}",
                    emphasize=p is not None and p < 0.05,
                )
            )
        
        # 添加完整的相关性矩阵表格
        if len(top_pairs) > 3:
            headers = ["变量对", "相关系数(r)", "P值", "方向", "强度", "显著性"]
            rows = []
            for abs_r, pair, r, p, interp, marker in top_pairs:
                direction = "正相关" if r > 0 else "负相关"
                sig_text = "显著" if p is not None and p < 0.05 else ""
                rows.append([
                    pair.replace("_vs_", " vs "),
                    f"{r:.3f}",
                    format_p_value(p),
                    direction,
                    interp,
                    sig_text + (" " + marker if marker else "")
                ])
            section.tables.append({"headers": headers, "rows": rows})
        
        if highlights:
            _, pair, r, p, interp, marker = highlights[0]
            relation = pair.replace("_vs_", " 与 ")
            direction = "正相关" if r > 0 else "负相关"
            significance = "统计显著" if p is not None and p < 0.05 else "无显著性"
            section.conclusion = f"{relation} 呈{direction}（r={r:.3f}，p={format_p_value(p)}），关联强度为{interp}，{significance}。"
            
            # 多重共线性警告
            if abs(r) > 0.7 and p is not None and p < 0.05:
                section.warnings.append(
                    f"{relation} 相关系数较高（|r|={abs(r):.2f}），回归分析时需注意多重共线性问题"
                )
        
        # 添加整体解释
        strong_correlations = [p for abs_r, p, *_ in top_pairs if abs_r > 0.5]
        if len(strong_correlations) > 3:
            section.interpretation = f"发现 {len(strong_correlations)} 对变量存在中等以上强度相关，建议在多变量分析时评估共线性。"
        
        sections.append(section)
        return sections


@register_handler("correlation")
def build_correlation(analysis: 'Analysis', parameters: Dict, results: Dict) -> List[AnalysisSection]:
    return CorrelationSectionBuilder(analysis, parameters, results).build()
