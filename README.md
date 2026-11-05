# HealthInsight Hub (HIH)

智能医疗数据分析平台。本仓库面向 **本地 Docker 部署**（PostgreSQL + FastAPI + React）。

## 快速开始

### 要求

- Docker Desktop / Docker Engine 20.10+
- Docker Compose v2

### 启动

```bash
# 1. 配置环境变量（二选一）
cp env.example .env
# 或交互生成：
./generate-env.sh

# 2. 启动（PostgreSQL + Backend + Frontend）
./start.sh
```

启动成功后：

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:3000 |
| 后端 API | http://localhost:8000 |
| API 文档 | http://localhost:8000/docs |

默认管理员（**登录后请立即修改密码**）：

- 用户名：`admin`
- 密码：`Admin@123`

### 常用命令

```bash
docker compose logs -f backend   # 后端日志
docker compose logs -f frontend  # 前端日志
docker compose ps                # 服务状态
docker compose down              # 停止
```

## 项目结构

```
HIH/
├── backend/          # FastAPI 后端
├── frontend/         # React 前端
├── database/         # PostgreSQL 初始化 SQL
├── docs/             # 产品 / 技术文档
├── docker-compose.yml
├── start.sh          # 一键启动
└── env.example       # 环境变量模板
```

## 配置说明

敏感配置放在 `.env`（已加入 `.gitignore`，**不要提交到 Git**）：

- `POSTGRES_*` / `DATABASE_URL`：数据库
- `SECRET_KEY`：JWT 签名密钥（请使用随机长字符串）
- `ALLOWED_ORIGINS`：前端来源 CORS

文件默认保存在本地 `uploads/` 目录，无需云存储。

## 文档

更多说明见 [`docs/README.md`](docs/README.md)：

- [部署指南（本地）](docs/Deployment.md)
- [技术设计](docs/TechnicalDesign.md)
- [API 参考](docs/API.md)
- [产品需求](docs/PRD.md)

## 许可证

见 [LICENSE](LICENSE)。
