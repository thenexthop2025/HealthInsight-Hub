from __future__ import annotations

import os
from typing import Tuple

# 简易的文件头魔数映射（仅用于基本校验，并不完全可靠）
MAGIC_NUMBERS = {
    # ZIP 容器（xlsx/xlsm 等现代 Office 使用 zip 容器）
    b"\x50\x4B\x03\x04": {"exts": {".xlsx", ".xlsm", ".zip"}},
    # 旧版 Excel (BIFF)
    b"\xD0\xCF\x11\xE0": {"exts": {".xls"}},
    # UTF-8 BOM 文本
    b"\xEF\xBB\xBF": {"exts": {".csv", ".txt"}},
}

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".sav", ".txt", ".json"}


def sniff_magic(file_path: str, read_len: int = 8) -> bytes:
    """读取文件开头若干字节用于简单的魔数嗅探。"""
    try:
        with open(file_path, "rb") as f:
            return f.read(read_len)
    except Exception:
        return b""


def is_allowed_extension(filename: str) -> bool:
    _, ext = os.path.splitext(filename.lower())
    return ext in ALLOWED_EXTENSIONS


def validate_file(file_path: str, filename: str, max_size_bytes: int) -> Tuple[bool, str]:
    """
    进行基础的文件校验：大小、扩展名、文件头嗅探。
    返回 (是否通过, 错误消息)。
    """
    if not os.path.exists(file_path):
        return False, "文件不存在"

    # 大小校验
    size = os.path.getsize(file_path)
    if size > max_size_bytes:
        return False, f"文件过大，最大允许 {max_size_bytes // (1024 * 1024)}MB"

    # 扩展名白名单
    if not is_allowed_extension(filename):
        return False, "不支持的文件类型"

    # 简单的头部嗅探（可选）
    head = sniff_magic(file_path)
    if head:
        for magic, info in MAGIC_NUMBERS.items():
            if head.startswith(magic):
                # 存在魔数但扩展名与常见容器不匹配时也允许（以扩展名为准）
                break

    return True, ""
