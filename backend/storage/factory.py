"""
存储工厂
根据配置创建相应的存储实例
"""
from typing import Optional
from .base import StorageInterface
from .local_storage import LocalStorage
from .r2_storage import R2Storage
from settings import settings


class StorageFactory:
    """存储工厂类"""
    
    _instance: Optional[StorageInterface] = None
    
    @classmethod
    def get_storage(cls) -> StorageInterface:
        """
        获取存储实例（单例模式）
        
        Returns:
            StorageInterface: 存储实例
        """
        if cls._instance is None:
            cls._instance = cls._create_storage()
        return cls._instance
    
    @classmethod
    def _create_storage(cls) -> StorageInterface:
        """
        根据配置创建存储实例
        
        Returns:
            StorageInterface: 存储实例
        """
        if settings.USE_R2_STORAGE:
            return R2Storage()
        else:
            return LocalStorage(upload_dir=settings.UPLOAD_DIR)
    
    @classmethod
    def reset_instance(cls):
        """重置实例（主要用于测试）"""
        cls._instance = None


# 便捷函数
def get_storage() -> StorageInterface:
    """获取存储实例的便捷函数"""
    return StorageFactory.get_storage()
