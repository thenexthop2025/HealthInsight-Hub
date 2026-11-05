# HealthInsight Hub

[![Status](https://img.shields.io/badge/Status-Beta-orange.svg)](#项目状态)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/部署-Docker%20Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Backend](https://img.shields.io/badge/后端-FastAPI-009688?logo=fastapi&logoColor=white)](backend)
[![Frontend](https://img.shields.io/badge/前端-React-61DAFB?logo=react&logoColor=black)](frontend)

[English](README_EN.md)

**HealthInsight Hub（HIH）** 是一款可自托管的医疗与公共卫生数据分析平台。  
支持本地上传数据集、完成常用统计分析并导出报告，通过 Docker 一键运行，无需云账号。

> **部署范围：** 仅面向本地 / 自托管环境。  
> **当前版本：Beta。** 平台主流程可用，但部分统计分析算法仍在校准与完善中，结果请勿直接用于正式科研结论或临床决策。

---

## 项目状态

本仓库当前发布的是 **Beta** 版本，主要目标是完成本地可运行的端到端演示与架构验证。

| 模块 | 状态 | 说明 |
|------|------|------|
| 本地 Docker 部署 | 可用 | `./start.sh` 一键启动 |
| 用户认证 / 权限 | 可用 | 含默认管理员，请首次登录后改密 |
| 数据集上传与管理 | 可用 | 支持常见表格/统计软件格式 |
| 数据清洗与预处理 | 可用 | 基础能力已接通 |
| 统计分析算法 | **调试中** | 部分方法的实现、边界条件与结果校验仍需完善 |
| 报告导出 | 可用 | 输出内容随分析方法成熟度变化 |

欢迎试用与反馈。若发现统计结果异常、与 SPSS / R 等工具不一致，请优先通过 Issue 反馈复现步骤。

---

## 功能特性

- **数据集管理** — 支持上传与管理 CSV / Excel / SPSS / Stata / SAS 等格式
- **统计分析** — 描述统计、相关分析、卡方检验、线性/逻辑回归、分层分析、孟德尔随机化等
- **数据准备** — 清洗、质量检查、预处理与格式转换
- **报告导出** — 分析结果可导出为 PDF / DOCX
- **权限控制** — 基于 JWT 的认证与角色权限
- **一键部署** — Docker Compose 同时启动 PostgreSQL、后端 API 与前端界面

---

## 系统架构

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React 前端 │────▶│  FastAPI 后端    │────▶│  PostgreSQL 15  │
│  (Nginx)    │     │  (Uvicorn)       │     │                 │
│  :3000      │     │  :8000           │     │  :5432          │
└─────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                        本地上传 / 报告文件
```

| 层级 | 技术栈 |
|------|--------|
| 前端 | React 18、TypeScript、Ant Design、ECharts |
| 后端 | FastAPI、SQLAlchemy、Pandas / SciPy / Statsmodels / scikit-learn |
| 数据库 | PostgreSQL 15 |
| 运行环境 | Docker Compose |

---

## 环境要求

- Docker Engine **20.10+**（或 Docker Desktop）
- Docker Compose **v2**
- 建议配置：**4 GB** 内存，**20 GB** 磁盘空间

---

## 快速开始

```bash
git clone https://github.com/thenexthop2025/HealthInsight-Hub.git
cd HealthInsight-Hub

cp env.example .env
# 请编辑 .env，至少设置 POSTGRES_PASSWORD 与 SECRET_KEY
# 也可执行：./generate-env.sh

./start.sh
```

| 服务 | 地址 |
|------|------|
| 前端界面 | http://localhost:3000 |
| 后端 API | http://localhost:8000 |
| API 文档（Swagger） | http://localhost:8000/docs |

### 默认管理员账号

| 项目 | 值 |
|------|------|
| 用户名 | `admin` |
| 密码 | `Admin@123` |

首次登录后请立即修改密码。

---

## 配置说明

将 [`env.example`](env.example) 复制为 `.env`。**切勿将 `.env` 提交到 Git。**

| 变量 | 说明 |
|------|------|
| `POSTGRES_DB` | 数据库名称 |
| `POSTGRES_USER` | 数据库用户 |
| `POSTGRES_PASSWORD` | 数据库密码（正式使用务必修改） |
| `DATABASE_URL` | 数据库连接串（Compose 内主机名为 `postgres`） |
| `SECRET_KEY` | JWT 签名密钥（请使用足够长的随机字符串） |
| `ALLOWED_ORIGINS` | CORS 允许来源（默认 `http://localhost:3000`） |
| `TZ` | 时区（默认 `Asia/Shanghai`） |
| `MAX_FILE_SIZE` | 上传文件大小限制（字节） |

上传文件默认保存在本地文件系统（`uploads/` volume）。云对象存储为可选能力，默认关闭。

---

## 日常运维

```bash
docker compose ps                 # 查看状态
docker compose logs -f backend    # 后端日志
docker compose logs -f frontend   # 前端日志
docker compose restart backend    # 重启后端
docker compose down               # 停止（保留数据卷）
docker compose down -v            # 停止并删除数据（危险操作）
```

---

## 目录结构

```text
.
├── backend/              # FastAPI 后端
├── frontend/             # React 前端
├── database/init.sql     # 数据库初始化脚本
├── docs/                 # 部署说明
├── docker-compose.yml    # 本地编排配置
├── start.sh              # 一键启动脚本
├── generate-env.sh       # 交互式生成 .env
├── env.example           # 环境变量模板
├── README_EN.md          # English README
└── LICENSE
```

---

## 文档

- [本地部署指南](docs/Deployment.md)
- 在线 API 文档：启动后访问 `http://localhost:8000/docs`

---

## 安全提示

- 默认管理员账号仅用于**首次启动**，请尽快修改
- 妥善保管 `.env`；若密钥曾泄露，请轮换 `SECRET_KEY` 与数据库密码
- 请勿将含真实患者隐私的数据随仓库公开发布
- 若需对公网开放，请自行配置 HTTPS、防火墙与访问控制

---

## 免责声明

HealthInsight Hub 是面向研究与数据分析的工具软件，当前为 **Beta** 版本。  
统计分析结果可能仍存在偏差或未覆盖全部边界情况，**请勿**将本软件输出作为正式科研发表、临床诊断或治疗决策的唯一依据。  
它**不是**经认证的医疗器械。

---

## 许可证

本项目基于 [MIT License](LICENSE) 开源发布。
