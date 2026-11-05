from typing import Any, Dict, List
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix


def run_logistic_multinomial(df: pd.DataFrame, dependent_var: str, independent_vars: List[str], control_vars: List[str] = None) -> Dict[str, Any]:
    control_vars = control_vars or []
    all_vars = [dependent_var] + independent_vars + control_vars
    data = df[all_vars].dropna()
    if len(data) < 10:
        return {'error': 'Insufficient data for multinomial logistic regression (>=10)'}

    y = data[dependent_var]
    X = data[independent_vars + control_vars]

    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    if len(np.unique(y_encoded)) < 3:
        return {'error': f'Dependent variable must be multiclass (>=3), found {len(np.unique(y_encoded))} unique values', 'unique_values': list(np.unique(y))}

    X_train, X_test, y_train, y_test = train_test_split(X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    clf = LogisticRegression(random_state=42, max_iter=2000, multi_class='multinomial', solver='lbfgs')
    clf.fit(X_train_scaled, y_train)

    y_pred = clf.predict(X_test_scaled)
    proba = clf.predict_proba(X_test_scaled)
    cm = confusion_matrix(y_test, y_pred).tolist()
    report = classification_report(y_test, y_pred, output_dict=True)
    accuracy = float(clf.score(X_test_scaled, y_test))

    coef_matrix = getattr(clf, 'coef_', None)
    intercept = getattr(clf, 'intercept_', None)
    coefficients: List[Dict[str, Any]] = []
    if coef_matrix is not None:
        feature_names = list(X.columns)
        classes = list(le.classes_)
        for class_idx in range(coef_matrix.shape[0]):
            class_label = classes[class_idx] if class_idx < len(classes) else str(class_idx)
            if intercept is not None and len(intercept) > class_idx:
                coefficients.append({
                    'variable': f'intercept[{class_label}]',
                    'coefficient': float(intercept[class_idx]),
                    'p_value': None, 'std_error': None, 'significant': False,
                })
            for feat_idx, feat in enumerate(feature_names):
                coefficients.append({
                    'variable': f'{feat}[{class_label}]',
                    'coefficient': float(coef_matrix[class_idx, feat_idx]),
                    'p_value': None, 'std_error': None, 'significant': False,
                })

    return {
        'dependent_variable': dependent_var,
        'independent_variables': independent_vars,
        'control_variables': control_vars,
        'model_type': 'multinomial_logistic_regression',
        'model_performance': {
            'accuracy': accuracy,
            'precision_macro': float(report.get('macro avg', {}).get('precision', 0.0)),
            'recall_macro': float(report.get('macro avg', {}).get('recall', 0.0)),
            'f1_macro': float(report.get('macro avg', {}).get('f1-score', 0.0)),
            'precision_weighted': float(report.get('weighted avg', {}).get('precision', 0.0)),
            'recall_weighted': float(report.get('weighted avg', {}).get('recall', 0.0)),
            'f1_weighted': float(report.get('weighted avg', {}).get('f1-score', 0.0))
        },
        'diagnostics': { 'confusion_matrix': cm },
        'predictions': {
            'test_predictions': y_pred.tolist(),
            'test_probabilities': proba.tolist(),
            'test_actual': y_test.tolist(),
        },
        'coefficients': coefficients,
        'classes': le.classes_.tolist(),
        'sample_size': int(len(data)),
    }


