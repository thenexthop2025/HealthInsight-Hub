from datetime import datetime, timedelta
from typing import Optional, Tuple
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserCreate, UserLogin
from settings import settings
from utils.validators import password_validator, email_validator

# 密码加密
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT配置
security = HTTPBearer()

# Token 类型
TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"

# Token 过期时间
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # 短期访问令牌
REFRESH_TOKEN_EXPIRE_DAYS = 7  # 长期刷新令牌

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码"""
    # 截断密码到72字节以避免bcrypt限制
    if len(plain_password.encode('utf-8')) > 72:
        plain_password = plain_password[:72]
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """生成密码哈希"""
    # 截断密码到72字节以避免bcrypt限制
    if len(password.encode('utf-8')) > 72:
        password = password[:72]
    return pwd_context.hash(password)

def validate_password_strength(password: str) -> Tuple[bool, list]:
    """
    验证密码强度
    
    Returns:
        (是否有效, 错误信息列表)
    """
    return password_validator.validate(password)


def validate_email_format(email: str) -> Tuple[bool, str]:
    """
    验证邮箱格式
    
    Returns:
        (是否有效, 错误信息)
    """
    return email_validator.validate(email)


def create_token(data: dict, token_type: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    创建令牌（访问令牌或刷新令牌）
    
    Args:
        data: 要编码的数据
        token_type: 令牌类型 (access/refresh)
        expires_delta: 过期时间增量
    """
    to_encode = data.copy()
    
    # 设置过期时间
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        if token_type == TOKEN_TYPE_ACCESS:
            expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        else:  # refresh token
            expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode.update({
        "exp": expire,
        "type": token_type
    })
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建访问令牌"""
    return create_token(data, TOKEN_TYPE_ACCESS, expires_delta)


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """创建刷新令牌"""
    return create_token(data, TOKEN_TYPE_REFRESH, expires_delta)


def create_tokens(username: str) -> Tuple[str, str, int]:
    """
    创建访问令牌和刷新令牌
    
    Returns:
        (access_token, refresh_token, access_token_expires_seconds)
    """
    # 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": username}, 
        expires_delta=access_token_expires
    )
    
    # 创建刷新令牌
    refresh_token_expires = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    refresh_token = create_refresh_token(
        data={"sub": username}, 
        expires_delta=refresh_token_expires
    )
    
    return access_token, refresh_token, ACCESS_TOKEN_EXPIRE_MINUTES * 60

def verify_token(token: str, expected_type: Optional[str] = None) -> Optional[dict]:
    """
    验证令牌
    
    Args:
        token: JWT令牌
        expected_type: 期望的令牌类型 (access/refresh)，None表示不验证类型
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        
        # 验证令牌类型
        if expected_type:
            token_type = payload.get("type")
            if token_type != expected_type:
                return None
        
        return payload
    except JWTError:
        return None


def verify_refresh_token(refresh_token: str, db: Session) -> Optional[User]:
    """
    验证刷新令牌并返回用户
    
    Args:
        refresh_token: 刷新令牌
        db: 数据库会话
        
    Returns:
        用户对象或None
    """
    payload = verify_token(refresh_token, expected_type=TOKEN_TYPE_REFRESH)
    if payload is None:
        return None
    
    username: str = payload.get("sub")
    if username is None:
        return None
    
    user = db.query(User).filter(User.username == username).first()
    return user

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """获取当前用户"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    payload = verify_token(token)
    if payload is None:
        raise credentials_exception
    
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise credentials_exception
    
    return user

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """获取当前活跃用户"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="用户已停用")
    return current_user

def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """验证用户"""
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
