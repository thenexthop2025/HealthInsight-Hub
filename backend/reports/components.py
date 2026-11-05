from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

from .theme import THEME


@dataclass
class StyledText:
    text: str
    style: ParagraphStyle


def heading(text: str, level: int = 1) -> Paragraph:
    font_size = {1: 20, 2: 16, 3: 13, 4: 12}.get(level, 11)
    color = THEME.text_primary if level <= 2 else THEME.text_secondary
    style = ParagraphStyle(
        name=f"Heading{level}",
        fontName="STSong-Light",
        fontSize=font_size,
        leading=font_size + 2,
        textColor=color,
        spaceAfter=12,
    )
    return Paragraph(text, style)


def body_text(text: str, muted: bool = False) -> Paragraph:
    style = ParagraphStyle(
        name="Body",
        fontName="STSong-Light",
        fontSize=11,
        leading=16,
        textColor=THEME.text_muted if muted else THEME.text_secondary,
        spaceAfter=8,
    )
    return Paragraph(text, style)


def badge(text: str, color: colors.Color = THEME.primary) -> Table:
    style = ParagraphStyle(
        name="Badge",
        fontName="STSong-Light",
        fontSize=9,
        textColor=color,
        alignment=1,
    )
    cell = Paragraph(text.upper(), style)
    table = Table([[cell]], colWidths=[50])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), THEME.highlight_background),
        ("BOX", (0, 0), (-1, -1), 0.5, color),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    return table


def metric_table(metrics: Iterable[Dict[str, Any]]) -> Table:
    data: List[List[Any]] = []
    row: List[Any] = []
    for metric in metrics:
        highlight = metric.get("emphasize", False)
        text = f"<b>{metric['label']}</b>" if highlight else metric["label"]
        value = metric.get("value", "--")
        unit = metric.get("unit")
        interpretation = metric.get("interpretation")

        html = f"{text}<br/><font size=14>{value}</font>"
        if unit:
            html += f" {unit}"
        if interpretation:
            html += f"<br/><font color='{THEME.text_muted}'>{interpretation}</font>"
        row.append(Paragraph(html, ParagraphStyle("Metric", fontName="STSong-Light", alignment=1)))
    data.append(row)
    table = Table(data)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), THEME.surface),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("BOX", (0, 0), (-1, -1), 0.5, THEME.divider),
    ]))
    return table


def themed_table(headers: List[str], rows: List[List[Any]], emphasize: Optional[List[int]] = None) -> Table:
    table = Table([headers] + rows)
    style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), THEME.surface_muted),
        ("TEXTCOLOR", (0, 0), (-1, 0), THEME.text_primary),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("FONTNAME", (0, 0), (-1, -1), "STSong-Light"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
        ("BACKGROUND", (0, 1), (-1, -1), THEME.surface),
        ("TEXTCOLOR", (0, 1), (-1, -1), THEME.text_secondary),
        ("ALIGN", (0, 1), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, THEME.divider),
    ])
    if emphasize:
        for idx in emphasize:
            style.add("TEXTCOLOR", (0, idx + 1), (-1, idx + 1), THEME.primary)
    table.setStyle(style)
    return table


def vertical_spacer(height: int = 12) -> Spacer:
    return Spacer(1, height)
