import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Select,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Alert,
  Progress,
  message,
  Divider,
  Tag,
  Tooltip,
  Input,
  InputNumber,
  Switch,
} from 'antd';
import {
  BarChartOutlined,
  PlayCircleOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { dataAPI, analysisAPI } from '../../services/api';
import { useDatasetColumns } from '../../hooks/useDatasetColumns';
import type { Rules, ColumnMeta } from '../../analysis/adapters/registry';
import { crosstabRules } from '../../analysis/adapters/crosstab';
import { descriptiveRules } from '../../analysis/adapters/descriptive';
import { exploreRules } from '../../analysis/adapters/explore';
import { frequencyRules } from '../../analysis/adapters/frequency';
import { correlationRules } from '../../analysis/adapters/correlation';
import { linearRegressionRules, logisticBinaryRules, logisticMultinomialRules, logisticOrdinalRules, logisticConditionalRules } from '../../analysis/adapters/regression';
import { chiSquareRules } from '../../analysis/adapters/chi_square';
import { stratifiedRules } from '../../analysis/adapters/stratified';
import { mendelianRules } from '../../analysis/adapters/mendelian';
import { extractErrorMessage } from '../../utils/error';

const { Text } = Typography;
const { Option, OptGroup } = Select;

interface AnalysisFormProps {
  onAnalysisComplete?: (analysisId: string) => void;
}

const AnalysisForm: React.FC<AnalysisFormProps> = ({ onAnalysisComplete }) => {
  const [form] = Form.useForm();
  const [analysisForm] = Form.useForm();
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [selectedDataset, setSelectedDataset] = useState<any>(null);
  const [analysisType, setAnalysisType] = useState<string>('');
  const [dependentVars, setDependentVars] = useState<string[]>([]);
  const [independentVars, setIndependentVars] = useState<string[]>([]);
  const [groupingVars, setGroupingVars] = useState<string[]>([]);
  const [exposureVars, setExposureVars] = useState<string[]>([]);
  const [outcomeVars, setOutcomeVars] = useState<string[]>([]);
  const [instrumentVars, setInstrumentVars] = useState<string[]>([]);
  const [stratumVars, setStratumVars] = useState<string[]>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const queryClient = useQueryClient();

  // 获取数据集列表
  const { data: datasets } = useQuery('datasets', () => dataAPI.getDatasets());

  // 获取所有分析列表（用于检查名称重复）
  const { data: allAnalyses } = useQuery('analyses', () => analysisAPI.getAnalyses());

  // 统一使用公共 hook 获取并规范化列信息（通用方案）
  const {
    columns: datasetColumns,
    isLoading: columnsLoading,
    refetch: refetchColumns,
  } = useDatasetColumns(selectedDataset?.id ?? null);

  // 运行分析
  const runAnalysisMutation = useMutation(
    (data: any) => analysisAPI.runAnalysis(data),
    {
      onSuccess: (response: any) => {
        message.success('分析启动成功');
        // 兼容不同返回结构，稳健获取分析ID
        const analysisId =
          response?.data?.analysis_id ??
          response?.data?.id ??
          response?.analysis_id ??
          response?.id;

        if (!analysisId) {
          setRunningAnalysis(false);
          setAnalysisProgress(0);
          message.error('未获取到分析ID，无法跟踪进度');
          return;
        }
        setRunningAnalysis(true);
        setAnalysisProgress(0);
        
        // 开始轮询分析状态（容错 + 渐进进度）
        let progress = 5; // 给用户可见的反馈
        let attempts = 0;
        const MAX_ATTEMPTS = 60; // 最多轮询60秒

        const pollInterval = setInterval(() => {
          attempts += 1;
          setAnalysisProgress(Math.min(progress, 95));
          progress = Math.min(progress + 2, 95);

          analysisAPI
            .getAnalysis(Number(analysisId))
            .then((res) => {
              const analysis = res.data?.data || res.data || {};
              if (analysis.status === 'completed') {
                clearInterval(pollInterval);
                setAnalysisProgress(100);
                setRunningAnalysis(false);
                queryClient.invalidateQueries('analyses');
                if (onAnalysisComplete) onAnalysisComplete(analysis.id || String(analysisId));
              } else if (analysis.status === 'failed') {
                clearInterval(pollInterval);
                setRunningAnalysis(false);
                setAnalysisProgress(0);
                message.error(analysis.error_message || '分析失败');
                queryClient.invalidateQueries('analyses');
              }
            })
            .catch(() => {
              // 忽略单次错误，但若超时则提示
            });

          if (attempts >= MAX_ATTEMPTS) {
            clearInterval(pollInterval);
            setRunningAnalysis(false);
            message.warning('分析已启动，但未在预期时间内返回结果，请稍后在右侧历史查看');
            queryClient.invalidateQueries('analyses');
          }
        }, 1000);
      },
      onError: (error: any) => {
        message.error(extractErrorMessage(error, '分析失败'));
        setRunningAnalysis(false);
        setAnalysisProgress(0);
      },
    }
  );

  // 数据集改变时刷新列
  useEffect(() => {
    if (selectedDataset?.id) refetchColumns();
  }, [selectedDataset?.id, refetchColumns]);

  // 获取分析类型配置
  const getAnalysisTypeConfig = (type: string) => {
    // UI 附加信息（图标/颜色）放这里；变量规则来自各模块 Rules
    const ruleMap: Record<string, Rules> = {
      descriptive: descriptiveRules,
      explore: descriptiveRules,
      frequency: frequencyRules,
      crosstab: crosstabRules,
      correlation: correlationRules,
      linear_regression: linearRegressionRules,
      logistic_regression: logisticBinaryRules,
      logistic_regression_multinomial: logisticMultinomialRules,
      logistic_regression_ordinal: logisticOrdinalRules,
      logistic_regression_conditional: logisticConditionalRules,
      chi_square: chiSquareRules,
      stratified: stratifiedRules,
      mendelian_randomization: mendelianRules,
    };
    const base = ruleMap[type] || ({} as any);
    const ui: Record<string, any> = {
      descriptive: {
        name: '描述性分析',
        description: '计算基本统计量，包括均值、标准差、中位数等',
        icon: <BarChartOutlined />,
        color: '#1890ff',
      },
      frequency: {
        name: '频率分析',
        description: '分析分类变量的频数分布',
        icon: <BarChartOutlined />,
        color: '#52c41a',
      },
      crosstab: {
        name: '交叉表分析',
        description: '分析两个分类变量之间的关联关系',
        icon: <BarChartOutlined />,
        color: '#fa8c16',
      },
      correlation: {
        name: '相关性分析',
        description: '分析数值变量之间的线性相关关系',
        icon: <BarChartOutlined />,
        color: '#eb2f96',
      },
      linear_regression: {
        name: '线性回归',
        description: '连续因变量的线性模型，提供VIF/稳健SE/残差诊断',
        icon: <BarChartOutlined />,
        color: '#722ed1',
      },
      logistic_regression: {
        name: '二分类逻辑回归',
        description: '二分类因变量的对数几率模型，提供OR/CI/AUC等',
        icon: <BarChartOutlined />,
        color: '#391085',
      },
      logistic_regression_multinomial: {
        name: '无序多分类逻辑回归',
        description: '多类别无序分类的多项逻辑回归（multinomial）',
        icon: <BarChartOutlined />,
        color: '#391085',
      },
      logistic_regression_ordinal: {
        name: '有序多分类逻辑回归',
        description: '有序类别的有序logit模型（Ordered Logit）',
        icon: <BarChartOutlined />,
        color: '#391085',
      },
      logistic_regression_conditional: {
        name: '条件逻辑回归（分层）',
        description: '基于分层的条件逻辑回归（固定效应近似）',
        icon: <BarChartOutlined />,
        color: '#391085',
      },
      chi_square: {
        name: '卡方检验',
        description: '检验分类变量之间的独立性',
        icon: <BarChartOutlined />,
        color: '#13c2c2',
      },
      stratified: {
        name: '分层分析',
        description: '按分层变量进行分层统计分析',
        icon: <BarChartOutlined />,
        color: '#f5222d',
      },
      mendelian_randomization: {
        name: '孟德尔随机化',
        description: '使用工具变量进行因果推断',
        icon: <BarChartOutlined />,
        color: '#faad14',
      },
      explore: {
        name: '探索分析',
        description: '探索性数据分析，包括分布检验和异常值检测',
        icon: <BarChartOutlined />,
        color: '#2f54eb',
      },
    };
    return base ? { ...base, ...ui[type] } : (ui[type] || {});
  };

  // 旧集中式规则已移除，改由各模块 rulesRegistry 统一提供

  // 获取可用的变量选项
  // 每类型自带规则（与适配器同模块），统一入口
  const rulesRegistry: Record<string, Rules> = {
    descriptive: descriptiveRules,
    explore: exploreRules,
    frequency: frequencyRules,
    crosstab: crosstabRules,
    correlation: correlationRules,
    linear_regression: linearRegressionRules,
    logistic_regression: logisticBinaryRules,
    logistic_regression_multinomial: logisticMultinomialRules,
    logistic_regression_ordinal: logisticOrdinalRules,
    logistic_regression_conditional: logisticConditionalRules,
    chi_square: chiSquareRules,
    stratified: stratifiedRules,
    mendelian_randomization: mendelianRules,
  };

  const getVariableOptions = (columnType: string) => {
    if (!datasetColumns?.length || !analysisType) return [];
    const totalRows = selectedDataset?.total_rows || 0;
    const rules = rulesRegistry[analysisType];
    return datasetColumns.map((col: any) => {
      const meta: ColumnMeta = {
        name: col.name,
        is_numeric: !!col.is_numeric,
        is_categorical: !!col.is_categorical,
        unique_count: col.unique_count,
      };
      const assess = rules ? rules.explain(meta, columnType, { totalRows }) : { ok: true };
      const disabled = rules ? !assess.ok : false;
      const tip = assess.reason ? `不可选：${assess.reason}` : (col.is_numeric ? '数值型' : '分类型');
      return {
        label: (
          <Tooltip title={tip}>
            <div style={{ opacity: disabled ? 0.5 : 1 }}>
              <span>{col.name}</span>
              <Tag color={col.is_numeric ? 'blue' : 'green'} style={{ marginLeft: 8 }}>
                {col.is_numeric ? '数值型' : '分类型'}
              </Tag>
              <Text type="secondary" style={{ marginLeft: 8 }}>
                ({col.unique_count} 个唯一值)
              </Text>
            </div>
          </Tooltip>
        ),
        value: col.name,
        disabled,
      };
    });
  };

  // 处理分析类型改变
  const handleAnalysisTypeChange = (type: string) => {
    setAnalysisType(type);
    // 清空所有变量选择
    setDependentVars([]);
    setIndependentVars([]);
    setGroupingVars([]);
    setExposureVars([]);
    setOutcomeVars([]);
    setInstrumentVars([]);
    setStratumVars([]);
  };

  // 处理数据集改变
  const handleDatasetChange = (datasetId: any) => {
    const idNum = typeof datasetId === 'string' ? Number(datasetId) : datasetId;
    const dataset = (datasets as any)?.data?.find((d: any) => d.id === idNum);
    setSelectedDataset(dataset);
  };

  // 提交分析
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const analysisValues = await analysisForm.validateFields();
      
      const config = getAnalysisTypeConfig(analysisType);
      if (!config) {
        message.error('请选择有效的分析类型');
        return;
      }
      // 防御：有序/无序/二分类/条件逻辑回归必须至少一个自变量
      if ([
        'logistic_regression',
        'logistic_regression_multinomial',
        'logistic_regression_ordinal',
        'logistic_regression_conditional',
      ].includes(analysisType)) {
        const indepsFromForm = analysisValues.independent_variables;
        const indeps = Array.isArray(indepsFromForm)
          ? indepsFromForm
          : (indepsFromForm ? [indepsFromForm] : independentVars);
        if (!indeps || indeps.length === 0) {
          message.error('逻辑回归需要至少选择一个自变量');
          return;
        }
      }

      // 构建分析参数
      const analysisParams: any = {
        analysis_type: analysisType,
        dataset_id: values.dataset_id,
        analysis_name: values.analysis_name?.trim(), // 从主表单获取分析名称
        ...analysisValues,
      };

      // 根据分析类型添加相应的变量
      if (config.requiredVars.includes('dependent') || config.optionalVars.includes('dependent')) {
        // 优先从表单读取，避免受控状态偶发不同步；频率分析为单变量也统一包成数组
        const formDep = analysisValues.dependent_variables;
        const normalized = Array.isArray(formDep) ? formDep : (formDep ? [formDep] : dependentVars);
        analysisParams.dependent_variables = normalized;
        // 频率分析若未选择变量，直接给出提示，避免后端回退到“所有变量”
        if (analysisType === 'frequency' && (!analysisParams.dependent_variables || analysisParams.dependent_variables.length === 0)) {
          message.error('请选择一个分类变量用于频率分析');
          return;
        }
      }
      if (config.requiredVars.includes('independent') || config.optionalVars.includes('independent')) {
        // 统一优先从表单读取，其次回退到状态
        const formInd = analysisValues.independent_variables;
        const indeps = Array.isArray(formInd) ? formInd : (formInd ? [formInd] : independentVars);
        if (!(analysisType === 'descriptive' || analysisType === 'explore')) {
          analysisParams.independent_variables = indeps;
        }
      }
      // 回归类分析：标准化因变量字段为后端所需的单数 dependent_variable
      if ([
        'linear_regression',
        'logistic_regression',
        'logistic_regression_multinomial',
        'logistic_regression_ordinal',
        'logistic_regression_conditional',
      ].includes(analysisType)) {
        const depFromForm = analysisValues.dependent_variables;
        const dep = Array.isArray(depFromForm)
          ? depFromForm[0]
          : (Array.isArray(analysisParams.dependent_variables)
              ? analysisParams.dependent_variables[0]
              : analysisParams.dependent_variables);
        if (dep) {
          analysisParams.dependent_variable = dep;
        }
      }
      if (config.requiredVars.includes('exposure')) {
        // MR 等场景需要单个暴露变量，后端字段为 exposure_variable
        if (analysisType === 'mendelian_randomization') {
          // 从表单中读取暴露变量
          const formExposure = analysisValues.exposure_variables;
          const exposure = Array.isArray(formExposure) ? formExposure[0] : formExposure;
          if (exposure) {
            analysisParams.exposure_variable = exposure;
          }
        } else {
          analysisParams.exposure_variables = exposureVars;
        }
      }
      if (config.requiredVars.includes('outcome')) {
        if (analysisType === 'mendelian_randomization') {
          // 从表单中读取结局变量
          const formOutcome = analysisValues.outcome_variables;
          const outcome = Array.isArray(formOutcome) ? formOutcome[0] : formOutcome;
          if (outcome) {
            analysisParams.outcome_variable = outcome;
          }
        } else {
          analysisParams.outcome_variables = outcomeVars;
        }
      }
      if (config.requiredVars.includes('instrument')) {
        // 从表单中读取工具变量
        const formInstrument = analysisValues.instrument_variables;
        const instruments = Array.isArray(formInstrument) ? formInstrument : (formInstrument ? [formInstrument] : []);
        if (instruments.length > 0) {
          analysisParams.instrument_variables = instruments;
        }
      }
      if (config.requiredVars.includes('stratum')) {
        analysisParams.stratum_variables = stratumVars;
      }
      if (config.supportsGrouping) {
        const gForm = analysisValues.grouping_variables;
        const gNorm = Array.isArray(gForm) ? gForm : (gForm ? [gForm] : groupingVars);
        if (gNorm && gNorm.length > 0) {
          analysisParams.grouping_variables = gNorm;
        }
      }

      // 条件逻辑回归：将分层变量映射到后端字段 strata_variable
      if (analysisType === 'logistic_regression_conditional') {
        const strata = (analysisValues.grouping_variables && Array.isArray(analysisValues.grouping_variables)) ? analysisValues.grouping_variables[0] : groupingVars[0];
        analysisParams.strata_variable = strata;
      }

      // 交叉表/卡方：显式传 row/column 变量，兼容多种后端路径
      if ((analysisType === 'crosstab' || analysisType === 'chi_square')) {
        // 从表单中获取实际值，而不是从React状态获取
        const formDepVars = analysisValues.dependent_variables;
        const formIndVars = analysisValues.independent_variables;
        const rowVar = Array.isArray(formDepVars) ? formDepVars[0] : formDepVars;
        const colVar = Array.isArray(formIndVars) ? formIndVars[0] : formIndVars;
        if (rowVar) analysisParams.row_variable = rowVar;
        if (colVar) analysisParams.column_variable = colVar;
        // 移除冗余旧字段，统一只传规范字段
        delete analysisParams.dependent_variables;
        delete analysisParams.independent_variables;
      }

      // 规范化 MR 字段：只保留后端使用的字段名
      if (analysisType === 'mendelian_randomization') {
        delete analysisParams.exposure_variables;
        delete analysisParams.outcome_variables;
        
        // 验证孟德尔分析必需参数
        if (!analysisParams.exposure_variable) {
          message.error('请选择暴露变量');
          return;
        }
        if (!analysisParams.outcome_variable) {
          message.error('请选择结局变量');
          return;
        }
        if (!analysisParams.instrument_variables || analysisParams.instrument_variables.length === 0) {
          message.error('请选择工具变量');
          return;
        }
      }

      runAnalysisMutation.mutate(analysisParams);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const config = getAnalysisTypeConfig(analysisType);

  // 统一处理变量选择（在交叉表/卡方时限制为单选）
  const handleDependentChange = (vals: any) => {
    const arr = Array.isArray(vals) ? vals : [vals];
    const normalized = (
      analysisType === 'crosstab' ||
      analysisType === 'chi_square' ||
      analysisType === 'logistic_regression' ||
      analysisType === 'logistic_regression_multinomial' ||
      analysisType === 'logistic_regression_ordinal' ||
      analysisType === 'linear_regression'
    ) ? arr.slice(-1) : arr;
    setDependentVars(normalized);
    analysisForm.setFieldsValue({ dependent_variables: normalized });

    if (normalized.length > 0) {
      const disallowed = new Set(normalized);
      setIndependentVars(prev => prev.filter((v: string) => !disallowed.has(v)));
      setGroupingVars(prev => prev.filter((v: string) => !disallowed.has(v)));
      const currentIndep = analysisForm.getFieldValue('independent_variables') || [];
      const currentGroup = analysisForm.getFieldValue('grouping_variables') || [];
      analysisForm.setFieldsValue({
        independent_variables: currentIndep.filter((v: string) => !disallowed.has(v)),
        grouping_variables: currentGroup.filter((v: string) => !disallowed.has(v)),
      });
    }
  };
  const handleIndependentChange = (vals: any) => {
    let arr = Array.isArray(vals) ? vals : [vals];
    if (analysisType === 'crosstab' || analysisType === 'chi_square') {
      arr = arr.slice(-1);
    }
    const filtered = arr.filter((v) => !dependentVars.includes(v));
    setIndependentVars(filtered);
    analysisForm.setFieldsValue({ independent_variables: filtered });
  };

  // 仅在线性/逻辑回归显示高级选项
  const shouldShowAdvanced = (
    analysisType === 'linear_regression' ||
    analysisType === 'logistic_regression' ||
    analysisType === 'logistic_regression_multinomial' ||
    analysisType === 'logistic_regression_ordinal' ||
    analysisType === 'logistic_regression_conditional'
  );

  // 重置所有字段与选择
  const handleResetAll = () => {
    try {
      form.resetFields();
      analysisForm.resetFields();
    } catch {}
    setSelectedDataset(null);
    setAnalysisType('');
    setDependentVars([]);
    setIndependentVars([]);
    setGroupingVars([]);
    setExposureVars([]);
    setOutcomeVars([]);
    setInstrumentVars([]);
    setStratumVars([]);
    setShowAdvancedOptions(false);
  };

  return (
    <Card className="page-section-card" title="新建分析" extra={<BarChartOutlined />} headStyle={{ minHeight: 72, display: 'flex', alignItems: 'center' }}>
      <Form form={form} layout="vertical">
        <Form.Item
          name="analysis_name"
          label="分析名称"
          rules={[
            { required: true, message: '请输入分析名称' },
            { max: 100, message: '分析名称不能超过100个字符' },
            {
              validator: async (_, value) => {
                if (!value) return;
                const existingNames = (allAnalyses as any)?.data?.map((a: any) => a.name) || [];
                if (existingNames.includes(value.trim())) {
                  throw new Error('分析名称已存在，请使用不同的名称');
                }
              }
            }
          ]}
        >
          <Input placeholder="请输入分析名称（必填，不能重复）" />
        </Form.Item>

        <Form.Item
          name="dataset_id"
          label="选择数据集"
          rules={[{ required: true, message: '请选择数据集' }]}
        >
          <Select 
            placeholder="请选择数据集" 
            data-testid="dataset-select"
            onChange={handleDatasetChange}
          >
            {(datasets as any)?.data?.map((dataset: any) => (
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
            <OptGroup label="描述与探索性分析">
              <Option value="descriptive">描述性分析</Option>
              <Option value="explore">探索分析</Option>
            </OptGroup>
            <OptGroup label="分类数据分析（列联表）">
              <Option value="crosstab">交叉表分析</Option>
              <Option value="frequency">频率分析</Option>
              <Option value="chi_square">卡方检验</Option>
            </OptGroup>
            <OptGroup label="相关与关联分析">
              <Option value="correlation">相关性分析</Option>
            </OptGroup>
            <OptGroup label="回归建模与预测">
              <Option value="linear_regression">线性回归</Option>
              <Option value="logistic_regression">二分类逻辑回归</Option>
              <Option value="logistic_regression_multinomial">无序多分类逻辑回归</Option>
              <Option value="logistic_regression_ordinal">有序多分类逻辑回归</Option>
              <Option value="logistic_regression_conditional">条件逻辑回归（分层）</Option>
            </OptGroup>
            <OptGroup label="分层与合并证据（Meta 分析）">
              <Option value="stratified">分层分析（Mantel–Haenszel）</Option>
            </OptGroup>
            <OptGroup label="因果推断与遗传流行病学">
              <Option value="mendelian_randomization">孟德尔随机化</Option>
            </OptGroup>
          </Select>
        </Form.Item>

        {analysisType && config && (
          <Alert
            message={config.name}
            description={config.description}
            type="info"
            icon={<InfoCircleOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}

        {selectedDataset && analysisType && (
          <Form form={analysisForm} layout="vertical">
            {/* 分析变量（描述性/探索性）/ 行变量（交叉/卡方）/ 因变量（推断类） */}
            {(config.requiredVars.includes('dependent') || config.optionalVars.includes('dependent')) && (
              <Form.Item
                name="dependent_variables"
                label={
                  <span>
                    {(analysisType === 'descriptive' || analysisType === 'explore' || analysisType === 'frequency' || analysisType === 'correlation')
                      ? '分析变量'
                      : analysisType === 'crosstab' || analysisType === 'chi_square'
                        ? '行变量'
                        : '因变量'}
                    {config.requiredVars.includes('dependent') && <span style={{ color: 'red' }}> *</span>}
                    <Tooltip title={
                      (analysisType === 'descriptive' || analysisType === 'explore' || analysisType === 'frequency' || analysisType === 'correlation')
                        ? (analysisType === 'correlation'
                            ? '相关性分析：优先选择连续数值变量；可包含少数等级/二值变量（唯一值≤10），将自动采用秩相关/点二列等方法。至少选择2个变量。'
                            : '选择要分析的变量')
                        : analysisType === 'crosstab' || analysisType === 'chi_square'
                          ? '选择交叉表的行变量（分类变量）'
                          : '选择因变量（结局）'
                    }>
                      <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                    </Tooltip>
                  </span>
                }
                rules={config.requiredVars.includes('dependent') ? [{ required: true, message:
                  (analysisType === 'descriptive' || analysisType === 'explore' || analysisType === 'frequency' || analysisType === 'correlation') ? '请选择分析变量'
                  : analysisType === 'crosstab' || analysisType === 'chi_square' ? '请选择行变量'
                  : '请选择因变量'
                }] : []}
              >
                <Select
                  mode={
                    analysisType === 'crosstab' ||
                    analysisType === 'chi_square' ||
                    analysisType === 'linear_regression' ||
                    analysisType === 'logistic_regression' ||
                    analysisType === 'logistic_regression_multinomial' ||
                    analysisType === 'logistic_regression_ordinal' ||
                    analysisType === 'logistic_regression_conditional'
                      ? undefined
                      : 'multiple'
                  }
                  placeholder={(analysisType === 'descriptive' || analysisType === 'explore' || analysisType === 'frequency' || analysisType === 'correlation') ? '请选择分析变量' : (analysisType === 'crosstab' || analysisType === 'chi_square' ? '请选择行变量' : '请选择因变量')}
                  options={getVariableOptions('dependent')}
                  maxTagCount="responsive"
                  maxTagPlaceholder={(omittedValues) => (
                    <Tooltip title={omittedValues.map((v: any) => v.label || v.value).join(', ')}>
                      <span>+{omittedValues.length} ...</span>
                    </Tooltip>
                  )}
                  value={
                    analysisType === 'crosstab' ||
                    analysisType === 'chi_square' ||
                    analysisType === 'linear_regression' ||
                    analysisType === 'logistic_regression' ||
                    analysisType === 'logistic_regression_multinomial' ||
                    analysisType === 'logistic_regression_ordinal' ||
                    analysisType === 'logistic_regression_conditional'
                      ? dependentVars[0]
                      : dependentVars
                  }
                  onChange={handleDependentChange}
                  disabled={!analysisType || columnsLoading}
                />
              </Form.Item>
            )}

            {/* 自变量 / 列变量 */}
            {(config.requiredVars.includes('independent') || config.optionalVars.includes('independent')) && (
              <Form.Item
                name="independent_variables"
                label={
                  <span>
                    {analysisType === 'crosstab' || analysisType === 'chi_square' ? '列变量' : '自变量'}
                    {config.requiredVars.includes('independent') && <span style={{ color: 'red' }}> *</span>}
                    <Tooltip title={analysisType === 'crosstab' || analysisType === 'chi_square' ? '选择交叉表的列变量（分类变量）' : '选择自变量（因素/预测因子）'}>
                      <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                    </Tooltip>
                  </span>
                }
                rules={config.requiredVars.includes('independent') ? [{ required: true, message: analysisType === 'crosstab' || analysisType === 'chi_square' ? '请选择列变量' : '请选择自变量' }] : []}
              >
                <Select
                  mode={analysisType === 'crosstab' || analysisType === 'chi_square' ? undefined : 'multiple'}
                  placeholder={analysisType === 'crosstab' || analysisType === 'chi_square' ? '请选择列变量' : '请选择自变量'}
                  options={getVariableOptions('independent')}
                  maxTagCount="responsive"
                  maxTagPlaceholder={(omittedValues) => (
                    <Tooltip title={omittedValues.map((v: any) => v.label || v.value).join(', ')}>
                      <span>+{omittedValues.length} ...</span>
                    </Tooltip>
                  )}
                  value={analysisType === 'crosstab' || analysisType === 'chi_square' ? independentVars[0] : independentVars}
                  onChange={handleIndependentChange}
                  disabled={!analysisType || columnsLoading}
                />
              </Form.Item>
            )}

            {/* 分组/分层变量 */}
            {(config.supportsGrouping || analysisType === 'logistic_regression_conditional') && (
              <Form.Item
                name="grouping_variables"
                label={
                  <span>
                    分组/分层变量{analysisType === 'logistic_regression_conditional' && <span style={{ color: 'red' }}> *</span>}
                    <Tooltip title="探索分析：仅单选；需分类型；唯一值不宜过多（≤max(20, 10%样本量)）。其他分析按各自规则。">
                      <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                    </Tooltip>
                  </span>
                }
                rules={analysisType === 'logistic_regression_conditional' ? [{ required: true, message: '请选择分层变量' }] : []}
              >
                <Select
                  mode={analysisType === 'explore' ? undefined : 'multiple'}
                  placeholder={analysisType === 'logistic_regression_conditional' ? '请选择分层变量（单选）' : '请选择分组/分层变量（可选）'}
                  options={getVariableOptions('grouping')}
                  maxTagCount="responsive"
                  maxTagPlaceholder={(omittedValues) => (
                    <Tooltip title={omittedValues.map((v: any) => v.label || v.value).join(', ')}>
                      <span>+{omittedValues.length} ...</span>
                    </Tooltip>
                  )}
                  value={groupingVars}
                  onChange={(vals: any) => {
                    const arrRaw = Array.isArray(vals) ? vals : (vals ? [vals] : []);
                    const filtered = arrRaw.filter((v) => !dependentVars.includes(v));
                    const normalized = analysisType === 'logistic_regression_conditional' ? filtered.slice(0, 1) : filtered;
                    setGroupingVars(normalized);
                    analysisForm.setFieldsValue({ grouping_variables: normalized });
                  }}
                  disabled={!analysisType || columnsLoading}
                />
              </Form.Item>
            )}

            {/* 孟德尔随机化特殊变量 */}
            {analysisType === 'mendelian_randomization' && (
              <>
                <Form.Item
                  name="exposure_variables"
                  label={
                    <span>
                      暴露变量 <span style={{ color: 'red' }}>*</span>
                      <Tooltip title="选择暴露变量">
                        <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                      </Tooltip>
                    </span>
                  }
                  rules={[{ required: true, message: '请选择暴露变量' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="请选择暴露变量"
                    options={getVariableOptions('exposure')}
                    maxTagCount="responsive"
                    maxTagPlaceholder={(omittedValues) => (
                      <Tooltip title={omittedValues.map((v: any) => v.label || v.value).join(', ')}>
                        <span>+{omittedValues.length} ...</span>
                      </Tooltip>
                    )}
                    value={exposureVars}
                    onChange={setExposureVars}
                    disabled={!analysisType || columnsLoading}
                  />
                </Form.Item>

                <Form.Item
                  name="outcome_variables"
                  label={
                    <span>
                      结局变量 <span style={{ color: 'red' }}>*</span>
                      <Tooltip title="选择结局变量">
                        <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                      </Tooltip>
                    </span>
                  }
                  rules={[{ required: true, message: '请选择结局变量' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="请选择结局变量"
                    options={getVariableOptions('outcome')}
                    maxTagCount="responsive"
                    maxTagPlaceholder={(omittedValues) => (
                      <Tooltip title={omittedValues.map((v: any) => v.label || v.value).join(', ')}>
                        <span>+{omittedValues.length} ...</span>
                      </Tooltip>
                    )}
                    value={outcomeVars}
                    onChange={setOutcomeVars}
                    disabled={!analysisType || columnsLoading}
                  />
                </Form.Item>

                <Form.Item
                  name="instrument_variables"
                  label={
                    <span>
                      工具变量 <span style={{ color: 'red' }}>*</span>
                      <Tooltip title="选择工具变量">
                        <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                      </Tooltip>
                    </span>
                  }
                  rules={[{ required: true, message: '请选择工具变量' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="请选择工具变量"
                    options={getVariableOptions('instrument')}
                    maxTagCount="responsive"
                    maxTagPlaceholder={(omittedValues) => (
                      <Tooltip title={omittedValues.map((v: any) => v.label || v.value).join(', ')}>
                        <span>+{omittedValues.length} ...</span>
                      </Tooltip>
                    )}
                    value={instrumentVars}
                    onChange={setInstrumentVars}
                    disabled={!analysisType || columnsLoading}
                  />
                </Form.Item>
              </>
            )}

            {/* 分层分析特殊变量 */}
            {analysisType === 'stratified' && (
              <Form.Item
                name="stratum_variables"
                label={
                  <span>
                    分层变量 <span style={{ color: 'red' }}>*</span>
                    <Tooltip title="分层变量需为分类型；建议层数不宜过多（≤10），仅单选">
                      <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                    </Tooltip>
                  </span>
                }
                rules={[{ required: true, message: '请选择分层变量' }]}
              >
                <Select
                  mode={undefined}
                  placeholder="请选择分层变量"
                  options={getVariableOptions('stratum')}
                  value={stratumVars[0]}
                  onChange={(v: string | undefined) => setStratumVars(v ? [String(v)] : ([] as string[]))}
                  disabled={!analysisType || columnsLoading}
                />
              </Form.Item>
            )}

            {/* 高级选项（仅当该分析类型实际存在可配置项时显示） */}
            {shouldShowAdvanced && ((analysisType === 'linear_regression') || (analysisType === 'logistic_regression')) && (
              <>
                <Divider>
                  <Button
                    type="link"
                    icon={<SettingOutlined />}
                    onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  >
                    高级选项
                  </Button>
                </Divider>
                {showAdvancedOptions && (
                  <>
                    {/* 逻辑回归高级选项 */}
                    {analysisType === 'logistic_regression' && (
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="use_balanced" label={<span>类权重平衡<Tooltip title="逻辑回归对类别不平衡加权（class_weight='balanced'）"><QuestionCircleOutlined style={{ marginLeft: 4 }} /></Tooltip></span>} initialValue={true}>
                            <Switch />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="penalty" label={<span>正则化<Tooltip title="逻辑回归正则化类型：'l2' 推荐"><QuestionCircleOutlined style={{ marginLeft: 4 }} /></Tooltip></span>} initialValue="l2">
                            <Select options={[{ value: 'l2', label: 'L2' }, { value: 'none', label: '无' }]} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="C" label={<span>C（正则强度）<Tooltip title="越小惩罚越强，默认1.0"><QuestionCircleOutlined style={{ marginLeft: 4 }} /></Tooltip></span>} initialValue={1}>
                            <InputNumber min={0.001} max={100} step={0.1} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="threshold" label={<span>分类阈值<Tooltip title="用于计算混淆矩阵等指标，默认0.5"><QuestionCircleOutlined style={{ marginLeft: 4 }} /></Tooltip></span>} initialValue={0.5}>
                            <InputNumber min={0.01} max={0.99} step={0.01} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                    )}

                    {/* 线性回归高级选项 */}
                    {analysisType === 'linear_regression' && (
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item name="enable_robust_se" label={<span>稳健标准误(HC3)<Tooltip title="用于对抗异方差，结果中会返回稳健SE"><QuestionCircleOutlined style={{ marginLeft: 4 }} /></Tooltip></span>} initialValue={true}>
                            <Switch />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="vif_threshold" label={<span>VIF阈值<Tooltip title="用于提示多重共线性，常用10"><QuestionCircleOutlined style={{ marginLeft: 4 }} /></Tooltip></span>} initialValue={10}>
                            <InputNumber min={1} max={100} step={1} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="add_interactions" label={<span>生成交互项<Tooltip title="为自变量两两生成乘积项用于探索交互"><QuestionCircleOutlined style={{ marginLeft: 4 }} /></Tooltip></span>} initialValue={false}>
                            <Switch />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item name="add_quadratic" label={<span>二次项<Tooltip title="为每个自变量添加平方项用于拟合非线性"><QuestionCircleOutlined style={{ marginLeft: 4 }} /></Tooltip></span>} initialValue={false}>
                            <Switch />
                          </Form.Item>
                        </Col>
                      </Row>
                    )}
                  </>
                )}
              </>
            )}

            {/* 运行分析按钮 */}
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleSubmit}
                  loading={runningAnalysis}
                  disabled={!selectedDataset || !analysisType}
                >
                  {runningAnalysis ? '分析中...' : '运行分析'}
                </Button>
                <Button onClick={handleResetAll}>
                  重置
                </Button>
              </Space>
            </Form.Item>

            {/* 分析进度 */}
            {runningAnalysis && (
              <Form.Item>
                <div>
                  <Text>分析进度: {analysisProgress}%</Text>
                  <Progress 
                    percent={analysisProgress} 
                    status={analysisProgress === 100 ? 'success' : 'active'}
                    style={{ marginTop: 8 }}
                  />
                </div>
              </Form.Item>
            )}
          </Form>
        )}
      </Form>
    </Card>
  );
};

export default AnalysisForm;
