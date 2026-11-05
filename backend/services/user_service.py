from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from models import User
from repositories.user_repository import UserRepository
from auth import get_password_hash
from .audit_service import AuditService


class UserService:
    """用户业务服务：封装校验与业务流程。"""

    def __init__(self, db: Session):
        self.db = db
        self.repo = UserRepository(db)

    # ---- Queries ----
    def list_users(
        self,
        q: Optional[str] = None,
        role: Optional[str] = None,
        active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50,
        sort: Optional[str] = None,
    ) -> Tuple[List[User], int]:
        return self.repo.list_users(q, role, active, skip, limit, sort)

    def get_user(self, user_id: int) -> Optional[User]:
        return self.repo.get_by_id(user_id)

    # ---- Mutations ----
    def create_user(self, *, username: str, email: str, full_name: str, role: str, password: str, actor_id: int | None = None) -> User:
        # 唯一性校验
        if self.repo.get_by_username(username):
            raise ValueError("Username already registered")
        if self.repo.get_by_email(email):
            raise ValueError("Email already registered")

        hashed_password = get_password_hash(password)
        user = User(
            username=username,
            email=email,
            full_name=full_name,
            role=role,
            hashed_password=hashed_password,
            is_active=True,
        )
        created = self.repo.create(user)
        if actor_id is not None:
            AuditService(self.db).log(actor_id=actor_id, action="create_user", target_id=created.id, details={"username": username, "role": role})
        return created

    def update_user(self, user_id: int, updates: dict, actor_id: int | None = None) -> User:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")

        # 局部字段白名单
        allowed = {"username", "email", "full_name", "role", "is_active"}
        apply_updates = {k: v for k, v in updates.items() if k in allowed}

        # 唯一性校验（当 username/email 变化时）
        if "username" in apply_updates and apply_updates["username"] != user.username:
            if self.repo.get_by_username(apply_updates["username"]):
                raise ValueError("Username already registered")
        if "email" in apply_updates and apply_updates["email"] != user.email:
            if self.repo.get_by_email(apply_updates["email"]):
                raise ValueError("Email already registered")

        updated = self.repo.update(user, apply_updates)
        if actor_id is not None:
            AuditService(self.db).log(actor_id=actor_id, action="update_user", target_id=user_id, details={"fields": list(apply_updates.keys())})
        return updated

    def set_active(self, user_id: int, is_active: bool, actor_id: int | None = None) -> User:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        updated = self.repo.update(user, {"is_active": is_active})
        if actor_id is not None:
            AuditService(self.db).log(actor_id=actor_id, action="set_active", target_id=user_id, details={"is_active": is_active})
        return updated

    def change_role(self, user_id: int, role: str, actor_id: int | None = None) -> User:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        updated = self.repo.update(user, {"role": role})
        if actor_id is not None:
            AuditService(self.db).log(actor_id=actor_id, action="change_role", target_id=user_id, details={"role": role})
        return updated

    def reset_password(self, user_id: int, new_password: str, actor_id: int | None = None) -> User:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        hashed = get_password_hash(new_password)
        updated = self.repo.update(user, {"hashed_password": hashed})
        if actor_id is not None:
            AuditService(self.db).log(actor_id=actor_id, action="reset_password", target_id=user_id)
        return updated

    def delete_user(self, user_id: int, actor_id: int | None = None) -> None:
        user = self.repo.get_by_id(user_id)
        if not user:
            raise ValueError("User not found")
        self.repo.delete(user)
        if actor_id is not None:
            AuditService(self.db).log(actor_id=actor_id, action="delete_user", target_id=user_id)


