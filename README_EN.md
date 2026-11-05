# HealthInsight Hub

[![Status](https://img.shields.io/badge/Status-Beta-orange.svg)](#project-status)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Backend](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)](backend)
[![Frontend](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=black)](frontend)

[中文](README.md)

**HealthInsight Hub (HIH)** is a self-hosted platform for medical and public-health data analysis.
Upload datasets, run common statistical workflows, and generate reports — all on your own machine via Docker.

> **Scope:** local / self-hosted deployment only. No cloud account is required.  
> **Current release: Beta.** The main workflows run, but some statistical algorithms are still being calibrated. Do not treat outputs as final research or clinical evidence.

---

## Project Status

This repository currently ships a **Beta** release. The goal is a runnable local end-to-end demo and architecture validation.

| Area | Status | Notes |
|------|--------|-------|
| Local Docker deployment | Available | One-command `./start.sh` |
| Auth / roles | Available | Change the default admin password after first login |
| Dataset upload & management | Available | Common spreadsheet / stats-software formats |
| Cleaning & preprocessing | Available | Baseline flows are wired up |
| Statistical algorithms | **In progress** | Implementations, edge cases, and result validation still need work |
| Report export | Available | Output quality depends on the maturity of each analysis method |

Feedback is welcome. If results look wrong or diverge from SPSS / R, please open an Issue with reproduction steps.

---

## Features

- **Dataset management** — upload and manage CSV / Excel / SPSS / Stata / SAS files
- **Statistical analysis** — descriptive stats, correlation, chi-square, linear & logistic regression, stratified analysis, Mendelian randomization, and more
- **Data preparation** — cleaning, quality checks, preprocessing, and format conversion
- **Reporting** — export analysis outputs as PDF / DOCX
- **Access control** — JWT authentication with role-based permissions
- **One-command setup** — PostgreSQL + API + Web UI via Docker Compose

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  React UI   │────▶│  FastAPI Backend │────▶│  PostgreSQL 15  │
│  (Nginx)    │     │  (Uvicorn)       │     │                 │
│  :3000      │     │  :8000           │     │  :5432          │
└─────────────┘     └──────────────────┘     └─────────────────┘
                              │
                              ▼
                     local uploads / reports
```

| Layer | Stack |
|-------|--------|
| Frontend | React 18, TypeScript, Ant Design, ECharts |
| Backend | FastAPI, SQLAlchemy, Pandas / SciPy / Statsmodels / scikit-learn |
| Database | PostgreSQL 15 |
| Runtime | Docker Compose |

---

## Requirements

- Docker Engine **20.10+** (or Docker Desktop)
- Docker Compose **v2**
- Recommended: **4 GB** RAM, **20 GB** disk

---

## Quick Start

```bash
git clone https://github.com/thenexthop2025/HealthInsight-Hub.git
cd HealthInsight-Hub

cp env.example .env
# Edit .env — set POSTGRES_PASSWORD and SECRET_KEY at minimum
# Or run: ./generate-env.sh

./start.sh
```

| Service | URL |
|---------|-----|
| Web UI | http://localhost:3000 |
| API | http://localhost:8000 |
| OpenAPI (Swagger) | http://localhost:8000/docs |

### Default admin account

| Field | Value |
|-------|--------|
| Username | `admin` |
| Password | `Admin@123` |

Change this password immediately after the first login.

---

## Configuration

Copy [`env.example`](env.example) to `.env`. **Never commit `.env`.**

| Variable | Description |
|----------|-------------|
| `POSTGRES_DB` | Database name |
| `POSTGRES_USER` | Database user |
| `POSTGRES_PASSWORD` | Database password (**required in production-like use**) |
| `DATABASE_URL` | SQLAlchemy URL (host is `postgres` inside Compose) |
| `SECRET_KEY` | JWT signing key (use a long random string) |
| `ALLOWED_ORIGINS` | CORS allowlist (default: `http://localhost:3000`) |
| `TZ` | Timezone (default: `Asia/Shanghai`) |
| `MAX_FILE_SIZE` | Upload size limit in bytes |

Uploaded files are stored on the local filesystem (`uploads/` volume). Cloud object storage is optional and disabled by default.

---

## Operations

```bash
docker compose ps                 # status
docker compose logs -f backend    # API logs
docker compose logs -f frontend   # UI logs
docker compose restart backend    # restart API
docker compose down               # stop (keep volumes)
docker compose down -v            # stop and delete data (destructive)
```

---

## Repository Layout

```text
.
├── backend/              # FastAPI application
├── frontend/             # React application
├── database/init.sql     # Schema bootstrap
├── docs/                 # Deployment notes
├── docker-compose.yml    # Local stack
├── start.sh              # One-click launcher
├── generate-env.sh       # Interactive .env helper
├── env.example           # Environment template
├── README.md             # Chinese README
└── LICENSE
```

---

## Documentation

- [Local deployment guide](docs/Deployment.md)
- Interactive API docs: `http://localhost:8000/docs` (after start)

---

## Security Notes

- Default admin credentials are for **first-run convenience only**
- Keep `.env` private; rotate `SECRET_KEY` and database passwords if they are ever exposed
- Do not publish real patient-identifiable datasets with this repository
- If you expose the stack beyond localhost, put TLS and network access controls in front of it yourself

---

## Disclaimer

HealthInsight Hub is a research / analytics toolkit in **Beta**.
Statistical outputs may still be incomplete or inaccurate for some cases. Do **not** rely on them as the sole basis for formal publication, clinical diagnosis, or treatment decisions.
It is **not** a certified medical device.

---

## License

This project is released under the [MIT License](LICENSE).
