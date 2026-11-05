from typing import Any, Dict, List
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix
import statsmodels.api as sm


def run_logistic_binary(df: pd.DataFrame, dependent_var: str, independent_vars: List[str], control_vars: List[str] = None) -> Dict[str, Any]:
    control_vars = control_vars or []
    all_vars = [dependent_var] + independent_vars + control_vars
    data = df[all_vars].dropna()
    if len(data) < 10:
        return {'error': 'Insufficient data for logistic regression (>=10)'}

    y = data[dependent_var]
    X = data[independent_vars + control_vars]

    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    if len(np.unique(y_encoded)) != 2:
        return {'error': f'Dependent variable must be binary, found {len(np.unique(y_encoded))} unique values', 'unique_values': list(np.unique(y))}

    X_train, X_test, y_train, y_test = train_test_split(X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = LogisticRegression(random_state=42, max_iter=1000)
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    y_proba = model.predict_proba(X_test_scaled)
    accuracy = model.score(X_test_scaled, y_test)
    auc = roc_auc_score(y_test, y_proba[:, 1]) if len(np.unique(y_test)) == 2 else None
    cm = confusion_matrix(y_test, y_pred).tolist()

    X_full_const = sm.add_constant(X)
    sm_logit = sm.Logit(y_encoded, X_full_const).fit(disp=0)
    ci = sm_logit.conf_int(); params = sm_logit.params; se = sm_logit.bse; pvals = sm_logit.pvalues
    names = ['intercept'] + list(X.columns)
    coefficients = []
    for i, name in enumerate(names):
        c = float(params.iloc[i]); lo, hi = float(ci.iloc[i, 0]), float(ci.iloc[i, 1])
        coefficients.append({
            'variable': name,
            'coefficient': c,
            'std_error': float(se.iloc[i]),
            'p_value': float(pvals.iloc[i]),
            'odds_ratio': float(np.exp(c)),
            'confidence_interval': [float(np.exp(lo)), float(np.exp(hi))],
            'significant': bool(pvals.iloc[i] < 0.05)
        })

    class_report = classification_report(y_test, y_pred, output_dict=True)

    return {
        'dependent_variable': dependent_var,
        'independent_variables': independent_vars,
        'control_variables': control_vars,
        'model_performance': {
            'accuracy': float(accuracy),
            'auc': float(auc) if auc is not None else None,
            'precision': float(class_report['weighted avg']['precision']),
            'recall': float(class_report['weighted avg']['recall']),
            'f1_score': float(class_report['weighted avg']['f1-score'])
        },
        'coefficients': coefficients,
        'predictions': {
            'test_predictions': y_pred.tolist(),
            'test_probabilities': y_proba.tolist(),
            'test_actual': y_test.tolist(),
        },
        'diagnostics': { 'confusion_matrix': cm },
        'sample_size': int(len(data)),
        'training_size': int(len(X_train)),
        'test_size': int(len(X_test)),
    }


