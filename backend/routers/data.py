from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
import pandas as pd
import json
import os
import pyreadstat
from database import get_db
from models import DataSource, Dataset, User, Analysis, Report, UserRole
from schemas import DataSource as DataSourceSchema, DataSourceCreate, Dataset as DatasetSchema, DatasetCreate, DataUploadRequest, DataUploadResponse
from auth import get_current_active_user
from services.data_fetcher import DataFetcher
from services.r2_storage import R2StorageService
from config import load_registry_from_json
from settings import settings
from utils.file_validator import validate_file, is_allowed_extension
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
    query = db.query(Dataset).join(DataSource, Dataset.data_source_id == DataSource.id).filter(Dataset.is_deleted == False)
    if data_source_id:
        query = query.filter(Dataset.data_source_id == data_source_id)
    
    if current_user.role != UserRole.ADMIN.value:
        query = query.filter(Dataset.owner_id == current_user.id)
    
    datasets = query.offset(skip).limit(limit).all()
    
    # 为每个数据集添加数据源名称
    result = []
    for dataset in datasets:
        dataset_dict = dataset.__dict__.copy()
        # 获取数据源名称
        data_source = db.query(DataSource).filter(DataSource.id == dataset.data_source_id).first()
        if data_source:
            dataset_dict['data_source_name'] = data_source.name
        dataset_dict['owner_id'] = dataset.owner_id
        result.append(dataset_dict)
    
    return result

@router.get("/datasets/{dataset_id}", response_model=DatasetSchema)
def get_dataset(
    dataset_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取特定数据集"""
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, Dataset.is_deleted == False).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    ensure_dataset_access(dataset, current_user)
    return dataset

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
    
    # 选择存储方式
    if settings.USE_R2_STORAGE:
        # 使用 R2 存储
        storage_service = R2StorageService()
        file_path = await storage_service.upload_file(content, filename)
    else:
        # 使用本地存储
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        unique_name = f"{uuid.uuid4().hex}__{filename}"
        file_path = os.path.join(upload_dir, unique_name)
        with open(file_path, "wb") as buffer:
            buffer.write(content)
    
    # 基础文件校验：大小、类型（文件头嗅探）
    if settings.USE_R2_STORAGE:
        # R2 存储，创建临时文件进行校验
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}") as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        ok, err = validate_file(tmp_path, filename, settings.MAX_FILE_SIZE)
        os.unlink(tmp_path)  # 删除临时文件
    else:
        ok, err = validate_file(file_path, filename, settings.MAX_FILE_SIZE)
    
    if not ok:
        # 删除上传的文件
        if settings.USE_R2_STORAGE:
            await storage_service.delete_file(file_path)
        else:
            try:
                os.remove(file_path)
            except Exception:
                pass
        raise HTTPException(status_code=400, detail=err)

    try:
        # 使用统一的文件读取工具
        df = await read_data_file(file_path)
        if df is None:
            raise Exception("无法读取文件，文件可能不存在或格式不支持")
        
        # 检查同一用户下名称是否已存在（排除软删除的数据集）
        existing_dataset = db.query(Dataset).filter(
            Dataset.owner_id == current_user.id,
            Dataset.name == name,
            Dataset.is_deleted == False
        ).first()
        if existing_dataset:
            raise HTTPException(
                status_code=400,
                detail="同名数据集已存在，请更换一个名称"
            )
        
        # 获取列信息
        columns_info = {
            "columns": list(df.columns),
            "dtypes": df.dtypes.to_dict(),
            "shape": df.shape
        }
        
        # 处理数据源
        if data_source_type == "custom" and custom_data_source_name:
            # 创建新的自定义数据源
            data_source = DataSource(
                name=custom_data_source_name,
                description=f"用户自定义数据源: {custom_data_source_name}",
                data_type="custom",
                is_active=True
            )
            db.add(data_source)
            db.commit()
            db.refresh(data_source)
            final_data_source_id = data_source.id
        else:
            # 使用现有数据源（可能是数据源ID或标识）
            raw_data_source_id = data_source_id.strip() if data_source_id else None
            if not raw_data_source_id:
                raise HTTPException(status_code=400, detail="请选择数据源或提供自定义数据源名称")

            if raw_data_source_id.isdigit():
                # 直接使用已有的数据库ID
                final_data_source_id = int(raw_data_source_id)
            else:
                # 按标识查找或创建对应的数据源记录
                global_data_source = db.query(DataSource).filter(
                    DataSource.name.like(f"%{raw_data_source_id}%")
                ).first()

                if not global_data_source:
                    global_source_names = {
                        "who_gho": "WHO 世界卫生组织",
                        "who_hidr": "WHO 健康不平等",
                        "who_icd": "WHO 疾病分类"
                    }

                    source_name = global_source_names.get(raw_data_source_id, f"数据源 {raw_data_source_id}")
                    global_data_source = DataSource(
                        name=source_name,
                        description=f"数据源: {source_name}",
                        data_type="global",
                        is_active=True
                    )
                    db.add(global_data_source)
                    db.commit()
                    db.refresh(global_data_source)

                final_data_source_id = global_data_source.id
        
        # 创建数据集记录
        dataset = Dataset(
            name=name,
            description=description,
            data_source_id=final_data_source_id,
            owner_id=current_user.id,
            file_path=file_path,
            record_count=len(df),
            columns_info=json.dumps(columns_info, default=str)
        )
        
        # 添加调试信息
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"=== 文件上传调试信息 ===")
        logger.info(f"文件保存路径: {file_path}")
        logger.info(f"文件是否存在: {os.path.exists(file_path)}")
        logger.info(f"当前工作目录: {os.getcwd()}")
        logger.info(f"uploads目录内容: {os.listdir('uploads') if os.path.exists('uploads') else 'uploads目录不存在'}")
        
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
        
        logger.info(f"数据集已保存，ID: {dataset.id}, 文件路径: {dataset.file_path}")
        
        return DataUploadResponse(
            dataset_id=dataset.id,
            status="success",
            message="Dataset uploaded successfully"
        )
        
    except Exception as e:
        # 删除上传的文件
        if settings.USE_R2_STORAGE:
            await storage_service.delete_file(file_path)
        else:
            if os.path.exists(file_path):
                os.remove(file_path)
        
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
    import logging
    logger = logging.getLogger(__name__)
    
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    ensure_dataset_access(dataset, current_user)
    
    if not dataset.file_path:
        raise HTTPException(status_code=404, detail="Dataset file not found")
    
    # 使用统一的文件读取工具
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
    
    # 处理file://前缀
    file_path = dataset.file_path
    if file_path.startswith('file://'):
        file_path = file_path[7:]  # 移除file://前缀

    # 检查是否为从数据源导入的数据集
    if file_path.startswith('external://'):
        dataset_key = file_path.replace('external://', '')
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
        # 常规文件数据集 - 使用统一的文件读取工具
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
        is_categorical = (
            df[col].dtype == 'object' or  # 字符串类型
            (is_numeric_dtype and unique_count < 20) or  # 数值但唯一值少
            (is_numeric_dtype and unique_ratio < 0.1)  # 数值但唯一值比例小
        )
        
        is_numeric = is_numeric_dtype and not is_categorical
        
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
        "total_rows": len(df)
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
            if settings.USE_R2_STORAGE and dataset.file_path.startswith("r2://"):
                # 从 R2 删除文件
                storage_service = R2StorageService()
                await storage_service.delete_file(dataset.file_path)
            else:
                # 删除本地文件
                file_path = dataset.file_path
                if file_path.startswith('file://'):
                    file_path = file_path[7:]  # 移除file://前缀
                
                if os.path.exists(file_path):
                    os.remove(file_path)
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
