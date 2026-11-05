"""
数据预处理API路由 - 使用存储抽象层
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
import pandas as pd
import json
import os

from database import get_db
from models import Dataset, User
from auth import get_current_active_user
from preprocessing import PreprocessingFactory
from services.file_service import read_data_file

router = APIRouter()

@router.post("/preprocess/{dataset_id}")
async def preprocess_dataset(
    dataset_id: int,
    preprocessing_config: Dict[str, Any],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """对数据集进行预处理"""
    # 获取数据集
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not dataset.file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")
    
    try:
        # 使用统一的文件服务
        data = await read_data_file(dataset.file_path)
        if data is None:
            raise HTTPException(status_code=404, detail="无法读取文件，文件可能不存在或格式不支持")
        
        # 创建预处理工厂
        factory = PreprocessingFactory(data)
        
        # 执行预处理
        preprocessing_type = preprocessing_config.get('type')
        if not preprocessing_type:
            raise HTTPException(status_code=400, detail="Preprocessing type is required")
        
        result = factory.run_preprocessing(preprocessing_type, **preprocessing_config.get('params', {}))
        
        return {
            "success": True,
            "dataset_id": dataset_id,
            "preprocessing_type": preprocessing_type,
            "result": result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preprocessing failed: {str(e)}")

@router.get("/preprocess/{dataset_id}/info")
async def get_dataset_info(
    dataset_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取数据集基本信息"""
    # 获取数据集
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not dataset.file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")
    
    try:
        # 使用统一的文件服务
        data = await read_data_file(dataset.file_path)
        if data is None:
            raise HTTPException(status_code=404, detail="无法读取文件，文件可能不存在或格式不支持")
        
        # 创建预处理工厂
        factory = PreprocessingFactory(data)
        
        # 获取数据信息
        data_info = factory.get_data_info()
        data_types = factory.detect_data_types()
        
        return {
            "dataset_id": dataset_id,
            "data_info": data_info,
            "data_types": data_types
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get dataset info: {str(e)}")

@router.get("/preprocess/{dataset_id}/column/{column_name}/stats")
async def get_column_statistics(
    dataset_id: int,
    column_name: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取单个列的统计信息"""
    # 获取数据集
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not dataset.file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")
    
    try:
        # 使用统一的文件服务
        data = await read_data_file(dataset.file_path)
        if data is None:
            raise HTTPException(status_code=404, detail="无法读取文件，文件可能不存在或格式不支持")
        
        # 创建预处理工厂
        factory = PreprocessingFactory(data)
        
        # 获取列统计信息
        column_stats = factory.get_column_statistics(column_name)
        
        return {
            "dataset_id": dataset_id,
            "column_name": column_name,
            "statistics": column_stats
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get column statistics: {str(e)}")

@router.post("/preprocess/{dataset_id}/batch")
async def batch_preprocess_dataset(
    dataset_id: int,
    preprocessing_steps: List[Dict[str, Any]],
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """批量执行数据预处理步骤"""
    # 获取数据集
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not dataset.file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")
    
    try:
        # 使用统一的文件服务
        data = await read_data_file(dataset.file_path)
        if data is None:
            raise HTTPException(status_code=404, detail="无法读取文件，文件可能不存在或格式不支持")
        
        # 创建预处理工厂
        factory = PreprocessingFactory(data)
        
        # 执行批量预处理
        results = []
        for step in preprocessing_steps:
            step_type = step.get('type')
            step_params = step.get('params', {})
            
            if not step_type:
                continue
            
            try:
                result = factory.run_preprocessing(step_type, **step_params)
                results.append({
                    "step": step,
                    "success": True,
                    "result": result
                })
            except Exception as e:
                results.append({
                    "step": step,
                    "success": False,
                    "error": str(e)
                })
        
        return {
            "dataset_id": dataset_id,
            "total_steps": len(preprocessing_steps),
            "successful_steps": len([r for r in results if r["success"]]),
            "failed_steps": len([r for r in results if not r["success"]]),
            "results": results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch preprocessing failed: {str(e)}")
