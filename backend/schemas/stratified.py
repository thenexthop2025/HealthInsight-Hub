from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class StratifiedRequest(BaseModel):
    """Parameters required for stratified analysis."""

    dependent_variable: str = Field(..., description="Continuous or binary outcome variable.")
    independent_variable: str = Field(..., description="Exposure variable; binary preferred for OR.")
    stratum_variable: str = Field(..., description="Stratification variable.")
    measure: Literal["auto", "or", "md"] = Field(
        "auto",
        description="Desired effect measure: auto (default), odds ratio (or) or mean difference (md).",
    )


class StratifiedStratumResult(BaseModel):
    stratum: str
    effect: Optional[float] = None
    ci: Optional[List[float]] = None
    weight: Optional[float] = None
    counts: Optional[Dict[str, float]] = None
    n: Optional[float] = None
    n0: Optional[float] = None
    n1: Optional[float] = None
    notes: Optional[str] = None


class StratifiedOverallResult(BaseModel):
    effect: Optional[float] = None
    ci: Optional[List[float]] = None
    measure: Optional[str] = None


class StratifiedHeterogeneity(BaseModel):
    Q: float
    df: int
    p_value: float
    I2: float


class StratifiedResult(BaseModel):
    measure: str
    strata: List[StratifiedStratumResult]
    overall: Optional[StratifiedOverallResult] = None
    overall_fixed: Optional[StratifiedOverallResult] = None
    overall_random: Optional[StratifiedOverallResult] = None
    heterogeneity: Optional[StratifiedHeterogeneity] = None
    auto_binarized: Optional[Dict[str, str]] = None
    notes: Optional[List[str]] = None


