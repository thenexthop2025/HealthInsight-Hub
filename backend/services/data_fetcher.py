"""
统一数据获取引擎 - 支持灵活的数据获取、筛选和转换
"""
import httpx
import json
import pandas as pd
from urllib.parse import quote_plus
from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy import text
from schemas.data_source import DataSourceConfig, DatasetConfig, FilterConfig, FieldMapping, FilterType, FieldType
from utils.query import normalize_query_params, ensure_list
import logging
import pyreadstat
from services.file_service import read_data_file

logger = logging.getLogger(__name__)

class DataFetcher:
    """统一数据获取器"""
    
    def __init__(self):
        self.cache = {}
        self.cache_duration = 300  # 5分钟缓存
    
    async def fetch_data(
        self, 
        source_config: DataSourceConfig, 
        dataset_config: DatasetConfig,
        query_params: Dict[str, Any] = None,
        is_import: bool = False
    ) -> Dict[str, Any]:
        """获取数据"""
        try:
            normalized_params = normalize_query_params(query_params)
            logger.info(
                "准备获取数据 - source=%s dataset=%s params=%s is_import=%s",
                source_config.id,
                dataset_config.id,
                normalized_params,
                is_import,
            )
            # 构建API URL
            api_url = self._build_api_url(source_config, dataset_config, normalized_params)
            logger.info("构建的API URL: %s", api_url)
            
            # 检查缓存
            cache_key = self._get_cache_key(source_config.id, dataset_config.id, normalized_params)
            if not is_import and cache_key in self.cache:
                cached_data = self.cache[cache_key]
                if datetime.now().timestamp() - cached_data['timestamp'] < source_config.cache_duration:
                    return cached_data['data']
            
            # 获取数据
            print(f"🚀 构建的API URL: {api_url}")
            print(f"🚀 normalized_params: {normalized_params}")
            print(f"🚀 准备调用 _fetch_from_api...")
            try:
                data = await self._fetch_from_api(api_url, source_config, dataset_config, normalized_params, is_import)
                print(f"🚀 _fetch_from_api 返回成功")
            except Exception as fetch_error:
                print(f"🚀 _fetch_from_api 抛出异常: {type(fetch_error).__name__}: {str(fetch_error)}")
                raise
            
            # 缓存数据（仅预览模式）
            if not is_import:
                self.cache[cache_key] = {
                    'data': data,
                    'timestamp': datetime.now().timestamp()
                }
            
            return data
            
        except Exception as e:
            logger.error(f"数据获取失败: {str(e)}")
            return {"error": f"数据获取失败: {str(e)}"}
    
    def fetch_data_sync(
        self, 
        source_config: DataSourceConfig, 
        dataset_config: DatasetConfig,
        query_params: Dict[str, Any] = None,
        is_import: bool = False
    ) -> Dict[str, Any]:
        """同步获取数据"""
        try:
            import asyncio
            import threading
            
            # 在新线程中运行异步代码
            result = None
            exception = None
            
            def run_async():
                nonlocal result, exception
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    result = loop.run_until_complete(self.fetch_data(source_config, dataset_config, query_params, is_import))
                except Exception as e:
                    exception = e
                finally:
                    loop.close()
            
            thread = threading.Thread(target=run_async)
            thread.start()
            thread.join()
            
            if exception:
                raise exception
            
            return result
        except Exception as e:
            logger.error(f"同步数据获取失败: {str(e)}")
            return {"error": f"同步数据获取失败: {str(e)}"}
    
    def _build_api_url(
        self, 
        source_config: DataSourceConfig, 
        dataset_config: DatasetConfig,
        query_params: Dict[str, Any] = None
    ) -> str:
        """构建API URL"""
        base_url = source_config.base_url.rstrip('/')
        endpoint_template = dataset_config.custom_endpoint or source_config.endpoint
        indicator_placeholder_present = '{indicator_code}' in endpoint_template
        dimension_placeholder_present = '{dimension_code}' in endpoint_template

        endpoint = endpoint_template
        
        # 处理指标代码
        if dataset_config.indicator_code and indicator_placeholder_present:
            endpoint = endpoint.replace('{indicator_code}', dataset_config.indicator_code)
        if dataset_config.dimension_code and dimension_placeholder_present:
            endpoint = endpoint.replace('{dimension_code}', dataset_config.dimension_code)
        
        api_url = f"{base_url}/{endpoint.lstrip('/')}"
        
        # 构建查询参数
        params = self._build_query_params(source_config, dataset_config, query_params)

        # 指标/维度代码已经写入路径时，避免重复作为查询参数传递
        if dataset_config.indicator_code and indicator_placeholder_present:
            params.pop("indicator_code", None)
        if dataset_config.dimension_code and dimension_placeholder_present:
            params.pop("dimension_code", None)

        if params:
            encoded_parts = []
            for key, value in params.items():
                encoded_parts.append(f"{key}={quote_plus(str(value))}")
            api_url += f"?{'&'.join(encoded_parts)}"

        return api_url
    
    def _build_query_params(
        self, 
        source_config: DataSourceConfig, 
        dataset_config: DatasetConfig,
        query_params: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """构建查询参数"""
        params: Dict[str, Any] = {}
        filter_expressions: List[str] = []

        # 添加默认参数
        if dataset_config.default_params:
            params.update(dataset_config.default_params)

        # 添加筛选参数
        if query_params:
            for filter_config in source_config.filters:
                param_name = filter_config.name
                if param_name in query_params:
                    value = query_params[param_name]
                    expression = self._build_filter_expression(value, filter_config)
                    if expression:
                        filter_expressions.append(expression)
            
            # 处理特殊参数（如$count, $top等）
            for key, value in query_params.items():
                if key.startswith('$'):
                    params[key] = value

        # 添加分页参数 - 注意：这里只是为预览模式添加，导入模式会在_fetch_all_pages中手动控制分页
        # 所以我们需要一个标志来判断是否应该添加分页参数
        # 但是这个方法不知道is_import，所以我们暂时总是添加，后面在fetch_data中调整
        if source_config.supports_pagination:
            if dataset_config.import_limit:
                params[source_config.page_size_param] = dataset_config.import_limit
            else:
                params[source_config.page_size_param] = source_config.max_page_size
            # 只有在没有从query_params传入时才设置count参数
            if source_config.count_param not in params:
                params[source_config.count_param] = "true"

        if filter_expressions:
            params['$filter'] = " and ".join(filter_expressions)

        return params

    def _build_filter_expression(self, value: Any, filter_config: FilterConfig) -> Optional[str]:
        """构建OData筛选表达式"""
        if value in (None, "", []):
            return None

        field_name = filter_config.odata_field or filter_config.api_field
        field_type = filter_config.field_type
        filter_type = filter_config.filter_type

        def format_literal(val: Any) -> str:
            if field_type in (FieldType.STRING,):
                escaped = str(val).replace("'", "''")
                return f"'{escaped}'"
            return str(val)

        if filter_type == FilterType.IN:
            values = ensure_list(value)
            if not values:
                return None
            expressions = [f"{field_name} eq {format_literal(v)}" for v in values]
            return "(" + " or ".join(expressions) + ")"

        if filter_type == FilterType.EXACT:
            return f"{field_name} eq {format_literal(value)}"

        if filter_type == FilterType.CONTAINS:
            literal = format_literal(value)
            # literal includes quotes already
            return f"contains({field_name}, {literal})"

        if filter_type == FilterType.RANGE:
            # 支持"min-max"或{min:x, max:y}或单一值（精确匹配）
            min_val = max_val = None
            if isinstance(value, str) and '-' in value:
                parts = value.split('-', 1)
                min_val, max_val = parts[0].strip(), parts[1].strip()
            elif isinstance(value, dict):
                min_val = value.get('min')
                max_val = value.get('max')
            elif isinstance(value, list) and len(value) == 2:
                min_val, max_val = value
            elif isinstance(value, (str, int, float)):
                # 单一值，视为精确匹配
                return f"{field_name} eq {format_literal(value)}"

            clauses = []
            if min_val not in (None, ""):
                clauses.append(f"{field_name} ge {format_literal(min_val)}")
            if max_val not in (None, ""):
                clauses.append(f"{field_name} le {format_literal(max_val)}")
            if clauses:
                return "(" + " and ".join(clauses) + ")"

        # 对于自定义或未覆盖的类型，回退到精确匹配
        return f"{field_name} eq {format_literal(value)}"
    
    async def _fetch_from_api(
        self, 
        api_url: str, 
        source_config: DataSourceConfig, 
        dataset_config: DatasetConfig,
        query_params: Dict[str, Any] = None,
        is_import: bool = False
        ) -> Dict[str, Any]:
        """从API获取数据"""
        async with httpx.AsyncClient(timeout=source_config.timeout) as client:
            if source_config.supports_pagination and is_import:
                # 分页获取所有数据
                logger.info("开启分页抓取: base_url=%s", api_url)
                # 移除URL中已有的分页参数，因为_fetch_all_pages会自己添加
                # 移除$skip和$top参数
                import re
                from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
                parsed = urlparse(api_url)
                query_dict = parse_qs(parsed.query, keep_blank_values=True)
                # 移除分页相关参数
                query_dict.pop('$skip', None)
                query_dict.pop('$top', None)
                # 重新构建查询字符串（保留其他参数如$filter和$count）
                new_query = urlencode(query_dict, doseq=True)
                clean_url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))
                logger.info("清理后的URL: %s", clean_url)
                return await self._fetch_all_pages(client, clean_url, source_config, dataset_config, query_params or {})
            else:
                # 单次获取
                logger.info("发起单次请求: %s", api_url)
                print(f"🚀 正在发起HTTP请求...")
                print(f"🚀 URL: {api_url}")
                print(f"🚀 headers: {source_config.headers}")
                print(f"🚀 timeout: {source_config.timeout}")
                response = await client.get(api_url, headers=source_config.headers)
                print(f"🚀 HTTP响应状态码: {response.status_code}")
                if response.status_code != 200:
                    print(f"🚀 HTTP响应内容: {response.text[:500]}")
                    return {"error": f"API调用失败: HTTP {response.status_code}"}
                
                data = response.json()
                return self._process_response(data, source_config, dataset_config, query_params)
    
    async def _fetch_all_pages(
        self, 
        client: httpx.AsyncClient, 
        api_url: str, 
        source_config: DataSourceConfig, 
        dataset_config: DatasetConfig,
        query_params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """分页获取所有数据"""
        all_data = []
        skip = 0
        page_size = source_config.max_page_size
        
        while True:
            # 构建分页URL
            separator = "&" if "?" in api_url else "?"
            page_url = (
                f"{api_url}{separator}"
                f"{source_config.page_offset_param}={skip}&"
                f"{source_config.page_size_param}={page_size}"
            )
            logger.info("分页请求 URL: %s", page_url)
            print(f"🚀 分页请求 URL: {page_url}")
            print(f"🚀 headers: {source_config.headers}")
            
            response = await client.get(page_url, headers=source_config.headers)
            print(f"🚀 分页响应状态码: {response.status_code}")
            if response.status_code != 200:
                print(f"🚀 分页响应内容: {response.text[:500]}")
                return {"error": f"API调用失败: HTTP {response.status_code}"}
            
            data = response.json()
            values = data.get("value", [])
            if not values:
                break
            
            all_data.extend(values)
            skip += page_size
            
            # 如果返回的数据少于页面大小，说明已经获取完所有数据
            if len(values) < page_size:
                break
        
        # 构建最终响应
        final_data = {
            "@odata.count": len(all_data),
            "value": all_data
        }
        
        return self._process_response(final_data, source_config, dataset_config, query_params)
    
    def _process_response(
        self, 
        data: Dict[str, Any], 
        source_config: DataSourceConfig, 
        dataset_config: DatasetConfig,
        query_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """处理API响应"""
        try:
            # 处理不同的响应格式
            if isinstance(data, list):
                # 如果响应直接是数组
                total_count = len(data)
                values = data
            else:
                # 如果响应是对象，尝试获取数据
                total_count = data.get("@odata.count", data.get("total", len(data.get("value", []))))
                values = data.get("value", [])
            
            # 应用字段映射 - 处理所有API字段
            processed_data = []
            for item in values:
                processed_item = {}
                
                # 首先处理配置的字段映射
                for mapping in source_config.field_mappings:
                    api_value = item.get(mapping.api_field)
                    if api_value is not None:
                        # 应用数据转换
                        if mapping.transform:
                            api_value = self._apply_transform(api_value, mapping.transform)
                        processed_item[mapping.standard_field] = api_value
                    elif mapping.required:
                        processed_item[mapping.standard_field] = mapping.default_value
                
                # 然后添加所有其他API字段（未在字段映射中定义的）
                for api_field, api_value in item.items():
                    # 检查这个字段是否已经在字段映射中处理过
                    already_mapped = any(mapping.api_field == api_field for mapping in source_config.field_mappings)
                    if not already_mapped and api_value is not None:
                        # 使用API字段名作为标准字段名
                        processed_item[api_field] = api_value
                
                processed_data.append(processed_item)
            
            # 应用客户端筛选
            filtered_data = self._apply_client_filters(processed_data, source_config, query_params or {})
            
            # 构建列信息 - 优先使用配置的字段映射，只有在有实际数据时才使用动态字段
            if processed_data and len(processed_data) > 0:
                # 从实际数据中获取所有字段
                all_fields = set()
                for item in processed_data:
                    all_fields.update(item.keys())
                columns = list(all_fields)
            else:
                # 如果没有数据，使用配置的字段映射
                columns = [mapping.standard_field for mapping in source_config.field_mappings]
            
            filtered_count = len(filtered_data)
            has_filters = bool(query_params)
            # 总是返回API的真实总记录数，而不是实际获取的数据行数
            note_total = int(total_count)
            note_message = (
                f"筛选后共{filtered_count}条记录，总记录数{int(total_count)}。"
                if has_filters
                else f"共{int(total_count)}条记录。"
            )

            return {
                "columns": columns,
                "data": filtered_data,
                "total_records": note_total,
                "query_params": query_params or {},
                "note": note_message,
                "fetched_at": datetime.utcnow().isoformat() + "Z"
            }
            
        except Exception as e:
            logger.error(f"响应处理失败: {str(e)}")
            return {"error": f"响应处理失败: {str(e)}"}
    
    def _apply_transform(self, value: Any, transform: str) -> Any:
        """应用数据转换"""
        if transform == "float":
            return float(value) if value is not None else 0.0
        elif transform == "int":
            return int(value) if value is not None else 0
        elif transform == "str":
            return str(value) if value is not None else ""
        # 可以添加更多转换函数
        return value
    
    def _apply_client_filters(
        self, 
        data: List[Dict[str, Any]], 
        source_config: DataSourceConfig, 
        query_params: Dict[str, Any] = None
    ) -> List[Dict[str, Any]]:
        """应用客户端筛选"""
        if not query_params:
            return data
        
        filtered_data = []
        for record in data:
            include_record = True
            
            for filter_config in source_config.filters:
                if filter_config.name not in query_params:
                    continue
                
                value = query_params[filter_config.name]
                if not value or value == "All" or value == ["All"]:
                    continue
                
                standard_field = filter_config.standard_field or filter_config.name
                record_value = record.get(standard_field)
                if record_value is None:
                    # 如果映射字段不存在，假设API端已处理筛选
                    continue
                if not self._matches_filter(record_value, value, filter_config):
                    include_record = False
                    break
            
            if include_record:
                filtered_data.append(record)
        
        return filtered_data
    
    def _matches_filter(self, record_value: Any, filter_value: Any, filter_config: FilterConfig) -> bool:
        """检查记录是否匹配筛选条件"""
        if record_value is None:
            return False
        
        if filter_config.filter_type == FilterType.EXACT:
            return str(record_value) == str(filter_value)
        elif filter_config.filter_type == FilterType.CONTAINS:
            return str(filter_value).lower() in str(record_value).lower()
        elif filter_config.filter_type == FilterType.IN:
            if isinstance(filter_value, list):
                return str(record_value) in [str(v) for v in filter_value]
            else:
                return str(record_value) == str(filter_value)
        elif filter_config.filter_type == FilterType.RANGE:
            if isinstance(filter_value, str) and "-" in filter_value:
                try:
                    min_val, max_val = map(float, filter_value.split("-"))
                    record_val = float(record_value)
                    return min_val <= record_val <= max_val
                except (ValueError, TypeError):
                    return False
        elif filter_config.filter_type == FilterType.CUSTOM:
            # 这里可以实现自定义筛选逻辑
            pass
        
        return True
    
    def _get_cache_key(self, source_id: str, dataset_id: str, query_params: Dict[str, Any] = None) -> str:
        """生成缓存键"""
        params_str = json.dumps(query_params or {}, sort_keys=True)
        return f"{source_id}:{dataset_id}:{hash(params_str)}"
    
    def clear_cache(self):
        """清空缓存"""
        self.cache.clear()
    
    async def fetch_dataset_data(self, dataset_id: int, db) -> Optional[pd.DataFrame]:
        """
        从数据库获取数据集数据（支持 R2 存储）
        
        Args:
            dataset_id: 数据集ID
            db: 数据库连接
            
        Returns:
            pandas DataFrame或None
        """
        try:
            # 从数据库获取数据集信息
            query = text("SELECT file_path FROM datasets WHERE id = :dataset_id")
            result = db.execute(query, {"dataset_id": dataset_id})
            row = result.fetchone()
            
            if not row:
                logger.warning(f"数据集 {dataset_id} 不存在")
                return None
                
            file_path = row[0]
            if not file_path:
                logger.warning(f"数据集 {dataset_id} 没有文件路径")
                return None
            
            # 使用统一的文件服务读取数据（支持 R2 和本地存储）
            df = await read_data_file(file_path)
            if df is None:
                logger.warning(f"无法读取数据集文件: {file_path}")
                return None
            
            # 限制数据量，避免内存问题
            if len(df) > 1000:
                df = df.head(1000)
                logger.info(f"数据集 {dataset_id} 数据量较大，仅读取前1000行")
            
            if df.empty:
                logger.warning(f"数据集 {dataset_id} 没有数据")
                return None
                
            logger.info(f"成功读取数据集 {dataset_id}，形状: {df.shape}")
            return df
            
        except Exception as e:
            logger.error(f"获取数据集 {dataset_id} 数据时出错: {e}")
            return None
