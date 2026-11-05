"""
数据管理API路由 - 使用存储抽象层
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
import uuid
import os
import json
import pandas as pd
import tempfile
from database import get_db
from models import DataSource, Dataset, User, Analysis, Report, UserRole
from schemas import DataSource as DataSourceSchema, DataSourceCreate, Dataset as DatasetSchema, DatasetCreate, DataUploadRequest, DataUploadResponse
from auth import get_current_active_user
from services.data_fetcher import DataFetcher
from config import load_registry_from_json
from settings import settings
from utils.file_validator import validate_file, is_allowed_extension
from storage import get_storage
from services.file_service import read_data_file

router = APIRouter()

external_registry = load_registry_from_json()
external_fetcher = DataFetcher()


def ensure_dataset_access(dataset: Dataset, current_user: User) -> None:
    """确保当前用户有权限访问目标数据集"""
    if current_user.role != UserRole.ADMIN.value and dataset.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )


# 数据源管理
@router.get("/sources", response_model=List[DataSourceSchema])
def get_data_sources(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取数据源列表"""
    sources = db.query(DataSource).offset(skip).limit(limit).all()
    return sources


@router.post("/sources", response_model=DataSourceSchema)
def create_data_source(
    source: DataSourceCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """创建数据源"""
    db_source = DataSource(**source.dict())
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source


@router.get("/sources/{source_id}", response_model=DataSourceSchema)
def get_data_source(
    source_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取特定数据源"""
    source = db.query(DataSource).filter(DataSource.id == source_id).first()
    if source is None:
        raise HTTPException(status_code=404, detail="Data source not found")
    return source


# 数据集管理
@router.get("/datasets", response_model=List[DatasetSchema])
def get_datasets(
    skip: int = 0,
    limit: int = 100,
    data_source_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取数据集列表"""
    query = (
        db.query(Dataset)
        .join(DataSource, Dataset.data_source_id == DataSource.id)
        .options(joinedload(Dataset.data_source))
        .filter(Dataset.is_deleted == False)
    )
    
    if data_source_id:
        query = query.filter(Dataset.data_source_id == data_source_id)
    
    # 权限控制：普通用户只能看到自己的数据集
    if current_user.role != UserRole.ADMIN.value:
        query = query.filter(Dataset.owner_id == current_user.id)
    
    datasets = query.offset(skip).limit(limit).all()

    # 附加数据源名称，方便前端展示
    for dataset in datasets:
        data_source_name = dataset.data_source.name if dataset.data_source else None
        setattr(dataset, 'data_source_name', data_source_name)

    return datasets


@router.post("/datasets/upload", response_model=DataUploadResponse)
async def upload_dataset(
    file: UploadFile = File(...),
    name: str = Form(...),
    description: str = Form(""),
    data_source_id: Optional[str] = Form(None),
    data_source_type: str = Form("existing"),
    custom_data_source_name: str = Form(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """上传数据集文件"""
    # 检查文件扩展名白名单
    if not is_allowed_extension(file.filename):
        raise HTTPException(
            status_code=400,
            detail="仅支持 CSV、Excel、SPSS(.sav)、TXT、JSON 文件"
        )
    
    # 读取文件内容
    content = await file.read()
    filename = file.filename
    
    # 获取存储实例
    storage = get_storage()
    
    # 基础文件校验
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as tmp:
        tmp.write(content)
        tmp_path = tmp.name
    
    ok, err = validate_file(tmp_path, filename, settings.MAX_FILE_SIZE)
    os.unlink(tmp_path)  # 删除临时文件
    
    if not ok:
        raise HTTPException(status_code=400, detail=err)

    try:
        # 上传文件到存储
        file_path = await storage.upload_file(content, filename)
        
        # 读取数据文件获取基本信息
        df = await read_data_file(file_path)
        if df is None:
            # 如果读取失败，删除已上传的文件
            await storage.delete_file(file_path)
            raise Exception("无法读取文件，文件可能不存在或格式不支持")
        
        # 检查同一用户下名称是否已存在（排除软删除的数据集）
        existing_dataset = db.query(Dataset).filter(
            Dataset.owner_id == current_user.id,
            Dataset.name == name,
            Dataset.is_deleted == False
        ).first()
        if existing_dataset:
            await storage.delete_file(file_path)
            raise HTTPException(
                status_code=400,
                detail="同名数据集已存在，请更换一个名称"
            )
        
        # 获取列信息
        columns_info = {
            "columns": list(df.columns),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.to_dict().items()}
        }
        
        # 处理数据源
        final_data_source_id = None
        if data_source_type == "existing" and data_source_id:
            final_data_source_id = int(data_source_id)
        elif data_source_type == "custom" and custom_data_source_name:
            # 创建自定义数据源
            custom_source = DataSource(
                name=custom_data_source_name,
                description=f"用户自定义数据源: {custom_data_source_name}",
                data_type="custom"
            )
            db.add(custom_source)
            db.commit()
            db.refresh(custom_source)
            final_data_source_id = custom_source.id
        else:
            raise HTTPException(status_code=400, detail="请选择数据源或提供自定义数据源名称")

        # 创建数据集记录
        dataset = Dataset(
            name=name,
            description=description,
            file_path=file_path,
            data_source_id=final_data_source_id,
            owner_id=current_user.id,
            columns_info=json.dumps(columns_info),  # 需要序列化为JSON字符串
            record_count=len(df)
        )
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
        
        return DataUploadResponse(
            dataset_id=dataset.id,
            status="success",
            message="Dataset uploaded successfully"
        )
        
    except Exception as e:
        # 如果出错，删除已上传的文件
        if 'file_path' in locals():
            await storage.delete_file(file_path)
        
        raise HTTPException(
            status_code=400,
            detail=f"Error processing file: {str(e)}"
        )


@router.get("/datasets/{dataset_id}/preview")
async def preview_dataset(
    dataset_id: int,
    rows: int = 10,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """预览数据集"""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    ensure_dataset_access(dataset, current_user)
    
    if not dataset.file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")
    
    # 获取存储实例
    storage = get_storage()
    
    # 使用存储接口读取文件
    df = await read_data_file(dataset.file_path)
    if df is None:
        raise HTTPException(status_code=404, detail="无法读取文件，文件可能不存在或格式不支持")
    
    # 返回前N行数据，处理NaN值
    preview_df = df.head(rows).fillna('')  # 将NaN替换为空字符串
    preview_data = preview_df.to_dict(orient='records')
    
    note = f"仅展示前{rows}条记录" if len(df) > rows else None

    return {
        "columns": list(df.columns),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.to_dict().items()},
        "shape": df.shape,
        "preview": preview_data,
        "total_records": int(len(df)),
        "note": note
    }


@router.get("/datasets/{dataset_id}/columns")
async def get_dataset_columns(
    dataset_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取数据集的列信息"""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    ensure_dataset_access(dataset, current_user)
    
    if not dataset.file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")
    
    # 检查是否为从数据源导入的数据集
    if dataset.file_path.startswith('external://'):
        dataset_key = dataset.file_path.replace('external://', '')
        external_config = external_registry.get_dataset(dataset_key)
        source_config = external_registry.get_source(external_config.data_source_id) if external_config else None

        if not external_config or not source_config:
            raise HTTPException(status_code=400, detail="Dataset configuration not found")

        try:
            result = await external_fetcher.fetch_data(source_config, external_config, {}, is_import=False)
            preview_data = result.get('data', [])
            if not preview_data:
                raise HTTPException(status_code=400, detail="No data available from data source")
            df = pd.DataFrame(preview_data)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error fetching data from data source: {str(e)}"
            )
    else:
        # 常规文件数据集 - 使用存储接口
        storage = get_storage()
        try:
            df = await read_data_file(dataset.file_path)
            if df is None:
                raise HTTPException(status_code=404, detail="无法读取文件，文件可能不存在或格式不支持")
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error reading dataset file: {str(e)}"
            )
    
    # 返回列信息
    columns_info = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        unique_count = df[col].nunique()
        null_count = df[col].isnull().sum()
        
        # 更智能的数据类型判断
        is_numeric_dtype = pd.api.types.is_numeric_dtype(df[col])
        unique_count = df[col].nunique()
        total_rows = len(df)
        unique_ratio = unique_count / total_rows if total_rows > 0 else 0
        
        # 如果数值列的唯一值比例很小，可能是分类变量
        is_categorical = not is_numeric_dtype or (is_numeric_dtype and unique_ratio < 0.1)
        is_numeric = is_numeric_dtype and unique_ratio >= 0.1
        
        columns_info.append({
            "name": col,
            "dtype": dtype,
            "unique_count": int(unique_count),
            "null_count": int(null_count),
            "is_numeric": is_numeric,
            "is_categorical": is_categorical
        })
    
    return {
        "dataset_id": dataset_id,
        "dataset_name": dataset.name,
        "columns": columns_info,
        "total_rows": dataset.record_count
    }


@router.delete("/datasets/{dataset_id}")
async def delete_dataset(
    dataset_id: int,
    force: bool = Query(False, description="强制删除：连同关联的分析与报告一并删除"),
    soft: bool = Query(True, description="软删除（仅标记 is_deleted）"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """删除数据集"""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    ensure_dataset_access(dataset, current_user)
    
    # 如果有关联的分析，按策略处理
    linked_analyses = db.query(Analysis).filter(Analysis.dataset_id == dataset_id).all()
    if linked_analyses and not force:
        raise HTTPException(status_code=409, detail="该数据集已被分析引用，请先删除相关分析，或使用 force=true 强制删除")

    # 软删除：仅标记，不删除数据与文件
    if soft and not force:
        dataset.is_deleted = True
        db.commit()
        return {"message": "Dataset soft-deleted", "removed_analyses": 0, "removed_reports": 0}

    # 删除关联报告与分析（当 force=True 或 soft=False 时）
    removed_reports = 0
    removed_analyses = 0
    if linked_analyses:
        for a in linked_analyses:
            removed_reports += db.query(Report).filter(Report.analysis_id == a.id).delete(synchronize_session=False)
            db.delete(a)
            removed_analyses += 1

    # 删除文件
    if dataset.file_path:
        try:
            storage = get_storage()
            await storage.delete_file(dataset.file_path)
        except Exception as e:
            # 记录错误但不阻止删除数据库记录
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"删除文件失败: {dataset.file_path}, 错误: {str(e)}")
    
    # 删除数据库记录
    db.delete(dataset)
    db.commit()
    
    return {
        "message": "Dataset deleted successfully",
        "removed_analyses": removed_analyses,
        "removed_reports": removed_reports
    }
