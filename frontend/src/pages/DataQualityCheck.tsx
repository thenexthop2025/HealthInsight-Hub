/**
 * 数据质量检查页面
 */

import React, { useState } from 'react';
import {
  Card,
  Form,
  Select,
  Button,
  Typography,
  Row,
  Col,
  Statistic,
  Progress,
  Alert,
  Table,
  Tag,
  Spin,
  message,
  Tooltip,
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useQuery } from 'react-query';
import { dataAPI } from '../services/api';
import api from '../services/api';
import PageContainer from '../components/PageContainer';
import PageHero from '../components/PageHero';

const { Text, Paragraph } = Typography;
const { Option } = Select;

interface DataQualityCheckProps {}

interface QualityReport {
  overall_score: number;
  data_completeness: {
    total_rows: number;
    missing_data_summary: {
      total_missing_cells: number;
      total_cells: number;
      overall_missing_ratio: number;
    };
    column_completeness: Record<string, {
      missing_count: number;
      missing_ratio: number;
      completeness_ratio: number;
    }>;
    critical_columns: Array<{
      column: string;
      missing_ratio: number;
      severity: string;
    }>;
  };
  variable_analysis: {
    variable_types: Record<string, string>;
    numeric_analysis: Record<string, any>;
    categorical_analysis: Record<string, any>;
  };
  medical_validations: {
    age_validation: Record<string, any>;
    gender_validation: Record<string, any>;
    value_ranges: Record<string, any>;
    consistency_checks: {
      duplicate_rows: number;
      duplicate_ratio: number;
    };
  };
  recommendations: string[];
}

const DataQualityCheck: React.FC<DataQualityCheckProps> = () => {
  const [form] = Form.useForm();
  const [selectedDataset, setSelectedDataset] = useState<number | null>(null);
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(false);

  // 获取数据集列表
  const { data: datasetsResponse } = useQuery('datasets', () => dataAPI.getDatasets());
  const datasets = datasetsResponse?.data || [];
  const selectedDatasetInfo = datasets.find((dataset: any) => dataset.id === selectedDataset);
  const overallMissingRatio = qualityReport?.data_completeness?.missing_data_summary?.overall_missing_ratio;

  const handleQualityCheck = async (values: any) => {
    if (!values.dataset_id) {
      message.error('请选择数据集');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`/api/medical-preprocessing/quality-check/${values.dataset_id}`);
      if (response.data.success) {
        setQualityReport(response.data.result.quality_report);
        message.success('数据质量检查完成');
      } else {
        message.error('数据质量检查失败');
      }
    } catch (error) {
      message.error('数据质量检查失败');
      console.error('Quality check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a';
    if (score >= 60) return '#faad14';
    return '#ff4d4f';
  };

  const getScoreStatus = (score: number) => {
    if (score >= 80) return '优秀';
    if (score >= 60) return '良好';
    return '需要改进';
  };

  const columns = [
    {
      title: (
        <Tooltip title="数据集中的字段名称。">
          <span>列名</span>
        </Tooltip>
      ),
      dataIndex: 'column',
      key: 'column',
    },
    {
      title: (
        <Tooltip title="该列中缺失（为空/无效）的单元格数量。">
          <span>缺失数量</span>
        </Tooltip>
      ),
      dataIndex: 'missing_count',
      key: 'missing_count',
    },
    {
      title: (
        <Tooltip title="该列缺失单元格数 / 该列总单元格数 × 100%。">
          <span>缺失比例</span>
        </Tooltip>
      ),
      dataIndex: 'missing_ratio',
      key: 'missing_ratio',
      render: (ratio: number) => `${(ratio * 100).toFixed(1)}%`,
    },
    {
      title: (
        <Tooltip title="完整性 = 1 - 缺失比例。越高越好。">
          <span>完整性</span>
        </Tooltip>
      ),
      dataIndex: 'completeness_ratio',
      key: 'completeness_ratio',
      render: (ratio: number) => (
        <Progress
          percent={ratio * 100}
          size="small"
          status={ratio > 0.8 ? 'success' : ratio > 0.6 ? 'normal' : 'exception'}
        />
      ),
    },
  ];

  const criticalColumns = qualityReport?.data_completeness.critical_columns || [];

  const heroStats = [
    { label: '可用数据集', value: datasets.length },
    { label: '最新质量分数', value: qualityReport ? qualityReport.overall_score : '--' },
    {
      label: '缺失比例',
      value:
        qualityReport && typeof overallMissingRatio === 'number'
          ? `${(overallMissingRatio * 100).toFixed(1)}%`
          : '--',
    },
  ];

  return (
    <PageContainer>
      <PageHero
        icon={<DatabaseOutlined className="page-hero__title-icon" />}
        badge="质量守护"
        title="数据质量检查"
        subtitle="检测数据完整性、异常与医学规则，为后续分析提供可靠的数据基线。"
        stats={heroStats}
        meta={
          selectedDatasetInfo ? (
            <span>
              当前数据集：<strong>{selectedDatasetInfo.name}</strong>
            </span>
          ) : undefined
        }
      />

      <Card
        className="page-section-card"
        title={
          <span className="page-section-card__title">
            <CheckCircleOutlined className="page-section-card__title-icon" />
            选择数据集
          </span>
        }
      >
        <Paragraph style={{ color: 'var(--brand-muted)', marginBottom: 20 }}>
          请选择需要进行质量检查的数据集，我们将对缺失情况、变量分布与医学业务规则进行全面评估。
        </Paragraph>
        <Form form={form} layout="inline" onFinish={handleQualityCheck} className="page-toolbar">
          <Form.Item
            name="dataset_id"
            label="数据集"
            rules={[{ required: true, message: '请选择数据集' }]}
            style={{ minWidth: 260 }}
          >
            <Select
              placeholder="请选择要检查质量的数据集"
              onChange={(value) => setSelectedDataset(value)}
              allowClear
            >
              {datasets.map((dataset: any) => (
                <Option key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} icon={<CheckCircleOutlined />}>
              开始质量检查
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {loading && (
        <Card className="page-section-card">
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>正在检查数据质量...</div>
          </div>
        </Card>
      )}

      {qualityReport && (
        <>
          <Card
            className="page-section-card"
            title={<span className="page-section-card__title">总体质量评估</span>}
          >
            <Row gutter={16}>
              <Col span={8}>
                <Tooltip title="综合质量评分（0-100）。基于完整性、异常比率与一致性等指标的加权计算，仅供快速评估。">
                  <Statistic
                    title="质量分数"
                    value={Math.round(qualityReport.overall_score * 10) / 10}
                    suffix="/ 100"
                    valueStyle={{ color: getScoreColor(qualityReport.overall_score) }}
                  />
                </Tooltip>
              </Col>
              <Col span={8}>
                <Tooltip title="将质量分数映射为状态：≥80 优秀，60-79 良好，＜60 需要改进。">
                  <Statistic
                    title="数据状态"
                    value={getScoreStatus(qualityReport.overall_score)}
                    valueStyle={{ color: getScoreColor(qualityReport.overall_score) }}
                  />
                </Tooltip>
              </Col>
              <Col span={8}>
                <Tooltip title="数据集中记录的总行数（样本数）。">
                  <Statistic
                    title="总行数"
                    value={qualityReport.data_completeness.total_rows}
                  />
                </Tooltip>
              </Col>
            </Row>
          </Card>

          {/* 数据完整性 */}
          <Card
            className="page-section-card"
            title={<span className="page-section-card__title">数据完整性</span>}
          >
            <Row gutter={16}>
              <Col span={6}>
                <Tooltip title="全表中缺失（为空/无效）的单元格数量。">
                  <Statistic
                    title="缺失单元格"
                    value={qualityReport.data_completeness.missing_data_summary.total_missing_cells}
                  />
                </Tooltip>
              </Col>
              <Col span={6}>
                <Tooltip title="总单元格 = 行数 × 列数。">
                  <Statistic
                    title="总单元格"
                    value={qualityReport.data_completeness.missing_data_summary.total_cells}
                  />
                </Tooltip>
              </Col>
              <Col span={6}>
                <Tooltip title="缺失比例 = 缺失单元格 / 总单元格 × 100%。">
                  <Statistic
                    title="缺失比例"
                    value={qualityReport.data_completeness.missing_data_summary.overall_missing_ratio * 100}
                    suffix="%"
                    precision={1}
                  />
                </Tooltip>
              </Col>
              <Col span={6}>
                <Tooltip title="完全重复的记录行数（用于衡量一致性与去重需求）。">
                  <Statistic
                    title="重复行数"
                    value={qualityReport.medical_validations.consistency_checks.duplicate_rows}
                  />
                </Tooltip>
              </Col>
            </Row>

            {criticalColumns.length > 0 && (
              <Alert
                message="关键列缺失警告"
                description={
                  <div>
                    <p>以下列的缺失率过高，需要重点关注：</p>
                    <ul>
                      {criticalColumns.map((col, index) => (
                        <li key={index}>
                          <strong>{col.column}</strong>: 缺失率 {(col.missing_ratio * 100).toFixed(1)}%
                          <Tag
                            className={col.severity === 'high' ? 'tag-pastel-pink' : 'tag-pastel-yellow'}
                            style={{ marginLeft: 8 }}
                          >
                            {col.severity === 'high' ? '严重' : '中等'}
                          </Tag>
                        </li>
                      ))}
                    </ul>
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginTop: 16 }}
              />
            )}
          </Card>

          {/* 列完整性详情 */}
          <Card
            className="page-section-card"
            title={<span className="page-section-card__title">列完整性详情</span>}
          >
            <Table
              columns={columns}
              dataSource={Object.entries(qualityReport.data_completeness.column_completeness).map(([column, data]) => ({
                key: column,
                column,
                ...data,
              }))}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>

          {/* 变量分析 */}
          <Card
            className="page-section-card"
            title={<span className="page-section-card__title">变量分析</span>}
          >
            <Row gutter={16}>
              <Col span={8}>
                <Card size="small" title="数值变量">
                  <div>
                    {Object.entries(qualityReport.variable_analysis.numeric_analysis).map(([col, data]) => (
                      <div key={col} style={{ marginBottom: 8 }}>
                        <Text strong>{col}</Text>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          均值: {data.mean?.toFixed(2) || 'N/A'} | 
                          标准差: {data.std?.toFixed(2) || 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title="分类变量">
                  <div>
                    {Object.entries(qualityReport.variable_analysis.categorical_analysis).map(([col, data]) => (
                      <div key={col} style={{ marginBottom: 8 }}>
                        <Text strong>{col}</Text>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          唯一值: {data.unique_count} | 
                          最频繁: {data.most_frequent || 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small" title="变量类型分布">
                  <div>
                    {Object.entries(qualityReport.variable_analysis.variable_types).map(([col, type]) => (
                      <div key={col} style={{ marginBottom: 4 }}>
                        <Text>{col}: </Text>
                        <Tag
                          className=
                            {type === 'numeric'
                              ? 'tag-pastel-blue'
                              : type === 'categorical'
                              ? 'tag-pastel-mint'
                              : 'tag-pastel-yellow'}
                        >
                          {type === 'numeric' ? '数值型' : type === 'categorical' ? '分类型' : '时间型'}
                        </Tag>
                      </div>
                    ))}
                  </div>
                </Card>
              </Col>
            </Row>
          </Card>

          {/* 建议 */}
          {qualityReport.recommendations.length > 0 && (
            <Card
              className="page-section-card"
              title={<span className="page-section-card__title">改进建议</span>}
            >
              <ul>
                {qualityReport.recommendations.map((recommendation, index) => (
                  <li key={index} style={{ marginBottom: 8 }}>
                    <ExclamationCircleOutlined style={{ color: '#1890ff', marginRight: 8 }} />
                    {recommendation}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </PageContainer>
  );
};

export default DataQualityCheck;
