import React, { useState } from 'react';
import {
  Card,
  Input,
  Select,
  Button,
  Table,
  Space,
  message,
  Typography,
  Row,
  Col,
  Tag,
  Modal,
  Form,
  Descriptions,
  Divider,
  Alert,
  Spin,
  Tooltip,
  Badge,
  Tabs,
  Switch,
} from 'antd';
import {
  DownloadOutlined,
  EyeOutlined,
  CloudOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { externalDataAPI } from '../services/api';
import { extractErrorMessage } from '../utils/error';
import { formatDateTime } from '../utils/datetime';
import PageContainer from '../components/PageContainer';
import PageHero from '../components/PageHero';

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

interface Dataset {
  id: string;
  dataset_id: string;  // 添加dataset_id字段
  title: string;
  description: string;
  source: string;
  category: string;
  last_updated?: string;
  record_count: number;
  variables: string[] | number;
  api_endpoint: string;
  data_format: string;
  access_level: string;
  note?: string;
  fetched_at?: string;
}

const formatLastUpdated = (value?: string | null) => {
  if (!value) {
    return '暂无数据';
  }
  const formatted = formatDateTime(value);
  return formatted === '-' ? '暂无数据' : formatted;
};

const GlobalDatasets: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  
  // 数据更新相关状态 - 改为按数据集管理
  const [updatingDatasets, setUpdatingDatasets] = useState<Set<string>>(new Set());
  const [datasetFieldCounts, setDatasetFieldCounts] = useState<Record<string, number>>({});
  const [datasetRecordCounts, setDatasetRecordCounts] = useState<Record<string, number>>({});
  const [datasetLastUpdated, setDatasetLastUpdated] = useState<Record<string, string>>({});
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [importForm] = Form.useForm();
  const [paramsModalVisible, setParamsModalVisible] = useState(false);
  const [paramsForm] = Form.useForm();
  const [realPreviewData, setRealPreviewData] = useState<any>(null);
  const [configuredQueryParams, setConfiguredQueryParams] = useState<any>(null); // 新增状态：存储已配置的查询参数
  const [savedQueryParams, setSavedQueryParams] = useState<{[key: string]: any}>({}); // 新增状态：存储已保存的查询参数
  const [previewDataCache, setPreviewDataCache] = useState<{[key: string]: any}>({}); // 新增状态：存储预览数据缓存
  const [activeTab, setActiveTab] = useState<'all' | 'who'>('all');
  const [showEmptyDatasets, setShowEmptyDatasets] = useState<boolean>(true); // 新增：控制是否显示空数据集
  const queryClient = useQueryClient();

  // 从统一数据API获取数据集列表
  const { data: datasetsData, isLoading: datasetsLoading, refetch } = useQuery(
    ['datasets', searchQuery, selectedCategory, selectedSource, activeTab, currentPage],
    () => externalDataAPI.getDatasets({ limit: 5000, offset: 0 }),
    {
      keepPreviousData: true,
      onSuccess: async (data) => {
        // 加载所有数据集的预览缓存
        const datasets = data?.data?.datasets || [];
        const cachePromises = datasets.map(async (dataset: any) => {
          try {
            const response = await externalDataAPI.getPreviewCache(dataset.dataset_id);
            if (response.data.cached && response.data.data) {
              return { datasetId: dataset.dataset_id, cache: response.data };
            }
          } catch (error) {
            console.warn(`获取数据集 ${dataset.dataset_id} 预览缓存失败:`, error);
          }
          return null;
        });
        
        const cacheResults = await Promise.all(cachePromises);
        const newCache: {[key: string]: any} = {};
        const newRecordCounts: {[key: string]: number} = {};
        const newFieldCounts: {[key: string]: number} = {};
        const newLastUpdated: {[key: string]: string} = {};
        
        cacheResults.forEach(result => {
          if (result) {
            newCache[result.datasetId] = result.cache.data;
            // 收集所有更新数据
            if (result.cache.total_records !== undefined) {
              newRecordCounts[result.datasetId] = result.cache.total_records;
            }
            if (result.cache.data?.columns) {
              newFieldCounts[result.datasetId] = result.cache.data.columns.length;
            }
            if (result.cache.cached_at) {
              newLastUpdated[result.datasetId] = result.cache.cached_at;
            }
          }
        });
        
        // 一次性批量更新所有状态
        setPreviewDataCache(prev => ({ ...prev, ...newCache }));
        setDatasetRecordCounts(prev => ({ ...prev, ...newRecordCounts }));
        setDatasetFieldCounts(prev => ({ ...prev, ...newFieldCounts }));
        setDatasetLastUpdated(prev => ({ ...prev, ...newLastUpdated }));
        
        // 加载所有筛选条件
        try {
          const filterParamsResponse = await externalDataAPI.getAllFilterParams();
          if (filterParamsResponse.data.filter_params) {
            setSavedQueryParams(filterParamsResponse.data.filter_params);
          }
        } catch (error) {
          console.warn('加载筛选条件失败:', error);
        }
      },
      onError: (error) => {
        console.error('获取数据集失败:', error);
      },
      select: (data) => {
        // 前端过滤和分页
        console.log('数据集API响应:', data);
        let filteredDatasets = data?.data?.datasets || [];
        
        // 按搜索词过滤
        if (searchQuery) {
          filteredDatasets = filteredDatasets.filter((dataset: any) =>
            dataset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            dataset.description.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        
        // 按类别过滤
        if (selectedCategory) {
          filteredDatasets = filteredDatasets.filter((dataset: any) =>
            dataset.category === selectedCategory
          );
        }
        
        // 按数据源过滤
        if (selectedSource) {
          filteredDatasets = filteredDatasets.filter((dataset: any) =>
            dataset.data_source_id === selectedSource
          );
        }
        
        // 按标签过滤 - 由于所有数据集都来自WHO，我们按数据源ID来区分
        if (activeTab !== 'all') {
          if (activeTab === 'who') {
            // WHO标签：显示所有WHO相关的数据集
            filteredDatasets = filteredDatasets.filter((dataset: any) =>
              dataset.data_source_id?.startsWith('who_') || dataset.source === 'WHO'
            );
          } else if (activeTab === 'external') {
            // External标签：显示非WHO的数据集（目前没有，所以显示空）
            filteredDatasets = filteredDatasets.filter((dataset: any) =>
              !dataset.data_source_id?.startsWith('who_') && dataset.source !== 'WHO'
            );
          }
        }
        
        // 可选过滤空数据集 - 根据用户选择决定是否显示空数据集
        if (!showEmptyDatasets) {
          filteredDatasets = filteredDatasets.filter((dataset: any) => {
            const datasetId = dataset.dataset_id;
            const hasBeenUpdated = datasetLastUpdated[datasetId] !== undefined;
            const recordCount = datasetRecordCounts[datasetId] ?? dataset.record_count;
            
            // 只过滤那些已更新且确认为0的数据集
            if (hasBeenUpdated && recordCount === 0) {
              return false;
            }
            return true;
          });
        }
        
        // 分页
        const total = filteredDatasets.length;
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedDatasets = filteredDatasets.slice(startIndex, endIndex);
        
        return {
          ...data,
          data: {
            datasets: paginatedDatasets,
            total_count: total
          }
        };
      }
    }
  );

  // 获取类别列表
  const { data: categoriesData } = useQuery(
    'external-categories',
    () => externalDataAPI.getCategories()
  );


  // 移除全量更新相关代码

  // 单个数据集数据更新（记录数、字段数、最后更新时间）
  const updateDatasetFieldCount = useMutation(
    (datasetId: string) => externalDataAPI.updateDatasetFieldCount(datasetId),
    {
      onMutate: (datasetId) => {
        setUpdatingDatasets(prev => new Set(prev).add(datasetId));
      },
      onSuccess: async (data, datasetId) => {
        // 直接使用后端返回的预览数据，避免竞态条件
        const previewData = data.data.preview_data;
        
        // 批量更新所有状态
        setDatasetFieldCounts(prev => ({
          ...prev,
          [datasetId]: data.data.field_count
        }));
        setDatasetRecordCounts(prev => ({
          ...prev,
          [datasetId]: data.data.record_count
        }));
        setDatasetLastUpdated(prev => ({
          ...prev,
          [datasetId]: data.data.last_updated
        }));
        
        if (previewData) {
          setPreviewDataCache(prev => ({
            ...prev,
            [datasetId]: previewData
          }));
        }
        
        setUpdatingDatasets(prev => {
          const newSet = new Set(prev);
          newSet.delete(datasetId);
          return newSet;
        });
        
        message.success(`数据集 ${datasetId} 数据更新完成`);
      },
      onError: (error: any, datasetId) => {
        setUpdatingDatasets(prev => {
          const newSet = new Set(prev);
          newSet.delete(datasetId);
          return newSet;
        });
        
        // 检查是否为410错误（数据集已删除）
        if (error.response?.status === 410) {
          Modal.warning({
            title: '数据集已删除',
            content: (
              <div>
                <p>{extractErrorMessage(error)}</p>
                <p style={{ marginTop: '8px', color: '#666' }}>
                  此数据集已在配置管理中删除，点击"刷新"按钮更新数据集列表。
                </p>
              </div>
            ),
            okText: '刷新页面',
            onOk: () => {
              window.location.reload();
            }
          });
        } else {
          message.error(`更新失败: ${extractErrorMessage(error)}`);
        }
      }
    }
  );

  // 移除全量更新监控代码

  // 获取数据源列表
  const { data: sourcesData } = useQuery(
    'external-sources',
    () => externalDataAPI.getSources()
  );


  // 导入数据集
  const importDatasetMutation = useMutation(
    ({ datasetId, name, description, queryParams }: { datasetId: string; name: string; description: string; queryParams?: any }) =>
      externalDataAPI.importDataset(datasetId, name, description, queryParams),
    {
      onSuccess: () => {
        message.success('数据集导入成功！');
        setImportModalVisible(false);
        importForm.resetFields();
        // 刷新本地数据集列表
        queryClient.invalidateQueries('datasets');
      },
      onError: (error: any) => {
        message.error(`导入失败: ${extractErrorMessage(error, '未知错误')}`);
      }
    }
  );

  // 预览数据集
  const { data: previewData, isLoading: previewLoading } = useQuery(
    ['preview', selectedDataset?.dataset_id],
    () => externalDataAPI.previewDataset(selectedDataset!.dataset_id, 10),
    {
      enabled: !!selectedDataset && previewModalVisible,
      staleTime: 5 * 60 * 1000,
      cacheTime: 5 * 60 * 1000,
      onSuccess: (data) => {
        console.log('预览数据获取成功:', data);
      },
      onError: (error) => {
        console.error('预览数据获取失败:', error);
      }
    }
  );

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // 搜索时重置到第一页
  };

  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
  };

  const handleSourceChange = (value: string) => {
    setSelectedSource(value);
  };


  const handlePreview = (dataset: Dataset) => {
    // 检查是否已经更新过数据
    const hasBeenUpdated = datasetRecordCounts[dataset.dataset_id] !== undefined;
    
    if (!hasBeenUpdated) {
      message.warning('请先点击"更新数据"按钮获取最新数据，然后才能预览');
      return;
    }
    
    // 检查是否有缓存的预览数据
    const cachedPreviewData = previewDataCache[dataset.dataset_id];
    if (cachedPreviewData) {
      setRealPreviewData(cachedPreviewData);
      setPreviewModalVisible(true);
    } else {
      // 如果没有缓存，提示用户重新更新数据
      message.warning('预览数据已过期，请重新点击"更新数据"按钮');
    }
  };

  const handleImport = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    importForm.setFieldsValue({
      name: dataset.title,
      description: dataset.description
    });
    setImportModalVisible(true);
  };

  // 获取数据集的真实字段列表（用于动态筛选）
  const [datasetColumns, setDatasetColumns] = useState<any[]>([]);
  const [selectedFilterFields, setSelectedFilterFields] = useState<string[]>([]);
  
  const { isLoading: columnsLoading } = useQuery(
    ['dataset-columns', selectedDataset?.dataset_id],
    async () => {
      // 首先尝试从预览缓存获取字段
      const datasetId = selectedDataset?.dataset_id || '';
      const cacheResponse = await externalDataAPI.getPreviewCache(datasetId);
      
      if (cacheResponse.data.cached && cacheResponse.data.data?.columns) {
        return {
          data: {
            columns: cacheResponse.data.data.columns,
            source: 'cache'
          }
        };
      }
      
      // 如果缓存中没有，调用预览接口获取
      const previewResponse = await externalDataAPI.previewDataset(datasetId, 10);
      return {
        data: {
          columns: previewResponse.data.columns || [],
          source: 'api'
        }
      };
    },
    {
      enabled: !!selectedDataset?.dataset_id && paramsModalVisible,
      onSuccess: (response) => {
        const columns = response?.data?.columns || [];
        setDatasetColumns(columns);
        
        // 只在没有保存参数时才重置
        // 如果有保存的参数，会在 handleConfigureParams 中恢复
        if (!selectedDataset || !savedQueryParams[selectedDataset.dataset_id]) {
          setSelectedFilterFields([]);
          paramsForm.resetFields();
        }
      },
      onError: (error) => {
        console.error('获取数据集字段失败:', error);
        message.warning('无法获取数据集字段，请先更新数据');
        setDatasetColumns([]);
      }
    }
  );

  // 使用参数预览数据集
  const previewWithParamsMutation = useMutation(
    (params: any) => externalDataAPI.previewDatasetWithParams(selectedDataset?.dataset_id || '', params),
    {
      onSuccess: (response) => {
        const payload = response?.data || response;
        const previewPayload = payload?.preview && payload.preview.length > 0 ? payload : null;

        if (previewPayload) {
          setRealPreviewData(previewPayload);
          setConfiguredQueryParams(previewPayload?.query_params ?? null);
        } else {
          setRealPreviewData(null);
          setConfiguredQueryParams(null);
        }
        setPreviewModalVisible(true);
        setParamsModalVisible(false);
        message.success('获取真实数据预览成功！');
      },
      onError: (error: any) => {
        message.error('获取真实数据失败，将显示示例数据');
        setRealPreviewData(null);
        setConfiguredQueryParams(null);
        setPreviewModalVisible(true);
        setParamsModalVisible(false);
      }
    }
  );

  const handleConfigureParams = (dataset: Dataset) => {
    setSelectedDataset(dataset);
    setParamsModalVisible(true);
    
    // 如果有已保存的参数，恢复到表单中
    if (savedQueryParams[dataset.dataset_id]) {
      setTimeout(() => {
        const savedParams = savedQueryParams[dataset.dataset_id];
        
        // 恢复表单值
        paramsForm.setFieldsValue(savedParams);
        
        // 从保存的参数中提取字段列表
        const fields = new Set<string>();
        Object.keys(savedParams).forEach(key => {
          // 提取字段名（去掉 _condition 或 _value 后缀）
          if (key.endsWith('_condition') || key.endsWith('_value')) {
            const fieldName = key.replace(/_condition$|_value$/, '');
            fields.add(fieldName);
          }
        });
        
        // 恢复选中的字段
        setSelectedFilterFields(Array.from(fields));
      }, 100);
    } else {
      // 如果没有保存的参数，清空选中的字段
      setSelectedFilterFields([]);
    }
  };

  const handlePreviewWithParams = async (values: any) => {
    try {
      if (!selectedDataset) {
        message.error('未选择数据集');
        return;
      }

      // 从缓存中获取原始数据
      const cachedData = previewDataCache[selectedDataset.dataset_id];
      if (!cachedData || !cachedData.data) {
        message.error('请先更新数据以获取预览');
        return;
      }

      const allData = cachedData.data;
      const allColumns = cachedData.columns || [];

      // 提取筛选条件
      const filters: any[] = [];
      const fields = new Set<string>();
      Object.keys(values || {}).forEach(key => {
        if (key.endsWith('_condition') || key.endsWith('_value')) {
          const fieldName = key.replace(/_condition$|_value$/, '');
          fields.add(fieldName);
        }
      });

      fields.forEach(field => {
        const condition = values[`${field}_condition`];
        const value = values[`${field}_value`];
        if (condition && value) {
          filters.push({ field, operator: condition, value });
        }
      });

      console.log('应用筛选条件:', filters);
      console.log('数据列名:', allColumns);
      console.log('第一条数据示例:', allData[0]);

      // 在前端应用筛选
      let filteredData = allData;
      if (filters.length > 0) {
        filteredData = allData.filter((row: any) => {
          const matchResult = filters.every(filter => {
            const fieldValue = row[filter.field];
            const filterValue = filter.value;

            // 调试：输出字段值
            if (filteredData.length < 5) {
              console.log(`筛选字段: ${filter.field}, 行值: ${fieldValue}, 筛选值: ${filterValue}, 操作符: ${filter.operator}`);
            }

            // 如果字段值不存在，跳过该行
            if (fieldValue === undefined || fieldValue === null) {
              console.warn(`字段 ${filter.field} 在数据中不存在或为空`);
              return false;
            }

            // 根据操作符进行筛选
            switch (filter.operator) {
              case 'equals':
                // 对数字和字符串都进行严格比较
                const match = String(fieldValue).trim() === String(filterValue).trim();
                if (!match && filteredData.length < 5) {
                  console.log(`  不匹配: "${fieldValue}" !== "${filterValue}"`);
                }
                return match;
              case 'contains':
                return String(fieldValue).toLowerCase().includes(String(filterValue).toLowerCase());
              case 'gt':
                return Number(fieldValue) > Number(filterValue);
              case 'lt':
                return Number(fieldValue) < Number(filterValue);
              case 'gte':
                return Number(fieldValue) >= Number(filterValue);
              case 'lte':
                return Number(fieldValue) <= Number(filterValue);
              case 'not_equals':
                return String(fieldValue) !== String(filterValue);
              default:
                return true;
            }
          });
          return matchResult;
        });
      }

      console.log(`筛选结果: ${filteredData.length} / ${allData.length} 条记录`);
      console.log('筛选后的前3条数据:', filteredData.slice(0, 3));

      // 设置预览数据
      setRealPreviewData({
        dataset_id: selectedDataset.dataset_id,
        dataset_name: selectedDataset.title,
        columns: allColumns,
        data: filteredData.slice(0, 100), // 限制预览100条
        total_records: filteredData.length,
        note: filters.length > 0 
          ? `筛选后显示 ${filteredData.length} 条记录（共 ${allData.length} 条）`
          : `显示全部 ${allData.length} 条记录`,
        fetched_at: cachedData.fetched_at || new Date().toISOString()
      });

      setConfiguredQueryParams(values);
      setPreviewModalVisible(true);
      setParamsModalVisible(false);

      message.success(`筛选完成：找到 ${filteredData.length} 条记录`);

    } catch (error) {
      console.error('预览失败:', error);
      message.error('预览失败，请重试');
    }
  };

  const handleSaveParams = async (values: any) => {
    if (selectedDataset) {
      try {
        // 调用后端API保存筛选条件
        await externalDataAPI.saveFilterParams(selectedDataset.dataset_id, values);
        
        // 更新前端状态
        setSavedQueryParams(prev => ({
          ...prev,
          [selectedDataset.dataset_id]: values
        }));
        
        message.success('筛选条件已保存！');
        setParamsModalVisible(false);
      } catch (error) {
        console.error('保存筛选条件失败:', error);
        message.error('保存失败，请重试');
      }
    }
  };

  const handleImportSubmit = (values: any) => {
    if (selectedDataset) {
      // 检查是否有已保存的查询参数（可以为空对象，表示全量导入）
      const savedParams = savedQueryParams[selectedDataset.dataset_id];
      
      // 如果没有保存过任何配置（包括空配置），提示用户
      if (savedParams === undefined) {
        message.error('请先配置并保存筛选条件（可以不选择任何字段，表示全量导入）');
        return;
      }
      
      // 转换参数格式：从 {field_condition, field_value} 转换为 {field: value}
      const convertedParams: any = {};
      const fields = new Set<string>();
      
      // 提取所有字段名
      Object.keys(savedParams).forEach(key => {
        if (key.endsWith('_condition') || key.endsWith('_value')) {
          const fieldName = key.replace(/_condition$|_value$/, '');
          fields.add(fieldName);
        }
      });
      
      // 为每个字段构建参数
      fields.forEach(field => {
        const value = savedParams[`${field}_value`];
        if (value !== undefined && value !== null && value !== '') {
          convertedParams[field] = value;
        }
      });
      
      console.log('原始参数:', savedParams);
      console.log('转换后参数:', convertedParams);
      
      // 判断是全量导入还是筛选导入
      const isFullImport = Object.keys(convertedParams).length === 0;
      if (isFullImport) {
        console.log('执行全量导入（无筛选条件）');
      } else {
        console.log(`执行筛选导入（${Object.keys(convertedParams).length} 个筛选条件）`);
      }
      
      importDatasetMutation.mutate({
        datasetId: selectedDataset.dataset_id,
        name: values.name,
        description: values.description,
        queryParams: convertedParams // 空对象表示全量导入
      } as any);
    }
  };

  const getCategoryColor = (category: string) => {
    const colorMap: { [key: string]: string } = {
      // 英文键
      mortality: 'red',              // 死亡率 - 红色
      birth: 'green',                // 出生率 - 绿色
      behavior: 'blue',              // 健康行为 - 蓝色
      infectious_disease: 'orange',  // 传染病 - 橙色
      nutrition: 'purple',           // 营养 - 紫色
      cancer: 'magenta',             // 癌症 - 洋红色
      injury: 'volcano',             // 伤害 - 火山红
      mental_health: 'cyan',         // 心理健康 - 青色
      environmental: 'lime',         // 环境健康 - 酸橙绿
      immunization: 'gold',          // 免疫接种 - 金色
      occupational: 'geekblue',      // 职业健康 - 极客蓝
      substance_abuse: 'red',        // 药物滥用 - 红色
      maternal_health: 'pink',       // 孕产妇健康 - 粉色
      elderly_health: 'blue',        // 老年健康 - 蓝色
      chronic_disease: 'orange',     // 慢性病 - 橙色
      reproductive_health: 'magenta',// 生殖健康 - 洋红色
      child_health: 'cyan',          // 儿童健康 - 青色
      noncommunicable: 'volcano',    // 非传染病 - 火山红
      health_system: 'geekblue',     // 卫生系统 - 极客蓝
      hiv: 'red',                    // HIV - 红色
      tuberculosis: 'orange',        // 结核病 - 橙色
      malaria: 'green',              // 疟疾 - 绿色
      service: 'blue',               // 服务 - 蓝色
      financing: 'gold',             // 资金 - 金色
      workforce: 'purple',           // 劳动力 - 紫色
      medicines: 'lime',             // 药品 - 酸橙绿
      technology: 'cyan',            // 技术 - 青色
      
      // 中文键
      '死亡率': 'red',
      '出生率': 'green',
      '健康行为': 'blue',
      '传染病': 'orange',
      '营养': 'purple',
      '癌症': 'magenta',
      '伤害': 'volcano',
      '心理健康': 'cyan',
      '环境健康': 'lime',
      '免疫接种': 'gold',
      '职业健康': 'geekblue',
      '药物滥用': 'red',
      '孕产妇健康': 'pink',
      '老年健康': 'blue',
      '慢性病': 'orange',
      '生殖健康': 'magenta',
      '儿童健康': 'cyan',
      '非传染病': 'volcano',
      '卫生系统': 'geekblue',
      'HIV/艾滋病': 'red',
      '结核病': 'orange',
      '疟疾': 'green',
      '卫生服务': 'blue',
      '卫生资金': 'gold',
      '卫生人力': 'purple',
      '药品医疗': 'lime',
      '卫生技术': 'cyan',
      '人口健康': 'geekblue',
      '其他健康指标': 'purple'
    };
    return colorMap[category] || 'blue';
  };

  const getCategoryName = (category: string) => {
    const nameMap: { [key: string]: string } = {
      mortality: '死亡率',
      birth: '出生率',
      behavior: '健康行为',
      infectious_disease: '传染病',
      nutrition: '营养',
      cancer: '癌症',
      injury: '伤害',
      mental_health: '心理健康',
      environmental: '环境健康',
      immunization: '免疫接种',
      occupational: '职业健康',
      substance_abuse: '药物滥用',
      maternal_health: '孕产妇健康',
      elderly_health: '老年健康',
      chronic_disease: '慢性病',
      reproductive_health: '生殖健康',
      child_health: '儿童健康',
      noncommunicable: '非传染病',
      health_system: '卫生系统',
      hiv: 'HIV/艾滋病',
      tuberculosis: '结核病',
      malaria: '疟疾',
      service: '卫生服务',
      financing: '卫生资金',
      workforce: '卫生人力',
      medicines: '药品医疗',
      technology: '卫生技术'
    };
    return nameMap[category] || category;
  };

  const columns = [
    {
      title: '数据集名称',
      dataIndex: 'title',
      key: 'title',
      render: (name: string, record: Dataset) => (
        <div>
          <Text strong>{name}</Text>
          <br />
          <Space size={4}>
            <Badge 
              status={record.source === 'WHO' ? 'processing' : 'success'} 
              text={record.source}
            />
            <Text type="secondary" style={{ fontSize: '12px' }}>
              • {record.data_format || 'JSON'}
            </Text>
          </Space>
          {record.note && (
            <Text type="secondary" style={{ fontSize: '12px' }}>)
              {record.note}
            </Text>
          )}
        </div>
      )
    },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => (
        <Tag color={getCategoryColor(category)}>
          {getCategoryName(category)}
        </Tag>
      )
    },
    {
      title: '记录数',
      dataIndex: 'record_count',
      key: 'record_count',
      render: (count: number, record: Dataset) => {
        const recordCount = datasetRecordCounts[record.dataset_id];
        const actualCount = recordCount !== undefined ? recordCount : count;
        
        if (actualCount === 0) {
          // 如果已经更新过但记录数为0，显示"暂无数据"
          // 如果还没有更新过，显示"暂未更新"
          const hasBeenUpdated = recordCount !== undefined;
          return (
            <span style={{ 
              color: hasBeenUpdated ? '#ff4d4f' : '#1890ff', 
              fontStyle: 'italic' 
            }}>
              {hasBeenUpdated ? '暂无数据' : '暂未更新'}
            </span>
          );
        }
        
        return actualCount.toLocaleString();
      }
    },
    {
      title: '最后更新',
      dataIndex: 'last_updated',
      key: 'last_updated',
      render: (_value: string | undefined, record: Dataset) => {
        const lastUpdated = datasetLastUpdated[record.dataset_id];
        if (lastUpdated !== undefined) {
          return formatLastUpdated(lastUpdated);
        }
        return formatLastUpdated(record.last_updated || record.fetched_at);
      }
    },
    {
      title: '变量数',
      dataIndex: 'variables',
      key: 'variables',
      render: (variables: string[] | number, record: Dataset) => {
        const fieldCount = datasetFieldCounts[record.dataset_id];
        const isUpdating = updatingDatasets.has(record.dataset_id);
        
        if (isUpdating) {
          return (
            <Space>
              <Spin size="small" />
              <span>更新中...</span>
            </Space>
          );
        }
        
        if (fieldCount !== undefined) {
          return (
            <Space>
              <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                {fieldCount}
              </span>
              <span style={{ fontSize: '12px', color: '#666' }}>
                (已更新)
              </span>
            </Space>
          );
        }
        
        // 显示变量数，区分未更新和确实为0的情况
        const varCount = Array.isArray(variables) ? variables.length : variables;
        const hasFieldCount = datasetFieldCounts[record.dataset_id] !== undefined;
        
        if (varCount === 0 && !hasFieldCount) {
          return (
            <span style={{ color: '#1890ff', fontStyle: 'italic' }}>
              暂未更新
            </span>
          );
        }
        
        return varCount || 0;
      }
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: Dataset) => (
        <Space>
          <Tooltip title={
            datasetRecordCounts[record.dataset_id] !== undefined ? 
              "预览数据" : 
              "请先更新数据才能预览"
          }>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
              disabled={datasetRecordCounts[record.dataset_id] === undefined}
              style={{
                color: datasetRecordCounts[record.dataset_id] !== undefined ? 
                  '#1890ff' : '#d9d9d9'
              }}
            />
          </Tooltip>
          <Tooltip title={
            datasetRecordCounts[record.dataset_id] !== undefined ?
              (savedQueryParams[record.dataset_id] ? "已配置参数 - 点击重新配置" : "配置查询参数") :
              "请先更新数据"
          }>
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => handleConfigureParams(record)}
              disabled={datasetRecordCounts[record.dataset_id] === undefined}
              style={{ 
                color: savedQueryParams[record.dataset_id] ? '#52c41a' : 
                       (datasetRecordCounts[record.dataset_id] !== undefined ? '#1890ff' : '#d9d9d9')
              }}
            />
          </Tooltip>
          <Tooltip title="更新数据">
            <Button
              type="text"
              icon={<CloudOutlined />}
              loading={updatingDatasets.has(record.dataset_id)}
              onClick={() => updateDatasetFieldCount.mutate(record.dataset_id)}
            />
          </Tooltip>
          <Tooltip title={
            datasetRecordCounts[record.dataset_id] === undefined ? "请先更新数据" :
            (savedQueryParams[record.dataset_id] === undefined ? "请先配置筛选条件（可以不选字段以全量导入）" :
             (Object.keys(savedQueryParams[record.dataset_id]).length === 0 ? "全量导入（无筛选条件）" : 
              "筛选导入（使用已保存的筛选条件）"))
          }>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => handleImport(record)}
              disabled={datasetRecordCounts[record.dataset_id] === undefined}
            >
              导入
            </Button>
          </Tooltip>
        </Space>
      )
    }
  ];

  // 统计信息：外部数据集数量与累计记录数
  const externalCount = datasetsData?.data?.total_count || 0;
  const totalExternalRecords = Object.values(datasetRecordCounts).reduce((sum, cnt) => sum + (cnt || 0), 0);

  return (
    <PageContainer>
      <PageHero
        icon={<CloudOutlined className="page-hero__title-icon" />}
        badge="数据资源中心"
        title="外部数据集"
        subtitle="搜索和导入来自世界卫生组织(WHO)等官方平台的健康数据集"
        stats={[
          { label: '已注册数据源', value: sourcesData?.data?.sources?.length || 0 },
          { label: '外部数据集', value: externalCount },
          { label: '累计记录数', value: totalExternalRecords.toLocaleString() },
        ]}
      />

      {/* 数据源标签页 */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'all' | 'who')}
        style={{ marginBottom: 24 }}
        items={[
          {
            key: 'all',
            label: (
              <span>
                <CloudOutlined style={{ marginRight: 4 }} />
                全部数据源
              </span>
            ),
            children: null
          },
          {
            key: 'who',
            label: (
              <span>
                <Badge status="processing" />
                WHO 世界卫生组织
              </span>
            ),
            children: null
          }
        ]}
      />


      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Search
              placeholder="搜索数据集..."
              allowClear
              onSearch={handleSearch}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="选择类别"
              allowClear
              style={{ width: '100%' }}
              onChange={handleCategoryChange}
            >
              {categoriesData?.data?.categories?.map((category: string) => (
                <Option key={category} value={category}>
                  {getCategoryName(category)}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={6} md={4}>
            <Select
              placeholder="选择数据源"
              allowClear
              style={{ width: '100%' }}
              onChange={handleSourceChange}
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) =>
                String((option && (option as any).label) ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {(sourcesData?.data?.sources || []).map((src: any) => {
                const isObj = typeof src === 'object' && src !== null;
                const value = isObj ? (src.id || src.name || src.api_type || '') : src;
                const label = isObj
                  ? `${src.name || src.id || '未知'}${src.api_type ? ` (${src.api_type})` : ''}`
                  : String(src);
                const key = String(value || label);
                return (
                  <Option key={key} value={String(value || label)} label={label}>
                    {label}
                  </Option>
                );
              })}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space>
              <Button onClick={() => refetch()}>
                刷新
              </Button>
              <Text type="secondary">
                共 {datasetsData?.data?.total_count || 0} 个数据集
                {(() => {
                  const updatedCount = Object.keys(datasetLastUpdated).length;
                  const emptyCount = Object.entries(datasetRecordCounts).filter(
                    ([id, count]) => count === 0 && datasetLastUpdated[id]
                  ).length;
                  if (updatedCount > 0) {
                    return ` · 已更新 ${updatedCount} 个${emptyCount > 0 ? ` · 已隐藏 ${emptyCount} 个空数据集` : ''}`;
                  }
                  return '';
                })()}
              </Text>
            </Space>
          </Col>
          <Col xs={24} sm={6} md={8} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Space>
              <Text type="secondary">显示空数据集</Text>
              <Switch 
                checked={showEmptyDatasets} 
                onChange={setShowEmptyDatasets}
                checkedChildren="显示"
                unCheckedChildren="隐藏"
              />
              {!showEmptyDatasets && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  ({Object.entries(datasetRecordCounts).filter(([id, count]) => count === 0 && datasetLastUpdated[id]).length} 个空数据集已隐藏)
                </Text>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 数据集列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={datasetsData?.data?.datasets || []}
          loading={datasetsLoading}
          rowKey="dataset_id"
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: datasetsData?.data?.total_count || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, newPageSize) => {
              setCurrentPage(page);
              if (newPageSize && newPageSize !== pageSize) {
                setPageSize(newPageSize);
                setCurrentPage(1); // 改变每页条数时重置到第一页
              }
            },
            onShowSizeChange: (current, size) => {
              setPageSize(size);
              setCurrentPage(1); // 改变每页条数时重置到第一页
            }
          }}
        />
      </Card>

      {/* 预览模态框 */}
      <Modal
        title={
          <div>
            <Badge 
              status={selectedDataset?.source === 'WHO' ? 'processing' : 'success'} 
              text={selectedDataset?.source}
              style={{ marginRight: 8 }}
            />
            预览数据集: {selectedDataset?.title}
          </div>
        }
        open={previewModalVisible}
        onCancel={() => {
          setPreviewModalVisible(false);
          setRealPreviewData(null); // Clear real preview data when closing
          setConfiguredQueryParams(null); // Clear configured params
        }}
        width={800}
        footer={[
          <Button key="back" onClick={() => {
            setPreviewModalVisible(false);
            setParamsModalVisible(true);
          }}>
            返回配置参数
          </Button>,
          <Button key="close" onClick={() => {
            setPreviewModalVisible(false);
            setRealPreviewData(null); // Clear real preview data when closing
            setConfiguredQueryParams(null); // Clear configured params
          }}>
            关闭
          </Button>
        ]}
      >
        {previewLoading ? (
          <Spin size="large" style={{ textAlign: 'center', padding: 50 }} />
        ) : (
          <div>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="数据源">
                {selectedDataset?.source}
              </Descriptions.Item>
              <Descriptions.Item label="数据格式">
                {selectedDataset?.data_format}
              </Descriptions.Item>
              <Descriptions.Item label="总记录数">
              {(() => {
                // 优先使用缓存的记录数，然后是数据集中的记录数
                const cachedCount = datasetRecordCounts[selectedDataset?.dataset_id || ''];
                const previewCount = realPreviewData?.total_records || previewData?.data?.total_records;
                const count = cachedCount ?? previewCount ?? selectedDataset?.record_count ?? 0;
                return count ? count.toLocaleString() : '暂无数据';
              })()}
              </Descriptions.Item>
              <Descriptions.Item label="最后更新">
                {(() => {
                  // 优先使用缓存的更新时间
                  const cachedTime = datasetLastUpdated[selectedDataset?.dataset_id || ''];
                  const previewTime = realPreviewData?.fetched_at || previewData?.data?.fetched_at;
                  const time = cachedTime ?? previewTime ?? selectedDataset?.last_updated ?? selectedDataset?.fetched_at;
                  return formatLastUpdated(time);
                })()}
              </Descriptions.Item>
            </Descriptions>
            
            <Divider />
            
            <Title level={5}>变量列表</Title>
            <div style={{ marginBottom: 16 }}>
              {selectedDataset && Array.isArray(selectedDataset.variables) ? (
                selectedDataset.variables.map((variable, index) => (
                  <Tag key={index} style={{ marginBottom: 4 }}>
                    {variable}
                  </Tag>
                ))
              ) : (
                <Text type="secondary">
                  变量数量: {(() => {
                    const data = realPreviewData || previewData?.data;
                    const columns = data?.columns;
                    if (columns && Array.isArray(columns)) {
                      return columns.length;
                    }
                    return selectedDataset?.variables || 0;
                  })()}
                </Text>
              )}
            </div>
            
            <Title level={5}>数据预览</Title>
            {(() => {
              const data = realPreviewData || previewData?.data;
              // API返回的数据结构：data.data 包含预览数据，data.columns 包含列名
              const preview = data?.data || data?.preview;
              const columns = data?.columns;
              
              // 检查数据集是否已更新（有真实的字段数量）
              const hasUpdatedData = selectedDataset && 
                (datasetFieldCounts[selectedDataset.dataset_id] !== undefined || 
                 datasetRecordCounts[selectedDataset.dataset_id] !== undefined);
              
              // 调试信息
              console.log('预览数据调试:', {
                realPreviewData,
                previewData,
                data,
                preview,
                columns,
                previewLength: preview?.length,
                columnsLength: columns?.length,
                hasUpdatedData,
                datasetId: selectedDataset?.dataset_id,
                fieldCount: selectedDataset?.dataset_id ? datasetFieldCounts[selectedDataset.dataset_id] : undefined,
                recordCount: selectedDataset?.dataset_id ? datasetRecordCounts[selectedDataset.dataset_id] : undefined
              });
              
              if (preview && columns && Array.isArray(columns) && preview.length > 0) {
                // 限制最多显示10条记录
                const displayData = preview.slice(0, 10);
                const totalRecords = preview.length;
                
                return (
                  <div>
                    <Table
                      columns={columns.map((col: string) => ({
                        title: col,
                        dataIndex: col,
                        key: col
                      }))}
                      dataSource={displayData}
                      pagination={false}
                      size="small"
                      scroll={{ x: 1200 }}
                    />
                    {totalRecords > 10 && (
                      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                        显示前 10 条，共 {totalRecords} 条记录
                      </Text>
                    )}
                    {data?.note && (
                      <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                        {data.note}
                      </Text>
                    )}
                  </div>
                );
              } else if (!hasUpdatedData) {
                return (
                  <Alert
                    message="请先更新数据"
                    description="点击'更新数据'按钮获取真实的字段信息后再预览数据"
                    type="info"
                    showIcon
                    action={
                      <Button 
                        type="primary" 
                        size="small"
                        onClick={() => {
                          if (selectedDataset) {
                            updateDatasetFieldCount.mutate(selectedDataset.dataset_id);
                          }
                        }}
                        loading={selectedDataset ? updatingDatasets.has(selectedDataset.dataset_id) : false}
                      >
                        更新数据
                      </Button>
                    }
                  />
                );
              } else {
                return (
                  <Alert
                    message="暂无预览数据"
                    description="该数据集暂时没有可用的预览数据"
                    type="warning"
                    showIcon
                  />
                );
              }
            })()}
            
            {configuredQueryParams && (
              <>
                <Divider />
                <Title level={5}>已配置的查询参数</Title>
                <Descriptions bordered size="small" column={1}>
                  {Object.entries(configuredQueryParams).map(([key, value]) => (
                    <Descriptions.Item label={key} key={key}>
                      {Array.isArray(value) ? value.join(', ') : String(value)}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </>
            )}

            <Alert
              message="数据说明"
              description="这里只展示真实数据库里的10个条目，用于了解数据结构和字段信息。要获取完整真实数据进行分析，请使用表格中的'配置参数'按钮。"
              type={realPreviewData ? "success" : "info"}
              showIcon
              style={{ marginTop: 16 }}
            />
          </div>
        )}
      </Modal>

      {/* 参数配置模态框 - 基于真实字段的动态筛选 */}
      <Modal
        title={`配置筛选条件 - ${selectedDataset?.title}`}
        open={paramsModalVisible}
        onCancel={() => setParamsModalVisible(false)}
        footer={null}
        width={900}
      >
        {columnsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px' }}>加载数据集字段中...</div>
          </div>
        ) : datasetColumns.length === 0 ? (
          <div>
            <Alert
              message="无法获取数据集字段"
              description='请先点击"更新数据"按钮更新此数据集，以便获取字段信息。'
              type="warning"
              showIcon
              style={{ marginBottom: '16px' }}
            />
            <Button onClick={() => setParamsModalVisible(false)}>关闭</Button>
          </div>
        ) : (
          <Form
            form={paramsForm}
            layout="vertical"
            onFinish={handlePreviewWithParams}
          >
            {/* 选择要筛选的字段 */}
            <Alert
              message="选择筛选字段"
              description="从下方列表中选择需要筛选的字段，然后为每个字段设置筛选条件。"
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />
            
            <Form.Item label="选择字段">
              <Select
                mode="multiple"
                placeholder="选择要添加筛选条件的字段"
                value={selectedFilterFields}
                onChange={setSelectedFilterFields}
                style={{ width: '100%' }}
                showSearch
                filterOption={(input, option) =>
                  String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              >
                {datasetColumns.map((column: string) => (
                  <Option key={column} value={column}>
                    {column}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            
            <Divider />
            
            {/* 为选中的字段配置筛选条件 */}
            {selectedFilterFields.length > 0 ? (
              <>
                <Text strong>筛选条件配置</Text>
                <div style={{ marginTop: '16px' }}>
                  {selectedFilterFields.map((field) => (
                    <Card 
                      key={field}
                      size="small" 
                      title={field}
                      style={{ marginBottom: '12px' }}
                      extra={
                        <Button 
                          type="link" 
                          size="small"
                          danger
                          onClick={() => {
                            setSelectedFilterFields(prev => prev.filter(f => f !== field));
                            paramsForm.setFieldValue(`${field}_condition`, undefined);
                            paramsForm.setFieldValue(`${field}_value`, undefined);
                          }}
                        >
                          移除
                        </Button>
                      }
                    >
                      <Row gutter={16}>
                        <Col span={8}>
                          <Form.Item
                            name={`${field}_condition`}
                            label="条件"
                            rules={[{ required: true, message: '请选择条件' }]}
                          >
                            <Select placeholder="选择条件">
                              <Option value="equals">等于</Option>
                              <Option value="contains">包含</Option>
                              <Option value="gt">大于</Option>
                              <Option value="lt">小于</Option>
                              <Option value="gte">大于等于</Option>
                              <Option value="lte">小于等于</Option>
                              <Option value="not_equals">不等于</Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={16}>
                          <Form.Item
                            name={`${field}_value`}
                            label="值"
                            rules={[{ required: true, message: '请输入筛选值' }]}
                          >
                            <Input placeholder="输入筛选值" />
                          </Form.Item>
                        </Col>
                      </Row>
                    </Card>
                  ))}
                </div>
              </>
            ) : (
              <Alert
                message="未选择筛选字段"
                description="请从上方下拉菜单中选择要添加筛选条件的字段。"
                type="info"
                showIcon
              />
            )}
            
            <Divider />
            
            {selectedDataset && savedQueryParams[selectedDataset.dataset_id] && (
              <Alert
                message="已保存的筛选条件"
                description="检测到您已保存过筛选条件，您可以修改后重新保存，或直接使用当前配置进行预览。"
                type="success"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            )}
            
            <Form.Item>
              <Space>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={previewWithParamsMutation.isLoading}
                  icon={<EyeOutlined />}
                  disabled={selectedFilterFields.length === 0}
                >
                  预览筛选结果
                </Button>
                <Button 
                  type="default"
                  onClick={() => {
                    const values = paramsForm.getFieldsValue();
                    handleSaveParams(values);
                  }}
                  icon={<SettingOutlined />}
                >
                  保存筛选条件
                </Button>
                <Button onClick={() => setParamsModalVisible(false)}>
                  取消
                </Button>
              </Space>
            </Form.Item>
            
            <Alert
              message={selectedFilterFields.length === 0 ? "全量导入模式" : "筛选导入模式"}
              description={
                selectedFilterFields.length === 0 
                  ? "未配置任何筛选条件，保存后将支持全量导入此数据集的所有数据。"
                  : `已配置 ${selectedFilterFields.length} 个筛选字段，保存后将只导入符合筛选条件的数据。`
              }
              type={selectedFilterFields.length === 0 ? "info" : "success"}
              showIcon
              style={{ marginTop: '16px' }}
            />
          </Form>
        )}
      </Modal>

      {/* 导入模态框 */}
      <Modal
        title={`导入数据集: ${selectedDataset?.title}`}
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onOk={() => importForm.submit()}
        confirmLoading={importDatasetMutation.isLoading}
      >
        <Form form={importForm} onFinish={handleImportSubmit} layout="vertical">
          <Form.Item
            name="name"
            label="数据集名称"
            rules={[{ required: true, message: '请输入数据集名称' }]}
          >
            <Input placeholder="请输入数据集名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述（可选）"
          >
            <Input.TextArea
              placeholder="请输入数据集描述"
              rows={3}
            />
          </Form.Item>
          {selectedDataset && savedQueryParams[selectedDataset.dataset_id] ? (
            <Form.Item
              name="query_params"
              label="查询参数"
            >
              <Alert
                message="将使用已保存的查询参数获取真实数据"
                description="系统将使用您已保存的查询参数从数据源获取真实数据进行导入。"
                type="success"
                showIcon
                style={{ marginBottom: '8px' }}
              />
            </Form.Item>
          ) : (
            <Alert
              message="需要先配置并保存查询参数"
              description="请先点击'配置参数'按钮设置查询条件并保存，然后才能导入真实数据。"
              type="warning"
              showIcon
              style={{ marginBottom: '8px' }}
            />
          )}
        </Form>
      </Modal>

      {/* 移除全量更新进度条Modal */}
    </PageContainer>
  );
};

export default GlobalDatasets;
