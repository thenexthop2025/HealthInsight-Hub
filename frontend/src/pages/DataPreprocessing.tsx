/**
 * 数据预处理页面
 * 使用模块化的后端API，但保持原有的前端界面
 */

import React, { useState } from 'react';
import {
  Card,
  Form,
  Select,
  Button,
  Table,
  message,
  Typography,
  Row,
  Col,
  Tag,
  Modal,
  Tabs,
  Tooltip,
  Divider,
  List,
  Space,
} from 'antd';
import { DatabaseOutlined, BarChartOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useQuery } from 'react-query';
import { dataAPI } from '../services/api';
import { useDatasetColumns } from '../hooks/useDatasetColumns';
import ReportEChart from '../components/charts/ReportEChart';
import { reportPalette } from '../theme/reportTheme';
import PreprocessingAPI from '../data-preprocessing/services/preprocessingAPI';
import PageContainer from '../components/PageContainer';
import PageHero from '../components/PageHero';
import './DataPreprocessing.css';
import type {
  NormalizationSuggestion,
  NormalityTestRequest,
  NormalityTestResult,
} from '../data-preprocessing/types/preprocessing';

type NormalityTestSummary = (NormalityTestResult & {
  p_display?: string;
  p_exact?: number;
  original_size?: number;
});

const { Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface DataPreprocessingProps {}

interface VariableAnalysis {
  variable: string;
  dataType: 'quantitative' | 'qualitative';
  normalityTest?: {
    shapiro?: NormalityTestSummary;
    kolmogorov_smirnov?: NormalityTestSummary;
    anderson_darling?: NormalityTestSummary;
  };
  isNormal?: boolean;
  recommendation: string;
  descriptiveStats?: any;
  frequency?: Array<{ value: string; count: number; percentage: number }>;
  raw_data?: number[]; // 添加原始数据字段
  normalizationSuggestions?: NormalizationSuggestion[];
}

const DataPreprocessing: React.FC<DataPreprocessingProps> = () => {
  const [form] = Form.useForm();
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<VariableAnalysis[]>([]);
  const [preprocessingModalVisible, setPreprocessingModalVisible] = useState(false);
  const [chartTypes, setChartTypes] = useState<{[key: string]: string}>({});
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [retestingVariable, setRetestingVariable] = useState<string | null>(null);

  // 获取数据集列表
  const { data: datasets, isLoading: datasetsLoading } = useQuery(
    'datasets',
    () => dataAPI.getDatasets()
  );

  // 获取数据集列信息
  const { data: columnsData, isLoading: columnsLoading } = useDatasetColumns(selectedDatasetId);

  const resolvedColumns = columnsData?.data;

  const datasetsList = datasets?.data || [];
  const selectableColumns =
    resolvedColumns?.columns?.filter(
      (col: any) => col.is_numeric || col.is_categorical
    ) || [];
  const allVariableNames = selectableColumns.map((col: any) => col.name);
  const allVariablesSelected =
    allVariableNames.length > 0 &&
    selectedVariables.length === allVariableNames.length;
  const selectedDataset = datasetsList.find(
    (dataset: any) => dataset.id === selectedDatasetId
  );

  const handleDatasetChange = (datasetId: number) => {
    setSelectedDatasetId(datasetId);
    setSelectedVariables([]);
    form.setFieldsValue({ variables: [] });
    setAnalysisResults([]);
    setChartTypes({});
  };

  // 统一格式化 p 值
  const formatP = (obj: any): string => {
    if (!obj) return '-';
    if (typeof obj.p_display === 'string') return obj.p_display;
    const val = typeof obj.p_exact === 'number' ? obj.p_exact : obj.p_value;
    if (typeof val !== 'number') return '-';
  return val < 1e-4 ? val.toExponential(2) : val.toFixed(4);
};

const extractNormalityTest = (normalityData: any, name: string): NormalityTestSummary | undefined => {
  if (!normalityData?.tests) return undefined;
  const match = normalityData.tests.find((t: any) => t.test_name === name);
  return match || undefined;
};

  const scrollTabs = (direction: 'start' | 'end') => {
    const tabBar = document.querySelector('.preprocessing-tabs .ant-tabs-nav-wrap');
    if (tabBar) {
      const currentScroll = tabBar.scrollLeft;
      const tabsContainer = document.querySelector('.preprocessing-tabs .ant-tabs-nav-list');
      const tabs = tabsContainer?.querySelectorAll('.ant-tabs-tab');
      
      if (tabs && tabs.length > 0) {
        // 计算每个 tab 的平均宽度
        const totalWidth = Array.from(tabs).reduce((sum, tab) => sum + (tab as HTMLElement).offsetWidth, 0);
        const avgTabWidth = totalWidth / tabs.length;
        
        // 每次移动 3 个 tab 的宽度
        const scrollAmount = avgTabWidth * 3;
        
        const newScroll = direction === 'start' 
          ? Math.max(0, currentScroll - scrollAmount)
          : Math.min(tabBar.scrollWidth - tabBar.clientWidth, currentScroll + scrollAmount);
        
        tabBar.scrollTo({
          left: newScroll,
          behavior: 'smooth',
        });
      }
    }
  };

  const handleNormalityRetest = async (variable: string, method: string) => {
    const datasetId = selectedDatasetId;
    if (!datasetId) {
      message.warning('请先选择数据集');
      return;
    }

    setRetestingVariable(`${variable}-${method}`);
    try {
      const request: NormalityTestRequest = {
        dataset_id: datasetId,
        variable,
        transformation: method,
      };
      const response = await PreprocessingAPI.normalityTest(request);
      if (response.success && response.result) {
        const { normality_test: normalityTest } = response.result;
        setAnalysisResults((prev) =>
          prev.map((item) => {
            if (item.variable !== variable) return item;
            return {
              ...item,
              isNormal: normalityTest?.overall_is_normal ?? item.isNormal,
              normalityTest: normalityTest
                ? {
                    shapiro: extractNormalityTest(normalityTest, 'Shapiro-Wilk'),
                    kolmogorov_smirnov: extractNormalityTest(normalityTest, 'Kolmogorov-Smirnov'),
                    anderson_darling: extractNormalityTest(normalityTest, 'Anderson-Darling'),
                  }
                : item.normalityTest,
            };
          })
        );
        message.success(`已使用 ${method} 变换重新检验`);
      } else {
        message.error(response.error || '重新检验失败');
      }
    } catch (error) {
      message.error('重新检验失败');
      console.error('Normality retest error:', error);
    } finally {
      setRetestingVariable(null);
    }
  };


  // 执行数据预处理分析
  const handlePreprocessing = async (values: any) => {
    const datasetId = values.dataset_id || selectedDatasetId;
    const variablesToAnalyze = values.variables || selectedVariables;

    if (!datasetId) {
      message.error('请先选择数据集');
      return;
    }

    if (!variablesToAnalyze || variablesToAnalyze.length === 0) {
      message.error('请至少选择一个变量');
      return;
    }

    setLoading(true);
    try {
      // 使用新的API进行批量分析
      const response = await PreprocessingAPI.analyzeVariables({
        dataset_id: datasetId,
        variables: variablesToAnalyze
      });

      if (response.success && response.result) {
        const results: VariableAnalysis[] = response.result.results.map((result: any) => ({
          variable: result.variable,
          dataType: result.variable_analysis.data_type,
          isNormal: result.is_normal,
          normalityTest: result.normality_test
            ? {
                shapiro: extractNormalityTest(result.normality_test, 'Shapiro-Wilk'),
                kolmogorov_smirnov: extractNormalityTest(result.normality_test, 'Kolmogorov-Smirnov'),
                anderson_darling: extractNormalityTest(result.normality_test, 'Anderson-Darling'),
              }
            : undefined,
          descriptiveStats: result.descriptive_stats,
          frequency: result.descriptive_stats?.frequency_table || [],
          recommendation: result.recommendation,
          raw_data: result.raw_data || [], // 添加原始数据
          normalizationSuggestions: result.normalization_suggestions || [],
        }));

        setAnalysisResults(results);
        setPreprocessingModalVisible(true);
        message.success('变量特征分析完成');
      } else {
        message.error(response.error || '变量特征分析失败');
      }
    } catch (error) {
      message.error('变量特征分析失败');
      console.error('Preprocessing error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 生成直方图
  const generateHistogram = (analysis: VariableAnalysis) => {
    if (analysis.dataType !== 'quantitative' || !analysis.descriptiveStats) {
      return null;
    }

    const stats = analysis.descriptiveStats;
    const isNormal = analysis.isNormal;
    const rawData = (analysis as any).raw_data || [];

    if (rawData.length === 0) {
      return (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <p>暂无原始数据</p>
        </div>
      );
    }

    // 生成直方图数据
    const binCount = Math.min(20, Math.ceil(Math.sqrt(rawData.length)));
    const binWidth = (stats.max - stats.min) / binCount;
    const bins = Array.from({ length: binCount }, (_, i) => ({
      start: stats.min + i * binWidth,
      end: stats.min + (i + 1) * binWidth,
      count: 0
    }));
    
    // 使用真实数据统计每个分组的频数
    rawData.forEach((value: number) => {
      const binIndex = Math.min(Math.floor((value - stats.min) / binWidth), binCount - 1);
      if (binIndex >= 0 && binIndex < binCount) {
        bins[binIndex].count++;
      }
    });

    const histogramData = bins.map(bin => ({
      name: `${bin.start.toFixed(1)}-${bin.end.toFixed(1)}`,
      value: bin.count
    }));

    const option = {
      title: {
        text: `${analysis.variable} - 分布直方图`,
        left: 'center',
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const param = params[0];
          return `${param.name}<br/>频数: ${param.value}`;
        }
      },
      xAxis: {
        type: 'category',
        data: histogramData.map(item => item.name),
        axisLabel: {
          rotate: 45,
        },
      },
      yAxis: {
        type: 'value',
        name: '频数',
      },
      series: [
        {
          name: '频数',
          type: 'bar',
          data: histogramData.map(item => item.value),
          itemStyle: {
            color: isNormal ? reportPalette.success : reportPalette.danger,
          },
        },
      ],
    };

    return <ReportEChart option={option} style={{ height: 300 }} />;
  };

  // 生成频数图
  const generateFrequencyChart = (analysis: VariableAnalysis) => {
    if (!analysis.frequency || analysis.frequency.length === 0) return null;

    const option = {
      title: {
        text: `${analysis.variable} - 频数分布`,
        left: 'center',
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const param = params[0];
          return `${param.name}<br/>频数: ${param.value}`;
        }
      },
      xAxis: {
        type: 'category',
        data: analysis.frequency.map(item => item.value),
        axisLabel: {
          rotate: 45,
        },
      },
      yAxis: {
        type: 'value',
        name: '频数',
      },
      series: [
        {
          name: '频数',
          type: 'bar',
          data: analysis.frequency.map(item => item.count),
          itemStyle: {
            color: reportPalette.blue,
          },
        },
      ],
    };

    return <ReportEChart option={option} style={{ height: 300 }} />;
  };

  // 生成饼图
  const generatePieChart = (analysis: VariableAnalysis) => {
    if (!analysis.frequency || analysis.frequency.length === 0) return null;

    const pieData = analysis.frequency.map(item => ({
      name: item.value,
      value: item.count
    }));

    const option = {
      title: {
        text: `${analysis.variable} - 比例分布`,
        left: 'center',
      },
      tooltip: {
        trigger: 'item',
        formatter: '{a} <br/>{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        data: pieData.map(item => item.name)
      },
      series: [
        {
          name: '频数',
          type: 'pie',
          radius: '50%',
          center: ['50%', '60%'],
          data: pieData,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };

    return <ReportEChart option={option} style={{ height: 400 }} />;
  };

  // 生成箱线图
  const generateBoxplot = (analysis: VariableAnalysis) => {
    if (analysis.dataType !== 'quantitative' || !analysis.descriptiveStats) {
      return null;
    }

    const rawData = (analysis as any).raw_data || [];
    
    if (rawData.length === 0) {
      return (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <p>暂无原始数据</p>
        </div>
      );
    }

    // 使用真实数据计算箱线图数据
    const sortedData = rawData.sort((a: number, b: number) => a - b);
    const n = sortedData.length;
    
    const min = sortedData[0];
    const max = sortedData[n - 1];
    const q1 = sortedData[Math.floor(n * 0.25)];
    const median = sortedData[Math.floor(n * 0.5)];
    const q3 = sortedData[Math.floor(n * 0.75)];
    
    const boxData = [
      {
        name: analysis.variable,
        value: [min, q1, median, q3, max]
      }
    ];

    const option = {
      title: {
        text: `${analysis.variable} - 箱线图`,
        left: 'center',
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const data = params.data.value;
          if (!data || data.length < 5) return '数据不完整';
          return `${params.name}<br/>
            最小值: ${data[0]?.toFixed(2) || 'N/A'}<br/>
            Q1: ${data[1]?.toFixed(2) || 'N/A'}<br/>
            中位数: ${data[2]?.toFixed(2) || 'N/A'}<br/>
            Q3: ${data[3]?.toFixed(2) || 'N/A'}<br/>
            最大值: ${data[4]?.toFixed(2) || 'N/A'}`;
        }
      },
      xAxis: {
        type: 'category',
        data: [analysis.variable],
        axisLabel: {
          rotate: 0,
        },
      },
      yAxis: {
        type: 'value',
        name: '数值',
      },
      series: [
        {
          name: '箱线图',
          type: 'boxplot',
          data: boxData,
          itemStyle: {
            color: reportPalette.blue,
            borderColor: reportPalette.blue,
          },
        },
      ],
    };

    return <ReportEChart option={option} style={{ height: 300 }} />;
  };

  // 生成Q-Q图（正态性检验）
  const generateQQPlot = (analysis: VariableAnalysis) => {
    if (analysis.dataType !== 'quantitative' || !analysis.descriptiveStats) {
      return null;
    }

    const rawData = (analysis as any).raw_data || [];
    if (rawData.length === 0) {
      return (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <p>暂无原始数据</p>
        </div>
      );
    }

    // 计算Q-Q图数据
    const sortedData = rawData.sort((a: number, b: number) => a - b);
    const n = sortedData.length;
    const mean = analysis.descriptiveStats.mean;
    const std = analysis.descriptiveStats.std;
    
    // 计算理论分位数
    const theoreticalQuantiles: number[] = [];
    const sampleQuantiles: number[] = [];
    
    for (let i = 0; i < n; i++) {
      const p = (i + 0.5) / n;
      const theoretical = mean + std * Math.sqrt(2) * Math.sqrt(-Math.log(1 - p));
      theoreticalQuantiles.push(theoretical);
      sampleQuantiles.push(sortedData[i]);
    }

    const qqData = theoreticalQuantiles.map((theo, i) => [theo, sampleQuantiles[i]]);

    const option = {
      title: {
        text: `${analysis.variable} - Q-Q图（正态性检验）`,
        left: 'center',
      },
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const data = params.data;
          if (!data || data.length < 2) return '数据不完整';
          return `理论分位数: ${data[0]?.toFixed(2) || 'N/A'}<br/>样本分位数: ${data[1]?.toFixed(2) || 'N/A'}`;
        }
      },
      xAxis: {
        type: 'value',
        name: '理论分位数',
      },
      yAxis: {
        type: 'value',
        name: '样本分位数',
      },
      series: [
        {
          name: 'Q-Q散点',
          type: 'scatter',
          data: qqData,
          symbolSize: 6,
          itemStyle: {
            color: reportPalette.danger,
          },
        },
        {
          name: '参考线',
          type: 'line',
          data: [[Math.min(...theoreticalQuantiles), Math.min(...sampleQuantiles)], 
                 [Math.max(...theoreticalQuantiles), Math.max(...sampleQuantiles)]],
          lineStyle: {
            color: reportPalette.blue,
            type: 'dashed',
          },
          symbol: 'none',
        },
      ],
    };

    return <ReportEChart option={option} style={{ height: 300 }} />;
  };

  // 生成频率表
  const generateFrequencyTable = (analysis: VariableAnalysis) => {
    if (analysis.dataType !== 'qualitative' || !analysis.frequency) {
      return null;
    }

    const columns = [
      {
        title: '类别',
        dataIndex: 'value',
        key: 'value',
      },
      {
        title: '频数',
        dataIndex: 'count',
        key: 'count',
      },
      {
        title: '百分比',
        dataIndex: 'percent',
        key: 'percent',
        render: (text: number) => text ? `${text.toFixed(2)}%` : '-',
      },
    ];

    return (
      <Table
        columns={columns}
        dataSource={analysis.frequency}
        pagination={false}
        size="small"
        title={() => `${analysis.variable} - 频率分布表`}
      />
    );
  };

  // 分析结果表格列定义
  const analysisColumns = [
    {
      title: '变量名',
      dataIndex: 'variable',
      key: 'variable',
    },
    {
      title: '数据类型',
      dataIndex: 'dataType',
      key: 'dataType',
      render: (type: string) => (
        <Tag className={type === 'quantitative' ? 'tag-pastel-blue' : 'tag-pastel-mint'}>
          {type === 'quantitative' ? '定量资料' : '定性资料'}
        </Tag>
      ),
    },
    {
      title: '正态性',
      dataIndex: 'isNormal',
      key: 'isNormal',
      render: (isNormal: boolean | undefined, record: VariableAnalysis) => {
        if (record.dataType === 'qualitative') {
          return <Tag className="tag-muted">不适用</Tag>;
        }
        if (isNormal === undefined) {
          return <Tag className="tag-muted">未检测</Tag>;
        }
        return (
          <Tag className={isNormal ? 'tag-pastel-mint' : 'tag-pastel-pink'}>
            {isNormal ? '正态分布' : '非正态分布'}
          </Tag>
        );
      },
    },
    {
      title: 'P值',
      dataIndex: 'normalityTest',
      key: 'pValue',
      render: (normalityTest: any) => {
        if (!normalityTest) return '-';
        const sw = normalityTest.shapiro;
        const ks = normalityTest.kolmogorov_smirnov;
        const main = sw || ks;
        if (!main) return '-';

        const mainText = formatP(main);
        const swText = sw ? `Shapiro‑Wilk: ${formatP(sw)}${sw.sample_size ? ` (n=${sw.sample_size})` : ''}` : null;
        const ksText = ks ? `KS: ${formatP(ks)}${ks.sample_size ? ` (n=${ks.sample_size})` : ''}` : null;
        const tip = [swText, ksText].filter(Boolean).join('\n');
        return (
          <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{tip}</span>}>
            <span>{mainText}</span>
          </Tooltip>
        );
      },
    },
    {
      title: '分析建议',
      dataIndex: 'recommendation',
      key: 'recommendation',
      width: 300,
      render: (_text: string, record: VariableAnalysis) => (
        <div className="preprocessing-summary-recommendation">
          <Text className="preprocessing-recommendation">{record.recommendation}</Text>
          {record.normalizationSuggestions && record.normalizationSuggestions.length > 0 && (
            <div className="preprocessing-summary-transforms">
              {record.normalizationSuggestions.map((suggestion) => (
                <Tag
                  key={`${record.variable}-${suggestion.method}`}
                  color={suggestion.overall_is_normal ? 'green' : 'default'}
                >
                  {suggestion.display_name}
                </Tag>
              ))}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageContainer className="preprocessing-page">
      <PageHero
        className="preprocessing-hero"
        icon={<BarChartOutlined className="page-hero__title-icon" />}
        badge="数据特征"
        title="变量特征分析"
        subtitle="一站式完成变量类型识别、正态性检验与可视化分析，让数据预处理像预约诊疗一样轻松。"
        stats={[
          { label: '可用数据集', value: datasetsList.length },
          { label: '已选变量', value: selectedVariables.length },
          { label: '最新分析结果', value: analysisResults.length },
        ]}
        meta={
          selectedDataset ? (
            <span>
              当前数据集：<strong>{selectedDataset.name}</strong>
            </span>
          ) : undefined
        }
      />

      <Card
        className="page-section-card preprocessing-card"
        bordered={false}
        title={
          <span className="page-section-card__title">
            <DatabaseOutlined className="page-section-card__title-icon" />
            配置本次分析
          </span>
        }
      >
        <Form form={form} layout="vertical" onFinish={handlePreprocessing}>
          <Row gutter={20}>
            <Col span={12}>
              <Card
                className="page-section-card"
                title={
                  <span className="page-section-card__title">
                    <DatabaseOutlined className="page-section-card__title-icon" />
                    选择数据集
                  </span>
                }
                bordered={false}
              >
                <Form.Item
                  name="dataset_id"
                  rules={[{ required: true, message: '请选择数据集' }]}
                >
                  <Select
                    placeholder="请选择要分析的数据集"
                    onChange={handleDatasetChange}
                    loading={datasetsLoading}
                    size="large"
                    disabled={datasetsLoading}
                  >
                    {datasetsList.map((dataset: any) => (
                      <Option key={dataset.id} value={dataset.id}>
                        {dataset.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Card>
            </Col>
            <Col span={12}>
              <Card
                className="page-section-card"
                title={
                  <span className="page-section-card__title">
                    <BarChartOutlined className="page-section-card__title-icon" />
                    选择变量
                  </span>
                }
                bordered={false}
              >
                <Form.Item
                  name="variables"
                  rules={[{ required: true, message: '请选择要分析的变量' }]}
                >
                <div className="preprocessing-selection">
                  <div className="preprocessing-selection__controls">
                    <Button
                      size="middle"
                      className={`preprocessing-selection__button ${
                        allVariablesSelected
                          ? 'preprocessing-selection__button--active'
                          : ''
                      }`}
                      onClick={() => {
                        if (allVariablesSelected) {
                          form.setFieldsValue({ variables: [] });
                          setSelectedVariables([]);
                          message.info('已取消全选所有变量');
                        } else {
                          form.setFieldsValue({ variables: allVariableNames });
                          setSelectedVariables(allVariableNames);
                          message.success(`已全选所有变量 (${allVariableNames.length} 个)`);
                        }
                      }}
                      disabled={!selectedDatasetId || columnsLoading}
                    >
                      {allVariablesSelected ? '取消全选' : '一键全选'}
                    </Button>
                    <span className="preprocessing-selection__pill">
                      可选变量：{allVariableNames.length} 个
                    </span>
                  </div>

                  <Select
                    mode="multiple"
                    placeholder="请选择要分析的变量"
                    loading={columnsLoading}
                    disabled={!selectedDatasetId}
                    value={selectedVariables}
                    onChange={(values) => {
                      setSelectedVariables(values);
                      form.setFieldsValue({ variables: values });
                    }}
                    size="large"
                    allowClear
                    maxTagCount="responsive"
                  >
                    {selectableColumns.map((col: any) => (
                      <Option key={col.name} value={col.name}>
                        {col.name} {col.is_numeric ? '🔢' : '📝'}
                      </Option>
                    ))}
                  </Select>
                </div>
              </Form.Item>
              </Card>
            </Col>
          </Row>

          <div className="preprocessing-form__actions">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="preprocessing-action-btn"
            >
              开始变量特征分析
            </Button>
          </div>
        </Form>
      </Card>

      {/* 分析结果模态框 */}
      <Modal
        className="preprocessing-modal"
        title={
          <div className="preprocessing-modal__title">
            <BarChartOutlined className="preprocessing-modal__title-icon" />
            变量特征分析结果
          </div>
        }
        open={preprocessingModalVisible}
        onCancel={() => setPreprocessingModalVisible(false)}
        width={1200}
        footer={null}
      >
        <div className="preprocessing-modal__toolbar">
          <span className="preprocessing-modal__count">
            共 {analysisResults.length} 个变量
          </span>
          <div className="preprocessing-modal__nav">
            <Button
              size="small"
              icon={<LeftOutlined />}
              onClick={() => scrollTabs('start')}
            />
            <Button
              size="small"
              icon={<RightOutlined />}
              onClick={() => scrollTabs('end')}
            />
          </div>
        </div>

        <Tabs
          defaultActiveKey="summary"
          tabPosition="top"
          type="card"
          size="small"
          className="preprocessing-tabs"
        >
          <TabPane tab="分析摘要" key="summary">
            <Table
              columns={analysisColumns}
              dataSource={analysisResults}
              rowKey="variable"
              pagination={false}
              size="small"
              className="preprocessing-summary-table"
            />
          </TabPane>
          
          {analysisResults.map((analysis) => {
            const selectedChart =
              chartTypes[analysis.variable] ||
              (analysis.dataType === 'quantitative' ? 'histogram' : 'bar');
            const shapiroP = analysis.normalityTest?.shapiro?.p_value;

            return (
              <TabPane tab={analysis.variable} key={analysis.variable}>
                <Row gutter={16} className="analysis-card">
                  <Col span={12}>
                    <Card size="small" title="统计快照">
                      <div className="preprocessing-card__meta">
                        <p>
                          <strong>变量名：</strong>
                          {analysis.variable}
                        </p>
                        <p>
                          <strong>数据类型：</strong>
                          {analysis.dataType === 'quantitative' ? '定量资料' : '定性资料'}
                        </p>
                        {analysis.normalityTest && (
                          <p>
                            <strong>正态性检验：</strong>
                            {analysis.isNormal ? '正态分布' : '非正态分布'}
                            {typeof shapiroP === 'number'
                              ? ` (p=${shapiroP.toFixed(4)})`
                              : ''}
                          </p>
                        )}
                      </div>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title="分析建议">
                      <Text className="preprocessing-recommendation">
                        {analysis.recommendation}
                      </Text>
                      {analysis.normalizationSuggestions && analysis.normalizationSuggestions.length > 0 && (
                        <div className="preprocessing-normalization-suggestions">
                          <Divider orientation="left" plain>常见正态化尝试</Divider>
                          <List
                            size="small"
                            dataSource={analysis.normalizationSuggestions}
                            renderItem={(suggestion) => (
                              <List.Item
                                actions={
                                  suggestion.note ? [] : [
                                    <Button
                                      key="retest"
                                      type="link"
                                      size="small"
                                      loading={retestingVariable === `${analysis.variable}-${suggestion.method}`}
                                      onClick={() => handleNormalityRetest(analysis.variable, suggestion.method)}
                                    >
                                      {suggestion.overall_is_normal === true ? '使用此变换重检' : '再次检验'}
                                    </Button>
                                  ]
                                }
                              >
                                <List.Item.Meta
                                  title={
                                    <Space size={8}>
                                      <span>{suggestion.display_name}</span>
                                      {suggestion.overall_is_normal === true && (
                                        <Tag color="success">检验通过</Tag>
                                      )}
                                      {suggestion.overall_is_normal === false && (
                                        <Tag color="warning">仍非正态</Tag>
                                      )}
                                    </Space>
                                  }
                                  description={
                                    <div className="preprocessing-normalization-meta">
                                      {suggestion.note && (
                                        <div className="preprocessing-normalization-note">{suggestion.note}</div>
                                      )}
                                      {suggestion.tests && suggestion.tests.length > 0 && (
                                        <div className="preprocessing-normalization-tests">
                                          {suggestion.tests.map((test, idx) => (
                                            <Tag
                                              key={`${suggestion.method}-${test.test_name || idx}`}
                                              className={test.is_normal ? 'tag-pastel-mint' : 'tag-muted'}
                                            >
                                              {test.test_name || '检验'}: {formatP(test)}
                                            </Tag>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  }
                                />
                              </List.Item>
                            )}
                          />
                        </div>
                      )}
                    </Card>
                  </Col>
                </Row>

                <div className="preprocessing-chart-switcher__wrap">
                  <Select
                    className="preprocessing-chart-switcher"
                    value={selectedChart}
                    onChange={(value) =>
                      setChartTypes((prev) => ({
                        ...prev,
                        [analysis.variable]: value,
                      }))
                    }
                  >
                    {analysis.dataType === 'quantitative' ? (
                      <>
                        <Option value="histogram">📊 直方图（分布形状）</Option>
                        <Option value="boxplot">📦 箱线图（异常值）</Option>
                        <Option value="qqplot">📈 Q-Q 图（正态性）</Option>
                        <Option value="all">🔄 全部可视化</Option>
                      </>
                    ) : (
                      <>
                        <Option value="bar">📊 柱状图（频数）</Option>
                        <Option value="pie">🥧 饼图（比例）</Option>
                        <Option value="table">📋 频率表</Option>
                        <Option value="all">🔄 全部可视化</Option>
                      </>
                    )}
                  </Select>
                </div>

                {analysis.dataType === 'quantitative' ? (
                  selectedChart === 'all' ? (
                    <Row gutter={16}>
                      <Col span={8}>
                        <Card size="small" title="直方图">
                          {generateHistogram(analysis)}
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" title="箱线图">
                          {generateBoxplot(analysis)}
                        </Card>
                      </Col>
                      <Col span={8}>
                        <Card size="small" title="Q-Q 图">
                          {generateQQPlot(analysis)}
                        </Card>
                      </Col>
                    </Row>
                  ) : selectedChart === 'histogram' ? (
                    generateHistogram(analysis)
                  ) : selectedChart === 'boxplot' ? (
                    generateBoxplot(analysis)
                  ) : selectedChart === 'qqplot' ? (
                    generateQQPlot(analysis)
                  ) : (
                    generateHistogram(analysis)
                  )
                ) : selectedChart === 'all' ? (
                  <Row gutter={16}>
                    <Col span={8}>
                      <Card size="small" title="柱状图">
                        {generateFrequencyChart(analysis)}
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" title="饼图">
                        {generatePieChart(analysis)}
                      </Card>
                    </Col>
                    <Col span={8}>
                      <Card size="small" title="频率表">
                        {generateFrequencyTable(analysis)}
                      </Card>
                    </Col>
                  </Row>
                ) : selectedChart === 'bar' ? (
                  generateFrequencyChart(analysis)
                ) : selectedChart === 'pie' ? (
                  generatePieChart(analysis)
                ) : selectedChart === 'table' ? (
                  generateFrequencyTable(analysis)
                ) : (
                  generateFrequencyChart(analysis)
                )}
              </TabPane>
            );
          })}
        </Tabs>
      </Modal>
    </PageContainer>
  );
};

export default DataPreprocessing;
