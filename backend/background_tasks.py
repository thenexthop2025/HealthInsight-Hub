"""
后台任务函数
用于 FastAPI BackgroundTasks
"""
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import func
from database import engine
from models import Analysis, Dataset
from analysis import StatisticalAnalysisFactory
from services.file_service import read_data_file
import pandas as pd
import json
import os
import pyreadstat
import asyncio

# 创建数据库会话
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


async def run_statistical_analysis(analysis_id: int, parameters: dict, file_path: str):
    """
    运行统计分析任务
    
    此函数可被 FastAPI BackgroundTasks 调用，在后台异步执行分析任务
    
    Args:
        analysis_id: 分析记录ID
        parameters: 分析参数
        file_path: 文件路径
        
    Returns:
        dict: 执行结果
    """
    db = SessionLocal()
    
    try:
        # 获取分析记录
        analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
        if not analysis:
            return {"error": "Analysis not found"}
        
        # 更新状态为运行中
        analysis.status = "running"
        db.commit()
        
        # 使用统一的文件读取工具
        data = await read_data_file(file_path)
        if data is None:
            analysis.status = "failed"
            analysis.results = json.dumps({"error": "无法读取文件，文件可能不存在或格式不支持"})
            db.commit()
            return {"error": "无法读取文件，文件可能不存在或格式不支持"}
        
        # 创建分析工厂
        factory = StatisticalAnalysisFactory(data)
        
        # 执行分析
        clean_parameters = dict(parameters or {})

        analysis_type = clean_parameters.pop('analysis_type', None)
        dependent_variable = clean_parameters.pop('dependent_variable', None)
        dependent_variables = clean_parameters.pop('dependent_variables', []) or []
        independent_variables = clean_parameters.pop('independent_variables', []) or []
        control_variables = clean_parameters.pop('control_variables', []) or []
        row_variable = clean_parameters.pop('row_variable', None)
        column_variable = clean_parameters.pop('column_variable', None)
        grouping_variables = clean_parameters.pop('grouping_variables', None)
        stratum_variables = clean_parameters.pop('stratum_variables', None)
        strata_variable = clean_parameters.pop('strata_variable', None)
        descriptive_subtype = clean_parameters.pop('descriptive_subtype', None)
        categorical_variables = clean_parameters.pop('categorical_variables', None)
        include_missing = clean_parameters.pop('include_missing', None)
        include_totals = clean_parameters.pop('include_totals', None)
        filters = clean_parameters.pop('filters', None)
        
        result = factory.run_analysis(
            analysis_type=analysis_type,
            dependent_variable=dependent_variable,
            dependent_variables=dependent_variables,
            independent_variables=independent_variables,
            control_variables=control_variables,
            row_variable=row_variable,
            column_variable=column_variable,
            grouping_variables=grouping_variables,
            stratum_variables=stratum_variables,
            strata_variable=strata_variable,
            descriptive_subtype=descriptive_subtype,
            categorical_variables=categorical_variables,
            include_missing=include_missing,
            include_totals=include_totals,
            filters=filters,
            **clean_parameters
        )
        
        # 更新分析结果
        analysis.status = "completed"
        analysis.results = json.dumps(result)
        analysis.completed_at = func.now()
        db.commit()
        
        return {"success": True, "result": result}
        
    except Exception as e:
        # 更新分析状态为失败
        if 'analysis' in locals():
            analysis.status = "failed"
            analysis.results = json.dumps({"error": str(e)})
            db.commit()
        
        return {"error": str(e)}
        
    finally:
        db.close()


def run_statistical_analysis_sync(analysis_id: int, parameters: dict, file_path: str):
    """
    运行统计分析任务 - 同步版本
    
    Args:
        analysis_id: 分析记录ID
        parameters: 分析参数
        file_path: 文件路径
        
    Returns:
        dict: 执行结果
    """
    # 在新的事件循环中运行异步函数
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(run_statistical_analysis(analysis_id, parameters, file_path))
    finally:
        loop.close()
