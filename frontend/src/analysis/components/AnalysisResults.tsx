/**
 * 分析结果展示组件
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Typography,
  Select,
  Divider,
  Spin,
  Alert,
  Empty
} from 'antd';
import { Analysis, AnalysisType } from '../types/analysis';
import { getChartConfig, resolveAnalysisType } from '../config/analysisConfig';
import { generateChart } from '../charts/ChartGenerator';
import { generateStatisticsTable } from '../charts/StatisticsTable';
import { generateFormulas } from '../charts/Formulas';

const { Title, Text } = Typography;
const { Option } = Select;

interface AnalysisResultsProps {
  visible: boolean;
  analysis: Analysis | null;
  onClose: () => void;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({
  visible,
  analysis,
  onClose
}) => {
  const [selectedChartType, setSelectedChartType] = useState<string>('');

  // 当分析变化时，重置图表类型
  useEffect(() => {
    if (analysis) {
      const actualType = resolveAnalysisType(analysis);
      const chartConfigs = getChartConfig(actualType);
      if (chartConfigs.length > 0) {
        setSelectedChartType(chartConfigs[0].type);
      }
    }
  }, [analysis]);

  const effectiveChartType = useMemo(() => {
    if (!analysis) return '';
    if (selectedChartType) {
      return selectedChartType;
    }
    const actualType = resolveAnalysisType(analysis);
    const chartConfigs = getChartConfig(actualType);
    return chartConfigs.length > 0 ? chartConfigs[0].type : '';
  }, [analysis, selectedChartType]);

  if (!analysis) return null;

  const actualType = resolveAnalysisType(analysis);
  const chartConfigs = getChartConfig(actualType);

  const renderContent = () => {
    if (analysis.status === 'running') {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text>分析进行中，请稍候...</Text>
          </div>
        </div>
      );
    }

    if (analysis.status === 'failed') {
      return (
        <Alert
          message="分析失败"
          description={
            <pre style={{ 
              background: '#fff1f0', 
              padding: 16, 
              borderRadius: 4,
              maxHeight: 300,
              overflow: 'auto'
            }}>
              {typeof analysis.results === 'string' 
                ? analysis.results 
                : JSON.stringify(analysis.results, null, 2)}
            </pre>
          }
          type="error"
          showIcon
        />
      );
    }

    if (analysis.status === 'completed' && analysis.results) {
      return (
        <>
          <Title level={4}>可视化结果</Title>
          
          {chartConfigs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ marginRight: 16 }}>图表类型：</Text>
              <Select
                value={effectiveChartType}
                onChange={setSelectedChartType}
                placeholder="选择图表类型"
                style={{ width: 200 }}
              >
                {chartConfigs.map((config, index) => (
                  <Option key={index} value={config.type}>
                    {config.name} - {config.description}
                  </Option>
                ))}
              </Select>
            </div>
          )}

          {effectiveChartType ? (
            generateChart(analysis, effectiveChartType)
          ) : (
            <Empty description="暂无可用图表" />
          )}

          <Divider />
          <Title level={4}>统计表格</Title>
          {generateStatisticsTable(analysis, selectedChartType)}

          <Divider />
          <Title level={4}>统计公式</Title>
          {generateFormulas(analysis)}

          <Divider />
          <Title level={4}>详细结果</Title>
          <pre style={{ 
            background: '#f5f5f5', 
            padding: 16, 
            borderRadius: 4,
            maxHeight: 300,
            overflow: 'auto'
          }}>
            {typeof analysis.results === 'string' 
              ? analysis.results 
              : JSON.stringify(analysis.results, null, 2)}
          </pre>
        </>
      );
    }

    return <Empty description="暂无分析结果" />;
  };

  return (
    <Modal
      title="分析结果"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={1200}
      style={{ top: 20 }}
    >
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <Text strong>分析名称：</Text>
            <Text>{analysis.name}</Text>
          </div>
          <div>
            <Text strong>分析类型：</Text>
            <Text>{actualType}</Text>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <Text strong>状态：</Text>
            <Text>{analysis.status}</Text>
          </div>
          <div>
            <Text strong>创建时间：</Text>
            <Text>{analysis.created_at}</Text>
          </div>
        </div>
      </div>

      <Divider />

      {renderContent()}
    </Modal>
  );
};

export default AnalysisResults;

