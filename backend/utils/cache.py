"""
统一的缓存工具类
提供简单的内存缓存功能，支持 LRU 淘汰策略
"""

import time
from typing import Any, Optional, Dict, Tuple
from functools import wraps
import json


class SimpleCache:
    """简单的内存缓存类"""
    
    def __init__(self, duration: int = 300, max_size: int = 1000):
        """
        初始化缓存
        
        Args:
            duration: 缓存持续时间（秒），默认 5 分钟
            max_size: 最大缓存条目数，默认 1000
        """
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self._duration = duration
        self._max_size = max_size
    
    def get(self, key: str) -> Optional[Any]:
        """
        获取缓存数据
        
        Args:
            key: 缓存键
            
        Returns:
            缓存的数据，如果不存在或已过期则返回 None
        """
        if key in self._cache:
            data, timestamp = self._cache[key]
            # 检查是否过期
            if time.time() - timestamp < self._duration:
                return data
            # 过期则删除
            del self._cache[key]
        return None
    
    def set(self, key: str, value: Any) -> None:
        """
        设置缓存数据
        
        Args:
            key: 缓存键
            value: 要缓存的数据
        """
        # 如果超过最大大小，使用 LRU 淘汰最旧的条目
        if len(self._cache) >= self._max_size:
            # 找到最旧的条目
            oldest_key = min(self._cache.items(), key=lambda x: x[1][1])[0]
            del self._cache[oldest_key]
        
        # 存储数据和时间戳
        self._cache[key] = (value, time.time())
    
    def clear(self) -> None:
        """清空所有缓存"""
        self._cache.clear()
    
    def remove(self, key: str) -> bool:
        """
        删除指定缓存
        
        Args:
            key: 缓存键
            
        Returns:
            是否成功删除
        """
        if key in self._cache:
            del self._cache[key]
            return True
        return False
    
    def size(self) -> int:
        """返回当前缓存条目数"""
        return len(self._cache)
    
    def make_key(self, *args, **kwargs) -> str:
        """
        生成缓存键
        
        Args:
            *args: 位置参数
            **kwargs: 关键字参数
            
        Returns:
            缓存键字符串
        """
        # 将参数序列化为字符串
        key_parts = [str(arg) for arg in args]
        if kwargs:
            sorted_kwargs = sorted(kwargs.items())
            key_parts.append(json.dumps(sorted_kwargs, sort_keys=True))
        return ":".join(key_parts)


# 全局缓存实例
_global_cache = SimpleCache(duration=300, max_size=1000)


def cached(duration: int = 300, cache_instance: Optional[SimpleCache] = None):
    """
    缓存装饰器
    
    Args:
        duration: 缓存持续时间（秒）
        cache_instance: 缓存实例，如果为 None 则使用全局缓存
        
    Example:
        @cached(duration=600)
        async def fetch_data(dataset_id: str):
            # ... 耗时操作
            return data
    """
    cache = cache_instance or _global_cache
    
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = f"{func.__name__}:{cache.make_key(*args, **kwargs)}"
            
            # 尝试从缓存获取
            result = cache.get(cache_key)
            if result is not None:
                return result
            
            # 执行函数并缓存结果
            result = await func(*args, **kwargs)
            cache.set(cache_key, result)
            return result
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = f"{func.__name__}:{cache.make_key(*args, **kwargs)}"
            
            # 尝试从缓存获取
            result = cache.get(cache_key)
            if result is not None:
                return result
            
            # 执行函数并缓存结果
            result = func(*args, **kwargs)
            cache.set(cache_key, result)
            return result
        
        # 根据函数类型返回对应的包装器
        import inspect
        if inspect.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


def get_global_cache() -> SimpleCache:
    """获取全局缓存实例"""
    return _global_cache


def clear_global_cache() -> None:
    """清空全局缓存"""
    _global_cache.clear()

