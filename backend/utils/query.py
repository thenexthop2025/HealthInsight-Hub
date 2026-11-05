"""Shared query normalization utilities for data sources."""
from typing import Any, Dict, List, Optional

ALL_SENTINELS = {"all", "*all*"}

def ensure_list(value: Any) -> List[Any]:
    """Normalize a value to a list, removing empty elements."""
    if value is None:
        return []
    if isinstance(value, list):
        return [item for item in value if item not in (None, "", [])]
    return [value]

def normalize_query_params(params: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Normalize incoming query parameters for downstream APIs."""
    if not params:
        return {}

    normalized: Dict[str, Any] = {}

    for key, value in params.items():
        raw_values = ensure_list(value)
        cleaned: List[Any] = []
        for item in raw_values:
            if isinstance(item, str):
                stripped = item.strip()
                if stripped.lower() in ALL_SENTINELS or not stripped:
                    continue
                cleaned.append(stripped)
            else:
                cleaned.append(item)

        if not cleaned:
            continue

        if key.lower() == "year":
            cleaned = [str(item)[:4] for item in cleaned if str(item)]

        if not cleaned:
            continue

        normalized[key] = cleaned if len(cleaned) > 1 else cleaned[0]

    return normalized
