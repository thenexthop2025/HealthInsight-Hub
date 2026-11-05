"""Utilities to load data source configurations from JSON files."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, Any

from schemas.data_source import (
    DataSourceRegistry,
    DataSourceConfig,
    DatasetConfig,
    FieldMapping,
    FilterConfig,
    FieldType,
    FilterType,
)

CONFIG_DIR = Path(__file__).resolve().parent


def _load_json(name: str) -> Dict[str, Any]:
    path = CONFIG_DIR / name
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _parse_field_mappings(raw_mappings):
    mappings = []
    for mapping in raw_mappings:
        mapping = mapping.copy()
        mapping["field_type"] = FieldType(mapping["field_type"])
        mappings.append(FieldMapping(**mapping))
    return mappings


def _parse_filters(raw_filters):
    filters = []
    for filt in raw_filters:
        filt = filt.copy()
        filt["field_type"] = FieldType(filt["field_type"])
        filt["filter_type"] = FilterType(filt["filter_type"])
        filters.append(FilterConfig(**filt))
    return filters


def load_registry_from_json() -> DataSourceRegistry:
    """Build a DataSourceRegistry from JSON configuration files."""
    registry = DataSourceRegistry()

    sources_conf = _load_json("data_sources.json")
    datasets_conf = _load_json("datasets.json")

    for source_id, source_data in sources_conf.items():
        data = source_data.copy()
        data["field_mappings"] = _parse_field_mappings(data.get("field_mappings", []))
        data["filters"] = _parse_filters(data.get("filters", []))
        registry.register_source(DataSourceConfig(**data))

    for dataset_id, dataset_data in datasets_conf.items():
        registry.register_dataset(DatasetConfig(**dataset_data))

    return registry
