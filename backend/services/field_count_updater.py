"""
字段数量更新服务 - 完整版本
负责动态获取和更新每个数据集的真实字段数量
"""
import asyncio
import aiohttp
import json
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Dict, Optional
import threading

logger = logging.getLogger(__name__)

class FieldCountUpdater:
    def __init__(self):
        self.datasets_file = "config/datasets.json"
        self.field_counts_file = "config/field_counts.json"
        self.last_update_file = "config/last_field_update.json"
        self.is_updating = False
        
    async def get_field_count_async(self, indicator_code: str) -> Optional[int]:
        """异步获取单个指标的字段数量"""
        try:
            url = f"https://ghoapi.azureedge.net/api/{indicator_code}"
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('value') and len(data['value']) > 0:
                            return len(data['value'][0].keys())
        except Exception as e:
            logger.warning(f"获取指标 {indicator_code} 字段数量失败: {e}")
        return None
    
    def get_field_count_sync(self, indicator_code: str) -> Optional[int]:
        """同步获取单个指标的字段数量（使用与预览数据相同的处理逻辑）"""
        try:
            import requests
            from services.data_fetcher import DataFetcher
            import json
            
            # 获取数据源配置
            with open("config/data_sources.json", 'r', encoding='utf-8') as f:
                data_sources = json.load(f)
            
            # 使用WHO GHO数据源配置
            # 尝试多个可能的数据源ID
            source_config_dict = data_sources.get('who_gho_datasource') or data_sources.get('who_gho')
            if not source_config_dict:
                logger.warning("未找到WHO GHO数据源配置")
                return None
            
            # 转换为DataSourceConfig对象
            from schemas.data_source import DataSourceConfig
            source_config = DataSourceConfig(**source_config_dict)
            
            # 获取数据集配置
            with open("config/datasets.json", 'r', encoding='utf-8') as f:
                datasets = json.load(f)
            
            # 找到对应的数据集
            dataset_dict = None
            for dataset_id, ds in datasets.items():
                if ds.get('indicator_code') == indicator_code:
                    dataset_dict = ds
                    break
            
            if not dataset_dict:
                logger.warning(f"未找到指标代码 {indicator_code} 对应的数据集")
                return None
            
            # 转换为DatasetConfig对象
            from schemas.data_source import DatasetConfig
            dataset = DatasetConfig(**dataset_dict)
            
            # 使用DataFetcher获取处理后的数据
            data_fetcher = DataFetcher()
            result = data_fetcher.fetch_data_sync(source_config, dataset, {}, is_import=False)
            
            if result:
                # 获取字段数量（不管记录数是否为0）
                if result.get('columns'):
                    field_count = len(result['columns'])
                    logger.info(f"指标 {indicator_code} 字段数量: {field_count}")
                    return field_count
                else:
                    # 如果没有columns信息，尝试从数据中推断字段数
                    data = result.get('data', [])
                    if data and len(data) > 0:
                        field_count = len(data[0].keys()) if isinstance(data[0], dict) else 0
                        logger.info(f"指标 {indicator_code} 从数据推断字段数量: {field_count}")
                        return field_count
                    else:
                        # 如果既没有columns也没有数据，返回0
                        logger.info(f"指标 {indicator_code} 没有数据，字段数量设为0")
                        return 0
            
        except Exception as e:
            logger.warning(f"获取指标 {indicator_code} 字段数量失败: {e}")
        return None
    
    async def update_all_field_counts_async(self, progress_callback=None) -> Dict[str, int]:
        """异步更新所有数据集的字段数量"""
        if self.is_updating:
            logger.info("字段数量更新正在进行中，跳过重复请求")
            return {}
            
        self.is_updating = True
        logger.info("开始异步更新字段数量...")
        
        try:
            # 读取数据集配置
            with open(self.datasets_file, 'r', encoding='utf-8') as f:
                datasets = json.load(f)
            
            field_counts = {}
            total = len(datasets)
            completed = 0
            
            # 限制并发数避免API限制
            semaphore = asyncio.Semaphore(3)
            
            async def update_single(dataset_id):
                nonlocal completed
                async with semaphore:
                    count = await self.get_field_count_async(dataset_id)
                    if count:
                        field_counts[dataset_id] = count
                    completed += 1
                    if progress_callback:
                        progress_callback(completed, total)
                    # 添加延迟避免API限制
                    await asyncio.sleep(0.1)
            
            # 创建所有任务
            tasks = [update_single(dataset_id) for dataset_id in datasets.keys()]
            await asyncio.gather(*tasks, return_exceptions=True)
            
            # 保存字段数量
            with open(self.field_counts_file, 'w', encoding='utf-8') as f:
                json.dump(field_counts, f, ensure_ascii=False, indent=2)
            
            # 保存更新时间
            with open(self.last_update_file, 'w', encoding='utf-8') as f:
                json.dump({
                    "last_update": datetime.now().isoformat(),
                    "total_updated": len(field_counts)
                }, f, ensure_ascii=False, indent=2)
            
            logger.info(f"异步字段数量更新完成，共更新 {len(field_counts)} 个数据集")
            return field_counts
            
        finally:
            self.is_updating = False
    
    def update_all_field_counts_sync(self, progress_callback=None) -> Dict[str, int]:
        """同步更新所有数据集的字段数量"""
        if self.is_updating:
            logger.info("字段数量更新正在进行中，跳过重复请求")
            return {}
            
        self.is_updating = True
        logger.info("开始同步更新字段数量...")
        
        try:
            # 读取数据集配置
            with open(self.datasets_file, 'r', encoding='utf-8') as f:
                datasets = json.load(f)
            
            field_counts = {}
            total = len(datasets)
            completed = 0
            
            # 逐个获取字段数量（避免API限制）
            for dataset_id in datasets.keys():
                count = self.get_field_count_sync(dataset_id)
                if count:
                    field_counts[dataset_id] = count
                completed += 1
                if progress_callback:
                    progress_callback(completed, total)
                
                # 添加延迟避免API限制
                time.sleep(0.2)
            
            # 保存字段数量
            with open(self.field_counts_file, 'w', encoding='utf-8') as f:
                json.dump(field_counts, f, ensure_ascii=False, indent=2)
            
            # 保存更新时间
            with open(self.last_update_file, 'w', encoding='utf-8') as f:
                json.dump({
                    "last_update": datetime.now().isoformat(),
                    "total_updated": len(field_counts)
                }, f, ensure_ascii=False, indent=2)
            
            logger.info(f"同步字段数量更新完成，共更新 {len(field_counts)} 个数据集")
            return field_counts
            
        finally:
            self.is_updating = False
    
    def get_field_count(self, dataset_id: str) -> int:
        """获取数据集的字段数量"""
        try:
            # 首先尝试从缓存文件读取
            if os.path.exists(self.field_counts_file):
                with open(self.field_counts_file, 'r', encoding='utf-8') as f:
                    field_counts = json.load(f)
                    if dataset_id in field_counts:
                        return field_counts[dataset_id]
        except Exception as e:
            logger.warning(f"读取字段数量缓存失败: {e}")

        # 如果缓存中没有，返回0（表示未更新）
        return 0
    
    def should_update(self) -> bool:
        """检查是否需要更新字段数量"""
        try:
            if not os.path.exists(self.last_update_file):
                return True
            
            with open(self.last_update_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                last_update = datetime.fromisoformat(data['last_update'])
                # 如果超过1天没有更新，则需要更新
                return datetime.now() - last_update > timedelta(days=1)
        except Exception:
            return True
    
    def start_background_update(self):
        """启动后台更新"""
        if self.should_update() and not self.is_updating:
            logger.info("启动后台字段数量更新...")
            # 使用线程池避免阻塞
            thread = threading.Thread(target=self._background_update_sync, daemon=True)
            thread.start()
    
    def _background_update_sync(self):
        """后台同步更新"""
        try:
            self.update_all_field_counts_sync()
        except Exception as e:
            logger.error(f"后台更新字段数量失败: {e}")

# 全局实例
field_count_updater = FieldCountUpdater()
