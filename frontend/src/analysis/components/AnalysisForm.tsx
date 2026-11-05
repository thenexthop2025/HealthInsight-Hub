/**
 * 分析表单组件
 */

import React, { useState, useEffect } from 'react';
import { Form, Select, Button, Space, Input } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import { AnalysisFormData, DescriptiveSubtype } from '../types/analysis';
import { ANALYSIS_TYPES, DESCRIPTIVE_SUBTYPES } from '../config/analysisConfig';

const { Option } = Select;

interface AnalysisFormProps {
  datasets: any[];
  columns: any[];
  onSubmit: (data: AnalysisFormData) => void;
  loading?: boolean;
}

const AnalysisForm: React.FC<AnalysisFormProps> = ({
  datasets,
  columns,
  onSubmit,
  loading = false
}) => {
  const [form] = Form.useForm();
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<string>('');
  const [descriptiveSubtype, setDescriptiveSubtype] = useState<DescriptiveSubtype>('descriptive');

  const handleAnalysisTypeChange = (value: string) => {
    setSelectedAnalysisType(value);
    if (value !== 'descriptive') {
      setDescriptiveSubtype('descriptive');
    }
  };

  const handleSubmit = (values: any) => {
    const formData: AnalysisFormData = {
      ...values,
      descriptive_subtype: selectedAnalysisType === 'descriptive' ? descriptiveSubtype : undefined
    };
    onSubmit(formData);
  };

  const renderDescriptiveSubtype = () => {
    if (selectedAnalysisType !== 'descriptive') return null;

    return (
      <Form.Item
        name="descriptive_subtype"
        label="描述性分析类型"
        rules={[{ required: true, message: '请选择描述性分析类型' }]}
      >
        <Select
          value={descriptiveSubtype}
          onChange={(value) => setDescriptiveSubtype(value)}
          placeholder="请选择描述性分析类型"
        >
          {Object.entries(DESCRIPTIVE_SUBTYPES).map(([key, label]) => (
            <Option key={key} value={key}>
              {label}
            </Option>
          ))}
        </Select>
      </Form.Item>
    );
  };

  const renderVariableFields = () => {
    if (!selectedAnalysisType) return null;

    const isDescriptive = selectedAnalysisType === 'descriptive';
    const isChiSquare = selectedAnalysisType === 'chi_square';
    const isCrosstab = selectedAnalysisType === 'crosstab';
    const isCorrelation = selectedAnalysisType === 'correlation';

    if (isChiSquare) {
      return (
        <>
          <Form.Item
            name="row_variable"
            label="行变量"
            rules={[{ required: true, message: '请选择行变量' }]}
          >
            <Select placeholder="请选择行变量">
              {columns
                .filter(col => col.is_categorical)
                .map(col => (
                  <Option key={col.name} value={col.name}>
                    {col.name}
                  </Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="column_variable"
            label="列变量"
            rules={[{ required: true, message: '请选择列变量' }]}
          >
            <Select placeholder="请选择列变量">
              {columns
                .filter(col => col.is_categorical)
                .map(col => (
                  <Option key={col.name} value={col.name}>
                    {col.name}
                  </Option>
                ))}
            </Select>
          </Form.Item>
        </>
      );
    }

    if (isCrosstab) {
      return (
        <>
          <Form.Item
            name="row_variable"
            label="行变量"
            rules={[{ required: true, message: '请选择行变量' }]}
          >
            <Select placeholder="请选择行变量">
              {columns
                .filter(col => col.is_categorical)
                .map(col => (
                  <Option key={col.name} value={col.name}>
                    {col.name}
                  </Option>
                ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="column_variable"
            label="列变量"
            rules={[{ required: true, message: '请选择列变量' }]}
          >
            <Select placeholder="请选择列变量">
              {columns
                .filter(col => col.is_categorical)
                .map(col => (
                  <Option key={col.name} value={col.name}>
                    {col.name}
                  </Option>
                ))}
            </Select>
          </Form.Item>
        </>
      );
    }

    if (isCorrelation) {
      return (
        <Form.Item
          name="columns"
          label="分析变量"
          rules={[{ required: true, message: '请选择分析变量' }]}
        >
          <Select
            mode="multiple"
            placeholder="请选择分析变量"
            maxTagCount={3}
          >
            {columns
              .filter(col => col.is_numeric)
              .map(col => (
                <Option key={col.name} value={col.name}>
                  {col.name}
                </Option>
              ))}
          </Select>
        </Form.Item>
      );
    }

    // 默认情况：因变量和自变量
    return (
      <>
        <Form.Item
          name="dependent_variables"
          label="因变量"
          rules={[{ required: true, message: '请选择因变量' }]}
        >
          <Select
            mode="multiple"
            placeholder="请选择因变量"
            maxTagCount={3}
          >
            {columns.map(col => (
              <Option key={col.name} value={col.name}>
                {col.name}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          name="independent_variables"
          label="自变量"
        >
          <Select
            mode="multiple"
            placeholder="请选择自变量（可选）"
            maxTagCount={3}
          >
            {columns.map(col => (
              <Option key={col.name} value={col.name}>
                {col.name}
              </Option>
            ))}
          </Select>
        </Form.Item>
        {isDescriptive && (
          <Form.Item
            name="categorical_variables"
            label="分类变量"
          >
            <Select
              mode="multiple"
              placeholder="请选择分类变量（可选）"
              maxTagCount={3}
            >
              {columns
                .filter(col => col.is_categorical)
                .map(col => (
                  <Option key={col.name} value={col.name}>
                    {col.name}
                  </Option>
                ))}
            </Select>
          </Form.Item>
        )}
      </>
    );
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
    >
      <Form.Item
        name="dataset_id"
        label="选择数据集"
        rules={[{ required: true, message: '请选择数据集' }]}
      >
        <Select placeholder="请选择数据集">
          {datasets.map(dataset => (
            <Option key={dataset.id} value={dataset.id}>
              {dataset.name}
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="analysis_type"
        label="分析类型"
        rules={[{ required: true, message: '请选择分析类型' }]}
      >
        <Select
          placeholder="请选择分析类型"
          onChange={handleAnalysisTypeChange}
        >
          {Object.entries(ANALYSIS_TYPES).map(([key, label]) => (
            <Option key={key} value={key}>
              {label}
            </Option>
          ))}
        </Select>
      </Form.Item>

      {renderDescriptiveSubtype()}
      {renderVariableFields()}

      <Form.Item
        name="analysis_name"
        label="分析名称"
      >
        <Input placeholder="请输入分析名称（可选）" />
      </Form.Item>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          icon={<PlayCircleOutlined />}
          loading={loading}
          block
        >
          配置并运行分析
        </Button>
      </Form.Item>
    </Form>
  );
};

export default AnalysisForm;

