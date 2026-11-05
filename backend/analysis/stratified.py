"""
Stratified analysis module.
Provides effect estimates per stratum and pooled summaries.
"""

from typing import Dict, List, Optional, Sequence, Tuple

import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype
from scipy.stats import chi2

from .base import AnalysisError, BaseAnalyzer
from schemas.stratified import (
    StratifiedHeterogeneity,
    StratifiedOverallResult,
    StratifiedRequest,
    StratifiedResult,
    StratifiedStratumResult,
)


class StratifiedAnalyzer(BaseAnalyzer):
    """Compute stratified (Mantel-Haenszel style) estimates."""

    def run(self, request: StratifiedRequest) -> Dict[str, any]:
        self._validate_request(request)
        dep = request.dependent_variable
        indep = request.independent_variable
        stratum = request.stratum_variable

        df = self.data[[dep, indep, stratum]].dropna()
        if df.empty:
            raise AnalysisError(
                "Stratified analysis requires non-empty data after dropping missing values",
                error_code="STRATA_NO_DATA",
            )

        dep_vals = df[dep].dropna().unique().tolist()
        indep_vals = df[indep].dropna().unique().tolist()
        is_binary_outcome = len(dep_vals) == 2
        is_binary_exposure = len(indep_vals) == 2

        target_measure = request.measure
        if target_measure == "auto":
            measure = "OR" if (is_binary_outcome and is_binary_exposure) else "MD"
        elif target_measure.lower() == "or":
            measure = "OR"
        else:
            measure = "MD"

        if measure == "OR":
            if not (is_binary_outcome and is_binary_exposure):
                raise AnalysisError(
                    "Odds ratio measure requires both dependent and independent variables to be binary",
                    error_code="STRATA_BINARY_REQUIRED",
                    details={
                        "dependent_unique": len(dep_vals),
                        "independent_unique": len(indep_vals),
                    },
                )
            result = self._run_binary(df, dep, indep, stratum, dep_vals, indep_vals)
        else:
            result = self._run_mean_difference(df, dep, indep, stratum, indep_vals)

        result.measure = measure
        return result.dict()

    def validate_parameters(self, analysis_type: str, **kwargs) -> None:
        if analysis_type != "stratified":
            return
        dependent = kwargs.get("dependent_variables") or []
        independent = kwargs.get("independent_variables") or []
        strata = kwargs.get("stratum_variables") or kwargs.get("strata_variable") or []
        if not dependent:
            raise ValueError("Stratified analysis requires dependent variables")
        if not independent:
            raise ValueError("Stratified analysis requires independent variables")
        if not strata:
            raise ValueError("Stratified analysis requires a stratum variable")

    def _validate_request(self, request: StratifiedRequest) -> None:
        if not request.dependent_variable or not request.independent_variable or not request.stratum_variable:
            raise AnalysisError(
                "Stratified analysis requires dependent, independent and stratum variables",
                error_code="STRATA_MISSING_PARAMS",
            )
        try:
            self._validate_variables(
                [request.dependent_variable, request.independent_variable, request.stratum_variable]
            )
        except ValueError as exc:
            raise AnalysisError(
                str(exc),
                error_code="STRATA_INVALID_VARIABLES",
            ) from exc

    def _run_binary(
        self,
        df: pd.DataFrame,
        dep: str,
        indep: str,
        stratum: str,
        dep_vals: Sequence,
        indep_vals: Sequence,
    ) -> StratifiedResult:
        strata_names = sorted(df[stratum].dropna().unique().tolist())
        strata_entries: List[StratifiedStratumResult] = []
        log_ors: List[float] = []
        variances: List[float] = []

        for s in strata_names:
            dfs = df[df[stratum] == s]
            e1, e0 = indep_vals[1], indep_vals[0]
            y1, y0 = dep_vals[1], dep_vals[0]
            a = int(((dfs[indep] == e1) & (dfs[dep] == y1)).sum())
            b = int(((dfs[indep] == e1) & (dfs[dep] == y0)).sum())
            c = int(((dfs[indep] == e0) & (dfs[dep] == y1)).sum())
            d = int(((dfs[indep] == e0) & (dfs[dep] == y0)).sum())
            aa, bb, cc, dd = float(a), float(b), float(c), float(d)
            if min(aa, bb, cc, dd) == 0:
                aa += 0.5
                bb += 0.5
                cc += 0.5
                dd += 0.5
            log_or = float(np.log((aa * dd) / (bb * cc)))
            var = float(1 / aa + 1 / bb + 1 / cc + 1 / dd)
            se = float(np.sqrt(var))
            z = 1.96
            ci_log = [log_or - z * se, log_or + z * se]
            effect = float(np.exp(log_or))
            ci = [float(np.exp(ci_log[0])), float(np.exp(ci_log[1]))]
            weight = 1.0 / var if var > 0 else 0.0
            strata_entries.append(
                StratifiedStratumResult(
                    stratum=str(s),
                    effect=effect,
                    ci=ci,
                    weight=weight,
                    counts={"a": aa, "b": bb, "c": cc, "d": dd},
                    n=float(aa + bb + cc + dd),
                )
            )
            log_ors.append(log_or)
            variances.append(var)

        return self._pooled_or(strata_entries, log_ors, variances)

    def _pooled_or(
        self, strata: List[StratifiedStratumResult], log_ors: List[float], variances: List[float]
    ) -> StratifiedResult:
        if not log_ors:
            raise AnalysisError(
                "No valid strata available for stratified OR calculation",
                error_code="STRATA_NO_VALID_STRATUM",
            )
        W = np.array([1 / v if v > 0 else 0.0 for v in variances])
        logORs_np = np.array(log_ors)

        overall_fixed = None
        overall_random = None
        heterogeneity = None

        if W.sum() > 0:
            fixed_log = float((W * logORs_np).sum() / W.sum())
            fixed_se = float(np.sqrt(1.0 / W.sum()))
            z = 1.96
            fixed_ci = [np.exp(fixed_log - z * fixed_se), np.exp(fixed_log + z * fixed_se)]
            overall_fixed = StratifiedOverallResult(
                effect=float(np.exp(fixed_log)), ci=[float(fixed_ci[0]), float(fixed_ci[1])], measure="OR"
            )

        Q = float((W * (logORs_np - (W * logORs_np).sum() / W.sum()) ** 2).sum()) if W.sum() > 0 else 0.0
        df_h = max(len(logORs_np) - 1, 1)
        C = float(W.sum() - (W**2).sum() / W.sum()) if W.sum() > 0 else 0.0
        tau2 = max((Q - df_h) / C, 0.0) if C > 0 else 0.0
        if tau2 >= 0:
            W_star = 1.0 / (np.array(variances) + tau2)
            if W_star.sum() > 0:
                random_log = float((W_star * logORs_np).sum() / W_star.sum())
                random_se = float(np.sqrt(1.0 / W_star.sum()))
                z = 1.96
                random_ci = [np.exp(random_log - z * random_se), np.exp(random_log + z * random_se)]
                overall_random = StratifiedOverallResult(
                    effect=float(np.exp(random_log)), ci=[float(random_ci[0]), float(random_ci[1])], measure="OR"
                )

        if Q > 0:
            i2 = max((Q - df_h) / Q, 0.0)
            p_hetero = float(chi2.sf(Q, df_h))
            heterogeneity = StratifiedHeterogeneity(
                Q=float(Q),
                df=int(df_h),
                p_value=p_hetero,
                I2=float(i2 * 100.0),
            )

        overall = overall_random or overall_fixed
        return StratifiedResult(
            measure="OR",
            strata=strata,
            overall=overall,
            overall_fixed=overall_fixed,
            overall_random=overall_random,
            heterogeneity=heterogeneity,
        )

    def _run_mean_difference(
        self,
        df: pd.DataFrame,
        dep: str,
        indep: str,
        stratum: str,
        indep_vals: Sequence,
    ) -> StratifiedResult:
        strata_names = sorted(df[stratum].dropna().unique().tolist())
        notes: List[str] = []
        indep_key = indep
        g0: Optional[float] = None
        g1: Optional[float] = None
        auto_map: Dict[str, str] = {}

        group_vals = sorted(indep_vals)
        if len(group_vals) != 2:
            if is_numeric_dtype(df[indep]):
                med = float(df[indep].median())
                df = df.copy()
                indep_key = "__indep_bin__"
                df[indep_key] = (df[indep] > med).astype(int)
                g0, g1 = 0, 1
                auto_map = {"original_variable": indep, "strategy": "median_split", "threshold": str(med)}
                notes.append(f"{indep} 数值型变量按中位数 {med:.4f} 自动二分。")
            else:
                vc = df[indep].value_counts()
                top2 = vc.index[:2].tolist()
                if len(top2) < 2:
                    raise AnalysisError(
                        "Stratified mean difference requires at least two groups or numeric exposure to auto-binarize",
                        error_code="STRATA_TWO_GROUPS_REQUIRED",
                    )
                df = df[df[indep].isin(top2)].copy()
                indep_key = indep
                g0, g1 = top2[0], top2[1]
                auto_map = {"original_variable": indep, "strategy": "top2_categories", "retained": [str(v) for v in top2]}
                notes.append(f"{indep} 多分类变量仅保留出现次数最高的两类 {top2}.")
        else:
            indep_key = indep
            g0, g1 = group_vals[0], group_vals[1]

        strata_entries: List[StratifiedStratumResult] = []
        weights: List[float] = []
        effects: List[float] = []

        for s in strata_names:
            dfs = df[df[stratum] == s]
            y0 = dfs[dfs[indep_key] == g0][dep].astype(float)
            y1 = dfs[dfs[indep_key] == g1][dep].astype(float)
            if len(y0) < 2 or len(y1) < 2:
                notes.append(f"分层 {s} 样本量不足（{len(y0)}, {len(y1)}），跳过。")
                continue
            mean0, mean1 = float(y0.mean()), float(y1.mean())
            var0, var1 = float(y0.var(ddof=1)), float(y1.var(ddof=1))
            n0, n1 = len(y0), len(y1)
            effect = mean1 - mean0
            se = float(np.sqrt(var0 / n0 + var1 / n1))
            z = 1.96
            ci = [effect - z * se, effect + z * se]
            weight = 1.0 / (se**2) if se > 0 else 0.0
            strata_entries.append(
                StratifiedStratumResult(
                    stratum=str(s),
                    effect=float(effect),
                    ci=[float(ci[0]), float(ci[1])],
                    weight=float(weight),
                    n0=float(n0),
                    n1=float(n1),
                    n=float(n0 + n1),
                )
            )
            if weight > 0:
                weights.append(weight)
                effects.append(effect)

        overall = None
        if sum(weights) > 0:
            overall_effect = float(np.sum(np.array(effects) * np.array(weights)) / np.sum(weights))
            overall_se = float(np.sqrt(1.0 / np.sum(weights)))
            z = 1.96
            overall_ci = [overall_effect - z * overall_se, overall_effect + z * overall_se]
            overall = StratifiedOverallResult(
                effect=overall_effect, ci=[float(overall_ci[0]), float(overall_ci[1])], measure="MD"
            )

        return StratifiedResult(
            measure="MD",
            strata=strata_entries,
            overall=overall,
            overall_fixed=overall,
            overall_random=None,
            heterogeneity=None,
            auto_binarized=auto_map or None,
            notes=notes or None,
        )
