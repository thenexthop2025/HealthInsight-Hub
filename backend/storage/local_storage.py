"""
本地文件存储实现
"""
import os
import pandas as pd
import pyreadstat
import json
import tempfile
from typing import Optional
from .base import StorageInterface


class LocalStorage(StorageInterface):
    """本地文件存储实现"""
    
    def __init__(self, upload_dir: str = "uploads"):
        self.upload_dir = upload_dir
        os.makedirs(upload_dir, exist_ok=True)
    
    async def upload_file(self, file_content: bytes, filename: str) -> str:
        """上传文件到本地存储"""
        import uuid
        unique_name = f"{uuid.uuid4().hex}__{filename}"
        file_path = os.path.join(self.upload_dir, unique_name)
        
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        
        return f"file://{file_path}"
    
    async def download_file(self, file_path: str) -> bytes:
        """从本地存储下载文件"""
        if file_path.startswith('file://'):
            file_path = file_path[7:]
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        with open(file_path, "rb") as f:
            return f.read()
    
    async def delete_file(self, file_path: str) -> bool:
        """从本地存储删除文件"""
        try:
            if file_path.startswith('file://'):
                file_path = file_path[7:]
            
            if os.path.exists(file_path):
                os.remove(file_path)
            return True
        except Exception:
            return False
    
    def file_exists(self, file_path: str) -> bool:
        """检查本地文件是否存在"""
        if file_path.startswith('file://'):
            file_path = file_path[7:]
        return os.path.exists(file_path)
    
    def get_public_url(self, file_path: str) -> str:
        """获取本地文件的公共访问 URL"""
        # 本地文件通常通过 API 端点访问
        if file_path.startswith('file://'):
            file_path = file_path[7:]
        return f"/api/files/{os.path.basename(file_path)}"
    
    async def read_data_file(self, file_path: str) -> Optional[pd.DataFrame]:
        """读取本地数据文件"""
        try:
            if file_path.startswith('file://'):
                file_path = file_path[7:]
            
            if not os.path.exists(file_path):
                return None
            
            return await self._read_file_by_extension(file_path)
        except Exception:
            return None
    
    async def _read_file_by_extension(self, file_path: str) -> Optional[pd.DataFrame]:
        """根据文件扩展名读取文件"""
        try:
            filename = os.path.basename(file_path)
            ext = os.path.splitext(filename)[1].lower()
            
            if ext == '.csv':
                return pd.read_csv(file_path)
            elif ext == '.sav':
                df, meta = pyreadstat.read_sav(file_path)
                return df
            elif ext == '.json':
                with open(file_path, 'r', encoding='utf-8') as f:
                    json_data = json.load(f)
                
                if isinstance(json_data, dict) and 'data' in json_data:
                    return pd.DataFrame(json_data['data'])
                elif isinstance(json_data, list):
                    return pd.DataFrame(json_data)
                else:
                    raise ValueError("不支持的 JSON 格式")
            elif ext == '.txt':
                try:
                    return pd.read_csv(file_path, sep=None, engine='python')
                except Exception:
                    try:
                        return pd.read_csv(file_path, sep='\t')
                    except Exception:
                        return pd.read_csv(file_path, delim_whitespace=True)
            elif ext in ['.xlsx', '.xls']:
                return pd.read_excel(file_path, engine='openpyxl')
            else:
                # 尝试作为 CSV 读取
                try:
                    return pd.read_csv(file_path)
                except Exception:
                    raise ValueError(f"不支持的文件格式: {filename}")
                    
        except Exception:
            return None
