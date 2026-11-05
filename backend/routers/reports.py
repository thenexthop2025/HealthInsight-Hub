from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
import logging
import os
from datetime import datetime
from typing import List

from auth import get_current_active_user
from database import get_db
from models import Analysis, Report, User
from schemas import Report as ReportSchema, ReportCreate

router = APIRouter()
logger = logging.getLogger(__name__)


def _load_report_builders():
    """Dynamically load report builders to handle different import contexts."""
    try:
        from reports import build_pdf_report, build_docx_report
        from reports.data import ReportDataBuilder
        return build_pdf_report, build_docx_report, ReportDataBuilder
    except ImportError as e:
        logger.error(f"Failed to import report builders: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Report generation module not available. Please contact administrator."
        )


def _build_report_file(analysis: Analysis, report_type: str, report_dir: str) -> str:
    os.makedirs(report_dir, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    build_pdf_report, build_docx_report, ReportDataBuilder = _load_report_builders()
    payload = ReportDataBuilder(analysis).build()
    normalized_type = (report_type or 'pdf').lower()

    if normalized_type == 'word':
        file_path = os.path.join(report_dir, f"analysis_{analysis.id}_{timestamp}.docx")
        build_docx_report(payload, file_path)
        return file_path

    if normalized_type == 'pdf':
        file_path = os.path.join(report_dir, f"analysis_{analysis.id}_{timestamp}.pdf")
        build_pdf_report(payload, file_path)
        return file_path

    raise ValueError(f"Unsupported report type: {report_type}")


@router.get("/", response_model=List[ReportSchema])
def get_reports(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取报告列表"""
    reports = db.query(Report).filter(Report.user_id == current_user.id).offset(skip).limit(limit).all()
    return reports

@router.get("/{report_id}", response_model=ReportSchema)
def get_report(
    report_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取特定报告"""
    report = db.query(Report).filter(
        Report.id == report_id,
        Report.user_id == current_user.id
    ).first()
    
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return report

@router.post("/", response_model=ReportSchema)
def create_report(
    report: ReportCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """创建报告"""
    # 检查分析是否存在
    analysis = db.query(Analysis).filter(
        Analysis.id == report.analysis_id,
        Analysis.user_id == current_user.id
    ).first()
    
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    if analysis.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Analysis must be completed before creating report"
        )
    
    # 创建报告目录
    report_dir = "generated_reports"

    report_type = report.report_type or "pdf"
    try:
        file_path = _build_report_file(analysis, report_type, report_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="Unsupported report type")
    except Exception as exc:
        logger.exception("Error generating report (type=%s, analysis=%s), fallback to PDF", report_type, analysis.id)
        file_path = _build_report_file(analysis, "pdf", report_dir)
    
    # 创建报告记录
    db_report = Report(
        **report.dict(),
        user_id=current_user.id,
        file_path=file_path
    )
    
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    return db_report

@router.post("/generate/{analysis_id}")
def generate_report(
    analysis_id: int,
    report_type: str = "pdf",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """生成分析报告"""
    # 获取分析
    analysis = db.query(Analysis).filter(
        Analysis.id == analysis_id,
        Analysis.user_id == current_user.id
    ).first()
    
    if analysis is None:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    if analysis.status != "completed":
        raise HTTPException(
            status_code=400,
            detail="Analysis must be completed before generating report"
        )
    
    # 创建报告目录
    report_dir = "generated_reports"

    try:
        file_path = _build_report_file(analysis, report_type, report_dir)
    except ValueError:
        raise HTTPException(status_code=400, detail="Unsupported report type")
    except Exception as exc:
        logger.exception("Error generating report (type=%s, analysis=%s)", report_type, analysis.id)
        raise HTTPException(status_code=500, detail="Failed to generate report")

    # 创建报告记录
    report = Report(
        title=f"Analysis Report - {analysis.name}",
        content="Generated analysis report",
        user_id=current_user.id,
        analysis_id=analysis_id,
        file_path=file_path,
        report_type=report_type
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    return {"report_id": report.id, "file_path": file_path}

@router.get("/download/{report_id}")
def download_report(
    report_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """下载报告文件"""
    report = db.query(Report).filter(
        Report.id == report_id,
        Report.user_id == current_user.id
    ).first()
    
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if not report.file_path or not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="Report file not found")
    
    # 读取文件内容
    with open(report.file_path, "rb") as file:
        content = file.read()
    
    # 返回文件
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={os.path.basename(report.file_path)}"}
    )


@router.delete("/{report_id}")
def delete_report(
    report_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """删除报告"""
    report = db.query(Report).filter(
        Report.id == report_id,
        Report.user_id == current_user.id
    ).first()
    
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # 删除文件
    if report.file_path and os.path.exists(report.file_path):
        try:
            os.remove(report.file_path)
        except Exception as e:
            logger.warning(f"Failed to delete report file {report.file_path}: {e}")
    
    # 删除数据库记录
    db.delete(report)
    db.commit()
    
    return {"message": "Report deleted successfully"}


# === REPORT GENERATION MARKER ===
