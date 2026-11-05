-- 创建数据库（如果不存在）
SELECT 'CREATE DATABASE disease_analysis'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'disease_analysis')\gexec

-- 使用数据库
\c disease_analysis;

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('doctor', 'researcher', 'public_health', 'admin')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 创建数据源表
CREATE TABLE IF NOT EXISTS data_sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    api_endpoint VARCHAR(255),
    data_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建数据集表
CREATE TABLE IF NOT EXISTS datasets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    data_source_id INTEGER REFERENCES data_sources(id),
    owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    file_path VARCHAR(255),
    record_count INTEGER,
    columns_info TEXT, -- JSON string of column metadata
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- 创建分析表
CREATE TABLE IF NOT EXISTS analyses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    user_id INTEGER REFERENCES users(id),
    dataset_id INTEGER REFERENCES datasets(id),
    analysis_type VARCHAR(50) NOT NULL,
    parameters TEXT, -- JSON string of analysis parameters
    results TEXT, -- JSON string of analysis results
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 创建报告表
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT,
    user_id INTEGER REFERENCES users(id),
    analysis_id INTEGER REFERENCES analyses(id),
    file_path VARCHAR(255),
    report_type VARCHAR(20) DEFAULT 'pdf' CHECK (report_type IN ('pdf', 'word', 'excel')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_datasets_owner ON datasets(owner_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_dataset_id ON analyses(dataset_id);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_analysis_id ON reports(analysis_id);

-- 插入默认数据源
INSERT INTO data_sources (name, description, data_type) VALUES
('CDC疾病数据', '美国疾病控制与预防中心疾病数据', 'disease'),
('WHO健康数据', '世界卫生组织健康统计数据', 'disease'),
('国家卫健委数据', '中国国家卫生健康委员会数据', 'disease'),
('生活习惯调查', '居民生活习惯调查数据', 'lifestyle'),
('人口统计数据', '人口普查和统计年鉴数据', 'demographic')
ON CONFLICT DO NOTHING;

-- 默认管理员由 backend/init_db.py 在首次启动时创建（用户名 admin / 密码 Admin@123）
-- 请登录后立即修改密码
