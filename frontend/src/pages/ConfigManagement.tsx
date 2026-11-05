import React, { useState } from 'react';
import {
  Card,
  Button,
  Input,
  Select,
  Table,
  Space,
  message,
  Typography,
  Row,
  Col,
  Tag,
  Modal,
  Form,
  Divider,
  Alert,
  Spin,
  Tooltip,
  Badge,
  Tabs,
  Drawer,
  Popconfirm,
  Checkbox,
  InputNumber,
  Switch
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  SaveOutlined,
  SettingOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import ConfigWizard from '../components/ConfigWizard';
import api, { unifiedDataAPI } from '../services/api';
import PageContainer from '../components/PageContainer';
import PageHero from '../components/PageHero';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { TabPane } = Tabs;

interface FieldMapping {
  api_field: string;
  standard_field: string;
  field_type: string;
  required: boolean;
  default_value?: any;
  transform?: string;
}

interface FilterConfig {
  name: string;
  display_name: string;
  field_type: string;
  filter_type: string;
  api_field: string;
  required: boolean;
  options?: any[];
  range_min?: number;
  range_max?: number;
}

interface DataSource {
  id: string;
  name: string;
  description: string;
  category: string;
  source: string;
  api_type: string;
  api_id?: string; // 关联的API ID
  base_url: string;
  endpoint: string;
  current_api_id?: string; // 当前关联的API ID
  api_configurations?: { [apiId: string]: { field_mappings: FieldMapping[]; filters: FilterConfig[] } }; // 多API配置
  field_mappings: FieldMapping[];
  filters: FilterConfig[];
  supports_pagination: boolean;
  page_size_param: string;
  page_offset_param: string;
  count_param: string;
  max_page_size: number;
  cache_duration: number;
}

interface Dataset {
  id: string;
  name: string;
  description: string;
  category: string;
  source: string;
  data_source_id: string;
  indicator_code?: string;
  dimension_code?: string;
  custom_endpoint?: string;
  default_params?: any;
  preview_limit: number;
  import_limit?: number;
}

const ConfigManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('api');
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isDatasetModalOpen, setIsDatasetModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const [editingDataset, setEditingDataset] = useState<Dataset | null>(null);
  const [editingApi, setEditingApi] = useState<any>(null);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<Record<string, any>>({});
  const [form] = Form.useForm();
  const [apiForm] = Form.useForm();
  const [datasetForm] = Form.useForm();

  const queryClient = useQueryClient();

  // 获取API列表
  const { data: apisData } = useQuery({
    queryKey: ['apis'],
    queryFn: async () => {
      const response = await api.get('/api/apis/');
      console.log('APIs API response:', response.data);
      console.log('APIs count:', response.data?.apis?.length || 0);
      return response.data;
    },
  });

  // 获取数据源列表
  const { data: sourcesData, isLoading: sourcesLoading, error: sourcesError } = useQuery({
    queryKey: ['datasources'],
    queryFn: async () => {
      const response = await api.get('/api/datasources/');
      console.log('DataSources API response:', response.data);
      console.log('DataSources count:', response.data?.datasources?.length || 0);
      return response.data;
    },
  });

  // 获取数据集列表
  const { data: datasetsData, isLoading: datasetsLoading } = useQuery({
    queryKey: ['config-datasets'],
    queryFn: async () => {
      const response = await api.get('/api/config/datasets');
      return response.data;
    },
  });

  // 创建API
  const createApiMutation = useMutation({
    mutationFn: async (apiData: any) => {
      const response = await api.post('/api/apis/', apiData);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['apis'] });
      if (data.auto_generated_id) {
        message.success(`API创建成功！自动生成ID: ${data.api_id}`);
      } else {
        message.success('API创建成功');
      }
      // 关闭API配置模态框
      setIsApiModalOpen(false);
      setEditingApi(null);
      apiForm.resetFields();
    },
  });

  // 创建数据源
  const createSourceMutation = useMutation({
    mutationFn: async (sourceData: DataSource) => {
      const response = await api.post('/api/datasources/', sourceData);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['datasources'] });
      if (data.auto_generated_id) {
        message.success(`数据源创建成功！自动生成ID: ${data.datasource_id}`);
      } else {
        message.success('数据源创建成功');
      }
      // 关闭数据源模态框
      setIsSourceModalOpen(false);
      form.resetFields();
    },
  });

  // 更新API
  const updateApiMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.put(`/api/apis/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apis'] });
      message.success('API更新成功');
      setIsApiModalOpen(false);
      apiForm.resetFields();
    },
    onError: (error: any) => {
      console.error('更新API失败:', error);
      message.error(`更新失败: ${error.response?.data?.detail || error.message}`);
    },
  });

  // 更新数据源
  const updateSourceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DataSource }) => {
      const response = await api.put(`/api/datasources/${id}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['datasources'] });
      message.success('数据源更新成功');
      setIsSourceModalOpen(false);
      form.resetFields();
      // 更新editingSource对象，使用后端返回的完整数据源信息
      if (editingSource && data.datasource) {
        setEditingSource(data.datasource);
      }
    },
    onError: (error: any) => {
      console.error('更新数据源失败:', error);
      message.error(`更新失败: ${error.response?.data?.detail || error.message}`);
    },
  });


  // 删除数据源
  const deleteSourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/datasources/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasources'] });
      message.success('数据源删除成功');
    },
    onError: (error: any) => {
      console.error('删除数据源失败:', error);
      const backendMessage = error.response?.data?.detail;
      message.error(backendMessage || `删除失败: ${error.message}`);
    },
  });

  // 删除API
  const deleteApiMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/apis/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apis'] });
      message.success('API删除成功');
    },
    onError: (error: any) => {
      console.error('删除API失败:', error);
      message.error(`删除失败: ${error.response?.data?.detail || error.message}`);
    },
  });

  // 删除数据集
  const deleteDatasetMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/api/datasets/${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-datasets'] });
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      message.success('数据集删除成功');
    },
    onError: (error: any) => {
      console.error('删除数据集失败:', error);
      message.error(`删除失败: ${error.response?.data?.detail || error.message}`);
    },
  });

  // 删除所有数据集
  const deleteAllDatasetsMutation = useMutation({
    mutationFn: async () => {
      const response = await unifiedDataAPI.deleteAllDatasets();
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['config-datasets'] });
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      message.success(`成功删除 ${data.deleted_count} 个数据集`);
    },
    onError: (error: any) => {
      console.error('删除所有数据集失败:', error);
      message.error(`删除失败: ${error.response?.data?.detail || error.message}`);
    },
  });

  // 数据集自动发现
  const discoverDatasetsMutation = useMutation({
    mutationFn: async (dataSourceId: string) => {
      const response = await unifiedDataAPI.discoverDatasets(dataSourceId);
      return response.data;
    },
    onSuccess: (data, dataSourceId) => {
      setDiscoveryStatus(prev => ({
        ...prev,
        [dataSourceId]: data
      }));
      message.success(`发现 ${data.datasets?.length || 0} 个数据集`);
    },
    onError: (error: any) => {
      message.error(`发现数据集失败: ${error.response?.data?.detail || error.message}`);
    },
  });

  // 生成数据集
  const generateDatasetsMutation = useMutation({
    mutationFn: async (dataSourceId: string) => {
      const response = await unifiedDataAPI.generateDatasets(dataSourceId);
      return response.data;
    },
    onSuccess: (data) => {
      message.success(`成功生成 ${data.added_datasets} 个新数据集`);
      queryClient.invalidateQueries({ queryKey: ['config-datasets'] });
    },
    onError: (error: any) => {
      message.error(`生成数据集失败: ${error.response?.data?.detail || error.message}`);
    },
  });


  // 导出配置
  const exportConfigMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/api/config/export');
      return response.data;
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `config_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('配置导出成功');
    },
  });

  const handleEditSource = (source: DataSource) => {
    setEditingSource(source);
    
    // 只设置字符串/数字类型的字段到表单，避免对象导致React渲染错误
    const formData = {
      id: source.id,
      name: source.name,
      description: source.description,
      category: source.category,
      source: source.source,
      api_type: source.api_type,
      base_url: source.base_url,
      endpoint: source.endpoint,
      // auth, field_mappings, filters 不设置，避免渲染对象
      supports_pagination: source.supports_pagination,
      page_size_param: source.page_size_param,
      page_offset_param: source.page_offset_param,
      count_param: source.count_param,
      max_page_size: source.max_page_size,
      cache_duration: source.cache_duration,
      api_id: (source as any).api_id || null
    };
    
    form.setFieldsValue(formData);
    
    // 将字段映射与筛选器写入表单，便于编辑
    form.setFieldsValue({
      field_mappings: (source.field_mappings || []).map(mapping => ({
        api_field: mapping.api_field,
        standard_field: mapping.standard_field,
        field_type: typeof mapping.field_type === 'string'
          ? mapping.field_type
          : String(mapping.field_type || ''),
        required: Boolean(mapping.required),
        default_value: mapping.default_value,
        transform: mapping.transform
      })),
      filters: (source.filters || []).map(filter => ({
        ...filter,
        required: Boolean(filter.required)
      }))
    });
    setIsSourceModalOpen(true);
  };

  const handleEditDataset = (dataset: Dataset) => {
    setEditingDataset(dataset);
    datasetForm.setFieldsValue(dataset);
    setIsDatasetModalOpen(true);
  };



  // 测试API连接
  const testApiConnection = async (apiRecord: any) => {
    try {
      message.loading('正在测试API连接...', 0);
      
      // 构建测试请求
      const testUrl = `${apiRecord.base_url}${apiRecord.endpoint}`;
      const testParams = {
        base_url: apiRecord.base_url,
        endpoint: apiRecord.endpoint,
        method: apiRecord.method || 'GET',
        auth: apiRecord.auth,
        timeout: apiRecord.timeout || 30
      };

      const response = await api.post('/api/apis/test-connection', testParams);
      
      message.destroy();
      
      if (response.data.success) {
        message.success('API连接测试成功！');
        Modal.info({
          title: 'API测试结果',
          content: (
            <div>
              <p><strong>测试URL:</strong> {testUrl}</p>
              <p><strong>状态:</strong> <Tag color="green">连接成功</Tag></p>
              <p><strong>响应时间:</strong> {response.data.response_time || 'N/A'}ms</p>
              {response.data.data_info && (
                <div>
                  <p><strong>数据信息:</strong></p>
                  <ul>
                    <li>总记录数: {response.data.data_info.total_records || 'N/A'}</li>
                    <li>数据列数: {response.data.data_info.columns?.length || 'N/A'}</li>
                  </ul>
                </div>
              )}
            </div>
          ),
          width: 500
        });
      } else {
        message.error('API连接测试失败');
        Modal.error({
          title: 'API测试失败',
          content: (
            <div>
              <p><strong>测试URL:</strong> {testUrl}</p>
              <p><strong>错误信息:</strong> {response.data.error || '未知错误'}</p>
            </div>
          )
        });
      }
    } catch (error: any) {
      message.destroy();
      message.error('API连接测试失败');
      Modal.error({
        title: 'API测试失败',
        content: (
          <div>
            <p><strong>错误信息:</strong> {error.response?.data?.detail || error.message || '网络错误'}</p>
          </div>
        )
      });
    }
  };

  const handleExportConfig = () => {
    exportConfigMutation.mutate();
  };

  const handleWizardComplete = (config: DataSource) => {
    createSourceMutation.mutate(config);
  };

  const handleSourceSubmit = (values: any) => {
    console.log('handleSourceSubmit called with values:', values);
    
    // 如果选择了API，需要创建一个真正的数据源（不是API）
    if (values.api_id) {
      // 从选中的API获取信息
      const selectedApi = apisData?.apis?.find((api: any) => api.id === values.api_id);
      if (selectedApi) {
        // 创建数据源配置，基于选中的API
        const dataSourceConfig = {
          ...values,
          // 从API继承的信息
          api_type: selectedApi.api_type,
          base_url: selectedApi.base_url,
          endpoint: selectedApi.endpoint,
          auth: selectedApi.auth,
          category: selectedApi.category,
          source: selectedApi.source,
          // 数据源特定的信息
          api_id: values.api_id, // 关联到API
          current_api_id: values.api_id, // 当前关联的API
          // 确保包含必需的字段
          field_mappings: values.field_mappings || [],
          filters: values.filters || [],
          supports_pagination: values.supports_pagination !== undefined ? values.supports_pagination : true,
          page_size_param: values.page_size_param || "$top",
          page_offset_param: values.page_offset_param || "$skip",
          count_param: values.count_param || "$count",
          max_page_size: values.max_page_size || 1000,
          cache_duration: values.cache_duration || 300,
        };
        
        // 处理多API配置
        if (editingSource) {
          // 编辑模式：更新当前API的配置
          const existingApiConfigurations = editingSource.api_configurations || {};
          const currentApiId = values.api_id;
          
          // 更新当前API的配置
          existingApiConfigurations[currentApiId] = {
            field_mappings: values.field_mappings || [],
            filters: values.filters || []
          };
          
          dataSourceConfig.api_configurations = existingApiConfigurations;
        } else {
          // 创建模式：初始化API配置
          dataSourceConfig.api_configurations = {
            [values.api_id]: {
              field_mappings: values.field_mappings || [],
              filters: values.filters || []
            }
          };
        }
        
        // 创建时不传递ID，让后端自动生成
        if (!editingSource) {
          delete dataSourceConfig.id;
        }
        
        if (editingSource) {
          updateSourceMutation.mutate({ id: editingSource.id, data: dataSourceConfig });
        } else {
          createSourceMutation.mutate(dataSourceConfig);
        }
      }
    } else {
      // 没有选择API，直接创建（这实际上是在创建API）
      const configWithDefaults = {
        ...values,
        // 确保包含必需的字段
        field_mappings: values.field_mappings || [],
        filters: values.filters || [],
        supports_pagination: values.supports_pagination !== undefined ? values.supports_pagination : true,
        page_size_param: values.page_size_param || "$top",
        page_offset_param: values.page_offset_param || "$skip",
        count_param: values.count_param || "$count",
        max_page_size: values.max_page_size || 1000,
        cache_duration: values.cache_duration || 300,
      };
      
      if (editingSource) {
        updateSourceMutation.mutate({ id: editingSource.id, data: configWithDefaults });
      } else {
        createSourceMutation.mutate(configWithDefaults);
      }
    }
  };

  const handleApiSubmit = (values: any) => {
    console.log('handleApiSubmit called with values:', values);
    console.log('editingApi:', editingApi);
    
    // 构建auth对象
    const auth = {
      auth_type: values.auth_type || 'none',
      api_key: values.api_key || null,
      api_key_header: values.api_key_header || 'X-API-Key',
      username: values.username || null,
      password: values.password || null,
      client_id: values.client_id || null,
      client_secret: values.client_secret || null,
      auth_url: values.auth_url || null,
      token_url: values.token_url || null,
    };
    
        // 构建API配置
        const apiConfig = {
          // 编辑时保留现有字段，创建时使用默认值
          id: editingApi?.id || values.id,
          name: values.name,
          description: values.description || editingApi?.description || values.name || 'API配置',
          category: values.category || editingApi?.category || 'Default',
          source: values.source || editingApi?.source || 'Unknown',
          api_type: values.api_type || editingApi?.api_type || 'REST',
          base_url: values.base_url || editingApi?.base_url || '',
          endpoint: values.endpoint || editingApi?.endpoint || '',
          method: values.method || editingApi?.method || 'GET',
          timeout: values.timeout || editingApi?.timeout || 30,
          auth: auth,
          field_mappings: editingApi?.field_mappings || [],
          filters: editingApi?.filters || [],
          supports_pagination: editingApi?.supports_pagination ?? true,
          page_size_param: editingApi?.page_size_param || '$top',
          page_offset_param: editingApi?.page_offset_param || '$skip',
          count_param: editingApi?.count_param || '$count',
          max_page_size: editingApi?.max_page_size || 1000,
          cache_duration: editingApi?.cache_duration || 300,
        };
    
    // 创建时不传递ID，让后端自动生成
    if (!editingApi) {
      delete apiConfig.id;
    }
    
    console.log('apiConfig:', apiConfig);
    
    // 根据是否为编辑来决定调用哪个mutation
    if (editingApi) {
      console.log('Calling updateApiMutation for ID:', editingApi.id);
      // 编辑现有API
      updateApiMutation.mutate({ id: editingApi.id, data: apiConfig });
    } else {
      console.log('Calling createApiMutation');
      // 创建新API
      createApiMutation.mutate(apiConfig);
    }
    
    // 注意：模态框关闭和表单重置应该在mutation的onSuccess中处理
    // 这里不应该立即关闭，因为mutation是异步的
  };

  // 数据源表格列定义
  const sourceColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: DataSource) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-sm text-gray-500">{record.description}</div>
        </div>
      ),
    },
    {
      title: '关联API',
      dataIndex: 'api_id',
      key: 'api_info',
      render: (apiId: string, record: any) => {
        // 如果有api_id且不是自身，显示关联的API信息
        if (apiId && apiId !== record.id) {
          const api = apisData?.apis?.find((a: any) => a.id === apiId);
          if (api) {
            return (
              <div>
                <div style={{ fontWeight: 'bold' }}>{api.name}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{api.api_type}</div>
              </div>
            );
          }
          // 找不到对应的API时，显示API ID字符串而不是对象
          return <Tag color="orange">API: {String(apiId)}</Tag>;
        }
        // 如果没有api_id或api_id是自身，说明这是API本身
        return (
          <div>
            <div style={{ fontWeight: 'bold' }}>{String(record.name || '')}</div>
            <div style={{ fontSize: '12px', color: '#666' }}>{String(record.api_type || '')} (自关联)</div>
          </div>
        );
      },
    },
    {
      title: '字段数',
      dataIndex: 'field_mappings',
      key: 'field_count',
      render: (mappings: FieldMapping[]) => Array.isArray(mappings) ? mappings.length : 0,
    },
    {
      title: '筛选器数',
      dataIndex: 'filters',
      key: 'filter_count',
      render: (filters: FilterConfig[]) => Array.isArray(filters) ? filters.length : 0,
    },
    {
      title: '状态',
      key: 'status',
      render: (record: DataSource) => {
        // 检查是否有数据集使用此数据源
        const usedByDatasets = datasetsData?.datasets?.filter(
          (dataset: any) => dataset.data_source_id === record.id
        ) || [];
        
        if (usedByDatasets.length > 0) {
          return (
            <div>
              <Tag color="green">
                已使用 ({usedByDatasets.length}个数据集)
              </Tag>
            </div>
          );
        } else {
          return (
            <div>
              <Tag color="orange">
                未使用
              </Tag>
            </div>
          );
        }
      },
    },
    {
      title: '操作',
      key: 'actions',
      render: (text: any, record: DataSource) => {
        const discoveryData = discoveryStatus[record.id];
        const hasDatasets = discoveryData?.datasets?.length > 0;
        
        return (
          <Space>
            <Tooltip title="编辑">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEditSource(record)}
              />
            </Tooltip>
            
            <Tooltip title="发现数据集">
              <Button
                size="small"
                type="primary"
                icon={<SearchOutlined />}
                loading={discoverDatasetsMutation.isLoading}
                onClick={() => discoverDatasetsMutation.mutate(record.id)}
              >
                发现数据集
              </Button>
            </Tooltip>
            
            {hasDatasets && (
              <Tooltip title="生成数据集">
                <Button
                  size="small"
                  type="default"
                  icon={<PlusOutlined />}
                  loading={generateDatasetsMutation.isLoading}
                  onClick={() => generateDatasetsMutation.mutate(record.id)}
                >
                  生成数据集
                </Button>
              </Tooltip>
            )}
            
            <Popconfirm
              title="确定要删除这个数据源吗？"
              onConfirm={() => deleteSourceMutation.mutate(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  // 数据集表格列定义
  const datasetColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Dataset) => (
        <div className="font-medium" title={record.description}>
          {text}
        </div>
      ),
    },
    {
      title: '数据源',
      dataIndex: 'data_source_id',
      key: 'data_source_id',
      render: (_value: any, record: any) => {
        const dataSourceInfo = record.data_source || record.data_source_id;
        if (!dataSourceInfo) {
          return <Tag>未知</Tag>;
        }
        if (typeof dataSourceInfo === 'string') {
          return <Tag color="green">{dataSourceInfo}</Tag>;
        }
        if (typeof dataSourceInfo === 'object') {
          const label = dataSourceInfo.name || dataSourceInfo.id || '未知';
          return <Tag color="green">{String(label)}</Tag>;
        }
        return <Tag color="green">{String(dataSourceInfo)}</Tag>;
      },
    },
    {
      title: '指标代码',
      dataIndex: 'indicator_code',
      key: 'indicator_code',
      render: (code: string) => code || '-',
    },
    {
      title: '预览限制',
      dataIndex: 'preview_limit',
      key: 'preview_limit',
    },
    {
      title: '导入限制',
      dataIndex: 'import_limit',
      key: 'import_limit',
      render: (limit: number) => limit || '无限制',
    },
    {
      title: '操作',
      key: 'actions',
      render: (text: any, record: Dataset) => (
        <Space>
          <Tooltip title="编辑">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEditDataset(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个数据集吗？"
            onConfirm={() => deleteDatasetMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (sourcesLoading || datasetsLoading) {
    return (
      <div className="p-6">
        <Spin size="large" />
      </div>
    );
  }

  const totalApis = apisData?.apis?.length ?? 0;
  const totalSources = sourcesData?.datasources?.length ?? 0;
  const totalDatasets = datasetsData?.datasets?.length ?? 0;

  const heroActions = (
    <Space size={12} wrap>
      <Button
        type="primary"
        icon={<SettingOutlined />}
        onClick={() => setIsWizardOpen(true)}
        className="enhanced-btn"
      >
        配置向导
      </Button>
      <Button icon={<DownloadOutlined />} onClick={handleExportConfig} className="enhanced-btn">
        导出配置
      </Button>
      <Button icon={<UploadOutlined />} className="enhanced-btn">导入配置</Button>
    </Space>
  );

  return (
    <PageContainer>
      <PageHero
        icon={<SettingOutlined className="page-hero__title-icon" />}
        badge="API导入数据源"
        title="配置管理"
        subtitle="统一管理外部API数据源、数据集与导入规则，保持平台配置一致可靠。"
        stats={[
          { label: '已配置API', value: totalApis },
          { label: '数据源', value: totalSources },
          { label: '数据集', value: totalDatasets },
        ]}
        actions={heroActions}
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        destroyInactiveTabPane
        style={{ marginBottom: 24 }}
      >
        <TabPane tab="API配置" key="api">
          <Card className="page-section-card" title="API配置管理">
            <Alert
              message="快速开始"
              description={
                <div>
                  <p><strong>配置第三方API的简单步骤：</strong></p>
                  <p>1. 点击下方"开始配置API"按钮开始配置</p>
                  <p>2. 填写API基础信息（URL、端点、认证方式等）</p>
                  <p>3. 点击"配置数据源"按钮，基于API配置字段映射和过滤器</p>
                  <p>4. 在"数据集"标签页中添加具体的数据集</p>
                  <p><strong>💡 关系说明：</strong>1个API → 1个数据源 → 多个数据集</p>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            {/* API管理表格 */}
            <div style={{ marginBottom: '20px' }}>
              <Title level={4}>API管理</Title>
              <Table
                columns={[
                  {
                    title: 'API名称',
                    dataIndex: 'name',
                    key: 'name',
                    render: (text: string, record: any) => (
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{text}</div>
                        <div style={{ fontSize: '12px', color: '#666' }}>{record.description}</div>
                      </div>
                    ),
                  },
                  {
                    title: 'API类型',
                    dataIndex: 'api_type',
                    key: 'api_type',
                    render: (type: string) => <Tag color="blue">{type}</Tag>,
                  },
                  {
                    title: 'API地址',
                    dataIndex: 'base_url',
                    key: 'api_url',
                    render: (url: string, record: any) => (
                      <Text code>{url}{record.endpoint}</Text>
                    ),
                  },
                  {
                    title: '认证状态',
                    dataIndex: 'auth',
                    key: 'auth_status',
                    render: (auth: any, record: any) => {
                      // 检查auth字段是否存在且有效
                      if (!auth || typeof auth !== 'object') {
                        return <Tag color="orange">需要配置</Tag>;
                      }
                      
                      // 检查认证类型
                      if (auth.auth_type === 'none') {
                        return <Tag color="green">无需认证</Tag>;
                      }
                      
                      // 检查是否有具体的认证信息
                      if (auth.auth_type === 'api_key' && auth.api_key) {
                        return <Tag color="blue">已配置密钥</Tag>;
                      }
                      
                      if (auth.auth_type === 'username_password' && auth.username) {
                        return <Tag color="blue">已配置账号</Tag>;
                      }
                      
                      if (auth.auth_type === 'oauth2' && auth.client_id) {
                        return <Tag color="blue">已配置OAuth2</Tag>;
                      }
                      
                      // 如果认证类型已设置但没有具体信息
                      if (auth.auth_type && auth.auth_type !== 'none') {
                        return <Tag color="orange">需要配置</Tag>;
                      }
                      
                      return <Tag color="orange">需要配置</Tag>;
                    },
                  },
                  {
                    title: '状态',
                    key: 'status',
                    render: (record: any) => {
                      // 检查是否有数据源使用此API
                      const usedBySources = sourcesData?.datasources?.filter(
                        (source: any) => source.api_id === record.id
                      ) || [];
                      
                      if (usedBySources.length > 0) {
                        return (
                          <div>
                            <Tag color="green">
                              已关联 ({usedBySources.length}个数据源)
                            </Tag>
                          </div>
                        );
                      } else {
                        return (
                          <div>
                            <Tag color="orange">
                              未关联
                            </Tag>
                          </div>
                        );
                      }
                    },
                  },
                  {
                    title: '操作',
                    key: 'actions',
                    render: (text: any, record: any) => {
                      return (
                        <Space>
                          <Button
                            type="link"
                            size="small"
                            onClick={() => {
                              // 测试API连接
                              testApiConnection(record);
                            }}
                            loading={false}
                          >
                            测试API
                          </Button>
                          <Button
                            type="link"
                            size="small"
                            onClick={() => {
                              setEditingApi(record);
                              // 正确设置表单字段，包括认证信息
                              const formValues = {
                                ...record,
                                // 将auth对象中的字段平铺到表单中
                                auth_type: record.auth?.auth_type || 'none',
                                api_key: record.auth?.api_key || '',
                                api_key_header: record.auth?.api_key_header || 'X-API-Key',
                                username: record.auth?.username || '',
                                password: record.auth?.password || '',
                                client_id: record.auth?.client_id || '',
                                client_secret: record.auth?.client_secret || '',
                                auth_url: record.auth?.auth_url || '',
                                token_url: record.auth?.token_url || ''
                              };
                              apiForm.setFieldsValue(formValues);
                              setIsApiModalOpen(true);
                            }}
                          >
                            编辑API
                          </Button>
                          <Button
                            type="link"
                            size="small"
                            danger
                            onClick={() => {
                              Modal.confirm({
                                title: '确认删除',
                                content: `确定要删除API "${record.name}" 吗？此操作不可撤销。`,
                                okText: '删除',
                                okType: 'danger',
                                cancelText: '取消',
                                onOk: () => {
                                  deleteApiMutation.mutate(record.id);
                                },
                              });
                            }}
                          >
                            删除
                          </Button>
                        </Space>
                      );
                    },
                  },
                ]}
                dataSource={apisData?.apis || []}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </div>

            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingApi(null);
                  apiForm.resetFields();
                  setIsApiModalOpen(true);
                }}
              >
                {apisData && apisData.apis && apisData.apis.length > 0 ? '添加更多API' : '开始配置API'}
              </Button>
              <p style={{ marginTop: '16px', color: '#666' }}>
                {apisData && apisData.apis && apisData.apis.length > 0 
                  ? '添加更多API到您的配置中'
                  : '点击上方按钮开始配置您的第一个API'
                }
              </p>
            </div>
          </Card>
        </TabPane>
        
        <TabPane tab="数据源" key="sources">
          <Card
            className="page-section-card"
            title="数据源配置"
            extra={
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingSource(null);
                  form.resetFields();
                  setIsSourceModalOpen(true);
                }}
                className="enhanced-btn"
              >
                添加数据源
              </Button>
            }
          >
            <>
              <Alert
                message="配置提示"
                description="请先在'API配置'标签页中配置API基础信息，然后在此页面创建基于该API的数据源。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              {sourcesError && (
                <Alert
                  message="加载数据源失败"
                  description={String(sourcesError) || '未知错误'}
                  type="error"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}
              {sourcesLoading && <div style={{ textAlign: 'center', padding: '20px' }}>加载中...</div>}
              {!sourcesLoading && !sourcesError && (
                <>
                  {/* 数据集发现状态显示 */}
                  {Object.keys(discoveryStatus).length > 0 && (
                    <Alert
                      message="数据集发现状态"
                      description={
                        <div>
                          {Object.entries(discoveryStatus).map(([sourceId, data]) => {
                            const sourceInfo = data?.data_source_name ?? data?.data_source;
                            const displayName = typeof sourceInfo === 'string'
                              ? sourceInfo
                              : sourceInfo?.name || sourceInfo?.id || sourceId;

                            return (
                              <div key={sourceId} style={{ marginBottom: '8px' }}>
                                <Badge 
                                  count={data.datasets?.length || 0} 
                                  style={{ backgroundColor: '#52c41a' }}
                                />
                                <span style={{ marginLeft: '8px' }}>
                                  数据源 "{displayName}" 发现 {data.datasets?.length || 0} 个数据集
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      }
                      type="info"
                      showIcon
                      style={{ marginBottom: '16px' }}
                    />
                  )}
                  
                  <Table
                    columns={sourceColumns}
                    dataSource={sourcesData?.datasources || []}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                  />
                </>
              )}
            </>
          </Card>
        </TabPane>

        <TabPane tab="数据集" key="datasets">
          <Card
            className="page-section-card"
            title="数据集配置"
            extra={
              <Space>
                <Popconfirm
                  title="确定要删除所有数据集吗？"
                  description="此操作不可恢复，将删除所有数据集配置。"
                  onConfirm={() => deleteAllDatasetsMutation.mutate()}
                  okText="确定删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    icon={<DeleteOutlined />}
                    disabled={!datasetsData?.datasets || datasetsData.datasets.length === 0}
                    className="enhanced-btn"
                  >
                    删除所有数据集
                  </Button>
                </Popconfirm>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditingDataset(null);
                    setIsDatasetModalOpen(true);
                  }}
                  className="enhanced-btn"
                >
                  添加数据集
                </Button>
              </Space>
            }
          >
            <Alert
              message="配置提示"
              description="请先在'API配置'和'数据源'标签页中完成配置，然后再添加数据集。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Table
              columns={datasetColumns}
              dataSource={datasetsData?.datasets || []}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </Card>
        </TabPane>
      </Tabs>


      {/* API配置模态框 */}
      <Modal
        title={editingApi ? '编辑API配置' : '添加API配置'}
        open={isApiModalOpen}
        onCancel={() => {
          setIsApiModalOpen(false);
          setEditingApi(null);
          apiForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={apiForm}
          layout="vertical"
          onFinish={handleApiSubmit}
          onFinishFailed={(errorInfo) => {
            console.log('表单验证失败:', errorInfo);
            message.error('请检查表单填写是否完整');
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="id"
                label="API ID"
                tooltip={editingApi ? "编辑时ID不可修改" : "系统将根据API名称自动生成唯一ID"}
              >
                {editingApi ? (
                  <Input 
                    value={editingApi.id} 
                    disabled 
                    style={{ backgroundColor: '#f5f5f5' }}
                  />
                ) : (
                  <Input 
                    placeholder="系统将自动生成" 
                    disabled 
                    style={{ backgroundColor: '#f5f5f5' }}
                    addonAfter={<span style={{ color: '#52c41a' }}>自动生成</span>}
                  />
                )}
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="API名称"
                rules={[{ required: true, message: '请输入API名称' }]}
              >
                <Input 
                  placeholder="API名称" 
                  onChange={(e) => {
                    // 基于API名称自动生成ID
                    if (!editingApi) { // 只在创建时自动生成
                      const name = e.target.value;
                      if (name) {
                        const autoId = name
                          .toLowerCase()
                          .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '_')
                          .replace(/_+/g, '_')
                          .replace(/^_|_$/g, '');
                        apiForm.setFieldValue('id', autoId);
                      }
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="category"
                label="类别"
                rules={[{ required: true, message: '请输入类别' }]}
              >
                <Input placeholder="API类别" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="source"
                label="数据源"
                rules={[{ required: true, message: '请输入数据源' }]}
              >
                <Input placeholder="数据源名称" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="API描述" />
          </Form.Item>

          {/* API基础信息 */}
          <Divider orientation="left">API基础信息</Divider>
          <Form.Item
            name="api_type"
            label="API类型"
            rules={[{ required: true, message: '请选择API类型' }]}
          >
            <Select placeholder="选择API类型">
              <Option value="REST">REST API</Option>
              <Option value="GraphQL">GraphQL</Option>
              <Option value="OData">OData</Option>
              <Option value="SOAP">SOAP</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>

          {/* 隐藏请求方法，默认为GET */}
          <Form.Item name="method" initialValue="GET" style={{ display: 'none' }}>
            <Input />
          </Form.Item>

          <Form.Item
            name="base_url"
            label="API基础地址"
            rules={[{ required: true, message: '请输入API基础地址' }]}
            tooltip="在API文档的'Getting Started'或'Base URL'部分可以找到"
            extra="例如：https://api.github.com 或 https://ghoapi.azureedge.net/api"
          >
            <Input 
              placeholder="https://api.example.com" 
              addonBefore="🌐"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="endpoint"
                label="API端点"
                rules={[{ required: true, message: '请输入API端点' }]}
                tooltip="具体的API路径，通常以 / 开头"
                extra="例如：/users 或 /v1/data"
              >
                <Input placeholder="/api/v1/data" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="timeout"
                label="超时时间(秒)"
                rules={[{ required: true, message: '请输入超时时间' }]}
                tooltip="API请求超时时间，建议30-60秒"
              >
                <InputNumber min={10} max={300} placeholder="30" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>


          {/* 认证配置 */}
          <Divider orientation="left">认证配置</Divider>
          <Form.Item
            name="auth_type"
            label="认证类型"
            rules={[{ required: true, message: '请选择认证类型' }]}
          >
            <Select 
              placeholder="选择认证类型"
              onChange={(value) => {
                // 重置认证相关字段
                apiForm.setFieldsValue({
                  api_key: '',
                  api_key_header: 'X-API-Key',
                  username: '',
                  password: '',
                  client_id: '',
                  client_secret: '',
                  auth_url: '',
                  token_url: ''
                });
              }}
            >
              <Option value="none">无需认证</Option>
              <Option value="api_key">API密钥</Option>
              <Option value="username_password">用户名密码</Option>
              <Option value="oauth2">OAuth2</Option>
            </Select>
          </Form.Item>

          {/* 动态显示认证字段 */}
          <Form.Item shouldUpdate={(prevValues, currentValues) => prevValues.auth_type !== currentValues.auth_type}>
            {({ getFieldValue }) => {
              const authType = getFieldValue('auth_type');
              
              if (authType === 'api_key') {
                return (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="api_key"
                        label="API密钥"
                        rules={[{ required: true, message: '请输入API密钥' }]}
                      >
                        <Input.Password placeholder="请输入API密钥" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="api_key_header"
                        label="密钥Header名称"
                        rules={[{ required: true, message: '请输入Header名称' }]}
                        tooltip="API密钥在HTTP请求头中的字段名"
                      >
                        <Input placeholder="X-API-Key" />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }
              
              if (authType === 'username_password') {
                return (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="username"
                        label="用户名"
                        rules={[{ required: true, message: '请输入用户名' }]}
                      >
                        <Input placeholder="请输入用户名" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="password"
                        label="密码"
                        rules={[{ required: true, message: '请输入密码' }]}
                      >
                        <Input.Password placeholder="请输入密码" />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }
              
              if (authType === 'oauth2') {
                return (
                  <div>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="client_id"
                          label="客户端ID"
                          rules={[{ required: true, message: '请输入客户端ID' }]}
                        >
                          <Input placeholder="请输入客户端ID" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="client_secret"
                          label="客户端密钥"
                          rules={[{ required: true, message: '请输入客户端密钥' }]}
                        >
                          <Input.Password placeholder="请输入客户端密钥" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="auth_url"
                          label="授权URL"
                          rules={[{ required: true, message: '请输入授权URL' }]}
                          tooltip="OAuth2授权服务器的授权端点"
                        >
                          <Input placeholder="https://example.com/oauth/authorize" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="token_url"
                          label="令牌URL"
                          rules={[{ required: true, message: '请输入令牌URL' }]}
                          tooltip="OAuth2授权服务器的令牌端点"
                        >
                          <Input placeholder="https://example.com/oauth/token" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                );
              }
              
              if (authType === 'none') {
                return (
                  <Alert
                    message="无需认证"
                    description="此API不需要任何认证信息，可以直接访问。"
                    type="info"
                    showIcon
                  />
                );
              }
              
              return null;
            }}
          </Form.Item>

          {/* 高级配置 */}
          <Divider orientation="left">
            <span>高级配置</span>
            <Tooltip title="点击展开高级技术配置">
              <Button 
                type="link" 
                size="small" 
                onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
                style={{ marginLeft: 8 }}
              >
                {showAdvancedConfig ? '收起' : '展开'}
              </Button>
            </Tooltip>
          </Divider>

          {showAdvancedConfig && (
            <div style={{ 
              background: '#f5f5f5', 
              padding: '16px', 
              borderRadius: '6px',
              marginBottom: '16px'
            }}>
              <Alert
                message="高级配置说明"
                description="这些是技术参数，通常使用默认值即可。只有在特殊情况下才需要修改。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              <Form.Item
                name="supports_pagination"
                label="支持分页"
                valuePropName="checked"
                tooltip="如果API支持分页，可以分批获取大量数据"
              >
                <Switch />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="max_page_size"
                    label="每次获取数据量"
                    rules={[{ required: true, message: '请输入每次获取的数据量' }]}
                    tooltip="每次从API获取多少条数据（建议1000-5000）"
                  >
                    <InputNumber min={100} max={10000} placeholder="1000" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="cache_duration"
                    label="数据缓存时间(分钟)"
                    rules={[{ required: true, message: '请输入缓存时间' }]}
                    tooltip="数据缓存多长时间，避免频繁请求API"
                  >
                    <InputNumber min={5} max={1440} placeholder="5" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="page_size_param"
                    label="页面大小参数"
                    tooltip="告诉API要获取多少条数据的参数名"
                    initialValue="$top"
                  >
                    <Input placeholder="$top" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="page_offset_param"
                    label="页面偏移参数"
                    tooltip="告诉API从第几条开始获取的参数名"
                    initialValue="$skip"
                  >
                    <Input placeholder="$skip" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="count_param"
                    label="计数参数"
                    tooltip="告诉API返回总数据量的参数名"
                    initialValue="$count"
                  >
                    <Input placeholder="$count" />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          )}

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsApiModalOpen(false)}>
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                loading={createSourceMutation.isLoading || updateSourceMutation.isLoading}
              >
                {editingApi ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 数据源编辑模态框 */}
      <Modal
        title={editingSource ? '编辑数据源' : '添加数据源'}
        open={isSourceModalOpen}
        onCancel={() => {
          setIsSourceModalOpen(false);
          setEditingSource(null);
          form.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSourceSubmit}
        >
          <Alert
            message="数据源配置说明"
            description="数据源基于已配置的API，负责定义字段映射、过滤器和数据处理规则。API的认证信息在API配置中管理。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="api_id"
                label="选择API"
                rules={[{ required: true, message: '请选择API' }]}
              >
                <Select 
                  placeholder="请选择API"
                  showSearch
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  dropdownStyle={{ maxHeight: 300, overflow: 'auto' }}
                  onChange={(value, option: any) => {
                    // 当选择API时，自动填充API相关信息
                    const selectedApi = apisData?.apis?.find((api: any) => api.id === value);
                    if (selectedApi) {
                      // 获取当前表单值，检查是否已有该API的字段映射配置
                    // 只在创建新数据源时自动填充，编辑时只更新技术字段
                      const updateFields: any = {
                        // API基本信息（只设置字符串/数字类型）
                        api_type: selectedApi.api_type,
                        base_url: selectedApi.base_url,
                        endpoint: selectedApi.endpoint,
                        // auth, field_mappings, filters 不设置到表单，避免渲染对象错误
                        // 数据源必需字段
                        category: selectedApi.category,
                        source: selectedApi.source,
                        // 分页配置
                        supports_pagination: selectedApi.supports_pagination,
                        page_size_param: selectedApi.page_size_param,
                        page_offset_param: selectedApi.page_offset_param,
                        count_param: selectedApi.count_param,
                        max_page_size: selectedApi.max_page_size,
                        cache_duration: selectedApi.cache_duration,
                      };
                      
                      // 字段映射和过滤器暂存到state或临时变量，不设置到表单
                      // 在提交时再从selectedApi中获取
                      if (!editingSource) {
                        // 创建新数据源时，自动生成名称和描述
                        updateFields.name = `${selectedApi.name} 数据源`;
                        updateFields.description = `基于${selectedApi.name} API配置`;
                      }
                      
                      form.setFieldsValue(updateFields);
                    }
                  }}
                >
                  {apisData?.apis?.map((api: any) => (
                    <Option 
                      key={api.id} 
                      value={api.id} 
                      label={`${api.name} (${api.api_type})`}
                      title={`${api.name} - ${api.api_type} - ${api.base_url}${api.endpoint}`}
                    >
                      {api.name} ({api.api_type})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="id"
                label="数据源ID"
                tooltip="系统将自动生成唯一ID"
              >
                <Input 
                  placeholder="系统将自动生成" 
                  disabled 
                  addonAfter="自动生成"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="名称"
                rules={[{ required: true, message: '请输入名称' }]}
              >
                <Input placeholder="数据源名称" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="description"
                label="描述"
              >
                <Input.TextArea 
                  placeholder="数据源描述" 
                  rows={3}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* 隐藏字段 - 从选中的API自动获取 */}
          <Form.Item name="category" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="source" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="api_type" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="base_url" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="endpoint" hidden>
            <Input />
          </Form.Item>
          {/* 对象和数组字段不渲染到表单中，避免React渲染错误 */}
          <Form.Item name="supports_pagination" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="page_size_param" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="page_offset_param" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="count_param" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="max_page_size" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="cache_duration" hidden>
            <Input />
          </Form.Item>


          <Divider>字段映射</Divider>
          <Form.List name="field_mappings">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card key={key} size="small" className="mb-2">
                    <Row gutter={8}>
                      <Col span={6}>
                        <Form.Item
                          {...restField}
                          name={[name, 'api_field']}
                          label="API字段名"
                        >
                          <Input placeholder="API字段名" />
                        </Form.Item>
                      </Col>
                      <Col span={6}>
                        <Form.Item
                          {...restField}
                          name={[name, 'standard_field']}
                          label="标准字段名"
                        >
                          <Input placeholder="标准字段名" />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item
                          {...restField}
                          name={[name, 'field_type']}
                          label="字段类型"
                        >
                          <Select placeholder="类型">
                            <Option value="string">String</Option>
                            <Option value="integer">Integer</Option>
                            <Option value="float">Float</Option>
                            <Option value="date">Date</Option>
                            <Option value="boolean">Boolean</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item
                          {...restField}
                          name={[name, 'required']}
                          valuePropName="checked"
                        >
                          <Checkbox>必需</Checkbox>
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Button
                          type="link"
                          danger
                          onClick={() => remove(name)}
                        >
                          删除
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() => add()}
                    block
                    icon={<PlusOutlined />}
                  >
                    添加字段映射
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Form.Item>
            <Space>
              <Button onClick={() => setIsSourceModalOpen(false)}>
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={createSourceMutation.isLoading || updateSourceMutation.isLoading}
              >
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 数据集编辑模态框 */}
      <Modal
        title={editingDataset ? '编辑数据集' : '添加数据集'}
        open={isDatasetModalOpen}
        onCancel={() => {
          setIsDatasetModalOpen(false);
          setEditingDataset(null);
          datasetForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form 
          form={datasetForm}
          layout="vertical"
          onFinish={(values) => {
            // TODO: 实现数据集保存逻辑
            console.log('Dataset values:', values);
            message.success('数据集保存成功');
            setIsDatasetModalOpen(false);
            setEditingDataset(null);
            datasetForm.resetFields();
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="id"
                label="数据集ID"
                rules={[{ required: true, message: '请输入数据集ID' }]}
              >
                <Input placeholder="数据集唯一标识" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="名称"
                rules={[{ required: true, message: '请输入名称' }]}
              >
                <Input placeholder="数据集名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="category"
                label="类别"
                rules={[{ required: true, message: '请输入类别' }]}
              >
                <Input placeholder="数据集类别" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="data_source_id"
                label="数据源"
                rules={[{ required: true, message: '请选择数据源' }]}
              >
                <Select placeholder="选择数据源">
                  {sourcesData?.datasources?.map((source: DataSource) => (
                    <Option key={source.id} value={source.id}>
                      {source.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="indicator_code"
                label="指标代码"
              >
                <Input placeholder="指标代码（可选）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="preview_limit"
                label="预览限制"
                rules={[{ required: true, message: '请输入预览限制' }]}
              >
                <Input type="number" placeholder="50" />
              </Form.Item>
            </Col>
          </Row>


          <Form.Item>
            <Space>
              <Button onClick={() => {
                setIsDatasetModalOpen(false);
                setEditingDataset(null);
                datasetForm.resetFields();
              }}>
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
              >
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 配置向导抽屉 */}
      <Drawer
        title="配置向导"
        placement="right"
        width={800}
        open={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      >
        <ConfigWizard
          onComplete={handleWizardComplete}
          onClose={() => setIsWizardOpen(false)}
        />
      </Drawer>

      {/* 数据预览模态框 */}
    </PageContainer>
  );
};

export default ConfigManagement;
