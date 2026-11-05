from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

from reportlab.lib.units import mm

from .theme import THEME


SIGNIFICANCE_THRESHOLD = 0.05


def format_p_value(p: Optional[float]) -> str:
    if p is None:
        return "--"
    if p < 0.001:
        return "< 0.001"
    return f"{p:.3f}"


def significance_marker(p: Optional[float]) -> str:
    if p is None:
        return ""
    return "★" if p < SIGNIFICANCE_THRESHOLD else ""


def mm_padding(top: float = 6, right: float = 6, bottom: float = 6, left: float = 6):
    return (top * mm, right * mm, bottom * mm, left * mm)


def metric_row(metrics: Iterable[Dict[str, Any]]) -> List[List[Any]]:
    row = []
    for metric in metrics:
        label = metric.get("label", "")
        value = metric.get("value", "--")
        unit = metric.get("unit")
        interpretation = metric.get("interpretation")
        emphasize = metric.get("emphasize", False)

        content = f"<b>{label}</b><br/>{value}"
        if unit:
            content += f" {unit}"
        if interpretation:
            content += f"<br/><font color='{THEME.text_secondary}'>({interpretation})</font>"
        row.append({
            "content": content,
            "emphasize": emphasize,
        })
    return [row]


def interpret_correlation(r: float) -> str:
    """解释相关系数强度"""
    abs_r = abs(r)
    if abs_r < 0.1:
        return "极弱相关"
    elif abs_r < 0.3:
        return "弱相关"
    elif abs_r < 0.5:
        return "中等相关"
    elif abs_r < 0.7:
        return "较强相关"
    else:
        return "强相关"


def interpret_odds_ratio(or_value: float) -> str:
    """解释OR值的临床意义"""
    if or_value < 0.5:
        return "风险显著降低"
    elif or_value < 0.8:
        return "风险轻度降低"
    elif or_value <= 1.2:
        return "无明显关联"
    elif or_value <= 2.0:
        return "风险轻度增加"
    elif or_value <= 4.0:
        return "风险中度增加"
    else:
        return "风险显著增加"


def interpret_effect_size_cohens_d(d: float) -> str:
    """解释Cohen's d效应量"""
    abs_d = abs(d)
    if abs_d < 0.2:
        return "微小效应"
    elif abs_d < 0.5:
        return "小效应"
    elif abs_d < 0.8:
        return "中等效应"
    else:
        return "大效应"


def interpret_r_squared(r2: float) -> str:
    """解释R²拟合优度"""
    if r2 < 0.1:
        return "拟合度较差"
    elif r2 < 0.3:
        return "拟合度一般"
    elif r2 < 0.5:
        return "拟合度中等"
    elif r2 < 0.7:
        return "拟合度良好"
    else:
        return "拟合度优秀"


def interpret_cramers_v(v: float) -> str:
    """解释Cramér's V关联强度"""
    if v < 0.1:
        return "关联极弱"
    elif v < 0.2:
        return "关联较弱"
    elif v < 0.3:
        return "关联中等"
    elif v < 0.4:
        return "关联较强"
    else:
        return "关联强"


def interpret_heterogeneity_i2(i2: float) -> str:
    """解释I²异质性"""
    if i2 < 25:
        return "异质性低"
    elif i2 < 50:
        return "异质性中等"
    elif i2 < 75:
        return "异质性较高"
    else:
        return "异质性高"


def format_ci(ci_lower: float, ci_upper: float, crosses_null: float = 1.0) -> tuple:
    """
    格式化置信区间并判断是否跨越无效值
    
    Args:
        ci_lower: 置信区间下限
        ci_upper: 置信区间上限
        crosses_null: 无效值（OR/RR为1.0，MD为0.0）
    
    Returns:
        (格式化的CI字符串, 解释文本)
    """
    ci_text = f"95% CI [{ci_lower:.2f}, {ci_upper:.2f}]"
    
    if ci_lower <= crosses_null <= ci_upper:
        interpretation = "CI包含无效值"
    else:
        interpretation = "CI不包含无效值"
    
    return ci_text, interpretation


def calculate_sample_size_adequacy(n: int, variables: int, outcome_type: str = "binary") -> str:
    """
    评估样本量充分性
    
    Args:
        n: 样本量
        variables: 自变量数量
        outcome_type: 结局类型 ("binary", "continuous")
    
    Returns:
        样本量充分性评价
    """
    if outcome_type == "binary":
        # 逻辑回归：EPV (events per variable) 规则
        min_required = variables * 10  # 每个变量至少10个事件
        if n < min_required:
            return f"样本量偏小（建议≥{min_required}），结果可能不稳定"
        elif n < variables * 20:
            return "样本量基本充足"
        else:
            return "样本量充足"
    else:
        # 线性回归：15-20倍变量数
        min_required = variables * 15
        if n < min_required:
            return f"样本量偏小（建议≥{min_required}），结果可能不稳定"
        elif n < variables * 30:
            return "样本量基本充足"
        else:
            return "样本量充足"


def format_percentage_change(baseline: float, new_value: float) -> str:
    """计算并格式化百分比变化"""
    if baseline == 0:
        return "--"
    change = ((new_value - baseline) / baseline) * 100
    sign = "增加" if change > 0 else "降低"
    return f"{sign}{abs(change):.1f}%"
