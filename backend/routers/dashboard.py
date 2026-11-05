from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_active_user
from models import Dataset, Analysis, Report, User, UserRole

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """返回仪表盘概要统计信息"""
    is_admin = (current_user.role == UserRole.ADMIN.value)

    dataset_query = db.query(Dataset).filter(Dataset.is_deleted == False)
    analysis_query = db.query(Analysis)
    report_query = db.query(Report)

    if not is_admin:
        dataset_query = dataset_query.filter(Dataset.owner_id == current_user.id)
        analysis_query = analysis_query.filter(Analysis.user_id == current_user.id)
        report_query = report_query.filter(Report.user_id == current_user.id)

    dataset_count = dataset_query.count()
    analysis_count = analysis_query.count()
    report_count = report_query.count()

    return {
        "dataset_count": dataset_count,
        "analysis_count": analysis_count,
        "report_count": report_count,
    }
