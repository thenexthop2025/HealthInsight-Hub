import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Typography,
  Tag,
  Modal,
  Form,
  Select,
  Popconfirm,
  Input,
} from 'antd';
import {
  FileTextOutlined,
  DownloadOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { reportAPI, analysisAPI } from '../services/api';
import { extractErrorMessage } from '../utils/error';
import { formatDateTime } from '../utils/datetime';
import PageContainer from '../components/PageContainer';
import PageHero from '../components/PageHero';

const { Text } = Typography;
const { Option } = Select;

interface Report {
  id: number;
  title: string;
  report_type: string;
  created_at: string;
  file_path?: string;
  analysis_id: number;
}

interface Analysis {
  id: number;
  name: string;
  analysis_type: string;
  status: string;
  parameters?: any;
}

const parseParameters = (analysis: Analysis | null) => {
  if (!analysis || !analysis.parameters) return undefined;
  try {
    return typeof analysis.parameters === 'string'
      ? JSON.parse(analysis.parameters)
      : analysis.parameters;
  } catch {
    return undefined;
  }
};

const resolveAnalysisType = (analysis: Analysis) => {
  if (analysis.analysis_type === 'descriptive') {
    const params = parseParameters(analysis);
    return params?.descriptive_subtype || params?.effective_analysis_type || 'descriptive';
  }
  return analysis.analysis_type;
};

const Reports: React.FC = () => {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  // 获取报告列表
  const { data: reports, isLoading: reportsLoading } = useQuery(
    'reports',
    () => reportAPI.getReports()
  );

  // 获取已完成的分析列表
  const { data: analyses } = useQuery('completedAnalyses', () =>
    analysisAPI.getAnalyses()
  );

  // 创建报告
  const createReportMutation = useMutation(
    (data: any) => reportAPI.createReport(data),
    {
      onSuccess: () => {
        message.success('报告创建成功');
        queryClient.invalidateQueries('reports');
        setCreateModalVisible(false);
        form.resetFields();
      },
      onError: (error: any) => {
        message.error(extractErrorMessage(error, '创建失败'));
      },
    }
  );


  // 下载报告
  const downloadReport = async (id: number, reportType: string) => {
    try {
      const response = await reportAPI.downloadReport(id);
      
      // 根据报告类型设置正确的MIME类型和文件扩展名
      let mimeType: string;
      let fileExtension: string;
      
      switch (reportType) {
        case 'word':
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          fileExtension = 'docx';
          break;
        case 'excel':
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          fileExtension = 'xlsx';
          break;
        case 'pdf':
        default:
          mimeType = 'application/pdf';
          fileExtension = 'pdf';
          break;
      }
      
      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report_${id}.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      message.error(extractErrorMessage(error, '下载失败'));
    }
  };

  // 删除报告
  const deleteReportMutation = useMutation(
    (id: number) => reportAPI.deleteReport(id),
    {
      onSuccess: () => {
        message.success('报告删除成功');
        queryClient.invalidateQueries('reports');
      },
      onError: (error: any) => {
        message.error(extractErrorMessage(error, '删除失败'));
      },
    }
  );

  // 处理报告创建
  const handleCreateReport = (values: any) => {
    createReportMutation.mutate(values);
  };


  // 获取报告类型标签
  const getReportTypeTag = (type: string) => {
    const typeMap: { [key: string]: { className: string; text: string } } = {
      pdf: { className: 'tag-pastel-pink', text: 'PDF' },
      word: { className: 'tag-pastel-blue', text: 'Word' },
      excel: { className: 'tag-pastel-mint', text: 'Excel' },
    };
    const typeInfo = typeMap[type] || { className: 'tag-muted', text: type };
    return <Tag className={typeInfo.className}>{typeInfo.text}</Tag>;
  };

  // 获取分析类型标签
const analysisTypeMeta: { [key: string]: { className: string; text: string } } = {
  descriptive: { className: 'tag-pastel-blue', text: '描述性统计' },
  frequency: { className: 'tag-pastel-blue', text: '频率分析' },
  crosstab: { className: 'tag-pastel-yellow', text: '交叉表分析' },
  explore: { className: 'tag-pastel-mint', text: '探索性分析' },
  pp_plot: { className: 'tag-pastel-mint', text: 'P-P图' },
  correlation: { className: 'tag-pastel-mint', text: '相关性分析' },
  chi_square: { className: 'tag-pastel-pink', text: '卡方检验' },
  logistic_regression: { className: 'tag-pastel-pink', text: '二分类逻辑回归' },
  logistic_regression_multinomial: { className: 'tag-pastel-pink', text: '无序多分类逻辑回归' },
  logistic_regression_ordinal: { className: 'tag-pastel-pink', text: '有序多分类逻辑回归' },
  logistic_regression_conditional: { className: 'tag-pastel-pink', text: '条件逻辑回归（分层）' },
  linear_regression: { className: 'tag-pastel-yellow', text: '线性回归' },
  machine_learning: { className: 'tag-pastel-mint', text: '机器学习' },
  stratified: { className: 'tag-pastel-blue', text: '分层分析' },
  mendelian_randomization: { className: 'tag-pastel-blue', text: '孟德尔随机化' },
};

const getAnalysisTypeLabel = (analysis: Analysis) => {
  const type = resolveAnalysisType(analysis);
  return analysisTypeMeta[type]?.text || type;
};

const getAnalysisTypeTag = (analysis: Analysis) => {
  const type = resolveAnalysisType(analysis);
  const meta = analysisTypeMeta[type] || { className: 'tag-muted', text: type };
  return <Tag className={meta.className}>{meta.text}</Tag>;
};

  // 报告表格列
  const reportColumns = [
    {
      title: '报告标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '报告类型',
      dataIndex: 'report_type',
      key: 'report_type',
      render: (type: string) => getReportTypeTag(type),
    },
    {
      title: '关联分析',
      dataIndex: 'analysis_id',
      key: 'analysis_id',
      render: (analysisId: number) => {
        const analysis = analyses?.data?.find((a: Analysis) => a.id === analysisId);
        return analysis ? (
          <Space>
            <Text>{analysis.name}</Text>
            {getAnalysisTypeTag(analysis)}
          </Space>
        ) : '-';
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => formatDateTime(date),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: Report) => (
        <Space>
          {record.file_path && (
            <Button
              type="link"
              icon={<DownloadOutlined />}
              onClick={() => downloadReport(record.id, record.report_type)}
            >
              下载
            </Button>
          )}
          <Popconfirm
            title="确定要删除这个报告吗？"
            onConfirm={() => deleteReportMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 已完成的分析列表
  const completedAnalyses = analyses?.data?.filter(
    (analysis: Analysis) => analysis.status === 'completed'
  ) || [];
  const reportCount = reports?.data?.length || 0;
  const availableDownloads = reports?.data?.filter((report: Report) => !!report.file_path).length || 0;

  return (
    <PageContainer>
      <PageHero
        icon={<FileTextOutlined className="page-hero__title-icon" />}
        badge="成果发布"
        title="报告管理"
        subtitle="统一生成、下载和归档分析报告，确保研究成果随时可查。"
        stats={[
          { label: '报告总数', value: reportCount },
          { label: '可下载报告', value: availableDownloads },
          { label: '完成分析', value: completedAnalyses.length },
        ]}
      />

      <Card
        className="page-section-card"
        title={<span className="page-section-card__title">报告列表</span>}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
              className="enhanced-btn"
            >
              创建报告
            </Button>
          </Space>
        }
      >
        <Table
          columns={reportColumns}
          dataSource={reports?.data || []}
          loading={reportsLoading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>


      {/* 创建报告模态框 */}
      <Modal
        title="创建报告"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createReportMutation.isLoading}
      >
        <Form form={form} onFinish={handleCreateReport} layout="vertical">
          <Form.Item
            name="title"
            label="报告标题"
            rules={[{ required: true, message: '请输入报告标题' }]}
          >
            <Input placeholder="请输入报告标题" />
          </Form.Item>
          <Form.Item
            name="analysis_id"
            label="关联分析"
            rules={[{ required: true, message: '请选择关联分析' }]}
          >
            <Select placeholder="请选择已完成的分析">
              {completedAnalyses.map((analysis: Analysis) => (
                <Option key={analysis.id} value={analysis.id}>
                  {analysis.name}（{getAnalysisTypeLabel(analysis)}）
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="report_type"
            label="报告类型"
            rules={[{ required: true, message: '请选择报告类型' }]}
            initialValue="pdf"
          >
            <Select placeholder="请选择报告类型">
              <Option value="pdf">PDF</Option>
              <Option value="word">Word</Option>
              <Option value="excel">Excel</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="content"
            label="报告内容"
          >
            <Input.TextArea 
              placeholder="请输入报告内容（可选）" 
              rows={4}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default Reports;
