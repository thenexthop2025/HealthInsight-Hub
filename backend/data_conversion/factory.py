"""
数据格式转换工厂类
"""

from .converter import DataFormatConverter
import logging

logger = logging.getLogger(__name__)

class DataConversionFactory:
    """数据格式转换工厂"""
    
    @staticmethod
    def create_converter() -> DataFormatConverter:
        """创建数据格式转换器实例"""
        return DataFormatConverter()
    
    @staticmethod
    def get_supported_formats():
        """获取支持的格式列表"""
        converter = DataConversionFactory.create_converter()
        return converter.get_supported_formats()
    
    @staticmethod
    def convert_file(input_path: str, output_format: str, **kwargs):
        """转换文件格式"""
        converter = DataConversionFactory.create_converter()
        return converter.convert_file(input_path, output_format, **kwargs)
    
    @staticmethod
    def get_file_info(file_path: str):
        """获取文件信息"""
        converter = DataConversionFactory.create_converter()
        return converter.get_file_info(file_path)

