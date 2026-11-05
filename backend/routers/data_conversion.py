"""
数据格式转换API路由
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import tempfile
import uuid
from datetime import datetime

from database import get_db
from auth import get_current_user
from models import User
from data_conversion.factory import DataConversionFactory

router = APIRouter()

@router.get("/supported-formats")
async def get_supported_formats(current_user: User = Depends(get_current_user)):
    """获取支持的格式列表"""
    try:
        formats = DataConversionFactory.get_supported_formats()
        return {
            "success": True,
            "formats": formats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取格式列表失败: {str(e)}")

@router.post("/upload-and-convert")
async def upload_and_convert(
    file: UploadFile = File(...),
    output_format: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """上传文件并转换格式"""
    try:
        # 检查文件大小
        if file.size > 50 * 1024 * 1024:  # 50MB
            raise HTTPException(status_code=413, detail="文件大小不能超过50MB")
        
        # 创建临时文件
        temp_dir = tempfile.mkdtemp()
        input_path = os.path.join(temp_dir, file.filename)
        
        # 保存上传的文件
        with open(input_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # 转换文件
        result = DataConversionFactory.convert_file(input_path, output_format)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        # 生成新的文件名
        original_name = os.path.splitext(file.filename)[0]
        output_ext = DataConversionFactory.get_supported_formats()[output_format]['extensions'][0]
        output_filename = f"{original_name}_converted{output_ext}"
        
        # 移动到uploads目录
        uploads_dir = "uploads"
        os.makedirs(uploads_dir, exist_ok=True)
        final_path = os.path.join(uploads_dir, f"{uuid.uuid4().hex[:8]}_{output_filename}")
        
        import shutil
        shutil.move(result["output_path"], final_path)
        
        # 清理临时文件
        shutil.rmtree(temp_dir)
        
        return {
            "success": True,
            "message": result["message"],
            "output_filename": output_filename,
            "download_url": f"/api/data-conversion/download/{os.path.basename(final_path)}",
            "file_info": {
                "rows": result["rows"],
                "columns": result["columns"],
                "file_size": result["file_size"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"转换失败: {str(e)}")

@router.get("/download/{filename}")
async def download_file(filename: str, current_user: User = Depends(get_current_user)):
    """下载转换后的文件"""
    try:
        # 仅允许 uploads 目录下的文件名，防止路径穿越
        safe_name = os.path.basename(filename)
        if not safe_name or safe_name != filename or safe_name in (".", ".."):
            raise HTTPException(status_code=400, detail="无效的文件名")

        uploads_root = os.path.abspath("uploads")
        file_path = os.path.abspath(os.path.join(uploads_root, safe_name))
        if not file_path.startswith(uploads_root + os.sep):
            raise HTTPException(status_code=400, detail="无效的文件名")

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="文件不存在")
        
        return FileResponse(
            path=file_path,
            filename=safe_name,
            media_type='application/octet-stream'
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下载失败: {str(e)}")

@router.post("/analyze-file")
async def analyze_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """分析文件信息"""
    try:
        # 检查文件大小
        if file.size > 50 * 1024 * 1024:  # 50MB
            raise HTTPException(status_code=413, detail="文件大小不能超过50MB")
        
        # 创建临时文件
        temp_dir = tempfile.mkdtemp()
        input_path = os.path.join(temp_dir, file.filename)
        
        # 保存上传的文件
        with open(input_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # 分析文件
        result = DataConversionFactory.get_file_info(input_path)
        
        # 清理临时文件
        import shutil
        shutil.rmtree(temp_dir)
        
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "success": True,
            "file_info": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析失败: {str(e)}")

@router.post("/batch-convert")
async def batch_convert(
    files: List[UploadFile] = File(...),
    output_format: str = Form(...),
    current_user: User = Depends(get_current_user)
):
    """批量转换文件"""
    try:
        if len(files) > 10:
            raise HTTPException(status_code=400, detail="一次最多只能转换10个文件")
        
        results = []
        temp_dir = tempfile.mkdtemp()
        
        try:
            for file in files:
                # 检查文件大小
                if file.size > 50 * 1024 * 1024:  # 50MB
                    results.append({
                        "filename": file.filename,
                        "success": False,
                        "error": "文件大小超过50MB"
                    })
                    continue
                
                # 保存文件
                input_path = os.path.join(temp_dir, file.filename)
                with open(input_path, "wb") as buffer:
                    content = await file.read()
                    buffer.write(content)
                
                # 转换文件
                result = DataConversionFactory.convert_file(input_path, output_format)
                
                if result["success"]:
                    # 移动到uploads目录
                    uploads_dir = "uploads"
                    os.makedirs(uploads_dir, exist_ok=True)
                    
                    original_name = os.path.splitext(file.filename)[0]
                    output_ext = DataConversionFactory.get_supported_formats()[output_format]['extensions'][0]
                    output_filename = f"{original_name}_converted{output_ext}"
                    final_path = os.path.join(uploads_dir, f"{uuid.uuid4().hex[:8]}_{output_filename}")
                    
                    import shutil
                    shutil.move(result["output_path"], final_path)
                    
                    results.append({
                        "filename": file.filename,
                        "success": True,
                        "output_filename": output_filename,
                        "download_url": f"/api/data-conversion/download/{os.path.basename(final_path)}",
                        "file_info": {
                            "rows": result["rows"],
                            "columns": result["columns"],
                            "file_size": result["file_size"]
                        }
                    })
                else:
                    results.append({
                        "filename": file.filename,
                        "success": False,
                        "error": result["error"]
                    })
        
        finally:
            # 清理临时文件
            import shutil
            shutil.rmtree(temp_dir)
        
        success_count = sum(1 for r in results if r["success"])
        
        return {
            "success": True,
            "message": f"批量转换完成，成功转换 {success_count}/{len(files)} 个文件",
            "results": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量转换失败: {str(e)}")

