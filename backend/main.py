import os

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import uvicorn

from database import get_db, engine
from models import Base
from routers import auth, data, analysis_v2 as analysis, reports, users, dashboard, config_management, unified_data, api_management, datasource_management, dataset_discovery, medical_preprocessing, data_preprocessing, data_conversion, audit
from routers import data_v2, preprocessing_v2
from settings import settings

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="HealthInsight Hub",
    description="HealthInsight Hub（HIH）- 智能医疗数据分析平台",
    version="1.0.0"
)

# CORS配置 - 使用 settings 中配置的允许源
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 安全配置
security = HTTPBearer()

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(users.router, prefix="/api/users", tags=["用户管理"])
# 数据管理 / 预处理（本地存储）
app.include_router(data_v2.router, prefix="/api/data", tags=["数据管理"])
app.include_router(preprocessing_v2.router, prefix="/api/data-preprocessing", tags=["数据预处理"])
app.include_router(data_preprocessing.router, prefix="/api/data-preprocessing", tags=["数据预处理"])

app.include_router(analysis.router, prefix="/api/analysis", tags=["数据分析"])
app.include_router(reports.router, prefix="/api/reports", tags=["报告生成"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["仪表盘"])
app.include_router(config_management.router, prefix="/api/config", tags=["配置管理"])
app.include_router(api_management.router, tags=["API管理"])
app.include_router(datasource_management.router, tags=["数据源管理"])
app.include_router(dataset_discovery.router, tags=["数据集发现"])
app.include_router(unified_data.router, tags=["统一数据"])
app.include_router(medical_preprocessing.router, prefix="/api/medical-preprocessing", tags=["医学数据预处理"])
app.include_router(data_conversion.router, prefix="/api/data-conversion", tags=["数据格式转换"])
app.include_router(audit.router, prefix="/api/audit", tags=["审计日志"])

# 静态资源：用户上传文件（头像等）
uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.get("/")
async def root():
    return {"message": "HealthInsight Hub API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.on_event("startup")
async def startup_event():
    """应用启动事件"""
    print("🚀 HealthInsight Hub API 已启动（本地部署模式）")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
