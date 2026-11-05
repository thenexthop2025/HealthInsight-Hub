"""
Mendelian randomization analysis module.
Encapsulates the MR workflow used by StatisticalAnalysisFactory.
"""

from typing import Any, Dict, List, Sequence, Tuple

import numpy as np

from .base import AnalysisError, BaseAnalyzer
from schemas.mendelian import (
    MendelianRandomizationResult,
    MendelianEggerResult,
    MendelianForestRow,
    MendelianFunnelPoint,
    MendelianIVWResult,
    MendelianPoint,
    MendelianRandomizationRequest,
)


class MendelianRandomizationAnalyzer(BaseAnalyzer):
    """Analyzer responsible for Mendelian randomization."""

    def run(self, request: MendelianRandomizationRequest) -> Dict[str, Any]:
        self._validate_request(request)
        betas_exp, betas_out, ses_exp, ses_out, labels = self._estimate_effects(request)
        ratio, se_ratio = self._compute_wald_ratios(betas_exp, betas_out, ses_exp, ses_out)
        ivw = self._inverse_variance_weighting(ratio, se_ratio)
        egger = self._egger_regression(betas_exp, betas_out, se_ratio)
        scatter = self._build_scatter_points(betas_exp, betas_out, labels)
        funnel = self._build_funnel_points(ratio, se_ratio, labels)
        forest = self._build_forest_rows(ratio, se_ratio, labels)
        result = MendelianRandomizationResult(
            ivw=ivw,
            egger=egger,
            scatter=scatter,
            funnel=funnel,
            forest=forest,
        )
        return result.dict()

    def validate_parameters(self, analysis_type: str, **kwargs: Any) -> None:
        """Factory compatibility: ensure required parameters are present."""
        if analysis_type != "mendelian_randomization":
            return
        exposure = kwargs.get("exposure_variable")
        outcome = kwargs.get("outcome_variable")
        instruments = kwargs.get("instrument_variables") or []
        if not exposure or not outcome or not instruments:
            raise AnalysisError(
                "Mendelian randomization requires exposure, outcome and instrument variables",
                error_code="MR_MISSING_PARAMS",
                details={
                    "exposure_variable": exposure,
                    "outcome_variable": outcome,
                    "instrument_variables": instruments,
                },
            )

    def _validate_request(self, request: MendelianRandomizationRequest) -> None:
        if not request.exposure_variable or not request.outcome_variable or not request.instrument_variables:
            raise AnalysisError(
                "Mendelian randomization requires exposure, outcome and instrument variables",
                error_code="MR_MISSING_PARAMS",
                details={
                    "exposure_variable": request.exposure_variable,
                    "outcome_variable": request.outcome_variable,
                    "instrument_variables": list(request.instrument_variables),
                },
            )
        try:
            self._validate_variables(
                [request.exposure_variable, request.outcome_variable] + list(request.instrument_variables)
            )
        except ValueError as exc:
            raise AnalysisError(
                str(exc),
                error_code="MR_INVALID_VARIABLES",
                details={
                    "exposure_variable": request.exposure_variable,
                    "outcome_variable": request.outcome_variable,
                    "instrument_variables": list(request.instrument_variables),
                },
            ) from exc

    def _estimate_effects(
        self, request: MendelianRandomizationRequest
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, List[str]]:
        betas_exp: List[float] = []
        betas_out: List[float] = []
        ses_exp: List[float] = []
        ses_out: List[float] = []
        labels: List[str] = []
        skipped: List[str] = []
        for iv in request.instrument_variables:
            sub = self.data[[iv, request.exposure_variable, request.outcome_variable]].dropna()
            if len(sub) < 3:
                skipped.append(str(iv))
                continue
            iv_values = sub[iv].astype(float).values
            x_vals = iv_values.reshape(-1, 1)
            design = np.hstack([np.ones((x_vals.shape[0], 1)), x_vals])
            y_exp = sub[request.exposure_variable].astype(float).values
            y_out = sub[request.outcome_variable].astype(float).values
            beta_exp, se_exp = self._fit_simple_ols(design, y_exp, iv_values)
            beta_out, se_out = self._fit_simple_ols(design, y_out, iv_values)
            betas_exp.append(beta_exp)
            betas_out.append(beta_out)
            ses_exp.append(se_exp)
            ses_out.append(se_out)
            labels.append(str(iv))
        betas_exp_arr = np.array(betas_exp, dtype=float)
        betas_out_arr = np.array(betas_out, dtype=float)
        ses_exp_arr = np.array(ses_exp, dtype=float)
        ses_out_arr = np.array(ses_out, dtype=float)
        if betas_exp_arr.size == 0:
            raise AnalysisError(
                "Insufficient valid instruments for Mendelian randomization",
                error_code="MR_INSUFFICIENT_IVS",
                details={
                    "requested_instruments": list(request.instrument_variables),
                    "skipped_instruments": skipped,
                },
            )
        return betas_exp_arr, betas_out_arr, ses_exp_arr, ses_out_arr, labels

    @staticmethod
    def _fit_simple_ols(
        X: np.ndarray, y: np.ndarray, raw_iv: np.ndarray
    ) -> Tuple[float, float]:
        beta = np.linalg.lstsq(X, y, rcond=None)[0][1]
        coeffs = np.linalg.lstsq(X, y, rcond=None)[0]
        residuals = y - X @ coeffs
        denom = np.sum((raw_iv - raw_iv.mean()) ** 2)
        se = float(np.sqrt(np.sum(residuals**2) / (len(y) - 2) / denom)) if denom > 0 else float("inf")
        return float(beta), se

    @staticmethod
    def _compute_wald_ratios(
        betas_exp: np.ndarray, betas_out: np.ndarray, ses_exp: np.ndarray, ses_out: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        ratio = betas_out / betas_exp
        se_ratio = np.sqrt(
            (ses_out**2) / (betas_exp**2) + (betas_out**2) * (ses_exp**2) / (betas_exp**4)
        )
        return ratio, se_ratio

    @staticmethod
    def _inverse_variance_weighting(ratio: np.ndarray, se_ratio: np.ndarray) -> MendelianIVWResult:
        weights = 1.0 / (se_ratio**2)
        beta_ivw = float(np.sum(weights * ratio) / np.sum(weights))
        se_ivw = float(np.sqrt(1.0 / np.sum(weights)))
        z = 1.96
        ci_ivw = [beta_ivw - z * se_ivw, beta_ivw + z * se_ivw]
        return MendelianIVWResult(beta=beta_ivw, se=se_ivw, ci=ci_ivw)

    @staticmethod
    def _egger_regression(
        betas_exp: np.ndarray, betas_out: np.ndarray, se_ratio: np.ndarray
    ) -> MendelianEggerResult:
        weights = np.diag(1.0 / (se_ratio**2))
        design = np.vstack([np.ones_like(betas_exp), betas_exp]).T
        beta_egger = np.linalg.inv(design.T @ weights @ design) @ (design.T @ weights @ betas_out)
        intercept = float(beta_egger[0])
        slope = float(beta_egger[1])
        return MendelianEggerResult(intercept=intercept, slope=slope)

    @staticmethod
    def _build_scatter_points(
        betas_exp: np.ndarray, betas_out: np.ndarray, labels: Sequence[str]
    ) -> List[MendelianPoint]:
        return [
            MendelianPoint(x=float(betas_exp[i]), y=float(betas_out[i]), label=labels[i])
            for i in range(len(labels))
        ]

    @staticmethod
    def _build_funnel_points(
        ratio: np.ndarray, se_ratio: np.ndarray, labels: Sequence[str]
    ) -> List[MendelianFunnelPoint]:
        return [
            MendelianFunnelPoint(se=float(se_ratio[i]), beta=float(ratio[i]), label=labels[i])
            for i in range(len(labels))
        ]

    @staticmethod
    def _build_forest_rows(
        ratio: np.ndarray, se_ratio: np.ndarray, labels: Sequence[str]
    ) -> List[MendelianForestRow]:
        z = 1.96
        rows: List[MendelianForestRow] = []
        for i in range(len(labels)):
            effect = float(ratio[i])
            ci_low = float(ratio[i] - z * se_ratio[i])
            ci_high = float(ratio[i] + z * se_ratio[i])
            rows.append(MendelianForestRow(study=labels[i], effect=effect, ci=[ci_low, ci_high]))
        return rows
