import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Modal,
  Typography,
  Select,
  Tabs,
  Space,
  Button,
  Alert,
  Collapse,
} from 'antd';
import {
  BarChartOutlined,
  TableOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  CopyOutlined,
} from '@ant-design/icons';
// import moment from 'moment';
import ChartGenerator from './ChartGenerator';
import { formatDateTime } from '../../utils/datetime';
import { generateStatisticsTable as generateStatisticsTableNode } from '../../analysis/charts/StatisticsTable';
import { generateFormulas } from '../../analysis/charts/Formulas';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;
const { Panel } = Collapse;

interface Analysis {
  id: string;
  analysis_type: string;
  dataset_id: string;
  dataset_name: string;
  status: string;
  created_at: string;
  completed_at?: string;
  results?: any;
  parameters?: any;
  error_message?: string;
}

interface AnalysisResultsProps {
  visible: boolean;
  analysis: Analysis | null;
  onClose: () => void;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = ({ visible, analysis, onClose }) => {
  const [selectedChartType, setSelectedChartType] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('chart');
  const [expandParams, setExpandParams] = useState<boolean>(false);
  const [expandResults, setExpandResults] = useState<boolean>(false);
  const chartHostRef = useRef<HTMLDivElement | null>(null);
  const [chartHostReady, setChartHostReady] = useState<boolean>(false);
  const [openNonce, setOpenNonce] = useState<number>(0);

  // 获取分析类型的中文名称
  const getAnalysisTypeName = (type: string) => {
    const typeNames: Record<string, string> = {
      descriptive: '描述性分析',
      frequency: '频率分析',
      crosstab: '交叉表分析',
      correlation: '相关性分析',
      regression: '回归分析',
      linear_regression: '线性回归',
      logistic_regression: '二分类逻辑回归',
      logistic_regression_multinomial: '无序多分类逻辑回归',
      logistic_regression_ordinal: '有序多分类逻辑回归',
      logistic_regression_conditional: '条件逻辑回归（分层）',
      chi_square: '卡方检验',
      stratified: '分层分析',
      mendelian_randomization: '孟德尔随机化',
      explore: '探索分析',
    };
    return typeNames[type] || type;
  };

  // 获取图表类型配置（兼容历史类型命名）
  const getChartConfig = (analysisType: string) => {
    const type = analysisType;
    const configs: Record<string, Array<{ type: string; name: string }>> = {
      descriptive: [
        { type: 'boxplot', name: '箱线图' },
        { type: 'histogram', name: '直方图' },
      ],
      logistic_regression: [
        { type: 'roc', name: 'ROC曲线' },
        { type: 'cm', name: '混淆矩阵' },
        { type: 'coefficients', name: '系数图' },
      ],
      logistic_regression_multinomial: [
        { type: 'cm', name: '混淆矩阵' },
        { type: 'coefficients', name: '系数图' },
      ],
      logistic_regression_ordinal: [
        { type: 'coefficients', name: '系数图' },
      ],
      logistic_regression_conditional: [
        { type: 'roc', name: 'ROC曲线' },
        { type: 'cm', name: '混淆矩阵' },
        { type: 'coefficients', name: '系数图' },
      ],
      frequency: [
        { type: 'bar', name: '柱状图' },
        { type: 'pie', name: '饼图' },
      ],
      crosstab: [
        { type: 'heatmap', name: '热力图' },
        { type: 'mosaic', name: '马赛克图' },
        { type: 'stacked_bar', name: '堆叠柱状图' },
        { type: 'residuals', name: '残差图' },
      ],
      correlation: [
        { type: 'heatmap', name: '相关性热力图' },
        { type: 'scatter', name: '散点图矩阵' },
        { type: 'network', name: '网络图' },
      ],
      linear_regression: [
        { type: 'residuals_vs_fitted', name: '拟合值-残差图' },
        { type: 'qq', name: '残差Q-Q图' },
        { type: 'actual_vs_pred', name: '实际值-预测值' },
        { type: 'coef_forest', name: '系数森林图' },
      ],
      // 注意：logistic_regression 的配置已在前面定义，避免重复键
      chi_square: [
        { type: 'heatmap', name: '热力图' },
        { type: 'expected_vs_observed', name: '观察/期望频数' },
        { type: 'mosaic', name: '马赛克图' },
        { type: 'stacked_bar', name: '堆叠柱状图' },
        { type: 'residuals', name: '残差图' },
      ],
      stratified: [
        { type: 'forest', name: '森林图' },
        { type: 'funnel', name: '漏斗图' },
        { type: 'bar', name: '分层柱状图' },
      ],
      mendelian_randomization: [
        { type: 'scatter', name: '散点图' },
        { type: 'funnel', name: '漏斗图' },
        { type: 'forest', name: '森林图' },
      ],
      explore: [
        { type: 'histogram', name: '直方图' },
        { type: 'boxplot', name: '箱线图' },
        { type: 'qq', name: 'Q-Q图' },
        { type: 'scatter', name: '散点图' },
      ],
    };
    return configs[type] || [];
  };

  // 当分析改变时，设置默认标签页与图表类型
  useEffect(() => {
    if (!analysis) return;
    if (analysis.status === 'failed') {
      setActiveTab('failed_info');
      return;
    }
    const chartConfigs = getChartConfig(analysis.analysis_type);
    // 每次打开结果，都重置为该分析类型的第一个默认图表，避免延续上一次的选择导致空白
    setSelectedChartType(chartConfigs[0]?.type || '');
    setActiveTab('chart');
  }, [analysis]);

  // 防抖：当弹窗可见且类型存在，但 selectedChartType 仍为空时，再次设定默认值（和描述性一致的兜底）
  useEffect(() => {
    if (!visible || !analysis) return;
    const charts = getChartConfig(analysis.analysis_type);
    if (!selectedChartType && charts.length > 0) {
      setSelectedChartType(charts[0].type);
    }
  }, [visible, analysis, selectedChartType]);

  // 弹窗可见时，直接允许渲染图表；后续用 ResizeObserver 触发重绘
  useEffect(() => {
    if (visible) {
      setChartHostReady(true);
      const timers: number[] = [] as any;
      const fire = () => window.dispatchEvent(new Event('resize'));
      timers.push(setTimeout(fire, 120) as unknown as number);
      timers.push(setTimeout(fire, 320) as unknown as number);
      timers.push(setTimeout(fire, 640) as unknown as number);
      if (analysis) {
        const charts = getChartConfig(analysis.analysis_type);
        setSelectedChartType(charts[0]?.type || '');
      }
      setOpenNonce((n) => n + 1);
      return () => timers.forEach((t) => clearTimeout(t as any));
    }
  }, [visible, analysis]);

  // 监听尺寸变化：当容器宽度>0时才渲染图表，并在变化时触发 resize
  useLayoutEffect(() => {
    const el = chartHostRef.current;
    if (!el) return;
    const RO = (window as any).ResizeObserver;
    if (typeof RO === 'function') {
      const ro = new RO((entries: any[]) => {
        const rect = entries?.[0]?.contentRect || { width: 0, height: 0 };
        const ok = (rect.width || 0) > 32; // 有实际宽度才认为就绪
        setChartHostReady(ok);
        if (ok) {
          setTimeout(() => window.dispatchEvent(new Event('resize')), 30);
        }
      });
      ro.observe(el);
      return () => ro.disconnect();
    } else {
      // 无 ResizeObserver 浏览器：兜底
      const timer = setInterval(() => {
        const w = (chartHostRef.current?.getBoundingClientRect().width || 0);
        const ok = w > 32;
        setChartHostReady(ok);
        if (ok) {
          window.dispatchEvent(new Event('resize'));
          clearInterval(timer);
        }
      }, 80) as unknown as number;
      return () => clearInterval(timer as any);
    }
  }, [visible]);

  // 使用通用生成器输出统计表格与公式
  const statisticsContent = analysis ? generateStatisticsTableNode(analysis as any, selectedChartType) : null;
  const formulasContent = analysis ? generateFormulas(analysis as any) : null;
  const parsedResults = analysis
    ? (typeof (analysis as any).results === 'string'
        ? (() => { 
            try { return JSON.parse((analysis as any).results); } 
            catch { 
              try {
                const sanitized = ((analysis as any).results as string)
                  .replace(/\bNaN\b/g, 'null')
                  .replace(/\bInfinity\b/g, 'null')
                  .replace(/\b-?Infinity\b/g, 'null');
                return JSON.parse(sanitized);
              } catch { return null; }
            } 
          })()
        : (analysis as any).results)
    : null;
  const failureMessage = (analysis as any)?.error_message || (parsedResults as any)?.error;

  // 导出结果
  const handleExport = () => {
    if (!analysis) return;
    
    // 这里将实现结果导出功能
    console.log('导出分析结果:', analysis);
  };

  // 复制结果
  const handleCopy = () => {
    if (!analysis) return;
    
    // 这里将实现结果复制功能
    console.log('复制分析结果:', analysis);
  };

  if (!analysis) {
    return null;
  }

  // 原始数据美化显示（支持字符串与对象）
  const MAX_ARRAY_ITEMS = 50;

  const prettyPrint = (value: any, expanded = false): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed, (key, val) => redactAndTruncate(key, val, expanded), 2);
      } catch (e) {
        return value;
      }
    }
    try {
      return JSON.stringify(value, (key, val) => redactAndTruncate(key, val, expanded), 2);
    } catch {
      return String(value);
    }
  };

  const redactAndTruncate = (key: string, val: any, expanded: boolean) => {
    // 脱敏
    const keyLower = (key || '').toLowerCase();
    const sensitive = ['password', 'token', 'secret', 'phone', 'mobile', 'email', 'id_card', '身份证'];
    if (sensitive.includes(keyLower)) {
      return '***';
    }
    // 大数组截断
    if (Array.isArray(val) && !expanded && val.length > MAX_ARRAY_ITEMS) {
      return `【数组已折叠：共 ${val.length} 项，见上方“数组预览”】`;
    }
    return val;
  };


  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // ignore
    }
  };

  const downloadJson = (filename: string, text: string) => {
    try {
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore
    }
  };

  const chartConfigs = getChartConfig(analysis.analysis_type);

  return (
        <Modal
      title={
        <div>
          <Title level={4} style={{ margin: 0, color: '#fff', fontWeight: 700 }}>
            {getAnalysisTypeName(analysis.analysis_type)} - 分析结果
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
            数据集: {analysis.dataset_name} | 
            创建时间: {formatDateTime(analysis.created_at, 'zh-CN', 'Asia/Shanghai')}
          </Text>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width="95%"
      style={{ top: 20 }}
          afterOpenChange={(open) => {
            if (open) {
              setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
            }
          }}
      footer={[
        <Button key="export" icon={<DownloadOutlined />} onClick={handleExport}>
          导出结果
        </Button>,
        <Button key="copy" icon={<CopyOutlined />} onClick={handleCopy}>
          复制结果
        </Button>,
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* 失败详情标签（仅失败时显示）*/}
        {analysis.status === 'failed' && (
          <TabPane
            tab={
              <span>
                <InfoCircleOutlined />
                失败详情
              </span>
            }
            key="failed_info"
          >
            <Alert
              type="error"
              message="分析失败"
              description={failureMessage || '后端未返回失败原因。请检查变量选择与数据类型是否符合要求。'}
              showIcon
            />
          </TabPane>
        )}
        {analysis.status !== 'failed' && (
        /* 图表标签页 */
        <TabPane 
          tab={
            <span>
              <BarChartOutlined />
              图表
            </span>
          } 
          key="chart"
        >
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Text strong>图表类型: </Text>
              <Select
                value={selectedChartType}
                onChange={setSelectedChartType}
                style={{ width: 200 }}
              >
                {chartConfigs.map(config => (
                  <Option key={config.type} value={config.type}>
                    {config.name}
                  </Option>
                ))}
              </Select>
            </Space>
          </div>

              <div ref={chartHostRef} style={{ minHeight: 500, width: '100%' }}>
                {chartHostReady ? (
                   <ChartGenerator 
                    key={`${analysis.id}-${selectedChartType}-${chartHostReady}-${openNonce}`}
                     analysis={analysis} 
                     chartType={selectedChartType} 
                   />
                 ) : (
                   <div style={{ height: 420 }} />
                 )}
               </div>
        </TabPane>
        )}

        {analysis.status !== 'failed' && (
        /* 统计表格标签页 */
        <TabPane 
          tab={
            <span>
              <TableOutlined />
              统计表格
            </span>
          } 
          key="table"
        >
          {statisticsContent || (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">暂无统计表格数据</Text>
            </div>
          )}
        </TabPane>
        )}

        {analysis.status !== 'failed' && (
        /* 公式和统计摘要标签页 */
        <TabPane 
          tab={
            <span>
              <InfoCircleOutlined />
              公式与摘要
            </span>
          } 
          key="formulas"
        >
          <div style={{ minHeight: 400 }}>
            {formulasContent || (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text type="secondary">暂无公式和统计摘要</Text>
              </div>
            )}
          </div>
        </TabPane>
        )}

        {analysis.status !== 'failed' && (
        /* 原始数据标签页 */
        <TabPane 
          tab={
            <span>
              <TableOutlined />
              原始数据（开发者）
            </span>
          } 
          key="raw"
        >
          <Collapse defaultActiveKey={[]}>
            <Panel header="分析参数" key="parameters">
              <div style={{ textAlign: 'right', marginBottom: 8 }}>
                <Space size={8}>
                  <Button size="small" onClick={() => setExpandParams(v => !v)}>{expandParams ? '收起' : '展开全部'}</Button>
                  <Button size="small" onClick={() => copyToClipboard(prettyPrint(analysis.parameters, expandParams))}>复制JSON</Button>
                  <Button size="small" onClick={() => downloadJson(`analysis_${analysis.id}_params.json`, prettyPrint(analysis.parameters, true))}>下载完整JSON</Button>
                </Space>
              </div>
              <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {prettyPrint(analysis.parameters, expandParams)}
              </pre>
            </Panel>
            <Panel header="分析结果" key="results">
              {/* 大数组友好预览 */}
              {/* 数组预览卡片（已移除按需展示） */}
              <div style={{ textAlign: 'right', marginBottom: 8 }}>
                <Space size={8}>
                  <Button size="small" onClick={() => setExpandResults(v => !v)}>{expandResults ? '收起' : '展开全部'}</Button>
                  <Button size="small" onClick={() => copyToClipboard(prettyPrint(analysis.results, expandResults))}>复制JSON</Button>
                  <Button size="small" onClick={() => downloadJson(`analysis_${analysis.id}_results.json`, prettyPrint(analysis.results, true))}>下载完整JSON</Button>
                </Space>
              </div>
              <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {prettyPrint(analysis.results, expandResults)}
              </pre>
              {/* 查看全部弹窗（移除） */}
            </Panel>
          </Collapse>
        </TabPane>
        )}
      </Tabs>
    </Modal>
  );
};

export default AnalysisResults;
