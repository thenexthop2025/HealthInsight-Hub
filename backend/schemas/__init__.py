from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, EmailStr

from .mendelian import MendelianRandomizationRequest, MendelianRandomizationResult
from .stratified import StratifiedRequest, StratifiedResult
from .conditional_logistic import (
    ConditionalLogisticRequest,
    ConditionalLogisticResult,
)

class UserRole(str, Enum):
    DOCTOR = "doctor"
    RESEARCHER = "researcher"
    PUBLIC_HEALTH = "public_health"
    ADMIN = "admin"

# 用户相关Schema
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    role: UserRole

class UserCreate(UserBase):
    password: str

class PublicRegisterRequest(BaseModel):
    """公开注册请求：不允许客户端指定角色"""
    username: str
    email: EmailStr
    full_name: str
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

class UserStatusUpdate(BaseModel):
    is_active: bool

class UserPasswordReset(BaseModel):
    new_password: str


class AuditLog(BaseModel):
    id: int
    actor_id: Optional[int] = None
    action: str
    target_type: str
    target_id: Optional[int] = None
    details: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogList(BaseModel):
    total: int
    items: List[AuditLog]

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenResponse(BaseModel):
    """Token响应，包含访问令牌和刷新令牌"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # access_token 过期时间（秒）

class RefreshTokenRequest(BaseModel):
    """刷新令牌请求"""
    refresh_token: str

class ChangePasswordRequest(BaseModel):
    """修改密码请求"""
    old_password: str
    new_password: str

# 数据源相关Schema
class DataSourceBase(BaseModel):
    name: str
    description: Optional[str] = None
    api_endpoint: Optional[str] = None
    data_type: str

class DataSourceCreate(DataSourceBase):
    pass

class DataSource(DataSourceBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# 数据集相关Schema
class DatasetBase(BaseModel):
    name: str
    description: Optional[str] = None
    file_path: Optional[str] = None
    record_count: Optional[int] = None
    columns_info: Optional[Union[Dict[str, Any], str]] = None

class DatasetCreate(DatasetBase):
    data_source_id: int

class Dataset(DatasetBase):
    id: int
    data_source_id: int
    owner_id: Optional[int] = None
    data_source_name: Optional[str] = None  # 数据源名称
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# 分析相关Schema
class AnalysisBase(BaseModel):
    name: str
    description: Optional[str] = None
    analysis_type: str
    parameters: Optional[Union[Dict[str, Any], str]] = None

class AnalysisCreate(AnalysisBase):
    dataset_id: int

class AnalysisUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None

class Analysis(AnalysisBase):
    id: int
    user_id: int
    dataset_id: int
    dataset_name: Optional[str] = None
    results: Optional[Union[Dict[str, Any], str]] = None
    status: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# 报告相关Schema
class ReportBase(BaseModel):
    title: str
    content: Optional[str] = None
    report_type: str = "pdf"

class ReportCreate(ReportBase):
    analysis_id: int

class Report(ReportBase):
    id: int
    user_id: int
    analysis_id: int
    file_path: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# 统计分析相关Schema
class StatisticalAnalysisRequest(BaseModel):
    dataset_id: int
    analysis_type: str  # regression, correlation, survival, descriptive, mendelian_randomization
    analysis_name: Optional[str] = None
    description: Optional[str] = None
    dependent_variable: Optional[str] = None
    dependent_variables: Optional[List[str]] = None
    independent_variables: Optional[List[str]] = None
    grouping_variables: Optional[List[str]] = None
    stratum_variables: Optional[List[str]] = None
    # 条件逻辑回归所需的单个分层字段
    strata_variable: Optional[str] = None
    control_variables: Optional[List[str]] = None
    descriptive_subtype: Optional[str] = None
    original_analysis_type: Optional[str] = None
    categorical_variables: Optional[List[str]] = None
    include_missing: Optional[bool] = None
    row_variable: Optional[str] = None
    column_variable: Optional[str] = None
    include_totals: Optional[bool] = True
    filters: Optional[Dict[str, Any]] = None
    parameters: Optional[Dict[str, Any]] = None
    
    # 孟德尔随机化分析专用参数
    exposure_variable: Optional[str] = None
    outcome_variable: Optional[str] = None
    instrument_variables: Optional[List[str]] = None
    confounders: Optional[List[str]] = None
    mr_method: Optional[str] = "two_stage"

    def mendelian_request(self) -> Optional[MendelianRandomizationRequest]:
        if self.analysis_type != "mendelian_randomization":
            return None
        return MendelianRandomizationRequest(
            exposure_variable=self.exposure_variable,
            outcome_variable=self.outcome_variable,
            instrument_variables=self.instrument_variables or [],
        )

    def stratified_request(self) -> Optional[StratifiedRequest]:
        if self.analysis_type != "stratified":
            return None
        dependent = (self.dependent_variables or [self.dependent_variable] or [])
        independent = self.independent_variables or []
        strata = self.stratum_variables or self.strata_variable or []
        dep = dependent[0] if dependent else None
        indep = independent[0] if independent else None
        stratum_var = strata[0] if isinstance(strata, list) else strata
        if not dep or not indep or not stratum_var:
            return None
        return StratifiedRequest(
            dependent_variable=dep,
            independent_variable=indep,
            stratum_variable=stratum_var,
        )

    def conditional_logistic_request(self) -> Optional[ConditionalLogisticRequest]:
        if self.analysis_type != "logistic_regression_conditional":
            return None
        dependent = (self.dependent_variables or [self.dependent_variable] or [])
        independent = self.independent_variables or []
        strata = self.stratum_variables or self.strata_variable or []
        if not dependent or not independent or not strata:
            return None
        stratum_var = strata[0] if isinstance(strata, list) else strata
        return ConditionalLogisticRequest(
            dependent_variable=dependent[0],
            independent_variables=independent,
            control_variables=self.control_variables or [],
            stratum_variable=stratum_var,
        )

class StatisticalAnalysisResponse(BaseModel):
    analysis_id: int
    status: str
    results: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

# 数据上传相关Schema
class DataUploadRequest(BaseModel):
    name: str
    description: Optional[str] = None
    data_source_id: int
    file_type: str  # csv, excel, json

class DataUploadResponse(BaseModel):
    dataset_id: int
    status: str
    message: str
