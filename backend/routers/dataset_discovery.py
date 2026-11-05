"""
数据集自动发现模块
从API端点自动发现和生成数据集配置
"""
import os
import json
import logging
import aiohttp
import asyncio
from typing import Dict, List, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from models import User
from auth import get_current_active_user
from schemas.data_source import DatasetConfig
import re

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/dataset-discovery", tags=["数据集发现"])

# 配置存储路径
CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config")
DATASETS_FILE = os.path.join(CONFIG_DIR, "datasets.json")
DATA_SOURCES_FILE = os.path.join(CONFIG_DIR, "data_sources.json")
APIS_FILE = os.path.join(CONFIG_DIR, "apis.json")

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

def clean_name(name: str) -> str:
    """清理数据集名称"""
    # 移除特殊字符，保留字母、数字、空格和中文
    name = re.sub(r'[^\w\s\u4e00-\u9fff]', '', name)
    return name.strip()

def generate_chinese_description(indicator_name: str) -> str:
    """生成中文描述"""
    # 简化的翻译逻辑
    translations = {
        'Number of': '数量',
        'Prevalence of': '患病率',
        'Coverage': '覆盖率',
        'Rate': '率',
        'Percentage': '百分比',
        'HIV': '艾滋病',
        'Tuberculosis': '结核病',
        'Malaria': '疟疾',
        'Immunization': '免疫接种',
        'Health': '健康',
        'Population': '人口',
        'Children': '儿童',
        'Adults': '成人',
        'Women': '女性',
        'Men': '男性'
    }
    
    description = indicator_name
    for en, zh in translations.items():
        description = description.replace(en, zh)
    
    return description

def get_category_from_name(name: str) -> str:
    """根据名称推断类别"""
    name_lower = name.lower()
    
    if any(keyword in name_lower for keyword in ['hiv', 'aids', 'antiretroviral']):
        return '传染病'
    elif any(keyword in name_lower for keyword in ['immunization', 'vaccine', 'vaccination']):
        return '预防保健'
    elif any(keyword in name_lower for keyword in ['tuberculosis', 'tb']):
        return '传染病'
    elif any(keyword in name_lower for keyword in ['malaria']):
        return '传染病'
    elif any(keyword in name_lower for keyword in ['health', 'medical', 'doctor', 'nurse']):
        return '其他健康指标'
    elif any(keyword in name_lower for keyword in ['population', 'demographic']):
        return '人口健康'
    elif any(keyword in name_lower for keyword in ['expenditure', 'cost', 'budget']):
        return '卫生支出'
    else:
        return '其他健康指标'

async def discover_who_gho_datasets(api_config: Dict[str, Any], data_source_config: Dict[str, Any]) -> List[Dict[str, Any]]:
    """发现WHO GHO数据集"""
    try:
        base_url = api_config.get('base_url', '')
        endpoint = api_config.get('endpoint', '')
        
        # 构建指标列表URL
        indicators_url = f"{base_url}/Indicator"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(indicators_url) as response:
                if response.status != 200:
                    raise Exception(f"获取指标列表失败: HTTP {response.status}")
                
                data = await response.json()
                # WHO GHO API返回的是直接的数组，不是{value: [...]}格式
                if isinstance(data, list):
                    indicators = data
                else:
                    indicators = data.get('value', [])
                
                datasets = []
                for indicator in indicators:
                    indicator_code = indicator.get('IndicatorCode', '')
                    indicator_name = indicator.get('IndicatorName', '')
                    
                    if not indicator_code or not indicator_name:
                        continue
                    
                    # 生成数据集配置
                    dataset = {
                        "id": f"who_gho_{indicator_code.lower()}",
                        "name": clean_name(indicator_name),
                        "description": generate_chinese_description(indicator_name),
                        "category": get_category_from_name(indicator_name),
                        "source": "WHO",
                        "data_source_id": data_source_config.get('id', ''),
                        "indicator_code": indicator_code,
                        "preview_limit": 10,
                        "import_limit": 1000,
                        "allow_full_import": True,
                        "default_params": {
                            "indicator_code": indicator_code
                        },
                        "field_mappings": {
                            "SpatialDim": {"field_name": "country", "field_type": "string", "required": False},
                            "TimeDim": {"field_name": "year", "field_type": "integer", "required": False},
                            "Dim1": {"field_name": "sex", "field_type": "string", "required": False},
                            "Dim2": {"field_name": "region", "field_type": "string", "required": False},
                            "Value": {"field_name": "value", "field_type": "float", "required": True}
                        }
                    }
                    
                    datasets.append(dataset)
                
                return datasets
                
    except Exception as e:
        logger.error(f"发现WHO GHO数据集失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"发现数据集失败: {str(e)}")

async def discover_generic_api_datasets(api_config: Dict[str, Any], data_source_config: Dict[str, Any]) -> List[Dict[str, Any]]:
    """发现通用API数据集"""
    try:
        base_url = api_config.get('base_url', '')
        endpoint = api_config.get('endpoint', '')
        
        # 尝试发现可用的端点
        discovery_urls = [
            f"{base_url}/datasets",
            f"{base_url}/indicators", 
            f"{base_url}/data",
            f"{base_url}/endpoints",
            f"{base_url}/catalog"
        ]
        
        datasets = []
        
        async with aiohttp.ClientSession() as session:
            for url in discovery_urls:
                try:
                    async with session.get(url) as response:
                        if response.status == 200:
                            data = await response.json()
                            
                            # 尝试解析数据集列表
                            if isinstance(data, dict):
                                if 'value' in data:
                                    items = data['value']
                                elif 'data' in data:
                                    items = data['data']
                                elif 'datasets' in data:
                                    items = data['datasets']
                                else:
                                    items = [data]
                            elif isinstance(data, list):
                                items = data
                            else:
                                continue
                            
                            # 为每个项目创建数据集配置
                            for i, item in enumerate(items[:10]):  # 限制前10个
                                if isinstance(item, dict):
                                    name = item.get('name', item.get('title', f'Dataset {i+1}'))
                                    code = item.get('code', item.get('id', f'dataset_{i+1}'))
                                    
                                    dataset = {
                                        "id": f"{data_source_config.get('id', 'unknown')}_{code.lower()}",
                                        "name": clean_name(name),
                                        "description": f"从 {base_url} 发现的数据集",
                                        "category": "其他健康指标",
                                        "source": api_config.get('source', 'Unknown'),
                                        "data_source_id": data_source_config.get('id', ''),
                                        "indicator_code": code,
                                        "preview_limit": 10,
                                        "import_limit": 1000,
                                        "allow_full_import": True,
                                        "default_params": {},
                                        "field_mappings": {}
                                    }
                                    
                                    datasets.append(dataset)
                            
                            break  # 找到数据就停止
                            
                except Exception as e:
                    logger.debug(f"尝试URL {url} 失败: {str(e)}")
                    continue
        
        return datasets
        
    except Exception as e:
        logger.error(f"发现通用API数据集失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"发现数据集失败: {str(e)}")

@router.post("/discover/{data_source_id}")
async def discover_datasets(
    data_source_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """为指定数据源发现数据集"""
    try:
        # 加载配置
        data_sources_config = load_config_from_file(DATA_SOURCES_FILE)
        apis_config = load_config_from_file(APIS_FILE)
        
        if data_source_id not in data_sources_config:
            raise HTTPException(status_code=404, detail="数据源不存在")
        
        data_source_config = data_sources_config[data_source_id]
        api_id = data_source_config.get('api_id')
        
        if not api_id or api_id not in apis_config:
            raise HTTPException(status_code=404, detail="关联的API不存在")
        
        api_config = apis_config[api_id]
        
        # 根据API类型选择发现方法
        api_type = api_config.get('api_type', '').lower()
        api_name = api_config.get('name', '').lower()
        api_source = api_config.get('source', '').lower()
        
        # 判断是否为WHO GHO API
        if ('odata' in api_type or 
            'who' in api_type.lower() or 
            'who' in api_name or 
            'who' in api_source or
            'gho' in api_name or
            'gho' in api_source):
            datasets = await discover_who_gho_datasets(api_config, data_source_config)
        else:
            datasets = await discover_generic_api_datasets(api_config, data_source_config)
        
        return {
            "message": f"发现 {len(datasets)} 个数据集",
            "data_source_id": data_source_id,
            "datasets": datasets
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"发现数据集失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"发现数据集失败: {str(e)}")

@router.post("/generate/{data_source_id}")
async def generate_datasets(
    data_source_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """为指定数据源生成并保存数据集配置"""
    try:
        # 发现数据集
        discovery_result = await discover_datasets(data_source_id, current_user)
        datasets = discovery_result['datasets']
        
        # 加载现有数据集配置
        datasets_config = load_config_from_file(DATASETS_FILE)
        
        # 添加新数据集
        added_count = 0
        for dataset in datasets:
            dataset_id = dataset['id']
            if dataset_id not in datasets_config:
                datasets_config[dataset_id] = dataset
                added_count += 1
        
        # 保存配置
        save_config_to_file(DATASETS_FILE, datasets_config)
        
        return {
            "message": f"成功生成 {added_count} 个新数据集",
            "data_source_id": data_source_id,
            "total_datasets": len(datasets),
            "added_datasets": added_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"生成数据集失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"生成数据集失败: {str(e)}")

@router.get("/status/{data_source_id}")
async def get_discovery_status(
    data_source_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """获取数据源的数据集发现状态"""
    try:
        # 加载配置
        data_sources_config = load_config_from_file(DATA_SOURCES_FILE)
        datasets_config = load_config_from_file(DATASETS_FILE)
        
        if data_source_id not in data_sources_config:
            raise HTTPException(status_code=404, detail="数据源不存在")
        
        # 统计该数据源的数据集数量
        data_source_datasets = [
            dataset for dataset in datasets_config.values()
            if dataset.get('data_source_id') == data_source_id
        ]
        
        return {
            "data_source_id": data_source_id,
            "data_source_name": data_sources_config[data_source_id].get('name', ''),
            "total_datasets": len(data_source_datasets),
            "datasets": data_source_datasets[:10]  # 返回前10个作为示例
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取发现状态失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取发现状态失败: {str(e)}")


