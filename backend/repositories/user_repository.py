from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, asc, desc

from models import User


class UserRepository:
    """用户数据访问层：仅负责数据库读写，不包含业务规则。"""

    def __init__(self, db: Session):
        self.db = db

    # ---- Getters ----
    def get_by_id(self, user_id: int) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def get_by_username(self, username: str) -> Optional[User]:
        return self.db.query(User).filter(User.username == username).first()

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email).first()

    # ---- List with filters ----
    def list_users(
        self,
        q: Optional[str] = None,
        role: Optional[str] = None,
        active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50,
        sort: Optional[str] = None,
    ) -> Tuple[List[User], int]:
        query = self.db.query(User)

        if q:
            like = f"%{q}%"
            query = query.filter(
                or_(User.username.like(like), User.email.like(like), User.full_name.like(like))
            )
        if role:
            query = query.filter(User.role == role)
        if active is not None:
            query = query.filter(User.is_active == active)

        total = query.count()

        if sort:
            # sort pattern: "field:asc" or "field:desc"
            try:
                field, direction = (part.strip() for part in sort.split(":", 1))
                column = getattr(User, field, None)
                if column is not None:
                    query = query.order_by(asc(column) if direction.lower() != "desc" else desc(column))
            except Exception:
                # ignore invalid sort
                pass

        items = query.offset(max(0, int(skip))).limit(max(1, int(limit))).all()
        return items, total

    # ---- Mutations ----
    def create(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: User, updates: dict) -> User:
        for field, value in updates.items():
            setattr(user, field, value)
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete(self, user: User) -> None:
        self.db.delete(user)
        self.db.commit()


