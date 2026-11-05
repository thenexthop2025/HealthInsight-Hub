import React, { useState } from 'react';
import {
  Card,
  Upload,
  Button,
  Select,
  message,
  Typography,
  Row,
  Col,
  Table,
  Space,
  Divider,
  Alert,
  Tag,
  Modal,
  List,
  Statistic
} from 'antd';
import type { UploadFile } from 'antd';
import {
  UploadOutlined,
  DownloadOutlined,
  FileTextOutlined,
  TableOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useQuery } from 'react-query';
import api from '../services/api';
import PageContainer from '../components/PageContainer';
import PageHero from '../components/PageHero';

const { Text } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

interface SupportedFormat {
  extensions: string[];
  description: string;
  mime_type: string;
}

interface FileInfo {
  format: string;
  rows: number;
  columns: number;
  file_size: number;
  column_names: string[];
  dtypes: Record<string, string>;
  memory_usage: number;
}

interface ConversionResult {
  filename: string;
  success: boolean;
  output_filename?: string;
  download_url?: string;
  file_info?: {
    rows: number;
    columns: number;
    file_size: number;
  };
  error?: string;
}

const DataFormatConversion: React.FC = () => {
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [conversionResults, setConversionResults] = useState<ConversionResult[]>([]);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showFileInfo, setShowFileInfo] = useState(false);

  // 获取支持的格式列表
  const { data: formatsData, isLoading: formatsLoading } = useQuery(
    'supported-formats',
    async () => {
      const response = await api.get('/api/data-conversion/supported-formats');
      return response.data;
    }
  );

  const supportedFormats = formatsData?.formats || {};
  const formatsCount = Object.keys(supportedFormats).length;
  const successCount = conversionResults.filter((result) => result.success).length;

  // 文件上传处理
  const handleFileUpload = (info: any) => {
    const { fileList: newFileList } = info;
    setFileList(newFileList);
    const files = newFileList.map((file: any) => file.originFileObj).filter(Boolean);
    setUploadedFiles(files);
  };

  // 分析文件信息
  const analyzeFile = async (file: File) => {
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/api/data-conversion/analyze-file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setFileInfo(response.data.file_info);
        setShowFileInfo(true);
        message.success('文件分析完成');
      } else {
        message.error('文件分析失败');
      }
    } catch (error: any) {
      message.error('文件分析失败');
      console.error('Analyze error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  // 转换文件
  const convertFiles = async () => {
    if (uploadedFiles.length === 0) {
      message.warning('请先选择要转换的文件');
      return;
    }

    if (!selectedFormat) {
      message.warning('请选择输出格式');
      return;
    }

    setLoading(true);
    try {
      if (uploadedFiles.length === 1) {
        // 单个文件转换
        const formData = new FormData();
        formData.append('file', uploadedFiles[0]);
        formData.append('output_format', selectedFormat);

        const response = await api.post('/api/data-conversion/upload-and-convert', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.success) {
          setConversionResults([{
            filename: uploadedFiles[0].name,
            success: true,
            output_filename: response.data.output_filename,
            download_url: response.data.download_url,
            file_info: response.data.file_info
          }]);
          message.success(response.data.message);
        } else {
          message.error('转换失败');
        }
      } else {
        // 批量转换
        const formData = new FormData();
        uploadedFiles.forEach(file => {
          formData.append('files', file);
        });
        formData.append('output_format', selectedFormat);

        const response = await api.post('/api/data-conversion/batch-convert', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.success) {
          setConversionResults(response.data.results);
          message.success(response.data.message);
        } else {
          message.error('批量转换失败');
        }
      }
    } catch (error: any) {
      message.error('转换失败');
      console.error('Conversion error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 下载文件（以 Blob 方式，确保二进制文件不被当作文本）
  const downloadFile = async (downloadUrl: string, filename: string) => {
    try {
      const res = await api.get(downloadUrl, { responseType: 'blob' });
      const blob = res.data as Blob;

      // 如果服务端返回错误 JSON（content-type: application/json），尝试解析提示
      const contentType = res.headers['content-type'] || '';
      if (contentType.includes('application/json')) {
        const text = await blob.text();
        try {
          const json = JSON.parse(text);
          message.error(json?.message || '下载失败：服务端返回错误');
          return;
        } catch {
          message.error('下载失败：文件格式异常');
          return;
        }
      }

      // 从 Content-Disposition 中取文件名（若有）
      const disposition: string | undefined = res.headers['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
        const headerName = decodeURIComponent(match?.[1] || match?.[2] || '');
        if (headerName) filename = headerName;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      message.success('下载开始');
    } catch (e) {
      // 兜底错误提示
      // eslint-disable-next-line no-console
      console.error('Download error:', e);
      message.error('下载失败，请稍后重试');
    }
  };

  // 清空结果
  const clearResults = () => {
    setConversionResults([]);
    setUploadedFiles([]);
    setFileList([]);
    setSelectedFormat('');
  };

  // 转换结果表格列
  const resultColumns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      render: (text: string) => (
        <Space>
          <FileTextOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'success',
      key: 'success',
      render: (success: boolean) => (
        success ? (
          <Tag className="tag-pastel-mint" icon={<CheckCircleOutlined />}>
            转换成功
          </Tag>
        ) : (
          <Tag className="tag-pastel-pink" icon={<ExclamationCircleOutlined />}>
            转换失败
          </Tag>
        )
      ),
    },
    {
      title: '输出文件',
      dataIndex: 'output_filename',
      key: 'output_filename',
      render: (text: string, record: ConversionResult) => (
        record.success ? (
          <Space>
            <TableOutlined />
            {text}
          </Space>
        ) : (
          <Text type="danger">{record.error}</Text>
        )
      ),
    },
    {
      title: '文件信息',
      dataIndex: 'file_info',
      key: 'file_info',
      render: (fileInfo: any) => (
        fileInfo ? (
          <Space direction="vertical" size="small">
            <Text>行数: {fileInfo.rows}</Text>
            <Text>列数: {fileInfo.columns}</Text>
            <Text>大小: {(fileInfo.file_size / 1024).toFixed(2)} KB</Text>
          </Space>
        ) : null
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (text: any, record: ConversionResult) => (
        record.success && record.download_url ? (
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            size="small"
            onClick={() => downloadFile(record.download_url!, record.output_filename!)}
          >
            下载
          </Button>
        ) : null
      ),
    },
  ];

  const heroStats = [
    { label: '支持格式', value: formatsCount },
    { label: '已上传文件', value: uploadedFiles.length },
    { label: '转换成功', value: successCount },
  ];

  return (
    <PageContainer>
      <PageHero
        icon={<DatabaseOutlined className="page-hero__title-icon" />}
        badge="格式转换中心"
        title="数据格式转换"
        subtitle="在多种医学研究常见格式之间快速转换，完成上传、分析与导出的一体化流程。"
        stats={heroStats}
        meta={
          selectedFormat ? (
            <span>
              当前目标格式：<strong>{selectedFormat.toUpperCase()}</strong>
            </span>
          ) : undefined
        }
      />

      <Row gutter={24}>
        {/* 文件上传区域 */}
        <Col span={12}>
          <Card
            className="page-section-card"
            title={<span className="page-section-card__title">📁 选择文件</span>}
            style={{ height: '100%' }}
          >
            <Dragger
              multiple
              beforeUpload={() => false}
              onChange={handleFileUpload}
              fileList={fileList}
              style={{ marginBottom: 16 }}
            >
              <p className="ant-upload-drag-icon">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持单个或批量上传，文件大小不超过50MB
              </p>
            </Dragger>

            {uploadedFiles.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text strong>已选择文件 ({uploadedFiles.length}个):</Text>
                <List
                  size="small"
                  dataSource={uploadedFiles}
                  renderItem={(file) => (
                    <List.Item
                      actions={[
                        <Button
                          type="link"
                          size="small"
                          icon={<InfoCircleOutlined />}
                          onClick={() => analyzeFile(file)}
                          loading={analyzing}
                        >
                          分析
                        </Button>
                      ]}
                    >
                      <Space>
                        <FileTextOutlined />
                        {file.name}
                        <Tag className="tag-pastel-blue">{(file.size / 1024).toFixed(2)} KB</Tag>
                      </Space>
                    </List.Item>
                  )}
                />
              </div>
            )}
          </Card>
        </Col>

        {/* 转换设置区域 */}
        <Col span={12}>
          <Card
            className="page-section-card"
            title={<span className="page-section-card__title">⚙️ 转换设置</span>}
            style={{ height: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>选择输出格式:</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="请选择输出格式"
                  value={selectedFormat}
                  onChange={setSelectedFormat}
                  loading={formatsLoading}
                >
                  {Object.entries(supportedFormats).map(([key, format]) => (
                    <Option key={key} value={key}>
                      <Space>
                        <DatabaseOutlined />
                        {(format as SupportedFormat).description}
                        <Tag className="tag-pastel-yellow">{key.toUpperCase()}</Tag>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </div>

              <Alert
                message="支持的格式"
                description={
                  <div>
                    {Object.entries(supportedFormats).map(([key, format]) => (
                      <Tag key={key} className="tag-pastel-blue" style={{ margin: 2 }}>
                        {(format as SupportedFormat).description}
                      </Tag>
                    ))}
                  </div>
                }
                type="info"
                showIcon
              />

              <Button
                type="primary"
                size="large"
                onClick={convertFiles}
                loading={loading}
                disabled={uploadedFiles.length === 0 || !selectedFormat}
                style={{ width: '100%' }}
                icon={<DatabaseOutlined />}
              >
                {uploadedFiles.length > 1 ? '批量转换' : '开始转换'}
              </Button>

              {conversionResults.length > 0 && (
                <Button
                  onClick={clearResults}
                  style={{ width: '100%' }}
                >
                  清空结果
                </Button>
              )}
            </Space>
          </Card>
        </Col>
      </Row>

      {/* 转换结果 */}
      {conversionResults.length > 0 && (
        <Card
          className="page-section-card"
          title={<span className="page-section-card__title">📊 转换结果</span>}
          style={{ marginTop: 24 }}
        >
          <Table
            columns={resultColumns}
            dataSource={conversionResults}
            rowKey="filename"
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {/* 文件信息模态框 */}
      <Modal
        title="📋 文件信息"
        open={showFileInfo}
        onCancel={() => setShowFileInfo(false)}
        footer={null}
        width={600}
      >
        {fileInfo && (
          <div>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="格式" value={fileInfo.format.toUpperCase()} />
              </Col>
              <Col span={8}>
                <Statistic title="行数" value={fileInfo.rows} />
              </Col>
              <Col span={8}>
                <Statistic title="列数" value={fileInfo.columns} />
              </Col>
            </Row>
            
            <Divider />
            
            <Row gutter={16}>
              <Col span={12}>
                <Statistic 
                  title="文件大小" 
                  value={(fileInfo.file_size / 1024).toFixed(2)} 
                  suffix="KB" 
                />
              </Col>
              <Col span={12}>
                <Statistic 
                  title="内存使用" 
                  value={(fileInfo.memory_usage / 1024).toFixed(2)} 
                  suffix="KB" 
                />
              </Col>
            </Row>

            <Divider />
            
            <div>
              <Text strong>列信息:</Text>
              <List
                size="small"
                dataSource={fileInfo.column_names}
                renderItem={(column, index) => (
                  <List.Item>
                    <Space>
                      <Text code>{column}</Text>
                      <Tag className="tag-pastel-mint">{fileInfo.dtypes[column]}</Tag>
                    </Space>
                  </List.Item>
                )}
                style={{ maxHeight: 200, overflow: 'auto' }}
              />
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};

export default DataFormatConversion;
