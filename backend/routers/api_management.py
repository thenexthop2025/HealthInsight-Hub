"""
API管理路由 - 独立管理API配置
"""
import os
import json
import logging
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends
from models import User
from auth import get_current_active_user
from schemas.data_source import DataSourceConfig

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/apis", tags=["API管理"])

# 配置存储路径
CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config")
APIS_FILE = os.path.join(CONFIG_DIR, "apis.json")

# 确保配置目录存在
os.makedirs(CONFIG_DIR, exist_ok=True)

def load_apis_from_file() -> Dict[str, Any]:
    """从文件加载API配置"""
    if os.path.exists(APIS_FILE):
        with open(APIS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_apis_to_file(apis: Dict[str, Any]):
    """保存API配置到文件"""
    with open(APIS_FILE, 'w', encoding='utf-8') as f:
        json.dump(apis, f, indent=2, ensure_ascii=False)

def generate_api_id(name: str, existing_ids: set) -> str:
    """基于名称生成唯一的API ID"""
    import re
    import uuid

    # 基础ID生成：转换为小写，替换特殊字符为下划线
    base_id = re.sub(r'[^a-z0-9\u4e00-\u9fa5]', '_', name.lower())
    base_id = re.sub(r'_+', '_', base_id).strip('_')

    # 如果基础ID为空，使用默认前缀
    if not base_id:
        base_id = 'api'

    # 检查是否已存在，如果存在则添加数字后缀
    api_id = base_id
    counter = 1
    while api_id in existing_ids:
        api_id = f"{base_id}_{counter}"
        counter += 1

    return api_id

@router.get("/")
async def get_apis(
    current_user: User = Depends(get_current_active_user)
):
    """获取所有API配置"""
    try:
        apis_config = load_apis_from_file()
        
        return {
            "apis": [
                {
                    "id": api_id,
                    "name": api_data.get("name", ""),
                    "description": api_data.get("description", ""),
                    "category": api_data.get("category", ""),
                    "source": api_data.get("source", ""),
                    "api_type": api_data.get("api_type", ""),
                    "base_url": api_data.get("base_url", ""),
                    "endpoint": api_data.get("endpoint", ""),
                    "method": api_data.get("method", "GET"),
                    "headers": api_data.get("headers"),
                    "timeout": api_data.get("timeout", 30),
                    "auth": api_data.get("auth", {}),
                    "supports_pagination": api_data.get("supports_pagination", True),
                    "page_size_param": api_data.get("page_size_param", "$top"),
                    "page_offset_param": api_data.get("page_offset_param", "$skip"),
                    "count_param": api_data.get("count_param", "$count"),
                    "max_page_size": api_data.get("max_page_size", 1000),
                    "cache_duration": api_data.get("cache_duration", 300),
                }
                for api_id, api_data in apis_config.items()
            ]
        }
    except Exception as e:
        logger.error(f"获取API配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取API配置失败")

@router.post("/")
async def create_api(
    api_data: Dict[str, Any],
    current_user: User = Depends(get_current_active_user)
):
    """创建新的API配置"""
    try:
        # 加载现有配置
        apis_config = load_apis_from_file()
        existing_ids = set(apis_config.keys())
        
        # 记录是否自动生成ID
        auto_generated = False
        
        # 如果没有提供ID或ID为空，自动生成
        if not api_data.get('id') or api_data['id'].strip() == '':
            name = api_data.get('name', '')
            if not name:
                raise HTTPException(status_code=400, detail="API名称为空，无法生成ID")
            
            api_data['id'] = generate_api_id(name, existing_ids)
            auto_generated = True
            logger.info(f"自动生成API ID: {api_data['id']}")
        
        # 验证API配置
        api = DataSourceConfig(**api_data)
        
        # 检查ID是否已存在
        if api.id in apis_config:
            raise HTTPException(status_code=400, detail=f"API ID '{api.id}' 已存在")
        
        # 添加新API
        apis_config[api.id] = api.dict()
        save_apis_to_file(apis_config)
        
        return {
            "message": "API创建成功",
            "api_id": api.id,
            "api_name": api.name,
            "auto_generated_id": auto_generated
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建API失败: {str(e)}")
        raise HTTPException(status_code=400, detail=f"创建API失败: {str(e)}")

@router.put("/{api_id}")
async def update_api(
    api_id: str,
    api_data: Dict[str, Any],
    current_user: User = Depends(get_current_active_user)
):
    """更新API配置"""
    try:
        # 加载现有配置
        apis_config = load_apis_from_file()
        
        # 检查API是否存在
        if api_id not in apis_config:
            raise HTTPException(status_code=404, detail="API不存在")
        
        # 验证API配置
        api = DataSourceConfig(**api_data)
        
        # 更新API配置
        apis_config[api_id] = api.dict()
        save_apis_to_file(apis_config)
        
        return {
            "message": "API更新成功",
            "api_id": api_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"更新API失败: {str(e)}")
        raise HTTPException(status_code=400, detail=f"更新API失败: {str(e)}")

@router.delete("/{api_id}")
async def delete_api(
    api_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """删除API配置"""
    try:
        # 加载现有配置
        apis_config = load_apis_from_file()
        
        # 检查API是否存在
        if api_id not in apis_config:
            raise HTTPException(status_code=404, detail="API不存在")
        
        # 检查是否有数据源使用此API
        DATA_SOURCES_FILE = os.path.join(CONFIG_DIR, "data_sources.json")
        sources_config = {}
        if os.path.exists(DATA_SOURCES_FILE):
            with open(DATA_SOURCES_FILE, 'r', encoding='utf-8') as f:
                sources_config = json.load(f)
        
        used_sources = [
            source_id for source_id, source_data in sources_config.items()
            if source_data.get("api_id") == api_id
        ]
        
        if used_sources:
            raise HTTPException(
                status_code=400,
                detail=f"无法删除API，以下数据源正在使用: {', '.join(used_sources)}"
            )
        
        # 删除API
        del apis_config[api_id]
        save_apis_to_file(apis_config)
        
        return {
            "message": "API删除成功",
            "api_id": api_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"删除API失败: {str(e)}")
        raise HTTPException(status_code=400, detail=f"删除API失败: {str(e)}")

@router.get("/{api_id}")
async def get_api(
    api_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """获取单个API配置"""
    try:
        apis_config = load_apis_from_file()
        
        if api_id not in apis_config:
            raise HTTPException(status_code=404, detail="API不存在")
        
        api_data = apis_config[api_id]
        return {
            "id": api_id,
            "name": api_data.get("name", ""),
            "description": api_data.get("description", ""),
            "category": api_data.get("category", ""),
            "source": api_data.get("source", ""),
            "api_type": api_data.get("api_type", ""),
            "base_url": api_data.get("base_url", ""),
            "endpoint": api_data.get("endpoint", ""),
            "method": api_data.get("method", "GET"),
            "headers": api_data.get("headers"),
            "timeout": api_data.get("timeout", 30),
            "auth": api_data.get("auth", {}),
            "supports_pagination": api_data.get("supports_pagination", True),
            "page_size_param": api_data.get("page_size_param", "$top"),
            "page_offset_param": api_data.get("page_offset_param", "$skip"),
            "count_param": api_data.get("count_param", "$count"),
            "max_page_size": api_data.get("max_page_size", 1000),
            "cache_duration": api_data.get("cache_duration", 300),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取API配置失败: {str(e)}")
        raise HTTPException(status_code=500, detail="获取API配置失败")

@router.post("/test-connection")
async def test_api_connection(
    test_params: dict,
    current_user: User = Depends(get_current_active_user)
):
    """测试API连接"""
    import aiohttp
    import time
    
    try:
        start_time = time.time()
        
        # 构建测试URL
        base_url = test_params.get('base_url', '')
        endpoint = test_params.get('endpoint', '')
        method = test_params.get('method', 'GET')
        auth = test_params.get('auth', {})
        timeout = test_params.get('timeout', 30)
        
        # 处理endpoint中的占位符
        if '{indicator_code}' in endpoint:
            # 使用一个通用的测试endpoint
            endpoint = endpoint.replace('{indicator_code}', '')
            if not endpoint.endswith('/'):
                endpoint += '/'
        
        test_url = f"{base_url}{endpoint}"
        
        # 构建请求头
        headers = {
            'User-Agent': 'Disease Analysis Platform/1.0',
            'Accept': 'application/json'
        }
        
        # 处理认证
        if auth.get('auth_type') == 'api_key' and auth.get('api_key'):
            header_name = auth.get('api_key_header', 'X-API-Key')
            headers[header_name] = auth['api_key']
        elif auth.get('auth_type') == 'basic' and auth.get('username') and auth.get('password'):
            import base64
            credentials = base64.b64encode(f"{auth['username']}:{auth['password']}".encode()).decode()
            headers['Authorization'] = f"Basic {credentials}"
        
        # 发送测试请求
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
            async with session.request(method, test_url, headers=headers) as response:
                response_time = int((time.time() - start_time) * 1000)
                
                if response.status == 200:
                    try:
                        data = await response.json()
                        
                        # 分析响应数据
                        data_info = {}
                        if isinstance(data, dict):
                            if 'value' in data:
                                # OData格式
                                records = data['value']
                                data_info['total_records'] = len(records)
                                if records:
                                    data_info['columns'] = list(records[0].keys()) if records else []
                            elif '@odata.count' in data:
                                data_info['total_records'] = data.get('@odata.count', 0)
                            else:
                                data_info['total_records'] = 1
                                data_info['columns'] = list(data.keys())
                        elif isinstance(data, list):
                            data_info['total_records'] = len(data)
                            if data:
                                data_info['columns'] = list(data[0].keys()) if data else []
                        
                        return {
                            "success": True,
                            "response_time": response_time,
                            "status_code": response.status,
                            "data_info": data_info,
                            "test_url": test_url
                        }
                    except Exception as e:
                        return {
                            "success": True,
                            "response_time": response_time,
                            "status_code": response.status,
                            "data_info": {"total_records": 0, "columns": []},
                            "test_url": test_url,
                            "note": f"连接成功但数据解析失败: {str(e)}"
                        }
                else:
                    return {
                        "success": False,
                        "error": f"HTTP {response.status}: {await response.text()}",
                        "response_time": response_time,
                        "test_url": test_url
                    }
                    
    except aiohttp.ClientError as e:
        return {
            "success": False,
            "error": f"网络连接错误: {str(e)}",
            "test_url": test_url
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"测试失败: {str(e)}",
            "test_url": test_url
        }
