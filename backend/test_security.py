"""
安全功能测试脚本
测试密码验证、登录限制、Token刷新等功能
"""
from utils.validators import password_validator, email_validator
from utils.rate_limiter import login_attempt_tracker


def test_password_validator():
    """测试密码验证器"""
    print("=" * 60)
    print("测试密码验证器")
    print("=" * 60)
    
    test_cases = [
        ("weak", False, "弱密码"),
        ("12345678", False, "只有数字"),
        ("password", False, "常见密码"),
        ("Password1", False, "缺少特殊字符"),
        ("Pass@123", True, "合格密码"),
        ("MyP@ssw0rd2024", True, "强密码"),
        ("admin123", False, "常见密码"),
    ]
    
    for password, expected_valid, desc in test_cases:
        is_valid, errors = password_validator.validate(password)
        status = "✅" if is_valid == expected_valid else "❌"
        print(f"{status} {desc}: '{password}' - {'有效' if is_valid else '无效'}")
        if errors:
            for error in errors:
                print(f"   - {error}")
    print()


def test_email_validator():
    """测试邮箱验证器"""
    print("=" * 60)
    print("测试邮箱验证器")
    print("=" * 60)
    
    test_cases = [
        ("test@example.com", True, "标准邮箱"),
        ("invalid.email", False, "缺少@"),
        ("test@", False, "缺少域名"),
        ("@example.com", False, "缺少用户名"),
        ("test@@example.com", False, "多个@"),
        ("user.name+tag@example.co.uk", True, "复杂邮箱"),
    ]
    
    for email, expected_valid, desc in test_cases:
        is_valid, error = email_validator.validate(email)
        status = "✅" if is_valid == expected_valid else "❌"
        print(f"{status} {desc}: '{email}' - {'有效' if is_valid else '无效'}")
        if error:
            print(f"   - {error}")
    print()


def test_login_limiter():
    """测试登录限制器"""
    print("=" * 60)
    print("测试登录限制器")
    print("=" * 60)
    
    username = "test_user"
    
    # 测试5次失败尝试
    print(f"模拟用户 '{username}' 的登录失败尝试:")
    for i in range(1, 6):
        login_attempt_tracker.record_failed_attempt(username)
        remaining = login_attempt_tracker.get_remaining_attempts(username)
        is_locked, lock_time = login_attempt_tracker.is_locked(username)
        
        if is_locked:
            print(f"尝试 {i}: ❌ 账户已被锁定 (剩余锁定时间: {lock_time}秒)")
        else:
            print(f"尝试 {i}: ❌ 失败 (剩余尝试次数: {remaining})")
    
    # 验证账户被锁定
    is_locked, remaining_time = login_attempt_tracker.is_locked(username)
    print(f"\n最终状态: {'🔒 已锁定' if is_locked else '✅ 未锁定'}")
    if is_locked:
        print(f"剩余锁定时间: {remaining_time // 60}分{remaining_time % 60}秒")
    
    # 测试成功登录清除记录
    print(f"\n模拟成功登录...")
    login_attempt_tracker.record_successful_login(username)
    remaining = login_attempt_tracker.get_remaining_attempts(username)
    print(f"成功登录后剩余尝试次数: {remaining}")
    
    # 查看统计
    stats = login_attempt_tracker.get_stats()
    print(f"\n登录限制器统计:")
    print(f"  - 追踪的用户数: {stats['total_tracked']}")
    print(f"  - 被锁定的用户数: {stats['locked_count']}")
    print()


if __name__ == "__main__":
    print("\n")
    print("╔════════════════════════════════════════════════════════════╗")
    print("║          安全功能测试                                      ║")
    print("╚════════════════════════════════════════════════════════════╝")
    print()
    
    test_password_validator()
    test_email_validator()
    test_login_limiter()
    
    print("=" * 60)
    print("✅ 所有测试完成！")
    print("=" * 60)
