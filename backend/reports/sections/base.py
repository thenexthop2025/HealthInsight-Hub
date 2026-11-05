from __future__ import annotations

from typing import Dict, List

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Analysis


from ..data import AnalysisSection, SummaryMetric
from ..theme import THEME
from ..utils import format_p_value, significance_marker


def default_method_text(analysis_type: str) -> str:
    mapping = {
        "descriptive": "基于变量分布的描述性统计，报告均值、中位数与离散度。",
        "frequency": "统计分类变量的频数、百分比与累计百分比。",
        "crosstab": "构建列联表，对两变量之间的分布差异进行比较。",
        "chi_square": "使用卡方检验评估分类变量之间的独立性。",
        "correlation": "计算皮尔逊、斯皮尔曼等相关系数评估变量间线性或秩序关系。",
        "linear_regression": "多元线性回归估计自变量对连续因变量的影响，并报告模型诊断。",
        "logistic_regression": "二分类逻辑回归分析因素与事件发生概率的关系，并报告OR值。",
        "logistic_regression_multinomial": "多分类逻辑回归评估多水平因变量与协变量的关系。",
        "logistic_regression_ordinal": "有序逻辑回归分析有序分类结局的影响因素。",
        "logistic_regression_conditional": "条件逻辑回归处理配对或分层数据，控制各层效应。",
        "stratified": "采用分层汇总方法计算分层OR/MD，并评估异质性。",
        "mendelian_randomization": "基于工具变量(MR)方法评估暴露与结局的因果效应。",
    }
    return mapping.get(analysis_type, "本段结果采用标准方法生成，详见系统配置。")


def metric(label: str, value: str, *, unit: str | None = None, interpretation: str | None = None, emphasize: bool = False) -> SummaryMetric:
    return SummaryMetric(label=label, value=value, unit=unit, interpretation=interpretation, emphasize=emphasize)


def tidy_p_value(label: str, p_value: float, threshold: float = 0.05) -> SummaryMetric:
    formatted = format_p_value(p_value)
    marker = significance_marker(p_value)
    interpretation = "统计显著" if p_value < threshold else "未达显著"
    emphasize = p_value < threshold
    value = f"{formatted} {marker}".strip()
    return SummaryMetric(label=label, value=value, interpretation=interpretation, emphasize=emphasize)


class SectionBuilder:
    """Utility base for creating analysis sections."""

    def __init__(self, analysis: 'Analysis', parameters: Dict, results: Dict):
        self.analysis = analysis
        self.parameters = parameters or {}
        self.results = results or {}

    def build(self) -> List[AnalysisSection]:
        raise NotImplementedError

    def header(self, title: str, section_type: str | None = None, method: str | None = None) -> AnalysisSection:
        return AnalysisSection(
            section_type=section_type or self.analysis.analysis_type,
            title=title,
            method=method or default_method_text(self.analysis.analysis_type),
        )
