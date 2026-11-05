#!/bin/bash

# 环境变量生成脚本（本地部署）
# 用于快速生成 .env 文件

set -e

echo "🔧 HealthInsight Hub - 环境变量配置生成器（本地部署）"
echo "=============================================="
echo ""

# 检查是否已存在 .env 文件
if [ -f .env ]; then
    read -p "⚠️  .env 文件已存在，是否覆盖？(y/N): " overwrite
    if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
        echo "❌ 已取消"
        exit 0
    fi
fi

# 生成 SECRET_KEY
echo "🔑 生成 SECRET_KEY..."
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")

# 交互式输入
echo ""
echo "📝 请输入配置信息（直接回车使用默认值）："
echo ""

# 数据库配置
read -p "PostgreSQL 数据库名 [disease_analysis]: " POSTGRES_DB
POSTGRES_DB=${POSTGRES_DB:-disease_analysis}

read -p "PostgreSQL 用户名 [postgres]: " POSTGRES_USER
POSTGRES_USER=${POSTGRES_USER:-postgres}

read -p "PostgreSQL 密码 [postgres]: " POSTGRES_PASSWORD
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}

# 时区
read -p "时区 [Asia/Shanghai]: " TZ
TZ=${TZ:-Asia/Shanghai}

# CORS
echo ""
echo "CORS 配置（逗号分隔多个域名）"
read -p "允许的来源 [http://localhost:3000,http://127.0.0.1:3000]: " ALLOWED_ORIGINS
ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-http://localhost:3000,http://127.0.0.1:3000}

# API Keys（可选）
echo ""
echo "API 密钥（可选，直接回车跳过）："
read -p "WHO API Key: " WHO_API_KEY

# 生成 .env 文件
cat > .env << EOF
# Database Configuration
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Backend Configuration
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
SECRET_KEY=${SECRET_KEY}
TZ=${TZ}

# API Keys (Optional)
WHO_API_KEY=${WHO_API_KEY}

# CORS Configuration (comma-separated origins)
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads

# JWT Configuration
ACCESS_TOKEN_EXPIRE_MINUTES=30
ALGORITHM=HS256
EOF

echo ""
echo "✅ .env 文件已生成！"
echo ""
echo "📋 配置摘要："
echo "  数据库: ${POSTGRES_DB}"
echo "  用户名: ${POSTGRES_USER}"
echo "  SECRET_KEY: ${SECRET_KEY:0:20}... (已生成)"
echo "  CORS: ${ALLOWED_ORIGINS}"
echo ""
echo "🔒 重要提示："
echo "  1. 请妥善保管 .env 文件，不要提交到 Git"
echo "  2. 首次登录后请立即修改默认管理员密码（admin / Admin@123）"
echo ""
echo "🚀 下一步："
echo "  运行 ./start.sh 启动服务"
echo ""
