import React, { Key, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  message,
  Popconfirm,
  Tooltip,
  Select,
  Row,
  Col,
  Statistic,
} from 'antd';
import type { TablePaginationConfig } from 'antd/es/table';
import {
  EyeOutlined,
  DeleteOutlined,
  BarChartOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { analysisAPI } from '../../services/api';
import { formatDateTime } from '../../utils/datetime';
import { extractErrorMessage } from '../../utils/error';
// import moment from 'moment';

const { Title, Text } = Typography;
const { Option } = Select;

interface Analysis {
  id: string;
  name?: string;
  analysis_type: string;
  dataset_id: string;
  dataset_name: string;
  status: string;
  created_at: string;
  completed_at?: string;
  results?: any;
  parameters?: any;
  error_message?: string;
}

interface AnalysisHistoryProps {
  onViewResults?: (analysis: Analysis) => void;
}

const AnalysisHistory: React.FC<AnalysisHistoryProps> = ({ onViewResults }) => {
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState<string>('');
  const [tablePagination, setTablePagination] = useState<{ current: number; pageSize: number }>({
    current: 1,
    pageSize: 10,
  });

  const queryClient = useQueryClient();

  // 获取分析历史
  const { data: analyses, isLoading } = useQuery('analyses', () => analysisAPI.getAnalyses());

  // 删除单个分析
  const deleteAnalysisMutation = useMutation(
    (analysisId: string) => analysisAPI.deleteAnalysis(Number(analysisId)),
    {
      onSuccess: () => {
        message.success('分析删除成功');
        queryClient.invalidateQueries('analyses');
      },
      onError: (error: any) => {
        message.error(extractErrorMessage(error, '删除失败'));
      },
    }
  );

  // 删除所有分析
  const deleteAllAnalysesMutation = useMutation(
    () => analysisAPI.deleteAllAnalyses(),
    {
      onSuccess: (response: any) => {
        message.success(response.message || '所有分析删除成功');
        queryClient.invalidateQueries('analyses');
      },
      onError: (error: any) => {
        message.error(extractErrorMessage(error, '批量删除失败'));
      },
    }
  );

  // 获取分析类型的中文名称
  const getAnalysisTypeName = (type: string) => {
    const typeNames: Record<string, string> = {
      descriptive: '描述性分析',
      frequency: '频率分析',
      crosstab: '交叉表分析',
      correlation: '相关性分析',
      regression: '回归分析',
      linear_regression: '线性回归',
      logistic_regression: '二分类逻辑回归',
      logistic_regression_multinomial: '无序多分类逻辑回归',
      logistic_regression_ordinal: '有序多分类逻辑回归',
      logistic_regression_conditional: '条件逻辑回归（分层）',
      chi_square: '卡方检验',
      stratified: '分层分析',
      mendelian_randomization: '孟德尔随机化',
      explore: '探索分析',
    };
    return typeNames[type] || type;
  };

  // 获取状态标签
  const getStatusTag = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      pending: {
        color: 'processing',
        icon: <ClockCircleOutlined />,
        text: '等待中',
      },
      running: {
        color: 'processing',
        icon: <ClockCircleOutlined />,
        text: '运行中',
      },
      completed: {
        color: 'success',
        icon: <CheckCircleOutlined />,
        text: '已完成',
      },
      failed: {
        color: 'error',
        icon: <CloseCircleOutlined />,
        text: '失败',
      },
    };
    const config = statusConfig[status] || { color: 'default', icon: null, text: status };
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 获取图表类型配置
  const getChartConfig = (analysisType: string) => {
    const configs: Record<string, Array<{ type: string; name: string }>> = {
      descriptive: [
        { type: 'boxplot', name: '箱线图' },
        { type: 'histogram', name: '直方图' },
      ],
      frequency: [
        { type: 'bar', name: '柱状图' },
        { type: 'pie', name: '饼图' },
        { type: 'table', name: '频数表' },
      ],
      crosstab: [
        { type: 'heatmap', name: '热力图' },
        { type: 'mosaic', name: '马赛克图' },
        { type: 'stacked_bar', name: '堆叠柱状图' },
        { type: 'residuals', name: '残差图' },
      ],
      correlation: [
        { type: 'heatmap', name: '相关性热力图' },
        { type: 'scatter', name: '散点图矩阵' },
        { type: 'network', name: '网络图' },
      ],
      regression: [
        { type: 'scatter', name: '散点图' },
        { type: 'residuals', name: '残差图' },
        { type: 'qq', name: 'Q-Q图' },
        { type: 'fitted', name: '拟合图' },
      ],
      chi_square: [
        { type: 'heatmap', name: '热力图' },
        { type: 'mosaic', name: '马赛克图' },
        { type: 'stacked_bar', name: '堆叠柱状图' },
        { type: 'residuals', name: '残差图' },
      ],
      stratified: [
        { type: 'forest', name: '森林图' },
        { type: 'funnel', name: '漏斗图' },
        { type: 'bar', name: '分层柱状图' },
      ],
      mendelian_randomization: [
        { type: 'scatter', name: '散点图' },
        { type: 'funnel', name: '漏斗图' },
        { type: 'forest', name: '森林图' },
      ],
      explore: [
        { type: 'histogram', name: '直方图' },
        { type: 'boxplot', name: '箱线图' },
        { type: 'qq', name: 'Q-Q图' },
        { type: 'scatter', name: '散点图' },
      ],
    };
    return configs[analysisType] || [];
  };

  // 查看分析结果
  const handleViewResults = (analysis: Analysis) => {
    // 如果父组件提供了 onViewResults，则完全交由父组件展示结果，避免双弹窗
    if (onViewResults) {
      onViewResults(analysis);
      return;
    }

    // 否则使用内部弹窗
    setSelectedAnalysis(analysis);
    setResultModalVisible(true);

    // 设置默认图表类型（第一次打开时有值）
    const chartConfigs = getChartConfig(analysis.analysis_type);
    setSelectedChartType(chartConfigs[0]?.type || '');
  };

  // 删除分析
  const handleDelete = (analysisId: string) => {
    deleteAnalysisMutation.mutate(analysisId);
  };

  // 删除所有分析
  const handleDeleteAll = () => {
    Modal.confirm({
      title: '确认删除所有分析',
      content: `确定要删除所有 ${(analyses as any)?.data?.length || 0} 条分析记录吗？此操作不可撤销。`,
      okText: '删除全部',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        deleteAllAnalysesMutation.mutate();
      },
    });
  };

  // 过滤分析数据
  const filteredAnalyses = (analyses as any)?.data || [];

  // 表格列配置
  const analysisTypeFilters = Object.entries({
    descriptive: '描述性分析',
    frequency: '频率分析',
    crosstab: '交叉表分析',
    correlation: '相关性分析',
    regression: '回归分析',
    linear_regression: '线性回归',
    logistic_regression: '二分类逻辑回归',
    logistic_regression_multinomial: '无序多分类逻辑回归',
    logistic_regression_ordinal: '有序多分类逻辑回归',
    logistic_regression_conditional: '条件逻辑回归（分层）',
    chi_square: '卡方检验',
    stratified: '分层分析',
    mendelian_randomization: '孟德尔随机化',
    explore: '探索分析',
  }).map(([value, label]) => ({ text: label, value }));

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      ellipsis: true,
      render: (val: string, record: Analysis) => val || `${getAnalysisTypeName(record.analysis_type)} #${record.id}`,
    },
    {
      title: '分析类型',
      dataIndex: 'analysis_type',
      key: 'analysis_type',
      width: 120,
      filters: analysisTypeFilters,
      onFilter: (value: Key | boolean, record: Analysis) =>
        record.analysis_type === String(value),
      render: (type: string) => (
        <Tag color="blue" icon={<BarChartOutlined />}>
          {getAnalysisTypeName(type)}
        </Tag>
      ),
    },
    {
      title: '数据集',
      dataIndex: 'dataset_name',
      key: 'dataset_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: '等待中', value: 'pending' },
        { text: '运行中', value: 'running' },
        { text: '已完成', value: 'completed' },
        { text: '失败', value: 'failed' },
      ],
      onFilter: (value: Key | boolean, record: Analysis) =>
        record.status === String(value),
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (time: string) => formatDateTime(time, 'zh-CN', 'Asia/Shanghai'),
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      key: 'completed_at',
      width: 150,
      render: (time: string) => time ? formatDateTime(time, 'zh-CN', 'Asia/Shanghai') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: any, record: Analysis) => (
        <Space>
          <Tooltip title={record.status === 'failed' ? '查看失败详情' : '查看结果'}>
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleViewResults(record)}
              disabled={record.status === 'running' || record.status === 'pending'}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="确定要删除这个分析吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Tooltip title="删除分析">
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 统计信息
  const stats = {
    total: (analyses as any)?.data?.length || 0,
    completed: (analyses as any)?.data?.filter((a: Analysis) => a.status === 'completed').length || 0,
    running: (analyses as any)?.data?.filter((a: Analysis) => a.status === 'running').length || 0,
    failed: (analyses as any)?.data?.filter((a: Analysis) => a.status === 'failed').length || 0,
  };

  const handleTableChange = (paginationConfig: TablePaginationConfig) => {
    setTablePagination(prev => ({
      current: paginationConfig.current || prev.current,
      pageSize: paginationConfig.pageSize || prev.pageSize,
    }));
  };

  return (
    <Card 
      className="page-section-card analysis-history-card"
      title="分析历史"
      extra={
        (analyses as any)?.data && (analyses as any).data.length > 0 && (
          <Button className="analysis-history__delete-all enhanced-btn"
            icon={<DeleteOutlined />}
            onClick={handleDeleteAll}
          >
            全部删除
          </Button>
        )
      }
    >
      {/* 统计信息 */}
      <Row
        gutter={16}
        justify="center"
        className="analysis-history__stats-row"
        style={{ marginBottom: 16 }}
      >
        <Col span={6}>
          <Statistic title="总分析数" value={stats.total} />
        </Col>
        <Col span={6}>
          <Statistic title="已完成" value={stats.completed} valueStyle={{ color: '#3f8600' }} />
        </Col>
        <Col span={6}>
          <Statistic title="运行中" value={stats.running} valueStyle={{ color: '#1890ff' }} />
        </Col>
        <Col span={6}>
          <Statistic title="失败" value={stats.failed} valueStyle={{ color: '#cf1322' }} />
        </Col>
      </Row>


      {/* 分析历史表格 */}
      <Table
        columns={columns}
        dataSource={filteredAnalyses}
        rowKey="id"
        loading={isLoading}
        onChange={handleTableChange}
        pagination={{
          current: tablePagination.current,
          pageSize: tablePagination.pageSize,
          showSizeChanger: true,
          showQuickJumper: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
        }}
        scroll={{ x: 800 }}
      />

      {/* 结果查看模态框（仅当父组件未提供 onViewResults 时使用内部弹窗）*/}
      {!onViewResults && (
      <Modal
        title={
          selectedAnalysis ? (
            <div>
              <Title level={4} style={{ margin: 0, color: '#fff', fontWeight: 700 }}>
                {getAnalysisTypeName(selectedAnalysis.analysis_type)} - 分析结果
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                数据集: {selectedAnalysis.dataset_name} | 
                创建时间: {formatDateTime(selectedAnalysis.created_at, 'zh-CN', 'Asia/Shanghai')}
              </Text>
            </div>
          ) : ''
        }
        open={resultModalVisible}
        onCancel={() => setResultModalVisible(false)}
        width="90%"
        style={{ top: 20 }}
        footer={null}
      >
        {selectedAnalysis && (
          <div>
            {/* 图表类型选择 */}
            <div style={{ marginBottom: 16 }}>
              <Text strong>图表类型: </Text>
              <Select
                value={selectedChartType}
                onChange={setSelectedChartType}
                style={{ width: 200, marginLeft: 8 }}
              >
                {getChartConfig(selectedAnalysis.analysis_type).map(config => (
                  <Option key={config.type} value={config.type}>
                    {config.name}
                  </Option>
                ))}
              </Select>
            </div>

            {/* 这里会渲染具体的图表内容 */}
            <div style={{ minHeight: 400, textAlign: 'center', padding: 40 }}>
              <Text type="secondary">
                图表内容将由 ChartGenerator 组件渲染
              </Text>
            </div>
          </div>
        )}
      </Modal>
      )}
    </Card>
  );
};

export default AnalysisHistory;
