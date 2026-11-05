"""
存储抽象基类
定义统一的存储接口
"""
from abc import ABC, abstractmethod
from typing import Optional, Union
import pandas as pd


class StorageInterface(ABC):
    """存储接口抽象基类"""
    
    @abstractmethod
    async def upload_file(self, file_content: bytes, filename: str) -> str:
        """
        上传文件
        
        Args:
            file_content: 文件内容（字节）
            filename: 文件名
            
        Returns:
            str: 存储路径标识符
        """
        pass
    
    @abstractmethod
    async def download_file(self, file_path: str) -> bytes:
        """
        下载文件
        
        Args:
            file_path: 存储路径标识符
            
        Returns:
            bytes: 文件内容
        """
        pass
    
    @abstractmethod
    async def delete_file(self, file_path: str) -> bool:
        """
        删除文件
        
        Args:
            file_path: 存储路径标识符
            
        Returns:
            bool: 删除是否成功
        """
        pass
    
    @abstractmethod
    def file_exists(self, file_path: str) -> bool:
        """
        检查文件是否存在
        
        Args:
            file_path: 存储路径标识符
            
        Returns:
            bool: 文件是否存在
        """
        pass
    
    @abstractmethod
    def get_public_url(self, file_path: str) -> str:
        """
        获取文件的公共访问 URL
        
        Args:
            file_path: 存储路径标识符
            
        Returns:
            str: 公共访问 URL
        """
        pass
    
    @abstractmethod
    async def read_data_file(self, file_path: str) -> Optional[pd.DataFrame]:
        """
        读取数据文件
        
        Args:
            file_path: 存储路径标识符
            
        Returns:
            pd.DataFrame: 读取的数据，失败时返回 None
        """
        pass
