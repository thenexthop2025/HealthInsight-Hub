import os
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import User, UserRole, UserProfile, Analysis, Report, AuditLog
from schemas import (
    User as UserSchema,
    UserUpdate,
    UserCreate,
    UserStatusUpdate,
    UserPasswordReset,
)
from auth import get_current_active_user, get_password_hash
from services.audit_service import AuditService
from settings import settings
from storage.factory import get_storage

router = APIRouter()

@router.post("/", response_model=UserSchema)
def create_user(
    user: UserCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """创建用户（仅管理员）"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    # 唯一性校验
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.query(User).filter(User.email == user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        hashed_password=hashed_password,
        is_active=True,
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    AuditService(db).log(
        actor_id=current_user.id if current_user else None,
        action="create_user",
        target_type="user",
        target_id=db_user.id,
        details={"username": db_user.username, "role": db_user.role},
    )
    return db_user

@router.get("/", response_model=List[UserSchema])
def read_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取用户列表（仅管理员）"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    users = db.query(User).offset(skip).limit(limit).all()
    return users

@router.get("/{user_id}", response_model=UserSchema)
def read_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """获取特定用户信息"""
    if current_user.role != UserRole.ADMIN and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@router.put("/{user_id}", response_model=UserSchema)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """更新用户信息"""
    if current_user.role != UserRole.ADMIN and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 更新用户信息
    update_data = user_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    AuditService(db).log(
        actor_id=current_user.id if current_user else None,
        action="update_user",
        target_type="user",
        target_id=user.id,
        details={"fields": list(update_data.keys())},
    )
    return user

@router.patch("/{user_id}/status", response_model=UserSchema)
def update_user_status(
    user_id: int,
    status_update: UserStatusUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """更新用户启用状态（仅管理员）"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = status_update.is_active
    db.commit()
    db.refresh(user)
    AuditService(db).log(
        actor_id=current_user.id if current_user else None,
        action="set_active",
        target_type="user",
        target_id=user.id,
        details={"is_active": status_update.is_active},
    )
    return user

@router.patch("/{user_id}/password")
def reset_user_password(
    user_id: int,
    payload: UserPasswordReset,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """重置用户密码（仅管理员）"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    AuditService(db).log(
        actor_id=current_user.id if current_user else None,
        action="reset_password",
        target_type="user",
        target_id=user.id,
    )
    return {"message": "Password reset successfully"}

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """删除用户（仅管理员）"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # 删除相关的审计日志（将actor_id设为NULL）
    db.query(AuditLog).filter(AuditLog.actor_id == user_id).update(
        {"actor_id": None}, synchronize_session=False
    )
    
    # 删除用户相关的数据
    db.query(Report).filter(Report.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(Analysis).filter(Analysis.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(UserProfile).filter(UserProfile.user_id == user_id).delete(
        synchronize_session=False
    )
    
    db.delete(user)
    db.commit()
    AuditService(db).log(
        actor_id=current_user.id if current_user else None,
        action="delete_user",
        target_type="user",
        target_id=user_id,
    )
    
    return {"message": "User deleted successfully"}


@router.get("/me/profile")
def get_my_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    avatar_path = getattr(profile, "avatar_path", None)

    display_avatar_path = avatar_path
    if avatar_path and str(avatar_path).startswith("r2://"):
        storage = get_storage()
        try:
            from storage.r2_storage import R2Storage

            if isinstance(storage, R2Storage):
                display_avatar_path = storage.get_public_url(avatar_path)
        except Exception:
            display_avatar_path = None

    return {
        "user": current_user,
        "avatar_path": display_avatar_path,
        "avatar_storage_path": avatar_path,
        "bio": getattr(profile, "bio", None),
    }


@router.patch("/me")
def update_me(
    updates: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    data = updates.dict(exclude_unset=True)
    # 普通用户不能修改自己的角色
    if "role" in data and current_user.role != UserRole.ADMIN:
        data.pop("role", None)
    if "username" in data:
        # 防止改为已存在用户名
        exists = db.query(User).filter(User.username == data["username"], User.id != current_user.id).first()
        if exists:
            raise HTTPException(status_code=400, detail="Username already registered")
    if "email" in data:
        exists = db.query(User).filter(User.email == data["email"], User.id != current_user.id).first()
        if exists:
            raise HTTPException(status_code=400, detail="Email already registered")
    for k, v in data.items():
        setattr(current_user, k, v)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    from PIL import Image
    import io

    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2 MB
    raw_bytes = file.file.read()
    if len(raw_bytes) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=400, detail="Avatar file size exceeds 2MB limit")
    try:
        image = Image.open(io.BytesIO(raw_bytes))
        image.verify()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid image file") from exc

    image = Image.open(io.BytesIO(raw_bytes)).convert("RGBA")
    image.thumbnail((256, 256))

    storage = get_storage()
    storage_prefix = "avatars/"
    filename = f"user_{current_user.id}.png"
    try:
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        buffer.seek(0)
        storage_key = f"{storage_prefix}{filename}"

        if settings.USE_R2_STORAGE:
            from storage.r2_storage import R2Storage

            if isinstance(storage, R2Storage):
                if hasattr(storage, "upload_file_to_key"):
                    file_path = await storage.upload_file_to_key(buffer.getvalue(), storage_key)
                else:
                    file_path = await storage.upload_file(buffer.getvalue(), storage_key)
                avatar_url = storage.get_public_url(file_path)
            else:
                raise HTTPException(status_code=500, detail="Storage backend mismatch for R2 upload")
        else:
            from storage.local_storage import LocalStorage

            if isinstance(storage, LocalStorage):
                avatars_dir = os.path.join(storage.upload_dir, "avatars")
                os.makedirs(avatars_dir, exist_ok=True)
                local_path = os.path.join(avatars_dir, filename)
                with open(local_path, "wb") as f:
                    f.write(buffer.getvalue())
                file_path = f"/uploads/avatars/{filename}"
                avatar_url = file_path
            else:
                raise HTTPException(status_code=500, detail="Storage backend mismatch for local upload")

        profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
        if profile is None:
            profile = UserProfile(
                user_id=current_user.id,
                avatar_path=file_path if settings.USE_R2_STORAGE else avatar_url,
            )
            db.add(profile)
        else:
            profile.avatar_path = file_path if settings.USE_R2_STORAGE else avatar_url
        db.commit()

        return {"avatar_path": avatar_url}

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Avatar upload failed: {exc}")
