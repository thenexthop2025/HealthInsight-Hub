import boto3
import uuid
import os
from typing import Optional, Union
from botocore.exceptions import ClientError, NoCredentialsError
import logging
from settings import settings

logger = logging.getLogger(__name__)

class R2StorageService:
    """Cloudflare R2 存储服务"""
    
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
            region_name='auto'  # R2 使用 auto 作为区域
        )
    
    async def upload_file(self, file_content: bytes, filename: str) -> str:
        """
        上传文件到 R2
        
        Args:
            file_content: 文件内容（字节）
            filename: 文件名
            
        Returns:
            str: R2 文件路径（r2://bucket/key 格式）
        """
        try:
            # 生成唯一文件名
            unique_filename = f"{uuid.uuid4().hex}__{filename}"
            
            # 上传到 R2
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=unique_filename,
                Body=file_content,
                ContentType=self._get_content_type(filename)
            )
            
            # 返回 R2 路径格式
            r2_path = f"r2://{self.bucket_name}/{unique_filename}"
            logger.info(f"文件上传成功到 R2: {r2_path}")
            return r2_path
            
        except NoCredentialsError:
            logger.error("R2 凭证配置错误")
            raise Exception("R2 存储配置错误，请检查凭证")
        except ClientError as e:
            logger.error(f"R2 上传失败: {str(e)}")
            raise Exception(f"文件上传失败: {str(e)}")
        except Exception as e:
            logger.error(f"R2 上传异常: {str(e)}")
            raise Exception(f"文件上传异常: {str(e)}")
    
    async def download_file(self, r2_path: str) -> bytes:
        """
        从 R2 下载文件
        
        Args:
            r2_path: R2 文件路径（r2://bucket/key 格式）
            
        Returns:
            bytes: 文件内容
        """
        try:
            # 解析 R2 路径
            if not r2_path.startswith("r2://"):
                raise ValueError(f"无效的 R2 路径格式: {r2_path}")
            
            path_parts = r2_path[5:].split("/", 1)  # 移除 r2:// 前缀
            if len(path_parts) != 2:
                raise ValueError(f"无效的 R2 路径格式: {r2_path}")
            
            bucket, key = path_parts
            
            # 从 R2 下载文件
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            file_content = response['Body'].read()
            
            logger.info(f"文件下载成功从 R2: {r2_path}")
            return file_content
            
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                logger.error(f"R2 文件不存在: {r2_path}")
                raise FileNotFoundError(f"文件不存在: {r2_path}")
            else:
                logger.error(f"R2 下载失败: {str(e)}")
                raise Exception(f"文件下载失败: {str(e)}")
        except Exception as e:
            logger.error(f"R2 下载异常: {str(e)}")
            raise Exception(f"文件下载异常: {str(e)}")
    
    async def delete_file(self, r2_path: str) -> bool:
        """
        从 R2 删除文件
        
        Args:
            r2_path: R2 文件路径（r2://bucket/key 格式）
            
        Returns:
            bool: 删除是否成功
        """
        try:
            # 解析 R2 路径
            if not r2_path.startswith("r2://"):
                raise ValueError(f"无效的 R2 路径格式: {r2_path}")
            
            path_parts = r2_path[5:].split("/", 1)  # 移除 r2:// 前缀
            if len(path_parts) != 2:
                raise ValueError(f"无效的 R2 路径格式: {r2_path}")
            
            bucket, key = path_parts
            
            # 从 R2 删除文件
            self.s3_client.delete_object(Bucket=bucket, Key=key)
            
            logger.info(f"文件删除成功从 R2: {r2_path}")
            return True
            
        except ClientError as e:
            logger.error(f"R2 删除失败: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"R2 删除异常: {str(e)}")
            return False
    
    def get_public_url(self, r2_path: str) -> str:
        """
        获取文件的公共访问 URL
        
        Args:
            r2_path: R2 文件路径（r2://bucket/key 格式）
            
        Returns:
            str: 公共访问 URL
        """
        try:
            # 解析 R2 路径
            if not r2_path.startswith("r2://"):
                raise ValueError(f"无效的 R2 路径格式: {r2_path}")
            
            path_parts = r2_path[5:].split("/", 1)  # 移除 r2:// 前缀
            if len(path_parts) != 2:
                raise ValueError(f"无效的 R2 路径格式: {r2_path}")
            
            bucket, key = path_parts
            
            # 构建公共 URL
            if self.public_url:
                return f"{self.public_url.rstrip('/')}/{key}"
            else:
                # 如果没有配置公共 URL，生成预签名 URL
                return self.s3_client.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': bucket, 'Key': key},
                    ExpiresIn=3600  # 1小时过期
                )
                
        except Exception as e:
            logger.error(f"生成公共 URL 失败: {str(e)}")
            raise Exception(f"生成公共 URL 失败: {str(e)}")
    
    def _get_content_type(self, filename: str) -> str:
        """根据文件扩展名获取 MIME 类型"""
        ext = os.path.splitext(filename)[1].lower()
        content_types = {
            '.csv': 'text/csv',
            '.json': 'application/json',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.xls': 'application/vnd.ms-excel',
            '.sav': 'application/octet-stream',
            '.txt': 'text/plain',
            '.pdf': 'application/pdf',
            '.zip': 'application/zip',
        }
        return content_types.get(ext, 'application/octet-stream')
    
    def file_exists(self, r2_path: str) -> bool:
        """
        检查文件是否存在
        
        Args:
            r2_path: R2 文件路径（r2://bucket/key 格式）
            
        Returns:
            bool: 文件是否存在
        """
        try:
            # 解析 R2 路径
            if not r2_path.startswith("r2://"):
                return False
            
            path_parts = r2_path[5:].split("/", 1)  # 移除 r2:// 前缀
            if len(path_parts) != 2:
                return False
            
            bucket, key = path_parts
            
            # 检查文件是否存在
            self.s3_client.head_object(Bucket=bucket, Key=key)
            return True
            
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return False
            else:
                logger.error(f"检查文件存在性失败: {str(e)}")
                return False
        except Exception as e:
            logger.error(f"检查文件存在性异常: {str(e)}")
            return False
