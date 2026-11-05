"""
认证路由模块
包含用户注册、登录、Token刷新、密码修改等功能
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from datetime import timedelta
from database import get_db
from models import User
from schemas import (
    UserCreate, UserLogin, Token, User as UserSchema,
    TokenResponse, RefreshTokenRequest, ChangePasswordRequest,
    PublicRegisterRequest, UserRole
)
from auth import (
    authenticate_user, create_tokens, get_password_hash, 
    get_current_active_user, verify_refresh_token,
    validate_password_strength, validate_email_format,
    verify_password
)
from utils.rate_limiter import login_attempt_tracker
from settings import settings

router = APIRouter()


@router.post("/register", response_model=UserSchema)
def register(user: PublicRegisterRequest, db: Session = Depends(get_db)):
    """
    用户注册
    
    验证：
    - 用户名唯一性
    - 邮箱唯一性和格式
    - 密码强度
    """
    # 验证邮箱格式
    is_valid_email, email_error = validate_email_format(user.email)
    if not is_valid_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=email_error
        )
    
    # 验证密码强度
    is_valid_password, password_errors = validate_password_strength(user.password)
    if not is_valid_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "密码不符合要求", "errors": password_errors}
        )
    
    # 检查用户名是否已存在
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已被注册"
        )
    
    # 检查邮箱是否已存在
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被注册"
        )
    
    # 创建新用户
    hashed_password = get_password_hash(user.password)
    # 公开注册强制为非管理员角色
    default_role = UserRole.RESEARCHER
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        full_name=user.full_name,
        role=default_role.value
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user


@router.post("/login", response_model=TokenResponse)
def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """
    用户登录
    
    功能：
    - 登录失败限制（5次失败锁定15分钟）
    - 返回访问令牌和刷新令牌
    """
    username = user_credentials.username
    
    # 检查账户是否被锁定
    is_locked, remaining_time = login_attempt_tracker.is_locked(username)
    if is_locked:
        minutes = remaining_time // 60
        seconds = remaining_time % 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"账户已被锁定，请在 {minutes}分{seconds}秒 后重试"
        )
    
    # 验证用户凭据
    user = authenticate_user(db, username, user_credentials.password)
    if not user:
        # 记录失败尝试
        login_attempt_tracker.record_failed_attempt(username)
        remaining = login_attempt_tracker.get_remaining_attempts(username)
        
        if remaining > 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"用户名或密码错误，剩余尝试次数: {remaining}",
                headers={"WWW-Authenticate": "Bearer"},
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="登录失败次数过多，账户已被锁定15分钟",
                headers={"WWW-Authenticate": "Bearer"},
            )
    
    # 登录成功，清除失败记录
    login_attempt_tracker.record_successful_login(username)
    
    # 创建访问令牌和刷新令牌
    access_token, refresh_token, expires_in = create_tokens(user.username)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": expires_in
    }


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    refresh_request: RefreshTokenRequest, 
    db: Session = Depends(get_db)
):
    """
    刷新访问令牌
    
    使用刷新令牌获取新的访问令牌和刷新令牌
    """
    # 验证刷新令牌
    user = verify_refresh_token(refresh_request.refresh_token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的刷新令牌",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # 检查用户是否激活
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="用户账户已被停用"
        )
    
    # 创建新的访问令牌和刷新令牌
    access_token, refresh_token, expires_in = create_tokens(user.username)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": expires_in
    }


@router.get("/me", response_model=UserSchema)
def read_users_me(current_user: User = Depends(get_current_active_user)):
    """获取当前用户信息"""
    return current_user


@router.post("/change-password")
def change_password(
    password_request: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    修改密码
    
    验证：
    - 旧密码正确性
    - 新密码强度
    """
    # 验证旧密码
    if not verify_password(password_request.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="旧密码不正确"
        )
    
    # 验证新密码强度
    is_valid, errors = validate_password_strength(password_request.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "新密码不符合要求", "errors": errors}
        )
    
    # 检查新密码是否与旧密码相同
    if verify_password(password_request.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="新密码不能与旧密码相同"
        )
    
    # 更新密码
    current_user.hashed_password = get_password_hash(password_request.new_password)
    db.commit()
    
    return {"message": "密码修改成功"}


@router.post("/logout")
def logout(current_user: User = Depends(get_current_active_user)):
    """
    用户登出
    
    注意：由于使用JWT，实际的token失效需要客户端删除token
    这个端点主要用于清理服务器端的会话数据（如果有）
    """
    # TODO: 如果实现了token黑名单，在这里添加token到黑名单
    return {"message": "登出成功"}
