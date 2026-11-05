from __future__ import annotations


from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

from .data import ReportPayload
from .theme import THEME


def _set_heading(run, size: int = 18, bold: bool = True):
    font = run.font
    font.name = "Calibri"
    font.size = Pt(size)
    font.bold = bold
    font.color.rgb = RGBColor(int(THEME.text_primary.red*255), int(THEME.text_primary.green*255), int(THEME.text_primary.blue*255))


def _set_paragraph(paragraph, text: str, muted: bool = False):
    run = paragraph.add_run(text)
    font = run.font
    font.name = "Calibri"
    font.size = Pt(11)
    font.color.rgb = RGBColor(int((THEME.text_muted if muted else THEME.text_secondary).red*255), int((THEME.text_muted if muted else THEME.text_secondary).green*255), int((THEME.text_muted if muted else THEME.text_secondary).blue*255))


def build_docx_report(payload: ReportPayload, file_path: str) -> None:
    doc = Document()
    doc.core_properties.title = payload.analysis_name

    title = doc.add_heading(level=0)
    _set_heading(title.add_run("HealthInsight Hub 数据分析报告"), size=22)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    if payload.description:
        _set_paragraph(doc.add_paragraph(), payload.description)

    doc.add_heading("基本信息", level=1)
    info_table = doc.add_table(rows=0, cols=2)
    info_table.style = "Table Grid"
    for label, value in [
        ("分析 ID", str(payload.analysis_id)),
        ("分析类型", payload.analysis_type),
        ("数据集", payload.dataset_name or "--"),
        ("创建时间", payload.created_at.strftime("%Y-%m-%d %H:%M")),
        ("完成时间", payload.completed_at.strftime("%Y-%m-%d %H:%M") if payload.completed_at else "--"),
        ("状态", payload.status),
    ]:
        row = info_table.add_row().cells
        row[0].text = label
        row[1].text = value

    for section in payload.sections:
        doc.add_heading(section.title, level=1)
        if section.method:
            _set_paragraph(doc.add_paragraph(), section.method, muted=True)
        if section.metrics:
            metrics_table = doc.add_table(rows=0, cols=2)
            metrics_table.style = "Table Grid"
            for metric in section.metrics:
                row_cells = metrics_table.add_row().cells
                row_cells[0].text = metric.label
                value_text = str(metric.value)
                if metric.unit:
                    value_text += f" {metric.unit}"
                if metric.interpretation:
                    value_text += f"\n{metric.interpretation}"
                row_cells[1].text = value_text
        for table in section.tables:
            headers = table.get("headers", [])
            rows = table.get("rows", [])
            doc_table = doc.add_table(rows=1, cols=len(headers))
            doc_table.style = "Table Grid"
            for i, header in enumerate(headers):
                doc_table.rows[0].cells[i].text = str(header)
            for row in rows:
                cells = doc_table.add_row().cells
                for i, value in enumerate(row):
                    cells[i].text = str(value)
        if section.interpretation:
            _set_paragraph(doc.add_paragraph(), f"结果解读：{section.interpretation}")
        if section.conclusion:
            _set_paragraph(doc.add_paragraph(), f"结论：{section.conclusion}")
        for warn in section.warnings:
            _set_paragraph(doc.add_paragraph(), f"注意：{warn}", muted=True)
        doc.add_paragraph()
    doc.save(file_path)
