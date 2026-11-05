"""
数据格式转换器
支持多种数据格式之间的转换
"""

import pandas as pd
import numpy as np
import os
import tempfile
from typing import Dict, Any, Optional, List, Tuple
from pathlib import Path
import logging
import re
from pandas.api import types as ptypes

logger = logging.getLogger(__name__)

class DataFormatConverter:
    """数据格式转换器"""
    
    SUPPORTED_FORMATS = {
        'csv': {
            'extensions': ['.csv'],
            'description': 'CSV文件',
            'mime_type': 'text/csv'
        },
        'excel': {
            'extensions': ['.xlsx', '.xls'],
            'description': 'Excel文件',
            'mime_type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        },
        'json': {
            'extensions': ['.json'],
            'description': 'JSON文件',
            'mime_type': 'application/json'
        },
        'txt': {
            'extensions': ['.txt', '.tsv'],
            'description': '文本文件',
            'mime_type': 'text/plain'
        },
        'spss': {
            'extensions': ['.sav'],
            'description': 'SPSS文件',
            'mime_type': 'application/x-spss-sav'
        },
        'parquet': {
            'extensions': ['.parquet'],
            'description': 'Parquet文件',
            'mime_type': 'application/octet-stream'
        }
    }
    
    def __init__(self):
        self.temp_dir = tempfile.mkdtemp()
    
    def get_supported_formats(self) -> Dict[str, Dict[str, Any]]:
        """获取支持的格式列表"""
        return self.SUPPORTED_FORMATS
    
    def detect_format(self, file_path: str) -> Optional[str]:
        """检测文件格式"""
        file_ext = Path(file_path).suffix.lower()
        
        for format_name, format_info in self.SUPPORTED_FORMATS.items():
            if file_ext in format_info['extensions']:
                return format_name
        
        return None
    
    def read_data(self, file_path: str, format_name: str, **kwargs) -> pd.DataFrame:
        """读取数据文件"""
        try:
            if format_name == 'csv':
                return pd.read_csv(file_path, **kwargs)
            elif format_name == 'excel':
                return pd.read_excel(file_path, **kwargs)
            elif format_name == 'json':
                return pd.read_json(file_path, **kwargs)
            elif format_name == 'txt':
                # 尝试检测分隔符
                delimiter = kwargs.get('delimiter', None)
                if not delimiter:
                    # 自动检测分隔符
                    with open(file_path, 'r', encoding='utf-8') as f:
                        first_line = f.readline()
                        if '\t' in first_line:
                            delimiter = '\t'
                        elif ',' in first_line:
                            delimiter = ','
                        else:
                            delimiter = ' '
                
                return pd.read_csv(file_path, delimiter=delimiter, **kwargs)
            elif format_name == 'spss':
                # 使用pyreadstat读取SPSS文件
                try:
                    import pyreadstat
                    df, meta = pyreadstat.read_sav(file_path)
                    return df
                except ImportError:
                    raise ValueError("需要安装pyreadstat库来读取SPSS文件")
            elif format_name == 'parquet':
                return pd.read_parquet(file_path, **kwargs)
            else:
                raise ValueError(f"不支持的格式: {format_name}")
                
        except Exception as e:
            logger.error(f"读取文件失败: {e}")
            raise ValueError(f"读取文件失败: {str(e)}")
    
    def write_data(self, df: pd.DataFrame, file_path: str, format_name: str, **kwargs) -> str:
        """写入数据文件"""
        try:
            if format_name == 'csv':
                df.to_csv(file_path, index=False, encoding='utf-8', **kwargs)
            elif format_name == 'excel':
                df.to_excel(file_path, index=False, **kwargs)
            elif format_name == 'json':
                df.to_json(file_path, orient='records', indent=2, **kwargs)
            elif format_name == 'txt':
                delimiter = kwargs.get('delimiter', '\t')
                df.to_csv(file_path, sep=delimiter, index=False, encoding='utf-8', **kwargs)
            elif format_name == 'spss':
                # 使用pyreadstat写入SPSS文件
                try:
                    import pyreadstat
                    prepared_df, column_labels = self._prepare_df_for_spss(df)
                    pyreadstat.write_sav(
                        prepared_df,
                        file_path,
                        column_labels=column_labels,
                        **kwargs
                    )
                except ImportError:
                    raise ValueError("需要安装pyreadstat库来写入SPSS文件")
            elif format_name == 'parquet':
                df.to_parquet(file_path, index=False, **kwargs)
            else:
                raise ValueError(f"不支持的格式: {format_name}")
            
            return file_path
            
        except Exception as e:
            logger.error(f"写入文件失败: {e}")
            raise ValueError(f"写入文件失败: {str(e)}")

    # --------------------
    # SPSS 写出前清洗工具
    # --------------------
    def _sanitize_spss_variable_name(self, name: str) -> str:
        """将任意列名转换为SPSS合法变量名。
        规则：字母开头，只含字母/数字/下划线，最长64，小写。"""
        if name is None:
            name = "var"
        original = str(name)
        s = original.lower()
        s = re.sub(r"[^a-z0-9_]", "_", s)
        if not s or s[0].isdigit():
            s = f"v_{s}" if s else "v"
        s = re.sub(r"_+", "_", s).strip("_") or "v"
        return s[:64]

    def _make_unique(self, names: List[str]) -> List[str]:
        seen = set()
        out: List[str] = []
        for base in names:
            idx = 1
            candidate = base
            while candidate.lower() in seen or not candidate:
                suffix = f"_{idx}"
                candidate = (base[: max(1, 64 - len(suffix))] + suffix)[:64]
                idx += 1
            seen.add(candidate.lower())
            out.append(candidate)
        return out

    def _prepare_df_for_spss(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str]]:
        """清洗为可写入 SAV：
        - 列名合法化并唯一
        - 类型处理：bool->0/1；datetime/timedelta->字符串；数字去除无穷大；对象/分类->字符串
        - 返回清洗后的 df 与原列名作为 column_labels
        """
        if isinstance(df.columns, pd.MultiIndex):
            df = df.copy()
            df.columns = ["_".join(map(str, lvl)).strip() for lvl in df.columns.values]

        cleaned = [self._sanitize_spss_variable_name(c) for c in df.columns]
        unique_cleaned = self._make_unique(cleaned)
        col_map = {orig: new for orig, new in zip(df.columns, unique_cleaned)}
        column_labels: Dict[str, str] = {new: str(orig)[:120] for orig, new in col_map.items()}

        out = df.copy()
        out.rename(columns=col_map, inplace=True)

        for col in out.columns:
            s = out[col]
            if ptypes.is_bool_dtype(s):
                out[col] = s.astype("Int8").fillna(0).astype("Int8")
                continue
            if ptypes.is_datetime64_any_dtype(s) or ptypes.is_datetime64tz_dtype(s):
                s2 = pd.to_datetime(s, errors='coerce')
                out[col] = s2.dt.strftime('%Y-%m-%d %H:%M:%S').fillna("")
                continue
            if ptypes.is_timedelta64_dtype(s):
                s2 = pd.to_timedelta(s, errors='coerce')
                secs = s2.dt.total_seconds()
                out[col] = secs.map(lambda v: "" if pd.isna(v) else str(int(v)))
                continue
            if ptypes.is_numeric_dtype(s):
                out[col] = s.replace([np.inf, -np.inf], np.nan)
                continue
            if ptypes.is_object_dtype(s) or ptypes.is_categorical_dtype(s):
                out[col] = s.astype("string").where(s.notna(), "").astype(str)
                continue
            out[col] = s

        return out, column_labels
    
    def convert_file(self, input_path: str, output_format: str, 
                    output_path: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """转换文件格式"""
        try:
            # 检测输入格式
            input_format = self.detect_format(input_path)
            if not input_format:
                raise ValueError(f"无法识别输入文件格式: {input_path}")
            
            if input_format not in self.SUPPORTED_FORMATS:
                raise ValueError(f"不支持的输入格式: {input_format}")
            
            if output_format not in self.SUPPORTED_FORMATS:
                raise ValueError(f"不支持的输出格式: {output_format}")
            
            # 读取数据
            logger.info(f"读取文件: {input_path} (格式: {input_format})")
            df = self.read_data(input_path, input_format)
            
            # 生成输出路径
            if not output_path:
                input_name = Path(input_path).stem
                output_ext = self.SUPPORTED_FORMATS[output_format]['extensions'][0]
                output_path = os.path.join(self.temp_dir, f"{input_name}_converted{output_ext}")
            
            # 写入数据
            logger.info(f"写入文件: {output_path} (格式: {output_format})")
            self.write_data(df, output_path, output_format, **kwargs)
            
            # 获取文件信息
            file_size = os.path.getsize(output_path)
            
            return {
                "success": True,
                "input_format": input_format,
                "output_format": output_format,
                "output_path": output_path,
                "file_size": file_size,
                "rows": len(df),
                "columns": len(df.columns),
                "message": f"成功转换 {input_format.upper()} 到 {output_format.upper()}"
            }
            
        except Exception as e:
            logger.error(f"转换失败: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"转换失败: {str(e)}"
            }
    
    def get_file_info(self, file_path: str) -> Dict[str, Any]:
        """获取文件信息"""
        try:
            format_name = self.detect_format(file_path)
            if not format_name:
                raise ValueError(f"无法识别文件格式: {file_path}")
            
            df = self.read_data(file_path, format_name)
            
            return {
                "success": True,
                "format": format_name,
                "rows": len(df),
                "columns": len(df.columns),
                "file_size": os.path.getsize(file_path),
                "column_names": df.columns.tolist(),
                "dtypes": df.dtypes.to_dict(),
                "memory_usage": df.memory_usage(deep=True).sum()
            }
            
        except Exception as e:
            logger.error(f"获取文件信息失败: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def cleanup_temp_files(self):
        """清理临时文件"""
        import shutil
        try:
            shutil.rmtree(self.temp_dir)
        except Exception as e:
            logger.warning(f"清理临时文件失败: {e}")

