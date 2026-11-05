"""
数据源配置模式 - 支持灵活的数据获取和筛选
"""
from typing import Dict, List, Optional, Any, Union
from pydantic import BaseModel, Field
from enum import Enum

class FilterType(str, Enum):
    """筛选类型枚举"""
    EXACT = "exact"  # 精确匹配
    CONTAINS = "contains"  # 包含匹配
    RANGE = "range"  # 范围匹配
    IN = "in"  # 在列表中
    CUSTOM = "custom"  # 自定义逻辑

class FieldType(str, Enum):
    """字段类型枚举"""
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    DATE = "date"
    BOOLEAN = "boolean"

class FilterConfig(BaseModel):
    """筛选配置"""
    name: str = Field(..., description="筛选参数名称")
    display_name: str = Field(..., description="显示名称")
    field_type: FieldType = Field(..., description="字段类型")
    filter_type: FilterType = Field(..., description="筛选类型")
    api_field: str = Field(..., description="API中的字段名")
    required: bool = Field(False, description="是否必需")
    standard_field: Optional[str] = Field(None, description="映射后的标准字段名")
    odata_field: Optional[str] = Field(None, description="OData过滤时使用的字段名")
    options: Optional[List[Dict[str, Any]]] = Field(None, description="选项列表")
    range_min: Optional[float] = Field(None, description="范围最小值")
    range_max: Optional[float] = Field(None, description="范围最大值")
    custom_logic: Optional[str] = Field(None, description="自定义筛选逻辑")

class AuthConfig(BaseModel):
    """认证配置"""
    auth_type: str = Field("none", description="认证类型")
    username: Optional[str] = Field(None, description="用户名")
    password: Optional[str] = Field(None, description="密码")
    token: Optional[str] = Field(None, description="访问令牌")
    api_key: Optional[str] = Field(None, description="API密钥")
    api_key_header: str = Field("X-API-Key", description="API密钥请求头")
    api_key_param: Optional[str] = Field(None, description="API密钥参数名")
    oauth2_client_id: Optional[str] = Field(None, description="OAuth2客户端ID")
    oauth2_client_secret: Optional[str] = Field(None, description="OAuth2客户端密钥")
    oauth2_token_url: Optional[str] = Field(None, description="OAuth2令牌URL")
    oauth2_auth_url: Optional[str] = Field(None, description="OAuth2授权URL")
    custom_auth_func: Optional[str] = Field(None, description="自定义认证函数")

class FieldMapping(BaseModel):
    """字段映射配置"""
    api_field: str = Field(..., description="API字段名")
    standard_field: str = Field(..., description="标准字段名")
    field_type: FieldType = Field(..., description="字段类型")
    required: bool = Field(False, description="是否必需")
    default_value: Optional[Any] = Field(None, description="默认值")
    transform: Optional[str] = Field(None, description="数据转换函数")

class DataSourceConfig(BaseModel):
    """数据源配置"""
    id: str = Field(..., description="数据源ID")
    name: str = Field(..., description="数据源名称")
    description: str = Field(..., description="描述")
    category: str = Field(..., description="类别")
    source: str = Field(..., description="数据源")
    api_type: str = Field(..., description="API类型")
    
    # API关联
    api_id: Optional[str] = Field(None, description="关联的API ID")
    current_api_id: Optional[str] = Field(None, description="当前关联的API ID")
    api_configurations: Optional[Dict[str, Dict[str, Any]]] = Field(None, description="多API配置")
    
    # API配置
    base_url: str = Field(..., description="API基础URL")
    endpoint: str = Field(..., description="API端点")
    method: str = Field("GET", description="HTTP方法")
    headers: Optional[Dict[str, str]] = Field(None, description="请求头")
    timeout: int = Field(30, description="超时时间")
    
    # 认证配置
    auth: AuthConfig = Field(default_factory=AuthConfig, description="认证配置")
    
    # 数据配置
    field_mappings: List[FieldMapping] = Field(..., description="字段映射配置")
    filters: List[FilterConfig] = Field(..., description="筛选配置")
    
    # 分页配置
    supports_pagination: bool = Field(True, description="是否支持分页")
    page_size_param: str = Field("$top", description="分页大小参数名")
    page_offset_param: str = Field("$skip", description="分页偏移参数名")
    count_param: str = Field("$count", description="计数参数名")
    max_page_size: int = Field(1000, description="最大分页大小")
    
    # 缓存配置
    cache_duration: int = Field(300, description="缓存持续时间（秒）")
    
    # 数据处理配置
    data_processor: Optional[str] = Field(None, description="数据处理器函数名")
    response_parser: Optional[str] = Field(None, description="响应解析器函数名")

class DatasetConfig(BaseModel):
    """数据集配置"""
    id: str = Field(..., description="数据集ID")
    name: str = Field(..., description="数据集名称")
    description: str = Field(..., description="描述")
    category: str = Field(..., description="类别")
    source: str = Field(..., description="数据源")
    
    # 数据源引用
    data_source_id: str = Field(..., description="数据源ID")
    
    # 数据集特定配置
    indicator_code: Optional[str] = Field(None, description="指标代码")
    dimension_code: Optional[str] = Field(None, description="维度代码")
    custom_endpoint: Optional[str] = Field(None, description="自定义端点")
    
    # 默认参数
    default_params: Optional[Dict[str, Any]] = Field(None, description="默认参数")
    
    # 预览配置
    preview_limit: int = Field(50, description="预览限制")
    import_limit: Optional[int] = Field(None, description="导入限制（None表示无限制）")

class DataSourceRegistry:
    """数据源注册表"""
    
    def __init__(self):
        self._sources: Dict[str, DataSourceConfig] = {}
        self._datasets: Dict[str, DatasetConfig] = {}
    
    def register_source(self, config: DataSourceConfig):
        """注册数据源"""
        self._sources[config.id] = config
    
    def register_dataset(self, config: DatasetConfig):
        """注册数据集"""
        self._datasets[config.id] = config
    
    def get_source(self, source_id: str) -> Optional[DataSourceConfig]:
        """获取数据源配置"""
        return self._sources.get(source_id)
    
    def get_dataset(self, dataset_id: str) -> Optional[DatasetConfig]:
        """获取数据集配置"""
        return self._datasets.get(dataset_id)
    
    def get_datasets_by_source(self, source_id: str) -> List[DatasetConfig]:
        """根据数据源获取数据集列表"""
        return [dataset for dataset in self._datasets.values() 
                if dataset.data_source_id == source_id]
    
    def list_sources(self) -> List[DataSourceConfig]:
        """列出所有数据源"""
        return list(self._sources.values())
    
    def list_datasets(self) -> List[DatasetConfig]:
        """列出所有数据集"""
        return list(self._datasets.values())

