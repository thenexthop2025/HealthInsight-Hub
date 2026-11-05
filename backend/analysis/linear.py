from typing import Any, Dict, List
import pandas as pd
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.diagnostic import het_breuschpagan
from scipy.stats import shapiro


def run_linear(df: pd.DataFrame, dependent_var: str, independent_vars: List[str], control_vars: List[str] = None, **kwargs) -> Dict[str, Any]:
    control_vars = control_vars or []
    all_vars = [dependent_var] + independent_vars + control_vars
    data = df[all_vars].dropna()
    if len(data) < 10:
        return {'error': 'Insufficient data for linear regression (>=10)', 'model': None}

    y = data[dependent_var]
    X = data[independent_vars + control_vars]

    # 可选：交互项/二次项
    add_interactions = kwargs.get('add_interactions') is True if kwargs else False
    add_quadratic = kwargs.get('add_quadratic') is True if kwargs else False
    if add_interactions and X.shape[1] >= 2:
        cols = list(X.columns)
        for i in range(len(cols)):
            for j in range(i+1, len(cols)):
                X[f'{cols[i]}*{cols[j]}'] = X[cols[i]] * X[cols[j]]
    if add_quadratic:
        for c in list(X.columns):
            X[f'{c}^2'] = X[c] ** 2

    X_with_const = sm.add_constant(X)
    model = sm.OLS(y, X_with_const).fit()
    robust = model.get_robustcov_results(cov_type='HC3')

    y_pred = model.predict(X_with_const)
    residuals = y - y_pred

    ci_df = model.conf_int(); r_ci_arr = robust.conf_int()
    coefficients = []
    for i, var in enumerate(['const'] + independent_vars + control_vars):
        coefficients.append({
            'variable': var,
            'coefficient': float(model.params.iloc[i]),
            'std_error': float(model.bse.iloc[i]),
            't_statistic': float(model.tvalues.iloc[i]),
            'p_value': float(model.pvalues.iloc[i]),
            'confidence_interval': [float(ci_df.iloc[i,0]), float(ci_df.iloc[i,1])],
            'robust_std_error': float(robust.bse[i]),
            'robust_t': float(robust.tvalues[i]),
            'robust_p_value': float(robust.pvalues[i]),
            'robust_confidence_interval': [float(r_ci_arr[i][0]), float(r_ci_arr[i][1])],
        })

    # 诊断
    try:
        X_no_const = sm.add_constant(X, has_constant='add')
        names = ['const'] + list(X.columns)
        vif = [{'variable': n, 'vif': float(variance_inflation_factor(X_no_const.values, i))} for i, n in enumerate(names)]
    except Exception:
        vif = []
    try:
        bp_lm, bp_lmpval, bp_f, bp_fp = het_breuschpagan(model.resid, model.model.exog)
        bp = {'lm': float(bp_lm), 'lm_p_value': float(bp_lmpval), 'f_value': float(bp_f), 'f_p_value': float(bp_fp)}
    except Exception:
        bp = None
    try:
        sh_stat, sh_p = shapiro(model.resid)
        sh_test = {'statistic': float(sh_stat), 'p_value': float(sh_p)}
    except Exception:
        sh_test = None

    return {
        'dependent_variable': dependent_var,
        'independent_variables': independent_vars,
        'control_variables': control_vars,
        'model_summary': {
            'r_squared': float(model.rsquared),
            'adj_r_squared': float(model.rsquared_adj),
            'aic': float(model.aic),
            'bic': float(model.bic),
            'f_statistic': float(model.fvalue),
            'f_p_value': float(model.f_pvalue),
            'sample_size': int(len(data))
        },
        'coefficients': coefficients,
        'residuals': {'values': residuals.tolist(), 'mean': float(residuals.mean()), 'std': float(residuals.std())},
        'predictions': y_pred.tolist(),
        'actual_values': y.tolist(),
        'diagnostics': {'vif': vif, 'breusch_pagan': bp, 'shapiro': sh_test}
    }


