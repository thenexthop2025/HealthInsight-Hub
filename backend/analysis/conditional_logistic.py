"""
Conditional logistic regression analyzer.

This module implements a fixed-effects (conditional) logistic regression for
stratified case-control data by adding stratum dummies. While it approximates
the conditional likelihood, it produces interpretable coefficients and keeps
the architecture consistent with other modular analyzers.
"""

from typing import Dict, List

import numpy as np
import pandas as pd
import statsmodels.api as sm
from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.preprocessing import LabelEncoder

from .base import AnalysisError, BaseAnalyzer
from schemas.conditional_logistic import (
    ConditionalLogisticCoefficient,
    ConditionalLogisticDiagnostics,
    ConditionalLogisticPerformance,
    ConditionalLogisticRequest,
    ConditionalLogisticResult,
)


class ConditionalLogisticAnalyzer(BaseAnalyzer):
    """Analyze logistic models conditional on stratification (fixed effects)."""

    def run(self, request: ConditionalLogisticRequest) -> Dict[str, any]:
        self._validate_request(request)

        all_vars = (
            [request.dependent_variable, request.stratum_variable]
            + request.independent_variables
            + (request.control_variables or [])
        )
        data = self.data[all_vars].dropna()
        if len(data) < 10:
            raise AnalysisError(
                "Insufficient data for conditional logistic regression (>=10)",
                error_code="CONDLOGIT_LOW_SAMPLE",
            )

        y = data[request.dependent_variable]
        if y.nunique() != 2:
            raise AnalysisError(
                "Conditional logistic regression requires binary outcome",
                error_code="CONDLOGIT_NON_BINARY_OUTCOME",
            )

        grouped = data.groupby(request.stratum_variable)[request.dependent_variable]
        informative_mask = grouped.transform(lambda s: s.nunique() == 2)
        informative_data = data[informative_mask.astype(bool)]
        if informative_data.empty:
            raise AnalysisError(
                "Conditional logistic regression requires strata with both outcome classes",
                error_code="CONDLOGIT_NO_INFORMATIVE_STRATUM",
            )

        dropped_obs = int(len(data) - len(informative_data))
        y = informative_data[request.dependent_variable]
        strata = informative_data[request.stratum_variable]
        X_raw = informative_data[request.independent_variables + (request.control_variables or [])]

        # Encode predictors
        X_num = pd.get_dummies(X_raw, drop_first=True)
        for c in X_num.columns:
            try:
                X_num[c] = pd.to_numeric(X_num[c], errors="coerce")
            except Exception:
                pass
        X_num = X_num.fillna(0.0).astype(float)
        if X_num.shape[1] == 0:
            raise AnalysisError(
                "No valid numeric predictors after encoding. Please check independent/control variables.",
                error_code="CONDLOGIT_NO_PREDICTOR",
            )

        strata_dummies = pd.get_dummies(strata, prefix=request.stratum_variable, drop_first=True).astype(float)
        X_fe = pd.concat([X_num.reset_index(drop=True), strata_dummies.reset_index(drop=True)], axis=1)
        X_const = sm.add_constant(X_fe, has_constant="add")

        le = LabelEncoder()
        y_encoded = le.fit_transform(y)

        try:
            model = sm.Logit(y_encoded, X_const).fit(disp=0)
        except Exception as exc:
            raise AnalysisError(
                f"Conditional logistic regression fit failed: {exc}",
                error_code="CONDLOGIT_FIT_FAILED",
                details={"error": str(exc)},
            ) from exc

        params = model.params
        pvals = model.pvalues
        bse = model.bse

        coefficients: List[ConditionalLogisticCoefficient] = []
        for name in X_fe.columns:
            coefficients.append(
                ConditionalLogisticCoefficient(
                    variable=name,
                    coefficient=float(params.get(name, float("nan"))),
                    std_error=float(bse.get(name, float("nan"))),
                    p_value=float(pvals.get(name, float("nan"))),
                    odds_ratio=float(np.exp(params.get(name, 0.0))),
                )
            )

        y_prob_list = None
        y_hat = None
        auc_val = None
        cm_full = None
        prec = rec = f1 = None
        try:
            y_prob_list = model.predict(X_const).tolist()
            y_hat = (np.array(y_prob_list) >= 0.5).astype(int)
            auc_val = roc_auc_score(y_encoded, y_prob_list)
            cm_full = confusion_matrix(y_encoded, y_hat).tolist()
            prec = precision_score(y_encoded, y_hat, zero_division=0)
            rec = recall_score(y_encoded, y_hat, zero_division=0)
            f1 = f1_score(y_encoded, y_hat, zero_division=0)
        except Exception:
            pass

        diagnostics = ConditionalLogisticDiagnostics(
            confusion_matrix=cm_full,
            informative_strata=int(strata.nunique()),
            dropped_strata=int(data[request.stratum_variable].nunique() - strata.nunique()),
            notes=(
                [f"Dropped {dropped_obs} observations from non-informative strata."]
                if dropped_obs > 0
                else None
            ),
        )

        performance = ConditionalLogisticPerformance(
            accuracy=float((y_hat == y_encoded).mean()) if y_hat is not None else None,
            auc=float(auc_val) if auc_val is not None else None,
            precision=float(prec) if prec is not None else None,
            recall=float(rec) if rec is not None else None,
            f1_score=float(f1) if f1 is not None else None,
        )

        predictions = (
            {
                "test_predictions": y_hat.tolist() if y_hat is not None else None,
                "test_probabilities": (
                    [[1 - p, p] for p in y_prob_list] if y_prob_list is not None else None
                ),
                "test_actual": y_encoded.tolist(),
            }
            if y_prob_list is not None and y_hat is not None
            else None
        )

        result = ConditionalLogisticResult(
            dependent_variable=request.dependent_variable,
            independent_variables=request.independent_variables,
            control_variables=request.control_variables,
            stratum_variable=request.stratum_variable,
            coefficients=coefficients,
            log_likelihood=float(model.llf),
            aic=float(model.aic),
            bic=float(model.bic),
            model_performance=performance,
            predictions=predictions,
            diagnostics=diagnostics,
            sample_size=int(len(informative_data)),
        )
        return result.dict()

    def validate_parameters(self, analysis_type: str, **kwargs) -> None:
        if analysis_type != "logistic_regression_conditional":
            return
        if not kwargs.get("dependent_variables"):
            raise ValueError("条件逻辑回归需要依赖变量")
        if not kwargs.get("independent_variables"):
            raise ValueError("条件逻辑回归需要独立变量")
        if not kwargs.get("strata_variable"):
            raise ValueError("条件逻辑回归需要提供分层变量 strata_variable")

    def _validate_request(self, request: ConditionalLogisticRequest) -> None:
        self._validate_variables(
            [request.dependent_variable]
            + request.independent_variables
            + request.control_variables
            + [request.stratum_variable]
        )
