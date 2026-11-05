import React from 'react';
import { Row, Col, Card, Statistic, Typography, Space } from 'antd';
import {
  DatabaseOutlined,
  BarChartOutlined,
  FileTextOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useQuery } from 'react-query';
import { dashboardAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../components/PageContainer';
import PageHero from '../components/PageHero';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // 获取统计数据
  const { data: statsData } = useQuery('dashboard-stats', () => dashboardAPI.getStats(), {
    staleTime: 60_000,
  });

  const datasetCount = statsData?.data?.dataset_count ?? 0;
  const analysisCount = statsData?.data?.analysis_count ?? 0;
  const reportCount = statsData?.data?.report_count ?? 0;

  const quickActions = [
    {
      title: '数据管理',
      description: '上传和管理数据集',
      icon: <DatabaseOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
      action: () => navigate('/data'),
    },
    {
      title: '数据分析',
      description: '运行统计分析',
      icon: <BarChartOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
      action: () => navigate('/analysis'),
    },
    {
      title: '报告管理',
      description: '查看和下载报告',
      icon: <FileTextOutlined style={{ fontSize: 24, color: '#fa8c16' }} />,
      action: () => navigate('/reports'),
    },
  ];

  return (
    <PageContainer>
      <PageHero
        icon={<BarChartOutlined className="page-hero__title-icon" />}
        badge="仪表盘"
        title="平台总览"
        subtitle="快速浏览数据资源、分析任务与报告输出的全局状态。"
      />

      <Row gutter={[15, 15]} style={{ marginBottom: 15 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-section-card card-gradient-border dashboard-stat-card">
            <Statistic
              title="内部数据集数量"
              value={datasetCount}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-section-card card-gradient-border dashboard-stat-card">
            <Statistic
              title="分析任务"
              value={analysisCount}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-section-card card-gradient-border dashboard-stat-card">
            <Statistic
              title="生成报告"
              value={reportCount}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="page-section-card card-gradient-border dashboard-stat-card">
            <Statistic
              title="系统状态"
              value="正常"
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        className="page-section-card card-gradient-border quick-actions-card"
        style={{ marginBottom: 15 }}
        title={<span className="page-section-card__title">快速操作导航</span>}
      >
        <Row gutter={[15, 0]} className="quick-actions-row">
          {quickActions.map((action, index) => (
            <Col xs={24} sm={12} lg={8} key={index}>
              <Card
                hoverable
                onClick={action.action}
                className="page-section-card card-gradient-border quick-action-item"
                style={{ textAlign: 'center', cursor: 'pointer', height: '100%', padding: 0, marginBottom: 15 }}
                bodyStyle={{ padding: 15 }}
              >
                <Space direction="vertical" size="middle">
                  {action.icon}
                  <div>
                    <Title level={4} style={{ margin: 0 }}>
                      {action.title}
                    </Title>
                    <Text type="secondary">{action.description}</Text>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Row gutter={[15, 15]}>
        <Col xs={24} lg={12}>
          <Card
            title={<span className="page-section-card__title">平台功能</span>}
            size="small"
            className="page-section-card card-gradient-border"
          >
            <ul style={{ paddingLeft: 20 }}>
              <li>支持多格式数据接入（CSV、Excel等）</li>
              <li>提供丰富的统计分析方法</li>
              <li>自动生成可视化图表</li>
              <li>支持报告导出（PDF、Word、Excel）</li>
              <li>多角色权限管理</li>
              <li>数据安全与隐私保护</li>
            </ul>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={<span className="page-section-card__title">统计分析类型</span>}
            size="small"
            className="page-section-card card-gradient-border"
          >
            <ul style={{ paddingLeft: 20 }}>
              <li>描述性统计分析</li>
              <li>相关性分析</li>
              <li>卡方检验</li>
              <li>逻辑回归分析</li>
              <li>线性回归分析</li>
              <li>机器学习预测</li>
              <li>分层分析</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </PageContainer>
  );
};

export default Dashboard;
