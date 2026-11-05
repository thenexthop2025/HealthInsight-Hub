"""
数据验证工具模块
包含密码、邮箱等验证功能
"""
import re
from typing import Tuple, List


class PasswordValidator:
    """密码验证器"""
    
    # 常见弱密码列表
    COMMON_PASSWORDS = {
        'password', '123456', '12345678', 'qwerty', 'abc123', 
        'monkey', '1234567', 'letmein', 'trustno1', 'dragon',
        'baseball', 'iloveyou', 'master', 'sunshine', 'ashley',
        'bailey', 'passw0rd', 'shadow', '123123', '654321',
        'superman', 'qazwsx', 'michael', 'football', 'admin',
        'admin123', 'root', 'toor', 'pass', 'test'
    }
    
    def __init__(
        self, 
        min_length: int = 8,
        max_length: int = 72,  # bcrypt 限制
        require_uppercase: bool = True,
        require_lowercase: bool = True,
        require_digit: bool = True,
        require_special: bool = True
    ):
        self.min_length = min_length
        self.max_length = max_length
        self.require_uppercase = require_uppercase
        self.require_lowercase = require_lowercase
        self.require_digit = require_digit
        self.require_special = require_special
    
    def validate(self, password: str) -> Tuple[bool, List[str]]:
        """
        验证密码强度
        
        Args:
            password: 待验证的密码
            
        Returns:
            (是否有效, 错误信息列表)
        """
        errors = []
        
        # 检查长度
        if len(password) < self.min_length:
            errors.append(f"密码长度至少需要 {self.min_length} 个字符")
        
        if len(password) > self.max_length:
            errors.append(f"密码长度不能超过 {self.max_length} 个字符")
        
        # 检查大写字母
        if self.require_uppercase and not re.search(r'[A-Z]', password):
            errors.append("密码必须包含至少一个大写字母")
        
        # 检查小写字母
        if self.require_lowercase and not re.search(r'[a-z]', password):
            errors.append("密码必须包含至少一个小写字母")
        
        # 检查数字
        if self.require_digit and not re.search(r'\d', password):
            errors.append("密码必须包含至少一个数字")
        
        # 检查特殊字符
        if self.require_special and not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;~`]', password):
            errors.append("密码必须包含至少一个特殊字符 (!@#$%^&*等)")
        
        # 检查是否是常见弱密码
        if password.lower() in self.COMMON_PASSWORDS:
            errors.append("密码过于简单，请使用更复杂的密码")
        
        # 检查是否包含连续字符
        if self._has_sequential_chars(password):
            errors.append("密码不应包含过多连续或重复字符")
        
        return len(errors) == 0, errors
    
    def _has_sequential_chars(self, password: str, threshold: int = 4) -> bool:
        """检查是否包含连续或重复字符"""
        # 检查连续重复字符 (如: aaaa, 1111)
        for i in range(len(password) - threshold + 1):
            if len(set(password[i:i+threshold])) == 1:
                return True
        
        # 检查连续递增/递减 (如: abcd, 1234, dcba, 4321)
        for i in range(len(password) - threshold + 1):
            substr = password[i:i+threshold]
            if self._is_sequential(substr):
                return True
        
        return False
    
    def _is_sequential(self, s: str) -> bool:
        """检查字符串是否是连续的"""
        if len(s) < 2:
            return False
        
        # 尝试转换为数字序列
        try:
            nums = [int(c) for c in s]
            diffs = [nums[i+1] - nums[i] for i in range(len(nums)-1)]
            return all(d == 1 for d in diffs) or all(d == -1 for d in diffs)
        except ValueError:
            pass
        
        # 检查字母序列
        if s.isalpha():
            ascii_vals = [ord(c) for c in s]
            diffs = [ascii_vals[i+1] - ascii_vals[i] for i in range(len(ascii_vals)-1)]
            return all(d == 1 for d in diffs) or all(d == -1 for d in diffs)
        
        return False


class EmailValidator:
    """邮箱验证器"""
    
    # RFC 5322 简化版邮箱正则
    EMAIL_PATTERN = re.compile(
        r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    )
    
    @classmethod
    def validate(cls, email: str) -> Tuple[bool, str]:
        """
        验证邮箱格式
        
        Args:
            email: 待验证的邮箱
            
        Returns:
            (是否有效, 错误信息)
        """
        if not email:
            return False, "邮箱不能为空"
        
        if len(email) > 254:  # RFC 5321
            return False, "邮箱地址过长"
        
        if not cls.EMAIL_PATTERN.match(email):
            return False, "邮箱格式不正确"
        
        # 检查本地部分长度
        local_part = email.split('@')[0]
        if len(local_part) > 64:  # RFC 5321
            return False, "邮箱用户名部分过长"
        
        return True, ""


# 创建默认验证器实例
password_validator = PasswordValidator(
    min_length=8,
    max_length=72,
    require_uppercase=True,
    require_lowercase=True,
    require_digit=True,
    require_special=True
)

email_validator = EmailValidator()

