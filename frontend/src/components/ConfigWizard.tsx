import React, { useState } from 'react';
import {
  Card,
  Button,
  Input,
  Select,
  Form,
  Steps,
  Progress,
  Alert,
  Row,
  Col,
  Space,
  Checkbox,
  message
} from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckOutlined,
  ExperimentOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useMutation } from 'react-query';

const { Option } = Select;
const { TextArea } = Input;
const { Step } = Steps;

interface ConfigWizardProps {
  onComplete: (config: any) => void;
  onClose: () => void;
}

const ConfigWizard: React.FC<ConfigWizardProps> = ({
  onComplete,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [form] = Form.useForm();
  const [config, setConfig] = useState({
    // 步骤1: 基本信息
    id: '',
    name: '',
    description: '',
    category: '',
    source: '',
    api_type: '',
    base_url: '',
    endpoint: '',
    
    // 步骤2: 字段映射
    field_mappings: [] as Array<{
      api_field: string;
      standard_field: string;
      field_type: string;
      required: boolean;
    }>,
    
    // 步骤3: 筛选器
    filters: [] as Array<{
      name: string;
      display_name: string;
      field_type: string;
      filter_type: string;
      api_field: string;
      required: boolean;
    }>,
    
    // 步骤4: 高级设置
    supports_pagination: true,
    page_size_param: '$top',
    page_offset_param: '$skip',
    count_param: '$count',
    max_page_size: 1000,
    cache_duration: 300,
  });

  const steps = [
    { title: '基本信息', description: '配置数据源的基本信息' },
    { title: '字段映射', description: '定义API字段到标准字段的映射' },
    { title: '筛选器', description: '配置数据筛选选项' },
    { title: '高级设置', description: '配置分页、缓存等高级选项' },
    { title: '测试连接', description: '测试数据源连接' },
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const addFieldMapping = () => {
    setConfig({
      ...config,
      field_mappings: [
        ...config.field_mappings,
        {
          api_field: '',
          standard_field: '',
          field_type: 'string',
          required: false,
        },
      ],
    });
  };

  const updateFieldMapping = (index: number, field: string, value: any) => {
    const newMappings = [...config.field_mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setConfig({ ...config, field_mappings: newMappings });
  };

  const removeFieldMapping = (index: number) => {
    const newMappings = config.field_mappings.filter((_, i) => i !== index);
    setConfig({ ...config, field_mappings: newMappings });
  };

  const addFilter = () => {
    setConfig({
      ...config,
      filters: [
        ...config.filters,
        {
          name: '',
          display_name: '',
          field_type: 'string',
          filter_type: 'exact',
          api_field: '',
          required: false,
        },
      ],
    });
  };

  const updateFilter = (index: number, field: string, value: any) => {
    const newFilters = [...config.filters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    setConfig({ ...config, filters: newFilters });
  };

  const removeFilter = (index: number) => {
    const newFilters = config.filters.filter((_, i) => i !== index);
    setConfig({ ...config, filters: newFilters });
  };

  // 测试连接
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/config/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error('Failed to test connection');
      return response.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        message.success('连接测试成功！');
        onComplete(config);
        onClose();
      } else {
        message.error(`连接测试失败: ${result.error}`);
      }
    },
  });

  const handleTestConnection = () => {
    testConnectionMutation.mutate();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="id"
                  label="数据源ID"
                  rules={[{ required: true, message: '请输入数据源ID' }]}
                >
                  <Input
                    value={config.id}
                    onChange={(e) => setConfig({ ...config, id: e.target.value })}
                    placeholder="unique_source_id"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="name"
                  label="名称"
                  rules={[{ required: true, message: '请输入名称' }]}
                >
                  <Input
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    placeholder="数据源名称"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="category"
                  label="类别"
                  rules={[{ required: true, message: '请输入类别' }]}
                >
                  <Input
                    value={config.category}
                    onChange={(e) => setConfig({ ...config, category: e.target.value })}
                    placeholder="数据源类别"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="api_type"
                  label="API类型"
                  rules={[{ required: true, message: '请选择API类型' }]}
                >
                  <Select
                    value={config.api_type}
                    onChange={(value) => setConfig({ ...config, api_type: value })}
                    placeholder="选择API类型"
                  >
                    <Option value="REST">REST API</Option>
                    <Option value="GraphQL">GraphQL</Option>
                    <Option value="OData">OData</Option>
                    <Option value="SOAP">SOAP</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="base_url"
                  label="基础URL"
                  rules={[{ required: true, message: '请输入基础URL' }]}
                >
                  <Input
                    value={config.base_url}
                    onChange={(e) => setConfig({ ...config, base_url: e.target.value })}
                    placeholder="https://api.example.com"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="endpoint"
                  label="端点"
                  rules={[{ required: true, message: '请输入端点' }]}
                >
                  <Input
                    value={config.endpoint}
                    onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                    placeholder="/api/data"
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="description"
              label="描述"
            >
              <TextArea
                value={config.description}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                placeholder="数据源描述"
                rows={3}
              />
            </Form.Item>
          </Form>
        );

      case 1:
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-medium">字段映射</span>
              <Button onClick={addFieldMapping} icon={<PlusOutlined />}>
                添加字段
              </Button>
            </div>
            <div className="space-y-4">
              {config.field_mappings.map((mapping, index) => (
                <Card key={index} size="small">
                  <Row gutter={8} align="middle">
                    <Col span={6}>
                      <Input
                        placeholder="API字段名"
                        value={mapping.api_field}
                        onChange={(e) => updateFieldMapping(index, 'api_field', e.target.value)}
                      />
                    </Col>
                    <Col span={6}>
                      <Input
                        placeholder="标准字段名"
                        value={mapping.standard_field}
                        onChange={(e) => updateFieldMapping(index, 'standard_field', e.target.value)}
                      />
                    </Col>
                    <Col span={4}>
                      <Select
                        value={mapping.field_type}
                        onChange={(value) => updateFieldMapping(index, 'field_type', value)}
                      >
                        <Option value="string">String</Option>
                        <Option value="integer">Integer</Option>
                        <Option value="float">Float</Option>
                        <Option value="date">Date</Option>
                        <Option value="boolean">Boolean</Option>
                      </Select>
                    </Col>
                    <Col span={4}>
                      <Checkbox
                        checked={mapping.required}
                        onChange={(e) => updateFieldMapping(index, 'required', e.target.checked)}
                      >
                        必需
                      </Checkbox>
                    </Col>
                    <Col span={4}>
                      <Button
                        type="link"
                        danger
                        onClick={() => removeFieldMapping(index)}
                      >
                        删除
                      </Button>
                    </Col>
                  </Row>
                </Card>
              ))}
            </div>
            {config.field_mappings.length === 0 && (
              <Alert
                message="请至少添加一个字段映射"
                description="字段映射定义了API返回的字段如何映射到标准字段。"
                type="info"
                showIcon
              />
            )}
          </div>
        );

      case 2:
        return (
          <div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-medium">筛选器配置</span>
              <Button onClick={addFilter} icon={<PlusOutlined />}>
                添加筛选器
              </Button>
            </div>
            <div className="space-y-4">
              {config.filters.map((filter, index) => (
                <Card key={index} size="small">
                  <Row gutter={8} align="middle">
                    <Col span={5}>
                      <Input
                        placeholder="筛选器名称"
                        value={filter.name}
                        onChange={(e) => updateFilter(index, 'name', e.target.value)}
                      />
                    </Col>
                    <Col span={5}>
                      <Input
                        placeholder="显示名称"
                        value={filter.display_name}
                        onChange={(e) => updateFilter(index, 'display_name', e.target.value)}
                      />
                    </Col>
                    <Col span={4}>
                      <Select
                        value={filter.filter_type}
                        onChange={(value) => updateFilter(index, 'filter_type', value)}
                      >
                        <Option value="exact">精确匹配</Option>
                        <Option value="contains">包含匹配</Option>
                        <Option value="range">范围匹配</Option>
                        <Option value="in">列表匹配</Option>
                      </Select>
                    </Col>
                    <Col span={4}>
                      <Input
                        placeholder="API字段名"
                        value={filter.api_field}
                        onChange={(e) => updateFilter(index, 'api_field', e.target.value)}
                      />
                    </Col>
                    <Col span={3}>
                      <Checkbox
                        checked={filter.required}
                        onChange={(e) => updateFilter(index, 'required', e.target.checked)}
                      >
                        必需
                      </Checkbox>
                    </Col>
                    <Col span={3}>
                      <Button
                        type="link"
                        danger
                        onClick={() => removeFilter(index)}
                      >
                        删除
                      </Button>
                    </Col>
                  </Row>
                </Card>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <Form layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="支持分页">
                  <Select
                    value={config.supports_pagination ? 'true' : 'false'}
                    onChange={(value) => setConfig({ ...config, supports_pagination: value === 'true' })}
                  >
                    <Option value="true">是</Option>
                    <Option value="false">否</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="最大分页大小">
                  <Input
                    type="number"
                    value={config.max_page_size}
                    onChange={(e) => setConfig({ ...config, max_page_size: parseInt(e.target.value) || 1000 })}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="分页大小参数">
                  <Input
                    value={config.page_size_param}
                    onChange={(e) => setConfig({ ...config, page_size_param: e.target.value })}
                    placeholder="$top"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="分页偏移参数">
                  <Input
                    value={config.page_offset_param}
                    onChange={(e) => setConfig({ ...config, page_offset_param: e.target.value })}
                    placeholder="$skip"
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="计数参数">
                  <Input
                    value={config.count_param}
                    onChange={(e) => setConfig({ ...config, count_param: e.target.value })}
                    placeholder="$count"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="缓存时间（秒）">
                  <Input
                    type="number"
                    value={config.cache_duration}
                    onChange={(e) => setConfig({ ...config, cache_duration: parseInt(e.target.value) || 300 })}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        );

      case 4:
        return (
          <div className="space-y-4">
            <Alert
              message="测试连接"
              description="点击测试连接按钮来验证您的配置是否正确。如果测试成功，数据源将被创建。"
              type="info"
              showIcon
            />
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">配置摘要</h4>
              <div className="text-sm space-y-1">
                <div><strong>数据源:</strong> {config.name} ({config.id})</div>
                <div><strong>API类型:</strong> {config.api_type}</div>
                <div><strong>URL:</strong> {config.base_url}{config.endpoint}</div>
                <div><strong>字段映射:</strong> {config.field_mappings.length} 个字段</div>
                <div><strong>筛选器:</strong> {config.filters.length} 个筛选器</div>
                <div><strong>分页支持:</strong> {config.supports_pagination ? '是' : '否'}</div>
              </div>
            </div>

            <Button
              type="primary"
              size="large"
              onClick={handleTestConnection}
              loading={testConnectionMutation.isLoading}
              icon={<ExperimentOutlined />}
              block
            >
              {testConnectionMutation.isLoading ? '测试中...' : '测试连接'}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* 进度条 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>步骤 {currentStep + 1} / {steps.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress percent={progress} />
        <div className="text-sm text-gray-600">
          {steps[currentStep].title}: {steps[currentStep].description}
        </div>
      </div>

      {/* 步骤指示器 */}
      <Steps current={currentStep} size="small">
        {steps.map((step, index) => (
          <Step key={index} title={step.title} />
        ))}
      </Steps>

      {/* 步骤内容 */}
      <Card>
        {renderStep()}
      </Card>

      {/* 导航按钮 */}
      <div className="flex justify-between">
        <Button
          onClick={prevStep}
          disabled={currentStep === 0}
          icon={<ArrowLeftOutlined />}
        >
          上一步
        </Button>
        
        <Space>
          <Button onClick={onClose}>
            取消
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button
              type="primary"
              onClick={nextStep}
              icon={<ArrowRightOutlined />}
            >
              下一步
            </Button>
          ) : (
            <Button
              type="primary"
              onClick={handleTestConnection}
              loading={testConnectionMutation.isLoading}
              icon={<CheckOutlined />}
            >
              {testConnectionMutation.isLoading ? '测试中...' : '完成'}
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
};

export default ConfigWizard;
