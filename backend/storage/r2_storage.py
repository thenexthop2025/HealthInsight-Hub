"""
Cloudflare R2 存储实现
"""
import boto3
import uuid
import os
import pandas as pd
import pyreadstat
import json
import tempfile
from typing import Optional
from botocore.exceptions import ClientError, NoCredentialsError
import logging
from .base import StorageInterface
from settings import settings

logger = logging.getLogger(__name__)


class R2Storage(StorageInterface):
    """Cloudflare R2 存储实现"""
    
    def __init__(self):
        self.account_id = settings.R2_ACCOUNT_ID
        self.access_key_id = settings.R2_ACCESS_KEY_ID
        self.secret_access_key = settings.R2_SECRET_ACCESS_KEY
        self.bucket_name = settings.R2_BUCKET_NAME
        self.public_url = getattr(settings, "R2_PUBLIC_URL", "")
        
        # 创建 S3 客户端（R2 兼容 S3 API）
        self.s3_client = boto3.client(
            's3',
            endpoint_url=f'https://{self.account_id}.r2.cloudflarestorage.com',
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
            region_name='auto'
        )
    
    async def upload_file(self, file_content: bytes, filename: str) -> str:
        """上传文件到 R2"""
        try:
            unique_filename = f"{uuid.uuid4().hex}__{filename}"
            
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=unique_filename,
                Body=file_content,
                ContentType=self._get_content_type(filename)
            )
            
            return f"r2://{self.bucket_name}/{unique_filename}"
            
        except NoCredentialsError:
            logger.error("R2 凭证配置错误")
            raise Exception("R2 存储配置错误，请检查凭证")
        except ClientError as e:
            logger.error(f"R2 上传失败: {str(e)}")
            raise Exception(f"文件上传失败: {str(e)}")
        except Exception as e:
            logger.error(f"R2 上传异常: {str(e)}")
            raise Exception(f"文件上传异常: {str(e)}")
    
    async def upload_file_to_key(self, file_content: bytes, key: str) -> str:
        """上传文件到指定 R2 路径（保留调用方提供的对象键）"""
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=file_content,
                ContentType=self._get_content_type(key),
            )
            return f"r2://{self.bucket_name}/{key}"
        except NoCredentialsError:
            logger.error("R2 凭证配置错误")
            raise Exception("R2 存储配置错误，请检查凭证")
        except ClientError as e:
            logger.error(f"R2 上传失败: {str(e)}")
            raise Exception(f"文件上传失败: {str(e)}")
        except Exception as e:
            logger.error(f"R2 上传异常: {str(e)}")
            raise Exception(f"文件上传异常: {str(e)}")
    
    async def download_file(self, file_path: str) -> bytes:
        """从 R2 下载文件"""
        try:
            if not file_path.startswith("r2://"):
                raise ValueError(f"无效的 R2 路径格式: {file_path}")
            
            path_parts = file_path[5:].split("/", 1)
            if len(path_parts) != 2:
                raise ValueError(f"无效的 R2 路径格式: {file_path}")
            
            bucket, key = path_parts
            
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            return response['Body'].read()
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                raise FileNotFoundError(f"文件不存在: {file_path}")
            else:
                raise Exception(f"文件下载失败: {str(e)}")
        except Exception as e:
            raise Exception(f"文件下载异常: {str(e)}")
    
    async def delete_file(self, file_path: str) -> bool:
        """从 R2 删除文件"""
        try:
            if not file_path.startswith("r2://"):
                return False
            
            path_parts = file_path[5:].split("/", 1)
            if len(path_parts) != 2:
                return False
            
            bucket, key = path_parts
            
            self.s3_client.delete_object(Bucket=bucket, Key=key)
            return True
            
        except Exception as e:
            logger.error(f"R2 删除异常: {str(e)}")
            return False
    
    def file_exists(self, file_path: str) -> bool:
        """检查 R2 文件是否存在"""
        try:
            if not file_path.startswith("r2://"):
                return False
            
            path_parts = file_path[5:].split("/", 1)
            if len(path_parts) != 2:
                return False
            
            bucket, key = path_parts
            
            self.s3_client.head_object(Bucket=bucket, Key=key)
            return True
            
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return False
            else:
                return False
        except Exception:
            return False
    
    def get_public_url(self, file_path: str) -> str:
        """获取 R2 文件的公共访问 URL"""
        try:
            if not file_path.startswith("r2://"):
                raise ValueError(f"无效的 R2 路径格式: {file_path}")
            
            path_parts = file_path[5:].split("/", 1)
            if len(path_parts) != 2:
                raise ValueError(f"无效的 R2 路径格式: {file_path}")
            
            bucket, key = path_parts
            
            if self.public_url:
                return f"{self.public_url.rstrip('/')}/{key}"
            else:
                return self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': bucket, 'Key': key},
                    ExpiresIn=3600
                )
                
        except Exception as e:
            logger.error(f"生成公共 URL 失败: {str(e)}")
            raise Exception(f"生成公共 URL 失败: {str(e)}")
    
    async def read_data_file(self, file_path: str) -> Optional[pd.DataFrame]:
        """读取 R2 数据文件"""
        try:
            if not file_path.startswith("r2://"):
                return None
            
            # 从 R2 下载文件内容
            file_content = await self.download_file(file_path)
            
            # 解析文件名
            path_parts = file_path[5:].split("/", 1)
            if len(path_parts) != 2:
                return None
            
            bucket, key = path_parts
            filename = key.split("__", 1)[-1] if "__" in key else key
            
            # 创建临时文件
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as tmp_file:
                tmp_file.write(file_content)
                tmp_path = tmp_file.name
            
            try:
                return await self._read_file_by_extension(tmp_path, filename)
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
                    
        except Exception as e:
            logger.error(f"读取 R2 文件失败 {file_path}: {str(e)}")
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
                try:
                    return pd.read_csv(file_path)
                except Exception:
                    raise ValueError(f"不支持的文件格式: {filename}")
                    
        except Exception:
            return None
    
    def _get_content_type(self, filename: str) -> str:
        """根据文件扩展名获取 MIME 类型"""
        ext = os.path.splitext(filename)[1].lower()
        content_types = {
            '.csv': 'text/csv',
            '.json': 'application/json',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.xls': 'application/vnd.ms-excel',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.sav': 'application/octet-stream',
            '.txt': 'text/plain',
            '.pdf': 'application/pdf',
            '.zip': 'application/zip',
        }
        return content_types.get(ext, 'application/octet-stream')
