"""
配置管理API - 支持通过API动态管理数据源配置
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from models import User
from database import get_db
from auth import get_current_active_user
from schemas.data_source import (
    DataSourceConfig, DatasetConfig, FilterConfig, FieldMapping, 
    FilterType, FieldType, DataSourceRegistry
)
from services.data_fetcher import DataFetcher
import json
import os
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["config-management"])

# 配置存储路径
CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config")
DATA_SOURCES_FILE = os.path.join(CONFIG_DIR, "data_sources.json")
DATASETS_FILE = os.path.join(CONFIG_DIR, "datasets.json")

# 确保配置目录存在
os.makedirs(CONFIG_DIR, exist_ok=True)

def load_config_from_file(file_path: str) -> Dict[str, Any]:
    """从文件加载配置"""
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_config_to_file(file_path: str, config: Dict[str, Any]):
    """保存配置到文件"""
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

def get_dynamic_registry() -> DataSourceRegistry:
    """获取动态配置的注册表"""
    registry = DataSourceRegistry()
    
    # 加载数据源配置
    sources_config = load_config_from_file(DATA_SOURCES_FILE)
    for source_id, source_data in sources_config.items():
        try:
            source = DataSourceConfig(**source_data)
            registry.register_source(source)
        except Exception as e:
            logger.error(f"加载数据源配置失败 {source_id}: {e}")
    
    # 加载数据集配置
    datasets_config = load_config_from_file(DATASETS_FILE)
    for dataset_id, dataset_data in datasets_config.items():
        try:
            dataset = DatasetConfig(**dataset_data)
            registry.register_dataset(dataset)
        except Exception as e:
            logger.error(f"加载数据集配置失败 {dataset_id}: {e}")
    
    return registry

@router.get("/sources")
async def get_data_sources(
    current_user: User = Depends(get_current_active_user)
):
    """获取所有数据源配置"""
    try:
        registry = get_dynamic_registry()
        sources = registry.list_sources()
        
        return {
            "sources": [
                {
                    "id": source.id,
                    "name": source.name,
                    "description": source.description,
                    "category": source.category,
                    "source": source.source,
                    "api_type": source.api_type,
                    "base_url": source.base_url,
                    "endpoint": source.endpoint,
                    "field_mappings": [
                        {
                            "api_field": mapping.api_field,
                            "standard_field": mapping.standard_field,
                            "field_type": mapping.field_type.value,
                            "required": mapping.required,
                            "default_value": mapping.default_value,
                            "transform": mapping.transform
                        }
                        for mapping in source.field_mappings
                    ],
                    "filters": [
                        {
                            "name": filter_config.name,
                            "display_name": filter_config.display_name,
                            "field_type": filter_config.field_type.value,
                            "filter_type": filter_config.filter_type.value,
                            "api_field": filter_config.api_field,
                            "required": filter_config.required,
                            "options": filter_config.options,
                            "range_min": filter_config.range_min,
                            "range_max": filter_config.range_max
                        }
                        for filter_config in source.filters
                    ],
                    "supports_pagination": source.supports_pagination,
                    "page_size_param": source.page_size_param,
                    "page_offset_param": source.page_offset_param,
                    "count_param": source.count_param,
                    "max_page_size": source.max_page_size,
                    "cache_duration": source.cache_duration,
                    "auth": {
                        "auth_type": source.auth.auth_type,
                        "api_key": source.auth.api_key,
                        "api_key_header": source.auth.api_key_header,
                        "username": source.auth.username,
                        "password": source.auth.password,
                        "client_id": source.auth.oauth2_client_id,
                        "client_secret": source.auth.oauth2_client_secret,
                        "auth_url": source.auth.oauth2_auth_url,
                        "token_url": source.auth.oauth2_token_url
                    }
                }
                for source in sources
            ]
        }
    except Exception as e:
        logger.error(f"获取数据源配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取数据源配置失败")

def generate_source_id(name: str, existing_ids: set) -> str:
    """基于名称生成唯一的数据源ID"""
    import re
    import uuid
    
    # 基础ID生成：转换为小写，替换特殊字符为下划线
    base_id = re.sub(r'[^a-z0-9\u4e00-\u9fa5]', '_', name.lower())
    base_id = re.sub(r'_+', '_', base_id).strip('_')
    
    # 如果基础ID为空，使用默认前缀
    if not base_id:
        base_id = 'api'
    
    # 检查是否已存在，如果存在则添加数字后缀
    source_id = base_id
    counter = 1
    while source_id in existing_ids:
        source_id = f"{base_id}_{counter}"
        counter += 1
    
    return source_id

@router.post("/sources")
async def create_data_source(
    source_data: Dict[str, Any],
    current_user: User = Depends(get_current_active_user)
):
    """创建新的数据源配置"""
    try:
        # 加载现有配置
        sources_config = load_config_from_file(DATA_SOURCES_FILE)
        existing_ids = set(sources_config.keys())
        
        # 记录是否自动生成ID
        auto_generated = False
        
        # 如果没有提供ID或ID为空，自动生成
        if not source_data.get('id') or source_data['id'].strip() == '':
            name = source_data.get('name', '')
            if not name:
                raise HTTPException(status_code=400, detail="API名称为空，无法生成ID")
            
            source_data['id'] = generate_source_id(name, existing_ids)
            auto_generated = True
            logger.info(f"自动生成数据源ID: {source_data['id']}")
        
        # 验证数据源配置
        source = DataSourceConfig(**source_data)
        
        # 检查ID是否已存在
        if source.id in sources_config:
            raise HTTPException(status_code=400, detail=f"数据源ID '{source.id}' 已存在")
        
        # 添加新数据源
        sources_config[source.id] = source.dict()
        save_config_to_file(DATA_SOURCES_FILE, sources_config)
        
        return {
            "message": "数据源创建成功",
            "source_id": source.id,
            "source_name": source.name,
            "auto_generated_id": auto_generated
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建数据源失败: {str(e)}")
        raise HTTPException(status_code=400, detail=f"创建数据源失败: {str(e)}")

@router.put("/sources/{source_id}")
async def update_data_source(
    source_id: str,
    source_data: Dict[str, Any],
    current_user: User = Depends(get_current_active_user)
):
    """更新数据源配置"""
    try:
        # 验证数据源配置
        source = DataSourceConfig(**source_data)
        
        # 确保ID一致
        if source.id != source_id:
            raise HTTPException(status_code=400, detail="数据源ID不匹配")
        
        # 加载现有配置
        sources_config = load_config_from_file(DATA_SOURCES_FILE)
        
        # 检查数据源是否存在
        if source_id not in sources_config:
            raise HTTPException(status_code=404, detail="数据源不存在")
        
        # 更新数据源
        sources_config[source_id] = source.dict()
        save_config_to_file(DATA_SOURCES_FILE, sources_config)
        
        return {
            "message": "数据源更新成功",
            "source_id": source_id,
            "source_name": source.name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新数据源失败: {str(e)}")
        raise HTTPException(status_code=400, detail=f"更新数据源失败: {str(e)}")

@router.delete("/sources/{source_id}")
async def delete_data_source(
    source_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """删除数据源配置"""
    try:
        # 加载现有配置
        sources_config = load_config_from_file(DATA_SOURCES_FILE)
        
        # 检查数据源是否存在
        if source_id not in sources_config:
            raise HTTPException(status_code=404, detail="数据源不存在")
        
        # 检查是否有数据集使用此数据源
        datasets_config = load_config_from_file(DATASETS_FILE)
        used_datasets = [
            dataset_id for dataset_id, dataset_data in datasets_config.items()
            if dataset_data.get("data_source_id") == source_id
        ]
        
        if used_datasets:
            raise HTTPException(
                status_code=400, 
                detail=f"无法删除数据源，以下数据集正在使用: {', '.join(used_datasets)}"
            )
        
        # 删除数据源
        del sources_config[source_id]
        save_config_to_file(DATA_SOURCES_FILE, sources_config)
        
        return {
            "message": "数据源删除成功",
            "source_id": source_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除数据源失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除数据源失败: {str(e)}")

@router.get("/datasets")
async def get_datasets(
    current_user: User = Depends(get_current_active_user)
):
    """获取所有数据集配置"""
    try:
        registry = get_dynamic_registry()
        datasets = registry.list_datasets()
        
        return {
            "datasets": [
                {
                    "id": dataset.id,
                    "name": dataset.name,
                    "description": dataset.description,
                    "category": dataset.category,
                    "source": dataset.source,
                    "data_source_id": dataset.data_source_id,
                    "indicator_code": dataset.indicator_code,
                    "dimension_code": dataset.dimension_code,
                    "custom_endpoint": dataset.custom_endpoint,
                    "default_params": dataset.default_params,
                    "preview_limit": dataset.preview_limit,
                    "import_limit": dataset.import_limit
                }
                for dataset in datasets
            ]
        }
    except Exception as e:
        logger.error(f"获取数据集配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取数据集配置失败")

@router.post("/datasets")
async def create_dataset(
    dataset_data: Dict[str, Any],
    current_user: User = Depends(get_current_active_user)
):
    """创建新的数据集配置"""
    try:
        # 验证数据集配置
        dataset = DatasetConfig(**dataset_data)
        
        # 检查数据源是否存在
        sources_config = load_config_from_file(DATA_SOURCES_FILE)
        if dataset.data_source_id not in sources_config:
            raise HTTPException(status_code=400, detail=f"数据源 '{dataset.data_source_id}' 不存在")
        
        # 加载现有配置
        datasets_config = load_config_from_file(DATASETS_FILE)
        
        # 检查ID是否已存在
        if dataset.id in datasets_config:
            raise HTTPException(status_code=400, detail=f"数据集ID '{dataset.id}' 已存在")
        
        # 添加新数据集
        datasets_config[dataset.id] = dataset.dict()
        save_config_to_file(DATASETS_FILE, datasets_config)
        
        return {
            "message": "数据集创建成功",
            "dataset_id": dataset.id,
            "dataset_name": dataset.name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建数据集失败: {str(e)}")
        raise HTTPException(status_code=400, detail=f"创建数据集失败: {str(e)}")

@router.put("/datasets/{dataset_id}")
async def update_dataset(
    dataset_id: str,
    dataset_data: Dict[str, Any],
    current_user: User = Depends(get_current_active_user)
):
    """更新数据集配置"""
    try:
        # 验证数据集配置
        dataset = DatasetConfig(**dataset_data)
        
        # 确保ID一致
        if dataset.id != dataset_id:
            raise HTTPException(status_code=400, detail="数据集ID不匹配")
        
        # 检查数据源是否存在
        sources_config = load_config_from_file(DATA_SOURCES_FILE)
        if dataset.data_source_id not in sources_config:
            raise HTTPException(status_code=400, detail=f"数据源 '{dataset.data_source_id}' 不存在")
        
        # 加载现有配置
        datasets_config = load_config_from_file(DATASETS_FILE)
        
        # 检查数据集是否存在
        if dataset_id not in datasets_config:
            raise HTTPException(status_code=404, detail="数据集不存在")
        
        # 更新数据集
        datasets_config[dataset_id] = dataset.dict()
        save_config_to_file(DATASETS_FILE, datasets_config)
        
        return {
            "message": "数据集更新成功",
            "dataset_id": dataset_id,
            "dataset_name": dataset.name
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新数据集失败: {str(e)}")
        raise HTTPException(status_code=400, detail=f"更新数据集失败: {str(e)}")

@router.delete("/datasets/{dataset_id}")
async def delete_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """删除数据集配置"""
    try:
        # 加载现有配置
        datasets_config = load_config_from_file(DATASETS_FILE)
        
        # 检查数据集是否存在
        if dataset_id not in datasets_config:
            raise HTTPException(status_code=404, detail="数据集不存在")
        
        # 删除数据集
        del datasets_config[dataset_id]
        save_config_to_file(DATASETS_FILE, datasets_config)
        
        return {
            "message": "数据集删除成功",
            "dataset_id": dataset_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除数据集失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除数据集失败: {str(e)}")

@router.delete("/datasets")
async def delete_all_datasets(
    current_user: User = Depends(get_current_active_user)
):
    """删除所有数据集配置"""
    try:
        # 加载现有配置
        datasets_config = load_config_from_file(DATASETS_FILE)
        
        # 获取所有数据集ID
        dataset_count = len(datasets_config)
        
        # 清空所有数据集
        datasets_config = {}
        save_config_to_file(DATASETS_FILE, datasets_config)
        
        return {
            "message": "所有数据集删除成功",
            "deleted_count": dataset_count
        }
        
    except Exception as e:
        logger.error(f"删除所有数据集失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除所有数据集失败: {str(e)}")

@router.post("/test-connection")
async def test_connection(
    source_data: Dict[str, Any],
    current_user: User = Depends(get_current_active_user)
):
    """测试数据源连接"""
    try:
        # 验证数据源配置
        source = DataSourceConfig(**source_data)
        
        # 为特定数据源提供默认参数
        test_params = {}
        if source.id == "who_gho":
            # WHO GHO需要指标代码
            test_params = {"indicator_code": "WHOSIS_000001"}
        
        # 创建测试数据集
        test_dataset = DatasetConfig(
            id="test_dataset",
            name="测试数据集",
            description="用于测试连接的数据集",
            category="测试",
            source="Test",
            data_source_id=source.id,
            indicator_code=test_params.get("indicator_code") if test_params.get("indicator_code") else None,
            import_limit=10  # 测试时只获取10条记录，但获取真实总记录数
        )
        
        # 测试连接 - 添加count参数以获取真实总记录数
        test_params_with_count = test_params.copy()
        if source.supports_pagination and source.count_param:
            test_params_with_count[source.count_param] = "true"
        
        data_fetcher = DataFetcher()
        result = await data_fetcher.fetch_data(source, test_dataset, test_params_with_count, is_import=False)
        
        if "error" in result:
            return {
                "success": False,
                "error": result["error"]
            }
        
        # 获取该数据源关联的数据集数量
        datasets_config = load_config_from_file(DATASETS_FILE)
        related_datasets = [
            dataset_id for dataset_id, dataset_data in datasets_config.items()
            if dataset_data.get("data_source_id") == source.id
        ]
        
        return {
            "success": True,
            "message": "连接测试成功",
            "api_info": {
                "total_records": result.get("total_records", 0),
                "columns": result.get("columns", []),
                "sample_data": result.get("data", [])[:5],  # 只返回前5条数据用于预览
                "note": result.get("note", "")
            },
            "source_info": {
                "related_datasets_count": len(related_datasets),
                "related_datasets": related_datasets[:10],  # 只显示前10个数据集名称
                "api_type": source.api_type,
                "base_url": source.base_url,
                "endpoint": source.endpoint
            }
        }
        
    except Exception as e:
        logger.error(f"测试连接失败: {str(e)}")
        return {
            "success": False,
            "error": f"测试连接失败: {str(e)}"
        }

@router.get("/export")
async def export_config(
    current_user: User = Depends(get_current_active_user)
):
    """导出所有配置"""
    try:
        sources_config = load_config_from_file(DATA_SOURCES_FILE)
        datasets_config = load_config_from_file(DATASETS_FILE)
        
        return {
            "exported_at": datetime.utcnow().isoformat(),
            "data_sources": sources_config,
            "datasets": datasets_config
        }
        
    except Exception as e:
        logger.error(f"导出配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"导出配置失败: {str(e)}")

@router.post("/import")
async def import_config(
    config_data: Dict[str, Any],
    current_user: User = Depends(get_current_active_user)
):
    """导入配置"""
    try:
        # 验证配置数据
        if "data_sources" not in config_data or "datasets" not in config_data:
            raise HTTPException(status_code=400, detail="配置数据格式错误")
        
        # 备份现有配置
        backup_suffix = datetime.now().strftime("%Y%m%d_%H%M%S")
        if os.path.exists(DATA_SOURCES_FILE):
            os.rename(DATA_SOURCES_FILE, f"{DATA_SOURCES_FILE}.backup_{backup_suffix}")
        if os.path.exists(DATASETS_FILE):
            os.rename(DATASETS_FILE, f"{DATASETS_FILE}.backup_{backup_suffix}")
        
        # 保存新配置
        save_config_to_file(DATA_SOURCES_FILE, config_data["data_sources"])
        save_config_to_file(DATASETS_FILE, config_data["datasets"])
        
        return {
            "message": "配置导入成功",
            "backup_created": True,
            "backup_suffix": backup_suffix
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"导入配置失败: {str(e)}")
        raise HTTPException(status_code=400, detail=f"导入配置失败: {str(e)}")

@router.get("/field-types")
async def get_field_types(
    current_user: User = Depends(get_current_active_user)
):
    """获取可用的字段类型"""
    return {
        "field_types": [
            {"value": field_type.value, "label": field_type.value.title()}
            for field_type in FieldType
        ]
    }

@router.get("/filter-types")
async def get_filter_types(
    current_user: User = Depends(get_current_active_user)
):
    """获取可用的筛选类型"""
    return {
        "filter_types": [
            {"value": filter_type.value, "label": filter_type.value.title()}
            for filter_type in FilterType
        ]
    }
