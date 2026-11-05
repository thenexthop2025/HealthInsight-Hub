#!/bin/bash

# =============================================================================
# HealthInsight Hub - 启动脚本（精简版）
# =============================================================================
# 
# 此脚本启动核心服务：
#   - PostgreSQL (数据库)
#   - Backend API (FastAPI)
#   - Frontend (React)
#
# 不包括：
#   - Redis
#   - Celery Workers
#
# 使用 FastAPI BackgroundTasks 处理异步任务
#
# =============================================================================

set -e

echo "🚀 启动 HealthInsight Hub（精简版）..."
echo ""

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ 错误：Docker 未运行"
    echo "   请先启动 Docker Desktop"
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "⚠️  .env 文件不存在"
    echo "   从 env.example 创建..."
    cp env.example .env
    echo "   ✅ .env 文件已创建"
    echo "   ⚠️  请编辑 .env 文件，设置必要的环境变量"
    echo ""
fi

# 停止并删除旧容器
echo "🧹 清理旧容器..."
docker compose down 2>/dev/null || true
echo ""

# 启动服务
echo "📦 启动服务（精简版：PostgreSQL + Backend + Frontend）..."
docker compose up -d
echo ""

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo ""
echo "📊 服务状态："
docker compose ps
echo ""

# 等待数据库就绪
echo "⏳ 等待数据库就绪..."
for i in {1..30}; do
    if docker exec disease_analysis_db pg_isready -U postgres > /dev/null 2>&1; then
        echo "✅ 数据库已就绪"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ 数据库启动超时"
        exit 1
    fi
    sleep 1
done
echo ""

# 初始化 / 补全数据库表与默认管理员（幂等）
echo "📝 初始化数据库（如需要）..."
docker exec disease_analysis_backend python init_db.py
echo "✅ 数据库检查完成"
echo ""

# 显示访问信息
echo "═══════════════════════════════════════════════════════════════════════"
echo "✅ HealthInsight Hub 启动成功！"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""
echo "📱 访问地址："
echo "   前端：  http://localhost:3000"
echo "   后端：  http://localhost:8000"
echo "   API文档：http://localhost:8000/docs"
echo ""
echo "🔐 默认管理员账号："
echo "   用户名：admin"
echo "   密码：  Admin@123"
echo "   ⚠️  请登录后立即修改密码！"
echo ""
echo "📊 运行的服务（本地 Docker）："
echo "   ✅ PostgreSQL  (disease_analysis_db)"
echo "   ✅ Backend API (disease_analysis_backend)"
echo "   ✅ Frontend    (disease_analysis_frontend)"
echo ""
echo "ℹ️  使用 FastAPI BackgroundTasks 处理异步任务"
echo "   无需 Redis、Celery 或云服务"
echo ""
echo "📝 查看日志："
echo "   docker compose logs -f backend"
echo "   docker compose logs -f frontend"
echo ""
echo "🛑 停止服务："
echo "   docker compose down"
echo ""
echo "═══════════════════════════════════════════════════════════════════════"

