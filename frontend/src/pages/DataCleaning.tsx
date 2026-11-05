/**
 * 数据清洗页面
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
  Alert,
  Table,
  Spin,
  message,
  Checkbox,
  Space,
  Divider,
} from 'antd';
import {
  ToolOutlined,
} from '@ant-design/icons';
import { useQuery } from 'react-query';
import { dataAPI } from '../services/api';
import api from '../services/api';
import PageContainer from '../components/PageContainer';
import PageHero from '../components/PageHero';

const { Text, Paragraph } = Typography;
const { Option } = Select;

interface DataCleaningProps {}

interface CleaningResult {
  original_shape: [number, number];
  cleaned_shape: [number, number];
  cleaning_log: Array<{
    operation: string;
    timestamp: string;
    data_shape: [number, number];
    details: any;
  }>;
  cleaned_data: any;
}

const DataCleaning: React.FC<DataCleaningProps> = () => {
  const [form] = Form.useForm();
  const [selectedDataset, setSelectedDataset] = useState<number | null>(null);
  const [cleaningResult, setCleaningResult] = useState<CleaningResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaningConfig, setCleaningConfig] = useState({
    handle_missing: true,
    missing_strategy: 'medical_fill',
    handle_outliers: true,
    outlier_strategy: 'remove',
    standardize_medical_vars: true,
    handle_duplicates: true,
    convert_types: true,
  });

  // 获取数据集列表
  const { data: datasetsResponse } = useQuery('datasets', () => dataAPI.getDatasets());
  const datasets = datasetsResponse?.data || [];
  const selectedDatasetInfo = datasets.find((dataset: any) => dataset.id === selectedDataset);
  const retentionRatio =
    cleaningResult && cleaningResult.original_shape[0]
      ? (cleaningResult.cleaned_shape[0] / cleaningResult.original_shape[0]) * 100
      : null;
  const enabledRules = ['handle_missing', 'handle_outliers', 'standardize_medical_vars', 'handle_duplicates', 'convert_types'].filter(
    (key) => (cleaningConfig as any)[key]
  ).length;

  const handleDataCleaning = async (values: any) => {
    if (!values.dataset_id) {
      message.error('请选择数据集');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`/api/medical-preprocessing/data-cleaning/${values.dataset_id}`, cleaningConfig);
      if (response.data.success) {
        setCleaningResult(response.data.result.cleaning_result);
        message.success('数据清洗完成');
      } else {
        message.error('数据清洗失败');
      }
    } catch (error) {
      message.error('数据清洗失败');
      console.error('Data cleaning error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (key: string, value: any) => {
    setCleaningConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const cleaningLogColumns = [
    {
      title: '操作',
      dataIndex: 'operation',
      key: 'operation',
      render: (operation: string) => {
        const operationMap: Record<string, string> = {
          'drop_missing_values': '删除缺失值',
          'medical_fill_missing_values': '医学填充缺失值',
          'drop_high_missing_columns': '删除高缺失列',
          'remove_outliers': '删除异常值',
          'cap_outliers': '限制异常值',
          'standardize_gender': '标准化性别',
          'standardize_age': '标准化年龄',
          'remove_duplicates': '删除重复数据',
          'convert_data_types': '转换数据类型',
        };
        return operationMap[operation] || operation;
      },
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: (timestamp: string) => new Date(timestamp).toLocaleString(),
    },
    {
      title: '数据形状',
      dataIndex: 'data_shape',
      key: 'data_shape',
      render: (shape: [number, number]) => `${shape[0]} 行 × ${shape[1]} 列`,
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      render: (details: any) => (
        <div>
          {Object.entries(details).map(([key, value]) => (
            <div key={key} style={{ fontSize: '12px' }}>
              <Text strong>{key}:</Text> {JSON.stringify(value)}
            </div>
          ))}
        </div>
      ),
    },
  ];

  const heroStats = [
    { label: '可用数据集', value: datasets.length },
    { label: '启用规则', value: `${enabledRules} 项` },
    {
      label: '最新保留率',
      value: retentionRatio !== null ? `${retentionRatio.toFixed(1)}%` : '--',
    },
  ];

  return (
    <PageContainer>
      <PageHero
        icon={<ToolOutlined className="page-hero__title-icon" />}
        badge="医学清洗"
        title="数据清洗"
        subtitle="自动处理缺失值、异常值与医学规则，提升数据质量并保障分析效果。"
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
            <ToolOutlined className="page-section-card__title-icon" />
            选择数据集
          </span>
        }
      >
        <Paragraph style={{ color: 'var(--brand-muted)', marginBottom: 20 }}>
          选择需要清洗的数据集，并根据业务要求调整清洗规则，系统会自动执行医学常用的数据修复策略。
        </Paragraph>
        <Form form={form} layout="inline" onFinish={handleDataCleaning} className="page-toolbar">
          <Form.Item
            name="dataset_id"
            label="数据集"
            rules={[{ required: true, message: '请选择数据集' }]}
            style={{ minWidth: 260 }}
          >
            <Select
              placeholder="请选择要清洗的数据集"
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
            <Button type="primary" htmlType="submit" loading={loading} icon={<ToolOutlined />}>
              开始数据清洗
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        className="page-section-card"
        title={<span className="page-section-card__title">清洗配置</span>}
      >
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card size="small" title="缺失值处理">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Checkbox
                  checked={cleaningConfig.handle_missing}
                  onChange={(e) => handleConfigChange('handle_missing', e.target.checked)}
                >
                  处理缺失值
                </Checkbox>
                {cleaningConfig.handle_missing && (
                  <Select
                    value={cleaningConfig.missing_strategy}
                    onChange={(value) => handleConfigChange('missing_strategy', value)}
                    style={{ width: '100%' }}
                  >
                    <Option value="medical_fill">医学填充（推荐）</Option>
                    <Option value="drop">删除缺失行</Option>
                    <Option value="drop_high_missing">删除高缺失列</Option>
                  </Select>
                )}
              </Space>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" title="异常值处理">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Checkbox
                  checked={cleaningConfig.handle_outliers}
                  onChange={(e) => handleConfigChange('handle_outliers', e.target.checked)}
                >
                  处理异常值
                </Checkbox>
                {cleaningConfig.handle_outliers && (
                  <Select
                    value={cleaningConfig.outlier_strategy}
                    onChange={(value) => handleConfigChange('outlier_strategy', value)}
                    style={{ width: '100%' }}
                  >
                    <Option value="remove">删除异常值</Option>
                    <Option value="cap">限制异常值</Option>
                  </Select>
                )}
              </Space>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" title="数据标准化">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Checkbox
                  checked={cleaningConfig.standardize_medical_vars}
                  onChange={(e) => handleConfigChange('standardize_medical_vars', e.target.checked)}
                >
                  标准化医学变量
                </Checkbox>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  自动标准化性别、年龄等医学变量格式
                </Text>
              </Space>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small" title="其他处理">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Checkbox
                  checked={cleaningConfig.handle_duplicates}
                  onChange={(e) => handleConfigChange('handle_duplicates', e.target.checked)}
                >
                  删除重复数据
                </Checkbox>
                <Checkbox
                  checked={cleaningConfig.convert_types}
                  onChange={(e) => handleConfigChange('convert_types', e.target.checked)}
                >
                  转换数据类型
                </Checkbox>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>

      {loading && (
        <Card className="page-section-card">
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>正在清洗数据...</div>
          </div>
        </Card>
      )}

      {cleaningResult && (
        <>
          {/* 清洗结果摘要 */}
          <Card
            className="page-section-card"
            title={<span className="page-section-card__title">清洗结果摘要</span>}
          >
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="原始数据"
                  value={`${cleaningResult.original_shape[0]} 行 × ${cleaningResult.original_shape[1]} 列`}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="清洗后数据"
                  value={`${cleaningResult.cleaned_shape[0]} 行 × ${cleaningResult.cleaned_shape[1]} 列`}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="数据保留率"
                  value={((cleaningResult.cleaned_shape[0] / cleaningResult.original_shape[0]) * 100).toFixed(1)}
                  suffix="%"
                />
              </Col>
            </Row>

            <Divider />

            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="执行操作数"
                  value={cleaningResult.cleaning_log.length}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="删除行数"
                  value={cleaningResult.original_shape[0] - cleaningResult.cleaned_shape[0]}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="删除列数"
                  value={cleaningResult.original_shape[1] - cleaningResult.cleaned_shape[1]}
                />
              </Col>
            </Row>
          </Card>

          {/* 清洗操作日志 */}
          <Card
            className="page-section-card"
            title={<span className="page-section-card__title">清洗操作日志</span>}
          >
            <Table
              columns={cleaningLogColumns}
              dataSource={cleaningResult.cleaning_log.map((log, index) => ({
                key: index,
                ...log,
              }))}
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>

          {/* 成功提示 */}
          <Alert
            message="数据清洗完成"
            description="数据已成功清洗，可以进行后续的数据分析。建议在分析前再次检查数据质量。"
            type="success"
            showIcon
            style={{ marginTop: 24 }}
          />
        </>
      )}
    </PageContainer>
  );
};

export default DataCleaning;
