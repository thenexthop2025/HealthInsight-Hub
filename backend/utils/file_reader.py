import os
import pandas as pd
import pyreadstat
import json
import tempfile
from typing import Optional, Union
import logging
from settings import settings

logger = logging.getLogger(__name__)

class FileReader:
    """统一的文件读取工具，支持本地文件和 R2 存储"""
    
    def __init__(self):
        self.r2_service = None
        if settings.USE_R2_STORAGE:
            try:
                from services.r2_storage import R2StorageService
                self.r2_service = R2StorageService()
            except Exception as e:
                logger.warning(f"R2 存储服务初始化失败: {str(e)}")
                self.r2_service = None
    
    async def read_data_file(self, file_path: str) -> Optional[pd.DataFrame]:
        """
        读取数据文件，支持本地文件和 R2 存储
        
        Args:
            file_path: 文件路径（本地路径或 r2:// 路径）
            
        Returns:
            pd.DataFrame: 读取的数据，失败时返回 None
        """
        try:
            # 判断是否为 R2 路径
            if file_path.startswith("r2://"):
                return await self._read_r2_file(file_path)
            else:
                return await self._read_local_file(file_path)
                
        except Exception as e:
            logger.error(f"读取文件失败 {file_path}: {str(e)}")
            return None
    
    async def _read_r2_file(self, r2_path: str) -> Optional[pd.DataFrame]:
        """读取 R2 文件"""
        if not self.r2_service:
            logger.error("R2 存储服务未初始化")
            return None
        
        try:
            # 从 R2 下载文件内容
            file_content = await self.r2_service.download_file(r2_path)
            
            # 解析文件名
            path_parts = r2_path[5:].split("/", 1)  # 移除 r2:// 前缀
            if len(path_parts) != 2:
                logger.error(f"无效的 R2 路径格式: {r2_path}")
                return None
            
            bucket, key = path_parts
            filename = key.split("__", 1)[-1] if "__" in key else key  # 移除 UUID 前缀
            
            # 创建临时文件
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as tmp_file:
                tmp_file.write(file_content)
                tmp_path = tmp_file.name
            
            try:
                # 读取临时文件
                df = await self._read_file_by_extension(tmp_path, filename)
                return df
            finally:
                # 清理临时文件
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
                    
        except Exception as e:
            logger.error(f"读取 R2 文件失败 {r2_path}: {str(e)}")
            return None
    
    async def _read_local_file(self, file_path: str) -> Optional[pd.DataFrame]:
        """读取本地文件"""
        try:
            # 处理 file:// 前缀
            if file_path.startswith('file://'):
                file_path = file_path[7:]
            
            # 检查文件是否存在
            if not os.path.exists(file_path):
                logger.error(f"本地文件不存在: {file_path}")
                return None
            
            # 获取文件名
            filename = os.path.basename(file_path)
            
            # 读取文件
            return await self._read_file_by_extension(file_path, filename)
            
        except Exception as e:
            logger.error(f"读取本地文件失败 {file_path}: {str(e)}")
            return None
    
    async def _read_file_by_extension(self, file_path: str, filename: str) -> Optional[pd.DataFrame]:
        """根据文件扩展名读取文件"""
        try:
            ext = os.path.splitext(filename)[1].lower()
            
            if ext == '.csv':
                return pd.read_csv(file_path)
            elif ext == '.sav':
                df, meta = pyreadstat.read_sav(file_path)
                return df
            elif ext == '.json':
                with open(file_path, 'r', encoding='utf-8') as f:
                    json_data = json.load(f)
                
                # 检查 JSON 结构
                if isinstance(json_data, dict) and 'data' in json_data:
                    return pd.DataFrame(json_data['data'])
                elif isinstance(json_data, list):
                    return pd.DataFrame(json_data)
                else:
                    raise ValueError("不支持的 JSON 格式，需要数组或包含'data'键的对象")
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
                # 未知格式，尝试作为 CSV 读取
                try:
                    return pd.read_csv(file_path)
                except Exception:
                    raise ValueError(f"不支持的文件格式: {filename}")
                    
        except Exception as e:
            logger.error(f"根据扩展名读取文件失败 {file_path}: {str(e)}")
            return None

# 创建全局实例
file_reader = FileReader()

async def read_data_file(file_path: str) -> Optional[pd.DataFrame]:
    """
    读取数据文件的便捷函数
    
    Args:
        file_path: 文件路径（本地路径或 r2:// 路径）
        
    Returns:
        pd.DataFrame: 读取的数据，失败时返回 None
    """
    return await file_reader.read_data_file(file_path)
