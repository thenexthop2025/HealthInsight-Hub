from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from settings import settings

# 创建数据库引擎
engine = create_engine(settings.DATABASE_URL)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基础模型类
Base = declarative_base()

def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def migrate_analysis_type_names() -> None:
    """一次性迁移：将历史 analysis_type 旧命名统一为新枚举。"""
    with engine.begin() as conn:
        mappings = {
            'explore_analysis': 'explore',
            'descriptive_statistics': 'descriptive',
            'frequency_analysis': 'frequency',
            'crosstab_analysis': 'crosstab',
            'correlation_analysis': 'correlation',
            'regression_analysis': 'regression',
            'chi_square_test': 'chi_square',
            'stratified_analysis': 'stratified',
        }
        for old, new in mappings.items():
            conn.execute(text("UPDATE analyses SET analysis_type = :new WHERE analysis_type = :old"), {"new": new, "old": old})
