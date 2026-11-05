from typing import List, Sequence

from pydantic import BaseModel, Field


class MendelianRandomizationRequest(BaseModel):
    exposure_variable: str
    outcome_variable: str
    instrument_variables: Sequence[str] = Field(default_factory=list)


class MendelianPoint(BaseModel):
    label: str
    x: float
    y: float


class MendelianFunnelPoint(BaseModel):
    label: str
    beta: float
    se: float


class MendelianForestRow(BaseModel):
    study: str
    effect: float
    ci: List[float]


class MendelianIVWResult(BaseModel):
    beta: float
    se: float
    ci: List[float]


class MendelianEggerResult(BaseModel):
    intercept: float
    slope: float


class MendelianRandomizationResult(BaseModel):
    ivw: MendelianIVWResult
    egger: MendelianEggerResult
    scatter: List[MendelianPoint]
    funnel: List[MendelianFunnelPoint]
    forest: List[MendelianForestRow]
