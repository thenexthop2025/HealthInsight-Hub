from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class ConditionalLogisticRequest(BaseModel):
    """Parameters required for conditional (stratified) logistic regression."""

    dependent_variable: str
    independent_variables: List[str]
    stratum_variable: str
    control_variables: List[str] = Field(default_factory=list)
    outcome_positive: Optional[int] = None  # allow explicit positive class


class ConditionalLogisticCoefficient(BaseModel):
    variable: str
    coefficient: Optional[float] = None
    std_error: Optional[float] = None
    p_value: Optional[float] = None
    odds_ratio: Optional[float] = None


class ConditionalLogisticPerformance(BaseModel):
    accuracy: Optional[float] = None
    auc: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None


class ConditionalLogisticDiagnostics(BaseModel):
    confusion_matrix: Optional[List[List[int]]] = None
    informative_strata: int = 0
    dropped_strata: int = 0
    notes: Optional[List[str]] = None


class ConditionalLogisticResult(BaseModel):
    model_config = {"protected_namespaces": ()}
    
    dependent_variable: str
    independent_variables: List[str]
    control_variables: List[str]
    stratum_variable: str
    coefficients: List[ConditionalLogisticCoefficient]
    log_likelihood: Optional[float] = None
    aic: Optional[float] = None
    bic: Optional[float] = None
    model_performance: Optional[ConditionalLogisticPerformance] = None
    predictions: Optional[Dict[str, List]] = None
    diagnostics: Optional[ConditionalLogisticDiagnostics] = None
    sample_size: int

