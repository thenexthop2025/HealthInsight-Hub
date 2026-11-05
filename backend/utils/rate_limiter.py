"""
速率限制工具模块
用于防止暴力破解和恶意请求
"""
from datetime import datetime, timedelta
from typing import Dict, Tuple
import threading


class LoginAttemptTracker:
    """登录尝试跟踪器（基于内存）"""
    
    def __init__(
        self, 
        max_attempts: int = 5,
        lockout_duration_minutes: int = 15,
        cleanup_interval_minutes: int = 60
    ):
        """
        初始化登录尝试跟踪器
        
        Args:
            max_attempts: 最大失败尝试次数
            lockout_duration_minutes: 锁定时长（分钟）
            cleanup_interval_minutes: 清理过期记录的间隔（分钟）
        """
        self.max_attempts = max_attempts
        self.lockout_duration = timedelta(minutes=lockout_duration_minutes)
        self.cleanup_interval = timedelta(minutes=cleanup_interval_minutes)
        
        # 存储结构: {username: {'attempts': int, 'locked_until': datetime, 'first_attempt': datetime}}
        self._attempts: Dict[str, dict] = {}
        self._lock = threading.Lock()
        self._last_cleanup = datetime.now()
    
    def record_failed_attempt(self, username: str) -> None:
        """记录失败的登录尝试"""
        with self._lock:
            self._cleanup_if_needed()
            
            now = datetime.now()
            
            if username not in self._attempts:
                self._attempts[username] = {
                    'attempts': 1,
                    'locked_until': None,
                    'first_attempt': now
                }
            else:
                record = self._attempts[username]
                
                # 如果已经锁定，不增加尝试次数
                if record['locked_until'] and now < record['locked_until']:
                    return
                
                # 如果锁定已过期，重置
                if record['locked_until'] and now >= record['locked_until']:
                    record['attempts'] = 1
                    record['locked_until'] = None
                    record['first_attempt'] = now
                else:
                    record['attempts'] += 1
                
                # 达到最大尝试次数，锁定账户
                if record['attempts'] >= self.max_attempts:
                    record['locked_until'] = now + self.lockout_duration
    
    def record_successful_login(self, username: str) -> None:
        """记录成功的登录，清除失败记录"""
        with self._lock:
            if username in self._attempts:
                del self._attempts[username]
    
    def is_locked(self, username: str) -> Tuple[bool, int]:
        """
        检查用户是否被锁定
        
        Returns:
            (是否锁定, 剩余锁定时间秒数)
        """
        with self._lock:
            self._cleanup_if_needed()
            
            if username not in self._attempts:
                return False, 0
            
            record = self._attempts[username]
            
            if not record['locked_until']:
                return False, 0
            
            now = datetime.now()
            
            if now < record['locked_until']:
                remaining = int((record['locked_until'] - now).total_seconds())
                return True, remaining
            else:
                # 锁定已过期
                del self._attempts[username]
                return False, 0
    
    def get_remaining_attempts(self, username: str) -> int:
        """获取剩余尝试次数"""
        with self._lock:
            if username not in self._attempts:
                return self.max_attempts
            
            record = self._attempts[username]
            
            # 如果已锁定，返回0
            if record['locked_until'] and datetime.now() < record['locked_until']:
                return 0
            
            return max(0, self.max_attempts - record['attempts'])
    
    def _cleanup_if_needed(self) -> None:
        """清理过期的记录"""
        now = datetime.now()
        
        if now - self._last_cleanup < self.cleanup_interval:
            return
        
        self._last_cleanup = now
        
        # 删除已过期的锁定记录
        expired_users = []
        for username, record in self._attempts.items():
            if record['locked_until'] and now >= record['locked_until']:
                expired_users.append(username)
        
        for username in expired_users:
            del self._attempts[username]
    
    def get_stats(self) -> dict:
        """获取统计信息（用于调试/监控）"""
        with self._lock:
            return {
                'total_tracked': len(self._attempts),
                'locked_count': sum(1 for r in self._attempts.values() 
                                   if r['locked_until'] and datetime.now() < r['locked_until'])
            }


# 创建全局实例
login_attempt_tracker = LoginAttemptTracker(
    max_attempts=5,
    lockout_duration_minutes=15,
    cleanup_interval_minutes=60
)

