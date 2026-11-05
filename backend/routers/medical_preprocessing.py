"""
医学数据预处理API路由
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import pandas as pd
import json
import os
import pyreadstat

from database import get_db
from models import Dataset, User, UserRole
from auth import get_current_active_user
from medical_preprocessing import MedicalPreprocessingFactory
from services.file_service import read_data_file, FileService
from storage import get_storage

router = APIRouter()

@router.post("/quality-check/{dataset_id}")
async def check_data_quality(
    dataset_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """检查医学数据质量"""
    # 获取数据集
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if current_user.role != UserRole.ADMIN.value and dataset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    if not dataset.file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")
    
    try:
        # 使用统一的文件服务读取数据（支持 R2 和本地存储）
        data = await read_data_file(dataset.file_path)
        if data is None:
            raise HTTPException(status_code=404, detail="无法读取文件，文件可能不存在或格式不支持")
        
        # 创建预处理工厂
        factory = MedicalPreprocessingFactory(data)
        
        # 执行质量检查
        result = factory.run_quality_check()
        
        return {
            "success": True,
            "dataset_id": dataset_id,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quality check failed: {str(e)}")

@router.post("/data-cleaning/{dataset_id}")
async def clean_data(
    dataset_id: int,
    cleaning_config: Optional[Dict[str, Any]] = None,
    save_cleaned_data: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """清洗医学数据"""
    # 获取数据集
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if current_user.role != UserRole.ADMIN.value and dataset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    if not dataset.file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")
    
    try:
        # 使用统一的文件服务读取数据（支持 R2 和本地存储）
        data = await read_data_file(dataset.file_path)
        if data is None:
            raise HTTPException(status_code=404, detail="无法读取文件，文件可能不存在或格式不支持")
        
        # 创建预处理工厂
        factory = MedicalPreprocessingFactory(data)
        
        # 执行数据清洗
        result = factory.run_data_cleaning(cleaning_config)
        
        cleaned_dataset_id = None
        if save_cleaned_data:
            # 保存清洗后的数据为新数据集
            cleaned_dataset_id = await _save_cleaned_dataset(
                dataset,
                result["cleaning_result"]["cleaned_data"],
                db,
                current_user.id
            )
        
        return {
            "success": True,
            "dataset_id": dataset_id,
            "cleaned_dataset_id": cleaned_dataset_id,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data cleaning failed: {str(e)}")

@router.post("/full-preprocessing/{dataset_id}")
async def full_preprocessing(
    dataset_id: int,
    cleaning_config: Optional[Dict[str, Any]] = None,
    save_cleaned_data: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """执行完整的医学数据预处理"""
    # 获取数据集
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if current_user.role != UserRole.ADMIN.value and dataset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    if not dataset.file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")
    
    try:
        # 使用统一的文件服务读取数据（支持 R2 和本地存储）
        data = await read_data_file(dataset.file_path)
        if data is None:
            raise HTTPException(status_code=404, detail="无法读取文件，文件可能不存在或格式不支持")
        
        # 创建预处理工厂
        factory = MedicalPreprocessingFactory(data)
        
        # 执行完整预处理
        result = factory.run_full_preprocessing(cleaning_config)
        
        cleaned_dataset_id = None
        if save_cleaned_data:
            # 保存清洗后的数据为新数据集
            cleaned_dataset_id = await _save_cleaned_dataset(
                dataset,
                result["data_cleaning"]["cleaning_result"]["cleaned_data"],
                db,
                current_user.id
            )
        
        return {
            "success": True,
            "dataset_id": dataset_id,
            "cleaned_dataset_id": cleaned_dataset_id,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Full preprocessing failed: {str(e)}")

@router.get("/data-info/{dataset_id}")
async def get_data_info(
    dataset_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取医学数据基本信息"""
    # 获取数据集
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if current_user.role != UserRole.ADMIN.value and dataset.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    if not dataset.file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")
    
    try:
        # 使用统一的文件服务读取数据（支持 R2 和本地存储）
        data = await read_data_file(dataset.file_path)
        if data is None:
            raise HTTPException(status_code=404, detail="无法读取文件，文件可能不存在或格式不支持")
        
        # 创建预处理工厂
        factory = MedicalPreprocessingFactory(data)
        
        # 获取数据信息
        data_info = factory.get_data_info()
        
        return {
            "success": True,
            "dataset_id": dataset_id,
            "data_info": data_info
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get data info: {str(e)}")

async def _save_cleaned_dataset(
    original_dataset: Dataset,
    cleaned_data,
    db: Session,
    owner_id: Optional[int]
) -> int:
    """保存清洗后的数据为新数据集"""
    import uuid
    from datetime import datetime
    import tempfile
    import os
    
    # 生成新的文件名
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    original_name = original_dataset.name
    cleaned_name = f"{original_name}_清洗后_{timestamp}"
    
    # 如果cleaned_data是字典列表，转换为DataFrame
    if isinstance(cleaned_data, list):
        cleaned_df = pd.DataFrame(cleaned_data)
    else:
        cleaned_df = cleaned_data
    
    # 生成文件名
    cleaned_filename = f"cleaned_{uuid.uuid4().hex[:8]}.csv"
    
    # 使用存储抽象层上传文件
    storage = get_storage()
    
    # 创建临时文件并读取内容
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as temp_file:
        cleaned_df.to_csv(temp_file.name, index=False, encoding='utf-8')
        temp_file_path = temp_file.name
    
    # 读取文件内容
    with open(temp_file_path, 'rb') as f:
        file_content = f.read()
    
    # 上传到存储（R2 或本地）
    file_path = await storage.upload_file(
        file_content=file_content,
        filename=cleaned_filename
    )
    
    # 清理临时文件
    os.unlink(temp_file_path)
    
    # 创建新数据集记录
    cleaned_dataset = Dataset(
        name=cleaned_name,
        description=f"基于 {original_name} 清洗后的数据集",
        file_path=file_path,
        record_count=len(cleaned_df),
        data_source_id=original_dataset.data_source_id,
        owner_id=owner_id or original_dataset.owner_id
    )
    
    db.add(cleaned_dataset)
    db.commit()
    db.refresh(cleaned_dataset)
    
    return cleaned_dataset.id

