#!/usr/bin/env python3
"""
数据库初始化脚本
用于本地首次启动时创建数据库表和默认管理员用户
"""

import sys
from database import Base, engine, SessionLocal
from models import User
from passlib.hash import bcrypt


def init_database():
    """创建所有数据库表"""
    try:
        print("🔧 正在创建数据库表...")
        Base.metadata.create_all(bind=engine)
        print("✅ 数据库表创建成功")
        return True
    except Exception as e:
        print(f"❌ 数据库表创建失败: {e}")
        return False


def create_admin_user():
    """创建默认管理员用户"""
    db = SessionLocal()
    try:
        # 检查管理员是否已存在
        existing_admin = db.query(User).filter_by(username='admin').first()
        if existing_admin:
            print("ℹ️  管理员用户已存在")
            return True
        
        # 创建管理员用户
        print("👤 正在创建管理员用户...")
        admin_user = User(
            username='admin',
            email='admin@example.com',
            hashed_password=bcrypt.hash('Admin@123'),
            full_name='System Administrator',
            role='admin',
            is_active=True
        )
        db.add(admin_user)
        db.commit()
        print("✅ 管理员用户创建成功")
        print("📋 登录信息:")
        print("   用户名: admin")
        print("   密码: Admin@123")
        print("   ⚠️  请在首次登录后立即修改密码！")
        return True
    except Exception as e:
        print(f"❌ 创建管理员用户失败: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def main():
    """主函数"""
    print("=" * 60)
    print("🚀 HealthInsight Hub - 数据库初始化")
    print("=" * 60)
    print()
    
    # 初始化数据库表
    if not init_database():
        print("\n❌ 数据库初始化失败，请检查数据库连接配置")
        sys.exit(1)
    
    print()
    
    # 创建管理员用户
    if not create_admin_user():
        print("\n⚠️  管理员用户创建失败，但数据库表已创建")
        sys.exit(1)
    
    print()
    print("=" * 60)
    print("✅ 数据库初始化完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()

