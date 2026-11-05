from pydantic_settings import BaseSettings
from typing import List
import os
import secrets

class Settings(BaseSettings):
    # 数据库配置（生产环境固定 Postgres；如需开发 SQLite 另配 .env.dev，不在生产镜像中）
    DATABASE_URL: str = "postgresql://postgres:postgres@postgres:5432/disease_analysis"
    
    # JWT配置 - 必须通过环境变量设置
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS配置 - 从环境变量读取的字符串，逗号分隔
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    # 文件上传配置
    MAX_FILE_SIZE: int = 20 * 1024 * 1024  # 20MB
    UPLOAD_DIR: str = "uploads"
    
    # 可选：对象存储（默认关闭，本地使用 UPLOAD_DIR）
    USE_R2_STORAGE: bool = False
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_PUBLIC_URL: str = ""

    # API配置（可选）
    WHO_API_KEY: str = ""
    
    class Config:
        env_file = ".env"
        extra = "ignore"  # 忽略额外的环境变量
    
    @property
    def allowed_origins_list(self) -> List[str]:
        """将 ALLOWED_ORIGINS 字符串转换为列表"""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

settings = Settings()
