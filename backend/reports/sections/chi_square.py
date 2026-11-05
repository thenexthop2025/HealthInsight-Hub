from __future__ import annotations

from typing import Dict, List

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Analysis


from .base import SectionBuilder, metric, tidy_p_value
from .factory import register_handler
from ..data import AnalysisSection
from ..utils import interpret_cramers_v


class ChiSquareSectionBuilder(SectionBuilder):
    def build(self) -> List[AnalysisSection]:
        stats = self.results or {}
        if not isinstance(stats, dict):
            return []

        section = self.header(
            "卡方检验",
            section_type="chi_square",
            method="卡方检验检定分类变量之间的独立性，用于频数型数据的关联分析。",
        )
        
        metrics = []
        
        # 样本量
        sample_size = stats.get("sample_size") or stats.get("n")
        if sample_size:
            metrics.append(metric("样本量", str(sample_size)))
        
        # 卡方统计量
        if "chi_square_statistic" in stats:
            chi2 = stats['chi_square_statistic']
            metrics.append(metric("χ² 值", f"{chi2:.2f}"))
        
        # 自由度
        if "degrees_of_freedom" in stats:
            df = stats["degrees_of_freedom"]
            metrics.append(metric("自由度", str(df)))
        
        # P值
        if "p_value" in stats:
            metrics.append(tidy_p_value("P值", stats["p_value"]))
        
        # Cramér's V 和解释
        if "cramers_v" in stats:
            v = stats['cramers_v']
            v_interp = interpret_cramers_v(v)
            metrics.append(metric("Cramér's V", f"{v:.3f}", interpretation=v_interp))
        
        section.metrics = metrics
        
        # 结果解释
        p_value = stats.get("p_value")
        cramers_v = stats.get("cramers_v")
        
        if p_value is not None:
            if p_value < 0.05:
                strength_text = ""
                if cramers_v is not None:
                    strength_text = f"，关联强度为{interpret_cramers_v(cramers_v)}"
                section.conclusion = f"两变量之间存在统计学显著关联（p={p_value:.3f}）{strength_text}。"
                
                # 临床意义解释
                if cramers_v is not None:
                    if cramers_v < 0.1:
                        section.interpretation = "虽然差异具有统计学意义，但实际关联强度极弱，临床意义有限。"
                    elif cramers_v < 0.2:
                        section.interpretation = "差异具有统计学意义，但关联强度较弱，需结合临床背景评估实际意义。"
                    else:
                        section.interpretation = "差异具有统计学意义，关联强度有实际临床意义。"
            else:
                section.conclusion = f"未发现显著关联（p={p_value:.3f}），两变量可能相互独立。"
        
        # 样本量充分性警告
        expected_freq = stats.get("expected_freq_min")
        if expected_freq is not None and expected_freq < 5:
            section.warnings.append(
                f"存在期望频数<5的单元格，卡方检验可能不适用，建议使用Fisher精确检验"
            )
        elif sample_size and sample_size < 40:
            section.warnings.append(
                "样本量较小（n<40），建议谨慎解释结果或使用Fisher精确检验"
            )
        
        return [section]


@register_handler("chi_square")
def build_chi_square(analysis: 'Analysis', parameters: Dict, results: Dict) -> List[AnalysisSection]:
    return ChiSquareSectionBuilder(analysis, parameters, results).build()
