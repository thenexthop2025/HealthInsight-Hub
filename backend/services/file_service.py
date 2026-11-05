"""
文件服务
提供统一的文件操作接口
"""
from typing import Optional
import pandas as pd
from storage import get_storage


class FileService:
    """文件服务类"""
    
    def __init__(self):
        self.storage = get_storage()
    
    async def read_data_file(self, file_path: str) -> Optional[pd.DataFrame]:
        """
        读取数据文件
        
        Args:
            file_path: 文件路径标识符
            
        Returns:
            pd.DataFrame: 读取的数据，失败时返回 None
        """
        return await self.storage.read_data_file(file_path)
    
    async def upload_file(self, file_content: bytes, filename: str) -> str:
        """
        上传文件
        
        Args:
            file_content: 文件内容（字节）
            filename: 文件名
            
        Returns:
            str: 存储路径标识符
        """
        return await self.storage.upload_file(file_content, filename)
    
    async def delete_file(self, file_path: str) -> bool:
        """
        删除文件
        
        Args:
            file_path: 文件路径标识符
            
        Returns:
            bool: 删除是否成功
        """
        return await self.storage.delete_file(file_path)
    
    def file_exists(self, file_path: str) -> bool:
        """
        检查文件是否存在
        
        Args:
            file_path: 文件路径标识符
            
        Returns:
            bool: 文件是否存在
        """
        return self.storage.file_exists(file_path)
    
    def get_public_url(self, file_path: str) -> str:
        """
        获取文件的公共访问 URL
        
        Args:
            file_path: 文件路径标识符
            
        Returns:
            str: 公共访问 URL
        """
        return self.storage.get_public_url(file_path)


# 创建全局实例
file_service = FileService()

# 便捷函数
async def read_data_file(file_path: str) -> Optional[pd.DataFrame]:
    """读取数据文件的便捷函数"""
    return await file_service.read_data_file(file_path)
