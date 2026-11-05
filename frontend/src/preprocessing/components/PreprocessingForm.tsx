/**
 * 数据预处理表单组件
 */

import React, { useState } from 'react';
import {
  Card,
  Form,
  Select,
  Button,
  Input,
  InputNumber,
  Switch,
  Space,
  Divider,
  Typography,
  Row,
  Col,
  message,
} from 'antd';
import {
  DatabaseOutlined,
  ToolOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { PreprocessingConfig, PreprocessingType } from '../types/preprocessing';

const { Title, Text } = Typography;
const { Option } = Select;

interface PreprocessingFormProps {
  onPreprocess: (config: PreprocessingConfig) => void;
  loading?: boolean;
  availableColumns?: string[];
}

export const PreprocessingForm: React.FC<PreprocessingFormProps> = ({
  onPreprocess,
  loading = false,
  availableColumns = [],
}) => {
  const [form] = Form.useForm();
  const [preprocessingType, setPreprocessingType] = useState<PreprocessingType>('clean_missing');

  const handleSubmit = (values: any) => {
    const config: PreprocessingConfig = {
      type: values.type,
      params: { ...values, type: undefined }, // 移除type字段
    };
    onPreprocess(config);
  };

  const renderTypeSpecificFields = () => {
    switch (preprocessingType) {
      case 'clean_missing':
        return (
          <>
            <Form.Item
              name="strategy"
              label="处理策略"
              rules={[{ required: true, message: '请选择处理策略' }]}
            >
              <Select placeholder="选择缺失值处理策略">
                <Option value="drop">删除包含缺失值的行</Option>
                <Option value="drop_columns">删除缺失值比例过高的列</Option>
                <Option value="fill_mean">用均值填充数值列</Option>
                <Option value="fill_median">用中位数填充数值列</Option>
                <Option value="fill_mode">用众数填充分类列</Option>
                <Option value="fill_forward">前向填充</Option>
                <Option value="fill_backward">后向填充</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="threshold"
              label="缺失值阈值"
              tooltip="当策略为'删除列'时，缺失值比例超过此阈值的列将被删除"
            >
              <InputNumber min={0} max={1} step={0.1} placeholder="0.5" />
            </Form.Item>
          </>
        );

      case 'remove_duplicates':
        return (
          <>
            <Form.Item
              name="subset"
              label="检查列"
              tooltip="指定检查重复的列，留空则检查所有列"
            >
              <Select
                mode="multiple"
                placeholder="选择要检查的列"
                allowClear
              >
                {availableColumns.map(col => (
                  <Option key={col} value={col}>{col}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="keep"
              label="保留策略"
              rules={[{ required: true, message: '请选择保留策略' }]}
            >
              <Select placeholder="选择重复行保留策略">
                <Option value="first">保留第一个</Option>
                <Option value="last">保留最后一个</Option>
                <Option value="false">删除所有重复行</Option>
              </Select>
            </Form.Item>
          </>
        );

      case 'detect_outliers':
      case 'remove_outliers':
        return (
          <>
            <Form.Item
              name="method"
              label="检测方法"
              rules={[{ required: true, message: '请选择检测方法' }]}
            >
              <Select placeholder="选择异常值检测方法">
                <Option value="iqr">四分位数方法 (IQR)</Option>
                <Option value="zscore">Z分数方法</Option>
                <Option value="modified_zscore">修正Z分数方法</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="columns"
              label="检查列"
              tooltip="指定检查异常值的列，留空则检查所有数值列"
            >
              <Select
                mode="multiple"
                placeholder="选择要检查的列"
                allowClear
              >
                {availableColumns.map(col => (
                  <Option key={col} value={col}>{col}</Option>
                ))}
              </Select>
            </Form.Item>
          </>
        );

      case 'standardize_text':
        return (
          <Form.Item
            name="columns"
            label="文本列"
            tooltip="指定要标准化的文本列，留空则处理所有文本列"
          >
            <Select
              mode="multiple"
              placeholder="选择要标准化的列"
              allowClear
            >
              {availableColumns.map(col => (
                <Option key={col} value={col}>{col}</Option>
              ))}
            </Select>
          </Form.Item>
        );

      case 'convert_types':
        return (
          <Form.Item
            name="type_mapping"
            label="类型映射"
            tooltip="指定列的数据类型转换映射"
          >
            <Input.TextArea
              placeholder='{"column1": "numeric", "column2": "categorical"}'
              rows={4}
            />
          </Form.Item>
        );

      case 'normalize':
        return (
          <>
            <Form.Item
              name="method"
              label="标准化方法"
              rules={[{ required: true, message: '请选择标准化方法' }]}
            >
              <Select placeholder="选择数据标准化方法">
                <Option value="standard">Z-score标准化</Option>
                <Option value="minmax">Min-Max标准化</Option>
                <Option value="robust">Robust标准化</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="columns"
              label="标准化列"
              tooltip="指定要标准化的列，留空则处理所有数值列"
            >
              <Select
                mode="multiple"
                placeholder="选择要标准化的列"
                allowClear
              >
                {availableColumns.map(col => (
                  <Option key={col} value={col}>{col}</Option>
                ))}
              </Select>
            </Form.Item>
          </>
        );

      case 'encode_categorical':
        return (
          <>
            <Form.Item
              name="method"
              label="编码方法"
              rules={[{ required: true, message: '请选择编码方法' }]}
            >
              <Select placeholder="选择分类变量编码方法">
                <Option value="label">标签编码</Option>
                <Option value="onehot">独热编码</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="columns"
              label="编码列"
              tooltip="指定要编码的列，留空则处理所有分类列"
            >
              <Select
                mode="multiple"
                placeholder="选择要编码的列"
                allowClear
              >
                {availableColumns.map(col => (
                  <Option key={col} value={col}>{col}</Option>
                ))}
              </Select>
            </Form.Item>
          </>
        );

      case 'create_features':
        return (
          <Form.Item
            name="feature_configs"
            label="特征配置"
            tooltip="JSON格式的特征创建配置"
          >
            <Input.TextArea
              placeholder='[{"type": "sum", "name": "total", "source_columns": ["col1", "col2"]}]'
              rows={6}
            />
          </Form.Item>
        );

      case 'select_features':
        return (
          <>
            <Form.Item
              name="target_column"
              label="目标列"
              rules={[{ required: true, message: '请选择目标列' }]}
            >
              <Select placeholder="选择目标列">
                {availableColumns.map(col => (
                  <Option key={col} value={col}>{col}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="k"
              label="特征数量"
              rules={[{ required: true, message: '请输入特征数量' }]}
            >
              <InputNumber min={1} placeholder="10" />
            </Form.Item>
          </>
        );

      case 'transform_skewed':
        return (
          <>
            <Form.Item
              name="method"
              label="变换方法"
              rules={[{ required: true, message: '请选择变换方法' }]}
            >
              <Select placeholder="选择偏斜数据变换方法">
                <Option value="log">对数变换</Option>
                <Option value="sqrt">平方根变换</Option>
                <Option value="box_cox">Box-Cox变换</Option>
              </Select>
            </Form.Item>
            <Form.Item
              name="columns"
              label="变换列"
              tooltip="指定要变换的列，留空则自动检测偏斜列"
            >
              <Select
                mode="multiple"
                placeholder="选择要变换的列"
                allowClear
              >
                {availableColumns.map(col => (
                  <Option key={col} value={col}>{col}</Option>
                ))}
              </Select>
            </Form.Item>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Card
      title={
        <Space>
          <ToolOutlined />
          <span>数据预处理</span>
        </Space>
      }
      size="small"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          type: 'clean_missing',
        }}
      >
        <Form.Item
          name="type"
          label="预处理类型"
          rules={[{ required: true, message: '请选择预处理类型' }]}
        >
          <Select
            placeholder="选择预处理类型"
            onChange={(value) => setPreprocessingType(value)}
          >
            <Option value="clean_missing">处理缺失值</Option>
            <Option value="remove_duplicates">删除重复数据</Option>
            <Option value="detect_outliers">检测异常值</Option>
            <Option value="remove_outliers">删除异常值</Option>
            <Option value="standardize_text">标准化文本</Option>
            <Option value="convert_types">转换数据类型</Option>
            <Option value="validate_quality">验证数据质量</Option>
            <Option value="validate_consistency">验证数据一致性</Option>
            <Option value="normalize">数据标准化</Option>
            <Option value="encode_categorical">编码分类变量</Option>
            <Option value="create_features">创建新特征</Option>
            <Option value="select_features">特征选择</Option>
            <Option value="transform_skewed">变换偏斜数据</Option>
          </Select>
        </Form.Item>

        <Divider />

        {renderTypeSpecificFields()}

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            icon={<CheckCircleOutlined />}
            block
          >
            执行预处理
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

