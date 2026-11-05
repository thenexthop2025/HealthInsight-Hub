"""
数据预处理API路由
提供变量分析、正态性检验、描述性统计等接口
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
import pandas as pd
import logging
from pydantic import BaseModel

from database import get_db
from models import User
from auth import get_current_user
from data_preprocessing import DataPreprocessingFactory
from services.data_fetcher import DataFetcher

router = APIRouter()
logger = logging.getLogger(__name__)

# 初始化工厂类
preprocessing_factory = DataPreprocessingFactory()
data_fetcher = DataFetcher()

# 请求模型
class AnalyzeVariablesRequest(BaseModel):
    dataset_id: int
    variables: List[str]


class NormalityTestPayload(BaseModel):
    dataset_id: int
    variable: str
    transformation: Optional[str] = None

@router.post("/analyze-variables")
async def analyze_variables(
    request: AnalyzeVariablesRequest,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    分析多个变量
    
    Args:
        dataset_id: 数据集ID
        variables: 变量名列表
        current_user: 当前用户
        db: 数据库连接
        
    Returns:
        变量分析结果
    """
    try:
        # 从请求体中获取参数
        dataset_id = request.dataset_id
        variables = request.variables
        
        # 获取数据集
        df = await data_fetcher.fetch_dataset_data(dataset_id, db)
        if df is None:
            raise HTTPException(status_code=404, detail="数据集不存在")
        
        # 分析变量
        result = preprocessing_factory.analyze_variables(df, variables)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return {
            "success": True,
            "message": "变量分析完成",
            "result": result
        }
        
    except Exception as e:
        logger.error(f"分析变量时出错: {e}")
        raise HTTPException(status_code=500, detail=f"分析变量时出错: {str(e)}")

@router.get("/variable-info/{dataset_id}")
async def get_variable_info(
    dataset_id: int,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    获取数据集变量信息
    
    Args:
        dataset_id: 数据集ID
        current_user: 当前用户
        db: 数据库连接
        
    Returns:
        变量信息
    """
    try:
        # 获取数据集
        df = await data_fetcher.fetch_dataset_data(dataset_id, db)
        if df is None:
            raise HTTPException(status_code=404, detail="数据集不存在")
        
        # 获取变量信息
        result = preprocessing_factory.get_variable_info(df, dataset_id)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return {
            "success": True,
            "message": "变量信息获取成功",
            "result": result
        }
        
    except Exception as e:
        logger.error(f"获取变量信息时出错: {e}")
        raise HTTPException(status_code=500, detail=f"获取变量信息时出错: {str(e)}")

@router.post("/normality-test")
async def normality_test(
    request: NormalityTestPayload,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    正态性检验
    
    Args:
        dataset_id: 数据集ID
        variable: 变量名
        current_user: 当前用户
        db: 数据库连接
        
    Returns:
        正态性检验结果
    """
    try:
        # 获取数据集
        df = await data_fetcher.fetch_dataset_data(request.dataset_id, db)
        if df is None:
            raise HTTPException(status_code=404, detail="数据集不存在")
        
        # 执行正态性检验
        result = preprocessing_factory.perform_normality_test(
            df,
            request.variable,
            transformation=request.transformation,
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return {
            "success": True,
            "message": "正态性检验完成",
            "result": result
        }
        
    except Exception as e:
        logger.error(f"正态性检验时出错: {e}")
        raise HTTPException(status_code=500, detail=f"正态性检验时出错: {str(e)}")

@router.post("/descriptive-stats")
async def descriptive_stats(
    dataset_id: int,
    variable: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    描述性统计
    
    Args:
        dataset_id: 数据集ID
        variable: 变量名
        current_user: 当前用户
        db: 数据库连接
        
    Returns:
        描述性统计结果
    """
    try:
        # 获取数据集
        df = await data_fetcher.fetch_dataset_data(dataset_id, db)
        if df is None:
            raise HTTPException(status_code=404, detail="数据集不存在")
        
        # 获取描述性统计
        result = preprocessing_factory.get_descriptive_stats(df, variable)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return {
            "success": True,
            "message": "描述性统计完成",
            "result": result
        }
        
    except Exception as e:
        logger.error(f"描述性统计时出错: {e}")
        raise HTTPException(status_code=500, detail=f"描述性统计时出错: {str(e)}")

@router.post("/frequency-analysis")
async def frequency_analysis(
    dataset_id: int,
    variable: str,
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    频数分析
    
    Args:
        dataset_id: 数据集ID
        variable: 变量名
        current_user: 当前用户
        db: 数据库连接
        
    Returns:
        频数分析结果
    """
    try:
        # 获取数据集
        df = await data_fetcher.fetch_dataset_data(dataset_id, db)
        if df is None:
            raise HTTPException(status_code=404, detail="数据集不存在")
        
        # 获取频数分析
        result = preprocessing_factory.get_frequency_analysis(df, variable)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
        
        return {
            "success": True,
            "message": "频数分析完成",
            "result": result
        }
        
    except Exception as e:
        logger.error(f"频数分析时出错: {e}")
        raise HTTPException(status_code=500, detail=f"频数分析时出错: {str(e)}")
