import React, { useState, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Upload,
  Modal,
  Form,
  Input,
  Select,
  message,
  Space,
  Tag,
  Popconfirm,
  Typography,
  Row,
  Col,
  Radio,
  Progress,
} from 'antd';
import {
  EyeOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api, { dataAPI, externalDataAPI } from '../services/api';
import { extractErrorMessage } from '../utils/error';
import { formatDateTime } from '../utils/datetime';
import type { ColumnsType } from 'antd/es/table';
import PageContainer from '../components/PageContainer';
import PageHero from '../components/PageHero';

const { Text } = Typography;
const { Option } = Select;

// 可调整大小的列头组件
const ResizableTitle = (props: any) => {
  const { onResize, width, ...restProps } = props;

  if (!width) {
    return <th {...restProps} />;
  }

  return (
    <th
      {...restProps}
      style={{
        ...restProps.style,
        position: 'relative',
        userSelect: 'none',
      }}
    >
      {restProps.children}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          height: '100%',
          width: '10px',
          cursor: 'col-resize',
          zIndex: 1,
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.pageX;
          const startWidth = width;

          const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(50, startWidth + (e.pageX - startX));
            onResize?.(newWidth);
          };

          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };

          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
      />
    </th>
  );
};

interface DataSource {
  id: number;
  name: string;
  description: string;
  data_type: string;
  is_active: boolean;
  created_at: string;
}

interface Dataset {
  id: number;
  name: string;
  description: string;
  data_source_id: number;
  data_source_name?: string; // 数据源名称
  owner_id?: number;
  record_count: number;
  created_at: string;
  updated_at: string;
}

const DataManagement: React.FC = () => {
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [dataSourceType, setDataSourceType] = useState<'existing' | 'custom'>('existing'); // 新增：数据源类型
  const [uploadForm] = Form.useForm();
  const queryClient = useQueryClient();
  
  // 列宽状态
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    name: 200,
    description: 300,
    data_source_name: 180,
    record_count: 120,
    created_at: 180,
    actions: 150,
  });

  // 获取数据源列表（用于数据源选择）
  const { data: globalDataSources } = useQuery(
    'globalDataSources',
    () => externalDataAPI.getSources()
  );

  // 获取数据集列表
  const { data: datasets, isLoading: datasetsLoading } = useQuery(
    'datasets',
    () => dataAPI.getDatasets()
  );

  const datasetList: Dataset[] = datasets?.data || [];
  
  // 调试：检查数据源名称
  if (datasetList.length > 0) {
    console.log('First dataset data_source_name:', datasetList[0].data_source_name);
    console.log('First dataset data_source_id:', datasetList[0].data_source_id);
  }
  const dataSourceList: DataSource[] =
    (globalDataSources?.data?.sources as DataSource[] | undefined) ?? [];
  const totalRecords = datasetList.reduce((sum, item) => sum + (item.record_count || 0), 0);

  // 上传数据集
  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const uploadDatasetMutation = useMutation(
    (formData: FormData) => dataAPI.uploadDataset(formData),
    {
      onSuccess: () => {
        message.success('数据集上传成功');
        queryClient.invalidateQueries('datasets');
        setUploadModalVisible(false);
        uploadForm.resetFields();
        setDataSourceType('existing'); // 重置数据源类型
        setUploadProgress(0);
      },
      onError: (error: any) => {
        message.error(extractErrorMessage(error, '上传失败'));
        setUploadProgress(0);
      },
    }
  );

  // 删除数据集
  const deleteDatasetMutation = useMutation(
    (params: { id: number; soft?: boolean; force?: boolean }) => {
      const { id, soft, force } = params;
      return dataAPI.deleteDataset(id, { soft, force });
    },
    {
      onSuccess: () => {
        message.success('数据集删除成功');
        queryClient.invalidateQueries('datasets');
      },
      onError: (error: any) => {
        message.error(extractErrorMessage(error, '删除失败'));
      },
    }
  );

  // 预览数据集
  const previewDataset = async (id: number) => {
    try {
      const response = await dataAPI.previewDataset(id, 10);
      setPreviewData(response.data);
      setPreviewModalVisible(true);
    } catch (error: any) {
      message.error(extractErrorMessage(error, '预览失败'));
    }
  };

  // 处理数据源创建
  // 处理数据集上传
  const handleUpload = (values: any) => {
    const formData = new FormData();
    formData.append('file', values.file.file);
    formData.append('name', values.name);
    formData.append('description', values.description || '');
    
    if (values.data_source_type === 'existing') {
      formData.append('data_source_id', values.data_source_id);
    } else {
      // 创建新数据源
      formData.append('custom_data_source_name', values.custom_data_source_name);
      formData.append('data_source_type', 'custom');
    }

    // 通过低层 axios 设置 onUploadProgress，更新进度条
    api.post('/api/data/datasets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt: any) => {
        if (evt.total) {
          // 网络传输占60%，后端处理占40%
          const networkPercent = Math.round((evt.loaded * 60) / evt.total);
          setUploadProgress(networkPercent);
        }
      },
    })
    .then(() => {
      // 网络传输完成，显示后端处理进度
      setUploadProgress(65);
      
      // 模拟后端处理进度（文件验证、R2上传、数据库保存等）
      const processingInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(processingInterval);
            return 90;
          }
          return prev + 3;
        });
      }, 300);
      
      // 清理定时器并完成上传
      setTimeout(() => {
        clearInterval(processingInterval);
        setUploadProgress(100);
        
        // 延迟一下再显示成功消息，让用户看到100%进度
        setTimeout(() => {
          message.success('数据集上传成功');
          queryClient.invalidateQueries('datasets');
          setUploadModalVisible(false);
          uploadForm.resetFields();
          setDataSourceType('existing');
          setUploadProgress(0);
        }, 500);
      }, 1500); // 1.5秒后完成
    })
    .catch((error) => {
      message.error(extractErrorMessage(error, '上传失败'));
      setUploadProgress(0);
    });
  };

  // 列宽调整处理函数
  const handleResize = useCallback((key: string) => (newWidth: number) => {
    setColumnWidths(prev => ({
      ...prev,
      [key]: newWidth,
    }));
  }, []);

  // 数据集表格列
  const datasetColumns: ColumnsType<Dataset> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: columnWidths.name,
      ellipsis: true,
      onHeaderCell: () => ({
        width: columnWidths.name,
        onResize: handleResize('name'),
      }),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: columnWidths.description,
      ellipsis: true,
      onHeaderCell: () => ({
        width: columnWidths.description,
        onResize: handleResize('description'),
      }),
    },
    {
      title: '数据源',
      dataIndex: 'data_source_name',
      key: 'data_source_name',
      width: columnWidths.data_source_name,
      onHeaderCell: () => ({
        width: columnWidths.data_source_name,
        onResize: handleResize('data_source_name'),
      }),
      render: (name: string, record: Dataset) => {
        if (name) {
          return <Tag className="tag-pastel-blue">{name}</Tag>;
        }
        return <Tag className="tag-muted">ID: {record.data_source_id}</Tag>;
      },
    },
    {
      title: '记录数',
      dataIndex: 'record_count',
      key: 'record_count',
      width: columnWidths.record_count,
      onHeaderCell: () => ({
        width: columnWidths.record_count,
        onResize: handleResize('record_count'),
      }),
      render: (count: number) => {
        if (typeof count !== 'number') {
          return '0';
        }
        return count.toLocaleString();
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: columnWidths.created_at,
      onHeaderCell: () => ({
        width: columnWidths.created_at,
        onResize: handleResize('created_at'),
      }),
      render: (date: string) => {
        if (typeof date !== 'string') {
          return '未知';
        }
        try {
          return formatDateTime(date);
        } catch (error) {
          return '无效日期';
        }
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: columnWidths.actions,
      fixed: 'right' as const,
      render: (_: any, record: Dataset) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => previewDataset(record.id)}
          >
            预览
          </Button>
          <Popconfirm
            title={
              <div>
                <div>确定要删除这个数据集吗？</div>
                <div style={{ marginTop: 8 }}>删除方式：</div>
                <Radio.Group defaultValue="soft" id={`del-mode-${record.id}`}>
                  <Radio value="soft">软删除（可恢复）</Radio>
                  <Radio value="force">级联删除（含相关分析与报告）</Radio>
                </Radio.Group>
              </div>
            }
            onConfirm={() => {
              const group = document.getElementById(`del-mode-${record.id}`) as HTMLDivElement | null;
              const selected = group?.querySelector('input[type="radio"]:checked') as HTMLInputElement | null;
              const mode = selected?.value || 'soft';
              
              if (mode === 'force') {
                // 强制删除
                deleteDatasetMutation.mutate({ id: record.id, force: true });
              } else {
                // 软删除
                deleteDatasetMutation.mutate({ id: record.id, soft: true });
              }
            }}
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

  const heroActions = (
    <Space size={12} wrap>
      <Button
        type="primary"
        icon={<UploadOutlined />}
        onClick={() => setUploadModalVisible(true)}
        className="upload-dataset-btn"
      >
        上传数据集
      </Button>
    </Space>
  );

  return (
    <PageContainer>
      <PageHero
        icon={<DatabaseOutlined className="page-hero__title-icon" />}
        badge="数据资源中心"
        title="内部数据集"
        subtitle="统一管理上传与导入的数据资源，为分析工作流提供可信赖的素材。"
        stats={[
          { label: '已注册数据源', value: dataSourceList.length },
          { label: '内部数据集', value: datasetList.length },
          { label: '累计记录数', value: totalRecords.toLocaleString() },
        ]}
        actions={heroActions}
      />

      <Card
        className="page-section-card"
        title={
          <span className="page-section-card__title">
            <DatabaseOutlined className="page-section-card__title-icon" />
            数据集列表
          </span>
        }
      >
        <Table
          columns={datasetColumns}
          dataSource={datasetList}
          loading={datasetsLoading}
          rowKey="id"
          scroll={{ x: 1200 }}
          components={{
            header: {
              cell: ResizableTitle,
            },
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      {/* 创建数据源功能移除：不再提供新建数据源入口与表单 */}

      {/* 上传数据集模态框 */}
      <Modal
        title="上传数据集"
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          uploadForm.resetFields();
          setDataSourceType('existing'); // 重置数据源类型
        }}
        onOk={() => uploadForm.submit()}
        confirmLoading={uploadDatasetMutation.isLoading}
        width={600}
      >
        <Form form={uploadForm} onFinish={handleUpload} layout="vertical">
          <Form.Item
            name="name"
            label="数据集名称"
            rules={[{ required: true, message: '请输入数据集名称' }]}
          >
            <Input placeholder="请输入数据集名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
          <Form.Item
            name="data_source_type"
            label="数据源类型"
            rules={[{ required: true, message: '请选择数据源类型' }]}
            initialValue="existing"
          >
            <Radio.Group 
              onChange={(e) => setDataSourceType(e.target.value)}
            >
              <Radio value="existing">选择现有数据源</Radio>
              <Radio value="custom">创建新数据源</Radio>
            </Radio.Group>
          </Form.Item>
          
          {dataSourceType === 'existing' ? (
            <Form.Item
              name="data_source_id"
              label="选择数据源"
              rules={[{ required: true, message: '请选择数据源' }]}
            >
              <Select 
                placeholder="请选择数据源" 
                showSearch
                filterOption={(input, option) =>
                  (option?.children as unknown as string)
                    ?.toLowerCase()
                    .includes(input.toLowerCase())
                }
              >
                {Array.isArray(globalDataSources?.data?.sources) && globalDataSources?.data?.sources.map((source: any) => (
                  <Option key={source.id} value={source.id}>
                    {source.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          ) : (
            <Form.Item
              name="custom_data_source_name"
              label="新数据源名称"
              rules={[{ required: true, message: '请输入数据源名称' }]}
            >
              <Input placeholder="请输入新数据源名称" />
            </Form.Item>
          )}
          <Form.Item
            name="file"
            label="文件"
            rules={[{ required: true, message: '请选择文件' }]}
          >
            <Upload.Dragger
              name="file"
              accept=".csv,.xlsx,.xls,.sav,.txt,.json"
              beforeUpload={() => false}
            >
              <p className="ant-upload-drag-icon">
                <DatabaseOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">支持 CSV、Excel、SPSS (.sav)、TXT、JSON，最大 20MB</p>
            </Upload.Dragger>
          </Form.Item>
          {uploadProgress > 0 && (
            <Form.Item label="上传进度">
              <Progress 
                percent={uploadProgress} 
                status={uploadProgress === 100 ? 'success' : uploadProgress >= 75 ? 'active' : undefined}
                format={(percent) => {
                  if (percent === undefined || percent === null) return '准备中...';
                  if (percent === 100) return '上传完成';
                  if (percent >= 75) return '处理中...';
                  return `上传中 ${percent}%`;
                }}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* 预览模态框 */}
      <Modal
        title={
          <div>
            <span>数据预览</span>
            <Text type="secondary" style={{ fontSize: '12px', marginLeft: '8px' }}>
              （仅显示前10条记录）
            </Text>
          </div>
        }
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={null}
        width={1200}
      >
        {previewData && (
          <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Text strong>记录数：</Text>
                <Text>{previewData.shape?.[0] || 0}</Text>
              </Col>
              <Col span={8}>
                <Text strong>列数：</Text>
                <Text>{previewData.shape?.[1] || 0}</Text>
              </Col>
              <Col span={8}>
                <Text strong>预览记录：</Text>
                <Text>10条</Text>
              </Col>
            </Row>
            <Table
              dataSource={previewData.preview || []}
              columns={previewData.columns?.map((col: string) => ({
                title: (
                  <div style={{ 
                    minWidth: '120px', 
                    maxWidth: '200px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {col}
                  </div>
                ),
                dataIndex: col,
                key: col,
                ellipsis: true,
                width: 150,
              })) || []}
              pagination={false}
              scroll={{ x: 'max-content' }}
              size="small"
            />
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};

export default DataManagement;
