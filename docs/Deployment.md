# HealthInsight Hub - 本地部署指南

本项目仅支持 **本地 / 自托管 Docker Compose** 部署。

## 系统要求

| 项目 | 最低要求 |
|------|----------|
| CPU | 2 核 |
| 内存 | 4 GB |
| 磁盘 | 20 GB |
| Docker | 20.10+ |
| Docker Compose | v2 |

## 快速部署

```bash
cp env.example .env          # 或 ./generate-env.sh
# 编辑 .env：设置 POSTGRES_PASSWORD、SECRET_KEY
./start.sh
```

访问：

- 前端：http://localhost:3000
- 后端：http://localhost:8000
- Swagger：http://localhost:8000/docs

默认管理员：`admin` / `Admin@123`（登录后立刻改密）。

## 服务组成

| 服务 | 容器名 | 端口 |
|------|--------|------|
| PostgreSQL 15 | `disease_analysis_db` | 5432 |
| FastAPI 后端 | `disease_analysis_backend` | 8000 |
| React 前端 (Nginx) | `disease_analysis_frontend` | 3000→80 |

异步任务使用 FastAPI `BackgroundTasks`，**不需要** Redis / Celery。

## 环境变量

以 `env.example` 为准，核心项：

| 变量 | 说明 |
|------|------|
| `POSTGRES_DB` / `USER` / `PASSWORD` | 数据库账号 |
| `DATABASE_URL` | 后端连接串（容器内主机名为 `postgres`） |
| `SECRET_KEY` | JWT 密钥，至少 32 位随机串 |
| `ALLOWED_ORIGINS` | CORS 白名单 |
| `TZ` | 时区，默认 `Asia/Shanghai` |

`.env` 仅用于本机，切勿提交到版本库。

## 数据与文件

- 数据库数据：Docker volume `postgres_data`
- 上传文件：volume `uploads_data`（本地文件系统）
- 生成报告：volume `reports_data`

备份示例：

```bash
docker exec disease_analysis_db pg_dump -U postgres disease_analysis > backup.sql
```

恢复示例：

```bash
cat backup.sql | docker exec -i disease_analysis_db psql -U postgres -d disease_analysis
```

## 日常运维

```bash
docker compose ps
docker compose logs -f backend
docker compose restart backend
docker compose down          # 停止（保留 volume）
docker compose down -v       # 停止并删除数据（危险）
```

首次空库时，`./start.sh` 会调用 `backend/init_db.py` 建表并创建管理员。

## 安全建议

1. 修改默认管理员密码
2. 使用强 `POSTGRES_PASSWORD` 与 `SECRET_KEY`
3. 不要把 `.env`、真实数据集或上传文件提交到 Git
4. 若对公网暴露，请自行加反向代理、HTTPS 与防火墙

## 故障排查

| 现象 | 处理 |
|------|------|
| Docker 无法连接 | 先启动 Docker Desktop |
| 数据库未就绪 | `docker compose logs postgres`，等待 healthy |
| 后端 5xx | `docker compose logs backend` |
| 前端空白 | 确认后端 `http://localhost:8000/health` 返回 healthy |
| 忘记管理员密码 | 进入后端容器执行重置，或清空 volume 后重新 `./start.sh` |

```bash
docker exec -it disease_analysis_backend python -c "
from database import SessionLocal
from models import User
from auth import get_password_hash
db = SessionLocal()
u = db.query(User).filter_by(username='admin').one()
u.hashed_password = get_password_hash('Admin@123')
db.commit()
print('password reset')
"
```
