"""
统一数据API路由 - 使用灵活的配置驱动系统
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from models import User
from database import get_db
from auth import get_current_active_user
from schemas.data_source import DataSourceRegistry
from services.data_fetcher import DataFetcher
from routers.config_management import get_dynamic_registry
from utils.query import normalize_query_params
from services.field_count_updater import field_count_updater
from storage import get_storage
import os
import json
from datetime import datetime
import logging
import tempfile

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/unified", tags=["unified-data"])

# 筛选条件配置文件路径
FILTER_PARAMS_FILE = "config/filter_params.json"

def get_dataset_record_count(dataset_id: str, source_config) -> int:
    """获取数据集的真实记录数"""
    try:
        # 首先尝试从缓存读取
        cache_file = f"config/record_counts.json"
        if os.path.exists(cache_file):
            with open(cache_file, 'r', encoding='utf-8') as f:
                record_counts = json.load(f)
                if dataset_id in record_counts:
                    return record_counts[dataset_id]
        
        # 如果缓存中没有，返回0（表示未更新）
        return 0
        
    except Exception as e:
        logger.warning(f"获取数据集 {dataset_id} 记录数失败: {e}")
        return 0

def get_dataset_last_updated(dataset_id: str) -> str:
    """获取数据集的最后更新时间"""
    try:
        # 从缓存文件读取最后更新时间
        cache_file = f"config/last_update_times.json"
        if os.path.exists(cache_file):
            with open(cache_file, 'r', encoding='utf-8') as f:
                update_times = json.load(f)
                if dataset_id in update_times:
                    return update_times[dataset_id]
        
        # 如果没有缓存，返回None（表示未更新）
        return None
        
    except Exception as e:
        logger.warning(f"获取数据集 {dataset_id} 最后更新时间失败: {e}")
        return None

def _parse_int(value: Any) -> Optional[int]:
    try:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str):
            value = value.strip()
            if value == "":
                return None
            return int(float(value))
    except (ValueError, TypeError):
        return None
    return None

def get_real_record_count(indicator_code: str) -> int:
    """从API获取真实的记录数"""
    try:
        import requests
        url = f"https://ghoapi.azureedge.net/api/{indicator_code}?$count=true"
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            # 先尝试从响应头读取
            header_count = (
                response.headers.get("OData-Count")
                or response.headers.get("odata-count")
                or response.headers.get("X-Total-Count")
            )
            parsed_header = _parse_int(header_count)
            if parsed_header is not None and parsed_header >= 0:
                return parsed_header

            data = response.json()
            # 从OData响应中获取记录数
            count_from_body = _parse_int(data.get('@odata.count'))
            if count_from_body is not None and count_from_body >= 0:
                return count_from_body

            # 其他常见字段
            for key in ('total', 'totalRecords', 'total_count'):
                if key in data:
                    parsed = _parse_int(data.get(key))
                    if parsed is not None and parsed >= 0:
                        return parsed

            if 'value' in data and isinstance(data['value'], list):
                return len(data['value'])
        return 0
    except Exception as e:
        logger.warning(f"获取指标 {indicator_code} 记录数失败: {e}")
        return 0

# 全局数据获取器和注册表
data_fetcher = DataFetcher()
registry = get_dynamic_registry()
print(f"🟢 Registry loaded at module level - sources: {len(registry.list_sources())}, datasets: {len(registry.list_datasets())}")
logger.info(f"🟢 Registry loaded at module level - sources: {len(registry.list_sources())}, datasets: {len(registry.list_datasets())}")

@router.get("/sources")
async def get_data_sources(
    current_user: User = Depends(get_current_active_user)
):
    """获取所有数据源列表"""
    try:
        current_registry = get_dynamic_registry()
        sources = current_registry.list_sources()
        return {
            "sources": [
                {
                    "id": source.id,
                    "name": source.name,
                    "description": source.description,
                    "category": source.category,
                    "source": source.source,
                    "api_type": source.api_type
                }
                for source in sources
            ]
        }
    except Exception as e:
        logger.error(f"获取数据源列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取数据源列表失败")

@router.get("/datasets")
async def get_datasets(
    source: Optional[str] = Query(None, description="数据源筛选"),
    category: Optional[str] = Query(None, description="类别筛选"),
    query: Optional[str] = Query(None, description="搜索关键词"),
    limit: int = Query(20, description="每页数量"),
    offset: int = Query(0, description="偏移量"),
    current_user: User = Depends(get_current_active_user)
):
    """获取数据集列表"""
    try:
        # 重新加载配置以确保获取最新数据
        current_registry = get_dynamic_registry()
        
        # 一次性读取数据集配置（避免重复读取文件）
        import json
        try:
            with open('config/datasets.json', 'r', encoding='utf-8') as f:
                datasets_config = json.load(f)
        except:
            datasets_config = {}
        
        datasets = current_registry.list_datasets()
        
        # 应用筛选
        filtered_datasets = []
        for dataset in datasets:
            # 数据源筛选
            if source and dataset.source != source:
                continue
            
            # 类别筛选
            if category and dataset.category != category:
                continue
            
            # 关键词搜索
            if query:
                query_lower = query.lower()
                if not (query_lower in dataset.name.lower() or 
                       query_lower in dataset.description.lower()):
                    continue
            
            # 获取数据源配置
            source_config = current_registry.get_source(dataset.data_source_id)
            if not source_config:
                continue
            
            # 获取真实记录数（从缓存或API）
            record_count = get_dataset_record_count(dataset.id, source_config)
            
            # 使用智能字段数量更新服务（缺省值为0）
            variables_count = field_count_updater.get_field_count(dataset.id)
            
            # 获取最后更新时间
            last_updated = get_dataset_last_updated(dataset.id)
            
            filtered_datasets.append({
                "dataset_id": dataset.id,
                "title": dataset.name,
                "description": dataset.description,
                "category": dataset.category,
                "source": dataset.source,
                "record_count": record_count,
                "variables": variables_count,
                "api_type": source_config.api_type,
                "last_updated": last_updated,
                "fetched_at": last_updated
            })
        
        # 应用分页
        total = len(filtered_datasets)
        paginated_datasets = filtered_datasets[offset:offset + limit]
        
        return {
            "datasets": paginated_datasets,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except Exception as e:
        logger.error(f"获取数据集列表失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取数据集列表失败")

@router.post("/datasets/update-field-counts")
async def update_field_counts(
    current_user: User = Depends(get_current_active_user)
):
    """手动更新所有数据集的字段数量"""
    try:
        # 启动后台更新
        field_count_updater.start_background_update()
        return {"message": "字段数量更新已开始，将在后台进行"}
    except Exception as e:
        logger.error(f"启动字段数量更新失败: {str(e)}")
        raise HTTPException(status_code=500, detail="启动字段数量更新失败")

@router.get("/datasets/field-counts-status")
async def get_field_counts_status(
    current_user: User = Depends(get_current_active_user)
):
    """获取字段数量更新状态"""
    try:
        import json
        import os
        from datetime import datetime
        
        status = {
            "has_cache": os.path.exists("config/field_counts.json"),
            "last_update": None,
            "total_cached": 0,
            "is_updating": field_count_updater.is_updating
        }
        
        if os.path.exists("config/last_field_update.json"):
            with open("config/last_field_update.json", 'r', encoding='utf-8') as f:
                data = json.load(f)
                status["last_update"] = data.get("last_update")
                status["total_cached"] = data.get("total_updated", 0)
        
        return status
    except Exception as e:
        logger.error(f"获取字段数量状态失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取字段数量状态失败")

@router.post("/datasets/{dataset_id}/update-field-count")
async def update_dataset_field_count(
    dataset_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """更新单个数据集的数据（记录数、字段数、最后更新时间、预览数据）"""
    try:
        import json
        import os
        from datetime import datetime
        
        # 获取数据集配置
        with open("config/datasets.json", 'r', encoding='utf-8') as f:
            datasets = json.load(f)
        
        if dataset_id not in datasets:
            raise HTTPException(
                status_code=410,  # 410 Gone - 表示资源曾经存在但已被删除
                detail="此数据集已在配置管理中删除，请刷新页面以更新数据集列表"
            )
        
        dataset = datasets[dataset_id]
        indicator_code = dataset.get('indicator_code', dataset_id)
        
        # 获取字段数量
        field_count = field_count_updater.get_field_count_sync(indicator_code)
        
        if field_count is None:
            raise HTTPException(status_code=500, detail="无法获取字段数量")
        
        # 获取记录数（从API获取真实记录数）
        record_count = get_real_record_count(indicator_code)
        
        # 当前时间
        current_time = datetime.now().isoformat()
        
        # 预先加载缓存文件（稍后统一写回）
        field_counts_file = "config/field_counts.json"
        record_counts_file = "config/record_counts.json"
        update_times_file = "config/last_update_times.json"
        field_counts = {}
        record_counts = {}
        update_times = {}
        if os.path.exists(field_counts_file):
            with open(field_counts_file, 'r', encoding='utf-8') as f:
                field_counts = json.load(f)
        if os.path.exists(record_counts_file):
            with open(record_counts_file, 'r', encoding='utf-8') as f:
                record_counts = json.load(f)
        if os.path.exists(update_times_file):
            with open(update_times_file, 'r', encoding='utf-8') as f:
                update_times = json.load(f)
        
        # 获取并缓存全部数据（用于前端筛选）
        preview_data = None
        try:
            # 调用预览接口获取数据（获取全部数据，不限制rows参数）
            # 如果数据量太大，可以设置一个合理的上限，比如10000条
            from routers.unified_data import preview_dataset as get_preview
            max_rows = min(record_count, 10000) if record_count else 10000  # 最多缓存10000条
            preview_result = await preview_dataset(dataset_id, rows=max_rows, current_user=current_user)
            
            # 如果API返回的总数比直接获取的更可靠，采用预览结果
            preview_total = _parse_int(preview_result.get("total_records"))
            if preview_total is not None and preview_total >= 0:
                record_count = preview_total
            
            # 保存预览数据到缓存文件
            preview_cache_file = "config/preview_cache.json"
            preview_cache = {}
            if os.path.exists(preview_cache_file):
                with open(preview_cache_file, 'r', encoding='utf-8') as f:
                    preview_cache = json.load(f)
            
            preview_cache[dataset_id] = {
                "data": preview_result,
                "cached_at": current_time,
                "total_records": record_count
            }
            
            with open(preview_cache_file, 'w', encoding='utf-8') as f:
                json.dump(preview_cache, f, ensure_ascii=False, indent=2)
            
            preview_data = preview_result
            logger.info(f"预览数据已缓存: {dataset_id}")
            
        except Exception as e:
            logger.warning(f"缓存预览数据失败: {str(e)}")
        
        # 写回缓存文件
        field_counts[dataset_id] = field_count
        record_counts[dataset_id] = record_count
        update_times[dataset_id] = current_time
        
        with open(field_counts_file, 'w', encoding='utf-8') as f:
            json.dump(field_counts, f, ensure_ascii=False, indent=2)
        with open(record_counts_file, 'w', encoding='utf-8') as f:
            json.dump(record_counts, f, ensure_ascii=False, indent=2)
        with open(update_times_file, 'w', encoding='utf-8') as f:
            json.dump(update_times, f, ensure_ascii=False, indent=2)
        
        return {
            "success": True,
            "dataset_id": dataset_id,
            "field_count": field_count,
            "record_count": record_count,
            "last_updated": current_time,
            "preview_cached": preview_data is not None,
            "preview_data": preview_data,  # 直接返回预览数据，避免前端再次请求
            "message": f"数据集 {dataset_id} 数据更新成功"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新数据集数据失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"更新失败: {str(e)}")

@router.get("/datasets/categories")
async def get_dataset_categories(
    current_user: User = Depends(get_current_active_user)
):
    """获取所有数据集的类别列表"""
    try:
        current_registry = get_dynamic_registry()
        categories = sorted({dataset.category for dataset in current_registry.list_datasets()})
        return {"categories": categories}
    except Exception as e:
        logger.error(f"获取类别失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取类别失败")

@router.get("/datasets/{dataset_id}")
async def get_dataset_details(
    dataset_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """获取数据集详细信息"""
    try:
        current_registry = get_dynamic_registry()
        dataset = current_registry.get_dataset(dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="数据集未找到")
        
        source_config = current_registry.get_source(dataset.data_source_id)
        if not source_config:
            raise HTTPException(status_code=404, detail="数据源配置未找到")
        
        # 构建列信息
        columns_info = []
        for mapping in source_config.field_mappings:
            columns_info.append({
                "name": mapping.standard_field,
                "type": mapping.field_type.value,
                "required": mapping.required,
                "description": f"API字段: {mapping.api_field}"
            })
        
        return {
            "id": dataset.id,
            "name": dataset.name,
            "description": dataset.description,
            "category": dataset.category,
            "source": dataset.source,
            "data_source_id": dataset.data_source_id,
            "columns": columns_info,
            "filters": [
                {
                    "name": filter_config.name,
                    "display_name": filter_config.display_name,
                    "type": filter_config.field_type.value,
                    "filter_type": filter_config.filter_type.value,
                    "required": filter_config.required,
                    "options": filter_config.options
                }
                for filter_config in source_config.filters
            ],
            "preview_limit": dataset.preview_limit,
            "import_limit": dataset.import_limit
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取数据集详情失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取数据集详情失败")

@router.get("/datasets/{dataset_id}/parameters")
async def get_dataset_parameters(
    dataset_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """获取数据集参数配置"""
    try:
        current_registry = get_dynamic_registry()
        dataset = current_registry.get_dataset(dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="数据集未找到")
        
        source_config = current_registry.get_source(dataset.data_source_id)
        if not source_config:
            raise HTTPException(status_code=404, detail="数据源配置未找到")
        
        # 构建参数配置
        parameters = {}
        for filter_config in source_config.filters:
            param_type = "multi_select" if filter_config.filter_type.value == "in" else "text"
            
            parameters[filter_config.name] = {
                "name": filter_config.display_name,
                "type": param_type,
                "code": filter_config.api_field,
                "options": filter_config.options or [],
                "required": filter_config.required,
                "field_type": filter_config.field_type.value,
                "filter_type": filter_config.filter_type.value
            }
        
        return {
            "dataset_id": dataset_id,
            "parameters": parameters,
            "note": f"此数据集包含{len(source_config.field_mappings)}个数据列: {', '.join([m.standard_field for m in source_config.field_mappings])}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取数据集参数失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取数据集参数失败")

@router.get("/datasets/{dataset_id}/preview-cache")
async def get_preview_cache(
    dataset_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """获取预览数据缓存"""
    try:
        import json
        import os
        
        preview_cache_file = "config/preview_cache.json"
        if not os.path.exists(preview_cache_file):
            return {"cached": False, "data": None}
        
        with open(preview_cache_file, 'r', encoding='utf-8') as f:
            preview_cache = json.load(f)
        
        if dataset_id in preview_cache:
            cache_entry = preview_cache[dataset_id]
            return {
                "cached": True,
                "data": cache_entry.get("data"),
                "cached_at": cache_entry.get("cached_at"),
                "total_records": cache_entry.get("total_records")
            }
        else:
            return {"cached": False, "data": None}
            
    except Exception as e:
        logger.error(f"获取预览缓存失败: {str(e)}")
        return {"cached": False, "data": None}

@router.get("/datasets/{dataset_id}/preview")
async def preview_dataset(
    dataset_id: str,
    rows: int = Query(10, description="预览行数"),
    current_user: User = Depends(get_current_active_user)
):
    """预览数据集"""
    try:
        current_registry = get_dynamic_registry()
        dataset = current_registry.get_dataset(dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="数据集未找到")
        
        source_config = current_registry.get_source(dataset.data_source_id)
        if not source_config:
            raise HTTPException(status_code=404, detail="数据源配置未找到")
        
        # 获取预览数据
        result = await data_fetcher.fetch_data(
            source_config, dataset, {}, is_import=False
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        # 限制返回的行数
        data = result.get("data", [])
        if rows > 0:
            data = data[:rows]
        
        return {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "columns": result.get("columns", []),
            "data": data,
            "total_records": result.get("total_records", 0),
            "note": result.get("note", ""),
            "fetched_at": result.get("fetched_at", "")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"预览数据集失败: {str(e)}")
        raise HTTPException(status_code=500, detail="预览数据集失败")

@router.post("/datasets/{dataset_id}/preview")
async def preview_dataset_with_params(
    dataset_id: str,
    query_params: Dict[str, Any],
    rows: int = Query(10, description="预览行数"),
    current_user: User = Depends(get_current_active_user)
):
    """使用参数预览数据集"""
    try:
        current_registry = get_dynamic_registry()
        dataset = current_registry.get_dataset(dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="数据集未找到")
        
        source_config = current_registry.get_source(dataset.data_source_id)
        if not source_config:
            raise HTTPException(status_code=404, detail="数据源配置未找到")
        
        # 获取预览数据
        normalized_params = normalize_query_params(query_params)
        result = await data_fetcher.fetch_data(
            source_config, dataset, normalized_params, is_import=False
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        # 限制返回的行数
        data = result.get("data", [])
        if rows > 0:
            data = data[:rows]
        
        return {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "columns": result.get("columns", []),
            "data": data,
            "total_records": result.get("total_records", 0),
            "note": result.get("note", ""),
            "fetched_at": result.get("fetched_at", ""),
            "query_params": normalized_params
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"预览数据集失败: {str(e)}")
        raise HTTPException(status_code=500, detail="预览数据集失败")

@router.post("/datasets/{dataset_id}/import")
async def import_dataset(
    dataset_id: str,
    request_data: Dict[str, Any],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """导入数据集到内部数据集"""
    logger.info(f"开始导入数据集: {dataset_id}")
    try:
        current_registry = get_dynamic_registry()
        # 获取数据集配置
        dataset_config = current_registry.get_dataset(dataset_id)
        if not dataset_config:
            raise HTTPException(status_code=404, detail="数据集未找到")
        
        # 获取数据源配置
        source_config = current_registry.get_source(dataset_config.data_source_id)
        if not source_config:
            raise HTTPException(status_code=404, detail="数据源配置未找到")
        
        # 提取请求参数
        name = request_data.get("name", dataset_config.name)
        description = request_data.get("description", dataset_config.description)
        raw_query_params = request_data.get("query_params", {})
        normalized_params = normalize_query_params(raw_query_params)
        
        logger.info(f"归一化后的查询参数: {normalized_params}")
        
        # 获取完整数据
        result = await data_fetcher.fetch_data(
            source_config, dataset_config, normalized_params, is_import=True
        )
        
        if "error" in result:
            logger.error(f"数据获取失败: {result['error']}")
            raise HTTPException(status_code=400, detail=result["error"])
        
        # 保存数据到文件系统
        import pandas as pd
        import os
        from datetime import datetime
        from models import Dataset as DatasetModel, DataSource as DataSourceModel
        
        # 创建上传目录
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        
        # 生成文件名（使用时间戳避免冲突）
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"imported_{dataset_id}_{timestamp}.json"
        
        # 将数据保存为JSON格式
        data_to_save = {
            "dataset_id": dataset_id,
            "name": name,
            "description": description,
            "source": source_config.name,
            "query_params": normalized_params,
            "columns": result.get("columns", []),
            "data": result.get("data", []),
            "total_records": result.get("total_records", 0),
            "fetched_at": datetime.now().isoformat()
        }
        
        # 使用存储抽象层保存文件
        storage = get_storage()
        
        # 创建临时文件并读取内容
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as temp_file:
            json.dump(data_to_save, temp_file, ensure_ascii=False, indent=2)
            temp_file_path = temp_file.name
        
        # 读取文件内容
        with open(temp_file_path, 'rb') as f:
            file_content = f.read()
        
        # 上传到存储（R2 或本地）
        file_path = await storage.upload_file(
            file_content=file_content,
            filename=filename
        )
        
        # 清理临时文件
        os.unlink(temp_file_path)
        
        logger.info(f"数据已保存到存储: {file_path}")
        
        # 准备列信息
        columns_info = []
        if result.get("data") and len(result["data"]) > 0:
            first_row = result["data"][0]
            for col in result.get("columns", []):
                col_info = {
                    "name": col,
                    "type": type(first_row.get(col)).__name__ if col in first_row else "unknown"
                }
                columns_info.append(col_info)
        
        # 查找或创建数据源
        # 尝试通过名称匹配找到对应的数据库数据源
        source_name = source_config.name
        data_source = db.query(DataSourceModel).filter(
            DataSourceModel.name.like(f"%{source_name}%")
        ).first()
        
        if not data_source:
            # 创建新的数据源记录
            data_source = DataSourceModel(
                name=source_name,
                description=source_config.description or f"数据源: {source_name}",
                data_type="imported",  # 标记为导入的外部数据
                api_endpoint=source_config.base_url,
                is_active=True
            )
            db.add(data_source)
            db.commit()
            db.refresh(data_source)
            logger.info(f"创建新数据源: {data_source.name} (ID: {data_source.id})")
        
        # 创建数据集记录
        dataset = DatasetModel(
            name=name,
            description=description,
            data_source_id=data_source.id,
            file_path=file_path,
            record_count=result.get("total_records", 0),
            columns_info=json.dumps(columns_info, ensure_ascii=False)
        )
        
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
        
        logger.info(f"数据集导入成功: {dataset.name} (ID: {dataset.id})")
        
        return {
            "message": "数据集导入成功",
            "dataset_id": dataset.id,  # 返回数据库ID
            "external_dataset_id": dataset_id,  # 原始外部数据集ID
            "dataset_name": name,
            "total_records": result.get("total_records", 0),
            "columns": result.get("columns", []),
            "file_path": file_path
        }
        
    except HTTPException as he:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"导入数据集失败: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"导入数据集失败: {str(e)}")

@router.get("/datasets/{dataset_id}/columns")
async def get_dataset_columns(
    dataset_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """获取数据集列信息"""
    try:
        current_registry = get_dynamic_registry()
        dataset = current_registry.get_dataset(dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="数据集未找到")
        
        source_config = current_registry.get_source(dataset.data_source_id)
        if not source_config:
            raise HTTPException(status_code=404, detail="数据源配置未找到")
        
        # 构建列信息
        columns_info = []
        for mapping in source_config.field_mappings:
            columns_info.append({
                "name": mapping.standard_field,
                "dtype": mapping.field_type.value,
                "unique_count": 0,  # 这些信息需要从实际数据中获取
                "null_count": 0,
                "is_numeric": mapping.field_type in [FieldType.INTEGER, FieldType.FLOAT],
                "is_categorical": mapping.field_type == FieldType.STRING
            })
        
        return {
            "dataset_id": dataset_id,
            "dataset_name": dataset.name,
            "columns": columns_info,
            "total_rows": 0  # 这个信息需要从实际数据中获取
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取数据集列信息失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取数据集列信息失败")

@router.post("/datasets/{dataset_id}/filter-params")
async def save_filter_params(
    dataset_id: str,
    filter_params: Dict[str, Any],
    current_user: User = Depends(get_current_active_user)
):
    """保存数据集的筛选条件"""
    try:
        # 加载现有筛选条件
        filter_params_config = {}
        if os.path.exists(FILTER_PARAMS_FILE):
            with open(FILTER_PARAMS_FILE, 'r', encoding='utf-8') as f:
                filter_params_config = json.load(f)
        
        # 保存新的筛选条件
        filter_params_config[dataset_id] = {
            "params": filter_params,
            "updated_at": datetime.now().isoformat(),
            "updated_by": current_user.username
        }
        
        # 写入文件
        with open(FILTER_PARAMS_FILE, 'w', encoding='utf-8') as f:
            json.dump(filter_params_config, f, ensure_ascii=False, indent=2)
        
        logger.info(f"已保存数据集 {dataset_id} 的筛选条件")
        
        return {
            "success": True,
            "message": "筛选条件保存成功",
            "dataset_id": dataset_id
        }
        
    except Exception as e:
        logger.error(f"保存筛选条件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"保存筛选条件失败: {str(e)}")

@router.get("/datasets/{dataset_id}/filter-params")
async def get_filter_params(
    dataset_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """获取数据集的筛选条件"""
    try:
        if not os.path.exists(FILTER_PARAMS_FILE):
            return {
                "has_params": False,
                "params": None
            }
        
        with open(FILTER_PARAMS_FILE, 'r', encoding='utf-8') as f:
            filter_params_config = json.load(f)
        
        if dataset_id in filter_params_config:
            return {
                "has_params": True,
                "params": filter_params_config[dataset_id]["params"],
                "updated_at": filter_params_config[dataset_id].get("updated_at"),
                "updated_by": filter_params_config[dataset_id].get("updated_by")
            }
        else:
            return {
                "has_params": False,
                "params": None
            }
            
    except Exception as e:
        logger.error(f"获取筛选条件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取筛选条件失败: {str(e)}")

@router.get("/filter-params/all")
async def get_all_filter_params(
    current_user: User = Depends(get_current_active_user)
):
    """获取所有数据集的筛选条件"""
    try:
        if not os.path.exists(FILTER_PARAMS_FILE):
            return {"filter_params": {}}
        
        with open(FILTER_PARAMS_FILE, 'r', encoding='utf-8') as f:
            filter_params_config = json.load(f)
        
        # 只返回参数部分，简化数据结构
        simplified_params = {}
        for dataset_id, config in filter_params_config.items():
            simplified_params[dataset_id] = config["params"]
        
        return {"filter_params": simplified_params}
        
    except Exception as e:
        logger.error(f"获取所有筛选条件失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取所有筛选条件失败: {str(e)}")
