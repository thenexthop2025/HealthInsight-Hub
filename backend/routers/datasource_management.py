"""
数据源管理路由 - 独立管理数据源配置
"""
import os
import json
import logging
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from models import User
from auth import get_current_active_user
from database import get_db
from schemas.data_source import DataSourceConfig, FieldMapping, FilterConfig

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/datasources", tags=["数据源管理"])

# 配置存储路径
CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config")
DATASOURCES_FILE = os.path.join(CONFIG_DIR, "data_sources.json")

# 确保配置目录存在
os.makedirs(CONFIG_DIR, exist_ok=True)

def load_datasources_from_file() -> Dict[str, Any]:
    """从文件加载数据源配置"""
    if os.path.exists(DATASOURCES_FILE):
        with open(DATASOURCES_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_datasources_to_file(datasources: Dict[str, Any]):
    """保存数据源配置到文件"""
    with open(DATASOURCES_FILE, 'w', encoding='utf-8') as f:
        json.dump(datasources, f, indent=2, ensure_ascii=False)

def generate_datasource_id(name: str, existing_ids: set) -> str:
    """基于名称生成唯一的数据源ID"""
    import re
    import uuid

    # 基础ID生成：转换为小写，替换特殊字符为下划线
    base_id = re.sub(r'[^a-z0-9\u4e00-\u9fa5]', '_', name.lower())
    base_id = re.sub(r'_+', '_', base_id).strip('_')

    # 如果基础ID为空，使用默认前缀
    if not base_id:
        base_id = 'datasource'

    # 检查是否已存在，如果存在则添加数字后缀
    datasource_id = base_id
    counter = 1
    while datasource_id in existing_ids:
        datasource_id = f"{base_id}_{counter}"
        counter += 1

    return datasource_id

@router.get("/")
async def get_datasources(
    current_user: User = Depends(get_current_active_user)
):
    """获取所有数据源配置"""
    try:
        datasources_config = load_datasources_from_file()
        
        return {
            "datasources": [
                {
                    "id": datasource_id,
                    "name": datasource_data.get("name", ""),
                    "description": datasource_data.get("description", ""),
                    "category": datasource_data.get("category", ""),
                    "source": datasource_data.get("source", ""),
                    "api_type": datasource_data.get("api_type", ""),
                    "api_id": datasource_data.get("api_id"),
                    "base_url": datasource_data.get("base_url", ""),
                    "endpoint": datasource_data.get("endpoint", ""),
                    "method": datasource_data.get("method", "GET"),
                    "headers": datasource_data.get("headers"),
                    "timeout": datasource_data.get("timeout", 30),
                    "auth": datasource_data.get("auth", {}),
                    "current_api_id": datasource_data.get("current_api_id"),
                    "api_configurations": datasource_data.get("api_configurations", {}),
                    # 为了兼容性，提供当前API的字段映射
                    "field_mappings": datasource_data.get("api_configurations", {}).get(
                        datasource_data.get("current_api_id", datasource_data.get("api_id")), {}
                    ).get("field_mappings", []),
                    "filters": datasource_data.get("api_configurations", {}).get(
                        datasource_data.get("current_api_id", datasource_data.get("api_id")), {}
                    ).get("filters", []),
                    "supports_pagination": datasource_data.get("supports_pagination", True),
                    "page_size_param": datasource_data.get("page_size_param", "$top"),
                    "page_offset_param": datasource_data.get("page_offset_param", "$skip"),
                    "count_param": datasource_data.get("count_param", "$count"),
                    "max_page_size": datasource_data.get("max_page_size", 1000),
                    "cache_duration": datasource_data.get("cache_duration", 300),
                }
                for datasource_id, datasource_data in datasources_config.items()
            ]
        }
    except Exception as e:
        logger.error(f"获取数据源配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取数据源配置失败")

@router.post("/")
async def create_datasource(
    datasource_data: Dict[str, Any],
    current_user: User = Depends(get_current_active_user)
):
    """创建新的数据源配置"""
    try:
        # 加载现有配置
        datasources_config = load_datasources_from_file()
        existing_ids = set(datasources_config.keys())
        
        # 记录是否自动生成ID
        auto_generated = False
        
        # 如果没有提供ID或ID为空，自动生成
        if not datasource_data.get('id') or datasource_data['id'].strip() == '':
            name = datasource_data.get('name', '')
            if not name:
                raise HTTPException(status_code=400, detail="数据源名称为空，无法生成ID")
            
            datasource_data['id'] = generate_datasource_id(name, existing_ids)
            auto_generated = True
            logger.info(f"自动生成数据源ID: {datasource_data['id']}")
        
        # 验证数据源配置
        datasource = DataSourceConfig(**datasource_data)
        
        # 检查ID是否已存在
        if datasource.id in datasources_config:
            raise HTTPException(status_code=400, detail=f"数据源ID '{datasource.id}' 已存在")
        
        # 添加新数据源
        datasources_config[datasource.id] = datasource.dict()
        save_datasources_to_file(datasources_config)
        
        return {
            "message": "数据源创建成功",
            "datasource_id": datasource.id,
            "datasource_name": datasource.name,
            "auto_generated_id": auto_generated
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建数据源失败: {str(e)}")
        raise HTTPException(status_code=400, detail=f"创建数据源失败: {str(e)}")

@router.put("/{datasource_id}")
async def update_datasource(
    datasource_id: str,
    datasource_data: Dict[str, Any],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """更新数据源配置"""
    try:
        # 加载现有配置
        datasources_config = load_datasources_from_file()
        
        # 检查数据源是否存在
        if datasource_id not in datasources_config:
            raise HTTPException(status_code=404, detail="数据源不存在")
        
        # 获取现有配置
        existing_config = datasources_config[datasource_id]
        
        # 验证数据源配置
        datasource = DataSourceConfig(**datasource_data)
        
        # 转换为字典
        new_config = datasource.dict()
        
        # 保留现有的多API配置，并合并新配置
        if "api_configurations" in existing_config and existing_config["api_configurations"]:
            # 如果新配置中有api_configurations，合并它们
            if "api_configurations" in new_config and new_config["api_configurations"]:
                # 合并：保留旧的，添加新的
                merged_configs = existing_config["api_configurations"].copy()
                merged_configs.update(new_config["api_configurations"])
                new_config["api_configurations"] = merged_configs
            else:
                # 如果新配置中没有api_configurations，保留旧的
                new_config["api_configurations"] = existing_config["api_configurations"]
        
        # 确保current_api_id正确设置
        if "current_api_id" not in new_config or not new_config["current_api_id"]:
            new_config["current_api_id"] = new_config.get("api_id")
        
        # 更新数据源配置文件
        datasources_config[datasource_id] = new_config
        save_datasources_to_file(datasources_config)
        
        # 同步更新数据库中的数据源名称
        try:
            from models import DataSource as DataSourceModel
            
            # 查找数据库中对应的数据源
            # 可能通过名称模糊匹配或者精确匹配旧名称
            old_name = existing_config.get("name", "")
            new_name = new_config.get("name", "")
            
            # 如果名称发生了变化，更新数据库
            if old_name and new_name and old_name != new_name:
                # 尝试通过旧名称查找数据源
                db_datasource = db.query(DataSourceModel).filter(
                    DataSourceModel.name.like(f"%{old_name}%")
                ).first()
                
                if db_datasource:
                    db_datasource.name = new_name
                    db_datasource.description = new_config.get("description", db_datasource.description)
                    db.commit()
                    logger.info(f"已同步更新数据库中的数据源名称: {old_name} -> {new_name}")
                else:
                    logger.warning(f"未在数据库中找到数据源: {old_name}")
        except Exception as sync_error:
            # 同步失败不影响配置更新
            logger.warning(f"同步数据库失败，但配置已更新: {str(sync_error)}")
        
        return {
            "message": "数据源更新成功",
            "datasource_id": datasource_id,
            "datasource": new_config
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新数据源失败: {str(e)}")
        raise HTTPException(status_code=400, detail=f"更新数据源失败: {str(e)}")

@router.delete("/{datasource_id}")
async def delete_datasource(
    datasource_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """删除数据源配置"""
    try:
        # 加载现有配置
        datasources_config = load_datasources_from_file()
        
        # 检查数据源是否存在
        if datasource_id not in datasources_config:
            raise HTTPException(status_code=404, detail="数据源不存在")
        
        # 检查是否有数据集使用此数据源
        from .config_management import load_config_from_file
        DATASETS_FILE = os.path.join(CONFIG_DIR, "datasets.json")
        datasets_config = load_config_from_file(DATASETS_FILE)
        used_datasets = [
            dataset_id for dataset_id, dataset_data in datasets_config.items()
            if dataset_data.get("data_source_id") == datasource_id
        ]
        
        if used_datasets:
            raise HTTPException(
                status_code=400,
                detail=f"无法删除数据源，以下数据集正在使用: {', '.join(used_datasets)}"
            )
        
        # 删除数据源
        del datasources_config[datasource_id]
        save_datasources_to_file(datasources_config)
        
        return {
            "message": "数据源删除成功",
            "datasource_id": datasource_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除数据源失败: {str(e)}")
        raise HTTPException(status_code=400, detail=f"删除数据源失败: {str(e)}")

@router.get("/{datasource_id}")
async def get_datasource(
    datasource_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """获取单个数据源配置"""
    try:
        datasources_config = load_datasources_from_file()
        
        if datasource_id not in datasources_config:
            raise HTTPException(status_code=404, detail="数据源不存在")
        
        datasource_data = datasources_config[datasource_id]
        return {
            "id": datasource_id,
            "name": datasource_data.get("name", ""),
            "description": datasource_data.get("description", ""),
            "category": datasource_data.get("category", ""),
            "source": datasource_data.get("source", ""),
            "api_type": datasource_data.get("api_type", ""),
            "api_id": datasource_data.get("api_id"),
            "base_url": datasource_data.get("base_url", ""),
            "endpoint": datasource_data.get("endpoint", ""),
            "method": datasource_data.get("method", "GET"),
            "headers": datasource_data.get("headers"),
            "timeout": datasource_data.get("timeout", 30),
            "auth": datasource_data.get("auth", {}),
            "field_mappings": datasource_data.get("field_mappings", []),
            "filters": datasource_data.get("filters", []),
            "supports_pagination": datasource_data.get("supports_pagination", True),
            "page_size_param": datasource_data.get("page_size_param", "$top"),
            "page_offset_param": datasource_data.get("page_offset_param", "$skip"),
            "count_param": datasource_data.get("count_param", "$count"),
            "max_page_size": datasource_data.get("max_page_size", 1000),
            "cache_duration": datasource_data.get("cache_duration", 300),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取数据源配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取数据源配置失败")
