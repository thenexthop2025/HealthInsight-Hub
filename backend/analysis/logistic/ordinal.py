from typing import Any, Dict, List
import pandas as pd
from statsmodels.miscmodels.ordinal_model import OrderedModel


def run_logistic_ordinal(df: pd.DataFrame, dependent_var: str, independent_vars: List[str], control_vars: List[str] = None) -> Dict[str, Any]:
    control_vars = control_vars or []
    all_vars = [dependent_var] + independent_vars + control_vars
    data = df[all_vars].dropna()
    if len(data) < 10:
        return {'error': 'Insufficient data for ordinal logistic regression (>=10)'}

    y = data[dependent_var]
    X = data[independent_vars + control_vars]

    # 转为有序类别（若可能）
    if not pd.api.types.is_categorical_dtype(y):
        try:
            y = pd.Categorical(y, ordered=True)
        except Exception:
            cats = sorted(y.unique())
            y = pd.Categorical(y, categories=cats, ordered=True)

    try:
        model = OrderedModel(y, X, distr='logit')
        res = model.fit(method='bfgs', disp=False, maxiter=200)
    except Exception as e:
        return {'error': f'OrderedModel fit failed: {e}'}

    params = res.params.to_dict(); pvalues = res.pvalues.to_dict(); bse = res.bse.to_dict()
    thresholds = {k: float(v) for k, v in params.items() if 'threshold' in k}
    coefficients = [
        {
            'variable': name,
            'coefficient': float(params[name]),
            'std_error': float(bse.get(name, float('nan'))),
            'p_value': float(pvalues.get(name, float('nan')))
        }
        for name in X.columns if name in params
    ]

    return {
        'dependent_variable': dependent_var,
        'independent_variables': independent_vars,
        'control_variables': control_vars,
        'model_type': 'ordinal_logistic_regression',
        'coefficients': coefficients,
        'thresholds': thresholds,
        'log_likelihood': float(res.llf),
        'aic': float(res.aic),
        'bic': float(res.bic),
        'converged': bool(res.mle_retvals.get('converged', True)),
        'sample_size': int(len(data)),
    }


