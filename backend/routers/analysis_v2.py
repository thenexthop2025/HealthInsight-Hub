"""
分析路由 - 模块化版本
使用新的统计分析模块
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import pandas as pd
import json
import os
import pyreadstat
from database import get_db
from models import Analysis, Dataset, User
from schemas import Analysis as AnalysisSchema, AnalysisCreate, AnalysisUpdate, StatisticalAnalysisRequest, StatisticalAnalysisResponse
from auth import get_current_active_user
from analysis import StatisticalAnalysisFactory
from background_tasks import run_statistical_analysis
from services.file_service import read_data_file

router = APIRouter()

@router.get("/", response_model=List[AnalysisSchema])
def get_analyses(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取分析列表"""
    # 使用join查询来获取数据集名称
    analyses = db.query(Analysis, Dataset.name.label('dataset_name')).join(
        Dataset, Analysis.dataset_id == Dataset.id
    ).filter(Analysis.user_id == current_user.id).offset(skip).limit(limit).all()
    
    # 构建返回结果
    result = []
    for analysis, dataset_name in analyses:
        analysis_dict = analysis.__dict__.copy()
        analysis_dict['dataset_name'] = dataset_name
        result.append(analysis_dict)
    
    return result

@router.get("/{analysis_id}", response_model=AnalysisSchema)
def get_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取特定分析"""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # 检查权限
    if analysis.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return analysis

@router.post("/", response_model=AnalysisSchema)
def create_analysis(
    analysis: AnalysisCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """创建分析"""
    db_analysis = Analysis(**analysis.dict(), user_id=current_user.id)
    db.add(db_analysis)
    db.commit()
    db.refresh(db_analysis)
    return db_analysis

@router.put("/{analysis_id}")
def update_analysis(
    analysis_id: int,
    analysis_update: AnalysisUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """更新分析"""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # 检查权限
    if analysis.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # 更新字段
    for field, value in analysis_update.dict(exclude_unset=True).items():
        setattr(analysis, field, value)
    
    db.commit()
    db.refresh(analysis)
    return analysis

@router.delete("/{analysis_id}")
def delete_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """删除分析"""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # 检查权限
    if analysis.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    db.delete(analysis)
    db.commit()
    return {"message": "Analysis deleted successfully"}

@router.delete("/")
def delete_all_analyses(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """删除所有分析"""
    analyses = db.query(Analysis).filter(Analysis.user_id == current_user.id).all()
    
    for analysis in analyses:
        db.delete(analysis)
    
    db.commit()
    
    return {"message": f"Successfully deleted {len(analyses)} analyses"}

@router.post("/run", response_model=StatisticalAnalysisResponse)
async def run_analysis(
    request: StatisticalAnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """运行统计分析 - 异步版本"""
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == request.dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not dataset.file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")
    
    # 准备参数
    # 统一：描述性/探索的分组变量优先使用 grouping_variables
    independent_vars = (
        request.grouping_variables if request.analysis_type in ["descriptive", "explore"] else request.independent_variables
    ) or []
    
    # 调试日志
    if request.analysis_type in ["crosstab", "chi_square"]:
        print(f"[DEBUG] Crosstab/Chi-square request received:")
        print(f"  row_variable: {request.row_variable}")
        print(f"  column_variable: {request.column_variable}")
        print(f"  dependent_variables: {request.dependent_variables}")
        print(f"  independent_variables: {request.independent_variables}")
    control_vars = request.control_variables or []
    dependent_vars = request.dependent_variables or (
        [request.dependent_variable] if request.dependent_variable else []
    )
    primary_dependent = request.dependent_variable or (dependent_vars[0] if dependent_vars else None)

    descriptive_subtype = request.dict().get("descriptive_subtype")
    effective_analysis_type = (
        descriptive_subtype if
        request.analysis_type == "descriptive" and descriptive_subtype
        else request.analysis_type
    )

    # 创建分析记录
    analysis = Analysis(
        name=request.analysis_name or f"{effective_analysis_type}_analysis_{request.dataset_id}",
        description=request.description or f"Analysis of dataset {request.dataset_id}",
        user_id=current_user.id,
        dataset_id=request.dataset_id,
        analysis_type=effective_analysis_type,
        parameters=json.dumps(request.dict()),
        status="running"
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    # 启动后台任务
    background_tasks.add_task(
        run_statistical_analysis,
        analysis.id,
        request.dict(),
        dataset.file_path
    )

    return StatisticalAnalysisResponse(
        analysis_id=analysis.id,
        status="running",
        message="Analysis started successfully"
    )

@router.post("/run-sync")
async def run_analysis_sync(
    request: StatisticalAnalysisRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """运行统计分析 - 同步版本"""
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == request.dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not dataset.file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")
    
    # 加载数据
    try:
        df = await read_data_file(dataset.file_path)
        if df is None:
            raise HTTPException(status_code=404, detail="无法读取文件，文件可能不存在或格式不支持")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dataset: {str(e)}")
    
    # 准备参数
    independent_vars = (
        request.grouping_variables if request.analysis_type in ["descriptive", "explore"] else request.independent_variables
    ) or []
    control_vars = request.control_variables or []
    dependent_vars = request.dependent_variables or (
        [request.dependent_variable] if request.dependent_variable else []
    )
    primary_dependent = request.dependent_variable or (dependent_vars[0] if dependent_vars else None)

    descriptive_subtype = request.dict().get("descriptive_subtype")
    effective_analysis_type = (
        descriptive_subtype if
        request.analysis_type == "descriptive" and descriptive_subtype
        else request.analysis_type
    )

    # 创建分析记录
    analysis = Analysis(
        name=request.analysis_name or f"{effective_analysis_type}_analysis_{request.dataset_id}",
        description=request.description or f"Analysis of dataset {request.dataset_id}",
        user_id=current_user.id,
        dataset_id=request.dataset_id,
        analysis_type=effective_analysis_type,
        parameters=json.dumps(request.dict()),
        status="running"
    )
    db.add(analysis)
    db.commit()
    db.refresh(analysis)

    try:
        # 创建分析工厂
        factory = StatisticalAnalysisFactory(df)
        
        # 执行分析
        result = factory.run_analysis(
            analysis_type=effective_analysis_type,
            dependent_variable=primary_dependent,
            dependent_variables=dependent_vars,
            independent_variables=independent_vars,
            control_variables=control_vars,
            row_variable=request.row_variable,
            column_variable=request.column_variable,
            grouping_variables=request.grouping_variables,
            stratum_variables=request.stratum_variables,
            strata_variable=request.strata_variable,
            descriptive_subtype=request.descriptive_subtype,
            categorical_variables=request.categorical_variables,
            include_missing=request.include_missing,
            include_totals=request.include_totals,
            filters=request.filters
        )
        
        # 更新分析结果
        analysis.results = json.dumps(result)
        analysis.status = "completed"
        analysis.completed_at = func.now()
        db.commit()
        
        return StatisticalAnalysisResponse(
            analysis_id=analysis.id,
            status="completed",
            message="Analysis completed successfully",
            result=result
        )
        
    except Exception as e:
        # 更新分析状态为失败
        analysis.status = "failed"
        analysis.error_message = str(e)
        db.commit()
        
        # 添加详细的错误日志
        import traceback
        error_details = traceback.format_exc()
        print(f"[ERROR] Analysis failed for analysis_id={analysis.id}, analysis_type={effective_analysis_type}")
        print(f"[ERROR] Error: {str(e)}")
        print(f"[ERROR] Traceback: {error_details}")
        
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

@router.get("/{analysis_id}/result")
def get_analysis_result(
    analysis_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取分析结果"""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # 检查权限
    if analysis.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return {
        "analysis_id": analysis.id,
        "status": analysis.status,
        "result": json.loads(analysis.results) if analysis.results else None,
        "error_message": analysis.error_message,
        "created_at": analysis.created_at,
        "updated_at": analysis.updated_at
    }