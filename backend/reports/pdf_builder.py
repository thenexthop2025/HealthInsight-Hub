from __future__ import annotations

from datetime import datetime
from typing import List

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Table, TableStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont

from .data import ReportPayload, AnalysisSection
from .components import heading, body_text, metric_table, themed_table, vertical_spacer
from .theme import THEME


def _format_datetime(value):
    if value is None:
        return "--"
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    try:
        return datetime.fromisoformat(str(value)).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return str(value)


def _ensure_fonts() -> None:
    try:
        pdfmetrics.getFont("STSong-Light")
    except KeyError:
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))


def _header(canvas, doc, payload: ReportPayload):
    canvas.saveState()
    canvas.setStrokeColor(THEME.divider)
    canvas.setFillColor(THEME.text_secondary)
    canvas.setFont("STSong-Light", 9)
    canvas.drawString(doc.leftMargin, doc.height + doc.topMargin + 12, f"项目：{payload.analysis_name}")
    canvas.drawRightString(
        doc.width + doc.leftMargin,
        doc.height + doc.topMargin + 12,
        datetime.now().strftime("%Y-%m-%d"),
    )
    canvas.restoreState()


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(THEME.divider)
    canvas.line(doc.leftMargin, doc.bottomMargin - 10, doc.leftMargin + doc.width, doc.bottomMargin - 10)
    canvas.setFont("STSong-Light", 8)
    canvas.setFillColor(THEME.text_muted)
    canvas.drawString(doc.leftMargin, doc.bottomMargin - 24, "HealthInsight Hub — 临床研究支持平台")
    canvas.drawRightString(doc.leftMargin + doc.width, doc.bottomMargin - 24, f"第 {doc.page} 页")
    canvas.restoreState()


def build_basic_info(payload: ReportPayload) -> List:
    info = [
        ["分析 ID", str(payload.analysis_id)],
        ["分析类型", payload.analysis_type],
        ["数据集", payload.dataset_name or "--"],
        ["创建时间", _format_datetime(payload.created_at)],
        ["完成时间", _format_datetime(payload.completed_at)],
        ["状态", payload.status],
    ]
    table = Table(info, colWidths=[1.5 * inch, 4.5 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), THEME.surface_muted),
                ("TEXTCOLOR", (0, 0), (-1, -1), THEME.text_secondary),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, -1), "STSong-Light"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.3, THEME.divider),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return [heading("基本信息", level=2), table, vertical_spacer(16)]


def section_flow(section: AnalysisSection) -> List:
    flow: List = []
    flow.append(heading(section.title, level=2))
    if section.method:
        flow.append(body_text(section.method, muted=True))
    if section.metrics:
        flow.append(metric_table([m.__dict__ for m in section.metrics]))
        flow.append(vertical_spacer(12))
    for table_data in section.tables:
        headers = table_data.get("headers", [])
        rows = table_data.get("rows", [])
        flow.append(themed_table(headers, rows))
        flow.append(vertical_spacer(10))
    if section.interpretation:
        flow.append(body_text(f"结果解读：{section.interpretation}"))
    if section.conclusion:
        flow.append(body_text(f"结论：{section.conclusion}"))
    if section.warnings:
        for warn in section.warnings:
            flow.append(body_text(f"注意：{warn}", muted=True))
    flow.append(vertical_spacer(18))
    return flow


def build_pdf_report(payload: ReportPayload, file_path: str) -> None:
    _ensure_fonts()
    doc = BaseDocTemplate(
        file_path,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=72,
        bottomMargin=60,
    )

    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    template = PageTemplate(id="main", frames=[frame], onPage=lambda c, d: _header(c, doc, payload), onPageEnd=_footer)
    doc.addPageTemplates([template])

    story: List = []
    story.append(heading("HealthInsight Hub 数据分析报告", level=1))
    if payload.description:
        story.append(body_text(payload.description))
    story.extend(build_basic_info(payload))

    for section in payload.sections:
        story.extend(section_flow(section))

    doc.build(story)
