from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models import Analysis



@dataclass
class SummaryMetric:
    label: str
    value: Any
    unit: Optional[str] = None
    interpretation: Optional[str] = None
    emphasize: bool = False


@dataclass
class AnalysisSection:
    section_type: str
    title: str
    method: str
    overview: Optional[str] = None
    metrics: List[SummaryMetric] = field(default_factory=list)
    tables: List[Dict[str, Any]] = field(default_factory=list)
    charts: List[Dict[str, Any]] = field(default_factory=list)
    interpretation: Optional[str] = None
    conclusion: Optional[str] = None
    warnings: List[str] = field(default_factory=list)


@dataclass
class ReportPayload:
    analysis_id: int
    analysis_name: str
    analysis_type: str
    dataset_name: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    status: str
    description: Optional[str]
    parameters: Dict[str, Any]
    sections: List[AnalysisSection]


class ReportDataBuilder:
    """Transforms Analysis ORM objects into structured report payloads."""

    def __init__(self, analysis: 'Analysis'):
        self.analysis = analysis
        self.parameters = self._load_json_field(analysis.parameters)
        self.results = self._load_json_field(analysis.results)

    @staticmethod
    def _load_json_field(raw: Any) -> Dict[str, Any]:
        if raw is None:
            return {}
        if isinstance(raw, dict):
            return raw
        if isinstance(raw, str):
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return {}
        return {}

    def build(self) -> ReportPayload:
        sections = self._build_sections()
        dataset_name = getattr(self.analysis, "dataset_name", None)
        if not dataset_name and getattr(self.analysis, "dataset", None) is not None:
            dataset_name = getattr(self.analysis.dataset, "name", None)
        return ReportPayload(
            analysis_id=self.analysis.id,
            analysis_name=self.analysis.name,
            analysis_type=self.analysis.analysis_type,
            dataset_name=dataset_name,
            created_at=self.analysis.created_at,
            completed_at=self.analysis.completed_at,
            status=self.analysis.status,
            description=self.analysis.description,
            parameters=self.parameters,
            sections=sections,
        )

    def _build_sections(self) -> List[AnalysisSection]:
        from .sections import factory

        handler = factory.get_handler(self.analysis.analysis_type)
        if handler:
            return handler(self.analysis, self.parameters, self.results)
        return []
