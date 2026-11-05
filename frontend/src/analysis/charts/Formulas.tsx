/**
 * 统计公式组件
 */

import React, { useState } from 'react';
import { Typography, Card, Descriptions, Select, Space, Tag } from 'antd';
import { Analysis } from '../types/analysis';

const { Paragraph } = Typography;

export const generateFormulas = (analysis: Analysis) => {
  if (!analysis) {
    return <div>暂无统计公式</div>;
  }

  const actualType = analysis.analysis_type;
  const results = typeof analysis.results === 'string'
    ? safeParse(analysis.results)
    : analysis.results;
  const params = typeof analysis.parameters === 'string' ? safeParse(analysis.parameters as any) : analysis.parameters;

  if (actualType === 'descriptive' || actualType === 'explore') {
    // 顶部增加数据集/变量选取摘要
    return (
      <>
        <SelectionSummary analysis={analysis} params={params} results={results} />
        <ResultSummary analysis={analysis} results={results} />
        <DescriptiveFormulas results={results} />
      </>
    );
  }

  if (actualType === 'frequency') {
    return (
      <>
        <SelectionSummary analysis={analysis} params={params} results={results} />
        <FrequencyFormulas />
      </>
    );
  }

  if (actualType === 'chi_square') {
    return (
      <>
        <SelectionSummary analysis={analysis} params={params} results={results} />
        <ResultSummary analysis={analysis} results={results} />
        <ChiSquareFormulas />
      </>
    );
  }

  if (actualType === 'crosstab') {
    return (
      <>
        <SelectionSummary analysis={analysis} params={params} results={results} />
        <Card title="交叉表 - 统计摘要" size="small" style={{ marginBottom: 12 }}>
          <Paragraph>
            交叉表显示行变量与列变量的计数分布。你可以在“统计表格”页签查看完整表格，在“图表”页签切换热力图/堆叠柱状图进行对比。
          </Paragraph>
        </Card>
        <ChiSquareFormulas />
      </>
    );
  }

  if (actualType === 'correlation') {
    return (
      <>
        <SelectionSummary analysis={analysis} params={params} results={results} />
        <ResultSummary analysis={analysis} results={results} />
        <CorrelationFormulas />
      </>
    );
  }

  if (actualType === 'logistic_regression') {
    return (
      <>
        <SelectionSummary analysis={analysis} params={params} results={results} />
        <ResultSummary analysis={analysis} results={results} />
        <LogisticRegressionFormulas />
      </>
    );
  }

  if (actualType === 'logistic_regression_multinomial') {
    return (
      <>
        <SelectionSummary analysis={analysis} params={params} results={results} />
        <ResultSummary analysis={analysis} results={results} />
        <MultinomialLogisticFormulas />
      </>
    );
  }

  if (actualType === 'logistic_regression_ordinal') {
    return (
      <>
        <SelectionSummary analysis={analysis} params={params} results={results} />
        <ResultSummary analysis={analysis} results={results} />
        <OrdinalLogisticFormulas />
      </>
    );
  }

  if (actualType === 'logistic_regression_conditional') {
    return (
      <>
        <SelectionSummary analysis={analysis} params={params} results={results} />
        <ResultSummary analysis={analysis} results={results} />
        <ConditionalLogisticFormulas />
      </>
    );
  }

  if (actualType === 'linear_regression') {
    return (
      <>
        <SelectionSummary analysis={analysis} params={params} results={results} />
        <ResultSummary analysis={analysis} results={results} />
        <LinearRegressionFormulas />
      </>
    );
  }

  if (actualType === 'mendelian_randomization') {
    return (
      <>
        <SelectionSummary analysis={analysis} params={params} results={results} />
        <ResultSummary analysis={analysis} results={results} />
        <Card title="孟德尔随机化 - 说明" size="small">
          <Paragraph>
            基于工具变量推断暴露对结局的因果效应。结果中：
            <br />• <strong>IVW</strong> 提供总体效应 β、标准误及 95% 置信区间；
            <br />• <strong>MR-Egger</strong> 的斜率近似因果效应，截距用于检测水平均多效性（截距显著偏离 0 时需谨慎解读）；
            <br />• 散点图叠加 IVW / Egger 拟合线可观察单个工具的拟合情况；
            <br />• 漏斗图展示 Wald 比值与标准误，可直观感受对称性和潜在偏倚；
            <br />• 森林图列出每个工具的效应及置信区间，便于识别异常工具。
            <br />当有效工具不足时系统会提示“Insufficient valid instruments for MR”，请检查变量或样本量。
          </Paragraph>
        </Card>
      </>
    );
  }

  if (actualType === 'stratified') {
    return (
      <>
        <SelectionSummary analysis={analysis} params={params} results={results} />
        <ResultSummary analysis={analysis} results={results} />
        <Card title="分层分析 - 说明" size="small">
          <Paragraph>
            按分层变量分别估计效应：当暴露与结局均为二分类时计算每层 OR（带 Haldane-Anscombe 修正），并给出固定效应与随机效应合并估计及异质性指标（Q、p、I²）；否则回退为两组均值差并自动加权合并。若暴露变量非二分类，系统会记录自动二分策略（数值型按中位数、分类变量保留出现次数最高的两类），相关信息会在结果备注中展示。
          </Paragraph>
        </Card>
      </>
    );
  }

  return <div>暂无统计公式</div>;
};

const safeParse = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

const DescriptiveFormulas: React.FC<{ results: any }> = ({ results }) => {
  return (
    <Card title="描述性统计 - 公式与摘要" size="small">
      <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
        <Paragraph>
          <strong>1. 均值 (Mean):</strong><br/>
          x̄ = (1/n) Σ xᵢ
        </Paragraph>
        <Paragraph>
          <strong>2. 方差与标准差 (Variance / Std):</strong><br/>
          s² = Σ(xᵢ - x̄)² / (n-1)， s = √s²
        </Paragraph>
        <Paragraph>
          <strong>3. 中位数与四分位数 (Median / Quartiles):</strong><br/>
          Q1 = 25%分位，Median = 50%分位，Q3 = 75%分位
        </Paragraph>
        <Paragraph>
          <strong>4. 四分位距 (IQR):</strong><br/>
          IQR = Q3 - Q1
        </Paragraph>
        <Paragraph>
          <strong>5. 偏度 (Skewness) 与 峰度 (Kurtosis):</strong><br/>
          用于描述分布形态的偏斜程度与尖峭程度
        </Paragraph>
        <Paragraph>
          <strong>6. 正态性提示:</strong><br/>
          小样本建议用 Shapiro-Wilk；大样本可用 KS。若 p &lt; 0.05，可认为偏离正态。
        </Paragraph>
      </div>
    </Card>
  );
};

// 结果摘要组件
const ResultSummary: React.FC<{ analysis: Analysis; results: any }> = ({ analysis, results }) => {
  const type = analysis.analysis_type;
  const fmt = (v: any, d = 4) => (typeof v === 'number' && Number.isFinite(v) ? v.toFixed(d) : v ?? 'N/A');

  const items: Array<{ label: string; value: any }> = [];

  // 样本量
  const inferSampleSize = () => {
    if (!results || typeof results !== 'object') return undefined;
    if (type === 'descriptive' || type === 'explore') {
      const first = Object.values(results || {})[0] as any;
      const stats = first?.descriptive || first?.overall || first;
      return stats?.count;
    }
    if (type === 'frequency') {
      const first = Object.values(results || {})[0] as any;
      return first?.summary?.total ?? first?.summary?.valid;
    }
    if (type === 'chi_square') {
      return results?.total ?? results?.n ?? undefined;
    }
    if (type === 'correlation') {
      const anyPair = Object.values(results?.correlations || {})[0] as any;
      return anyPair?.sample_size;
    }
    if (type === 'logistic_regression' || type === 'linear_regression') {
      return results?.model_summary?.sample_size;
    }
    return undefined;
  };

  const n = inferSampleSize();
  if (n !== undefined) items.push({ label: '样本量', value: n });

  if (type === 'chi_square') {
    items.push({ label: 'χ²', value: fmt(results?.chi_square_statistic) });
    items.push({ label: 'df', value: results?.degrees_of_freedom ?? 'N/A' });
    items.push({ label: 'p', value: fmt(results?.p_value) });
    if (results?.cramers_v !== undefined) items.push({ label: "Cramér's V", value: fmt(results?.cramers_v) });
    // 期望频数结论
    const warn = results?.warnings || {};
    if (warn.expected_freq_ratio_ge_5 !== undefined) {
      items.push({ label: '期望≥5占比', value: `${(warn.expected_freq_ratio_ge_5 * 100).toFixed(1)}%` });
    }
    if (warn.num_cells_lt_5 !== undefined) items.push({ label: '<5 单元格', value: warn.num_cells_lt_5 });
    if (warn.num_cells_lt_1 !== undefined) items.push({ label: '<1 单元格', value: warn.num_cells_lt_1 });
    // 2×2 专属
    if (results?.fisher_exact?.p_value !== undefined) items.push({ label: 'Fisher p', value: fmt(results.fisher_exact.p_value) });
    if (results?.yates_correction?.p_value !== undefined) items.push({ label: 'Yates p', value: fmt(results.yates_correction.p_value) });
    if (results?.odds_ratio_ci?.odds_ratio !== undefined) {
      const orc = results.odds_ratio_ci;
      items.push({ label: 'OR', value: fmt(orc.odds_ratio, 3) });
      if (Array.isArray(orc.ci_95)) items.push({ label: '95%CI', value: `[${fmt(orc.ci_95[0], 3)}, ${fmt(orc.ci_95[1], 3)}]` });
    }
    // 事后检验显著单元格列表
    try {
      const holm = results?.post_hoc?.cell_p_value_holm;
      if (holm && typeof holm === 'object') {
        const sig: string[] = [];
        Object.entries(holm).forEach(([row, cols]: [string, any]) => {
          Object.entries(cols || {}).forEach(([col, p]: [string, any]) => {
            const pv = typeof p === 'number' ? p : parseFloat(String(p));
            if (Number.isFinite(pv) && pv < 0.05) sig.push(`${row}/${col}`);
          });
        });
        if (sig.length) items.push({ label: '显著单元格(Holm)', value: sig.slice(0, 5).join('，') + (sig.length > 5 ? ` 等${sig.length}处` : '') });
      }
    } catch { /* ignore */ }
  } else if (type === 'correlation') {
    const anyPair = Object.entries(results?.correlations || {})[0] as any;
    const val = anyPair?.[1];
    if (val?.pearson) {
      items.push({ label: 'r (Pearson)', value: fmt(val.pearson.r) });
      items.push({ label: 'p (Pearson)', value: fmt(val.pearson.p) });
    }
    if (val?.spearman) {
      items.push({ label: 'ρ (Spearman)', value: fmt(val.spearman.r) });
      items.push({ label: 'p (Spearman)', value: fmt(val.spearman.p) });
    }
  } else if (type === 'logistic_regression' || type === 'linear_regression') {
    const ms = results?.model_summary || {};
    if (type === 'linear_regression') {
      if (ms.r_squared !== undefined) items.push({ label: 'R²', value: fmt(ms.r_squared) });
      if (ms.adj_r_squared !== undefined) items.push({ label: '调整R²', value: fmt(ms.adj_r_squared) });
      if (ms.aic !== undefined) items.push({ label: 'AIC', value: fmt(ms.aic, 2) });
      if (ms.bic !== undefined) items.push({ label: 'BIC', value: fmt(ms.bic, 2) });
      if (ms.f_statistic !== undefined) items.push({ label: 'F统计量', value: fmt(ms.f_statistic) });
      if (ms.f_p_value !== undefined) items.push({ label: 'F检验p', value: fmt(ms.f_p_value) });
    } else {
      // 逻辑回归显示整体性能
      const mp = results?.model_performance || {};
      if (typeof mp.accuracy === 'number') items.push({ label: '准确率', value: fmt(mp.accuracy) });
      if (typeof mp.auc === 'number') items.push({ label: 'AUC', value: fmt(mp.auc) });
      if (typeof mp.precision === 'number') items.push({ label: '精确率', value: fmt(mp.precision) });
      if (typeof mp.recall === 'number') items.push({ label: '召回率', value: fmt(mp.recall) });
      if (typeof mp.f1_score === 'number') items.push({ label: 'F1分数', value: fmt(mp.f1_score) });
    }
  } 
  else if (type === 'stratified') {
    const measure = results?.measure;
    if (measure) items.push({ label: '效应量类型', value: measure });
    if (Array.isArray(results?.overall?.ci)) {
      items.push({ label: '合并效应', value: fmt(results.overall.effect) });
      items.push({ label: '95%CI', value: `[${fmt(results.overall.ci[0])}, ${fmt(results.overall.ci[1])}]` });
    }
    if (results?.heterogeneity) {
      const h = results.heterogeneity;
      items.push({ label: '异质性Q', value: fmt(h.Q, 3) });
      items.push({ label: 'df', value: h.df ?? 'N/A' });
      items.push({ label: 'p(异质性)', value: fmt(h.p_value, 4) });
      if (h.I2 !== undefined) items.push({ label: 'I²(%)', value: fmt(h.I2, 1) });
    }
  }
  else if (type === 'mendelian_randomization') {
    const ivw = results?.ivw;
    if (ivw) {
      items.push({ label: 'IVW Beta', value: fmt(ivw.beta) });
      items.push({ label: 'SE', value: fmt(ivw.se) });
      if (Array.isArray(ivw.ci)) items.push({ label: '95%CI', value: `[${fmt(ivw.ci[0])}, ${fmt(ivw.ci[1])}]` });
    }
    if (results?.egger) {
      items.push({ label: 'Egger 截距', value: fmt(results.egger.intercept) });
      items.push({ label: 'Egger 斜率', value: fmt(results.egger.slope) });
      if (typeof results.egger.p_value === 'number') items.push({ label: 'Egger p', value: fmt(results.egger.p_value, 4) });
    }
    const ivCount = Array.isArray(results?.wald_ratios) ? results.wald_ratios.length : (Array.isArray(results?.forest_data) ? results.forest_data.length : undefined);
    if (typeof ivCount === 'number') items.push({ label: 'IV数量', value: ivCount });
  }
  
  // Hooks 必须在顶层调用：为描述性/探索准备变量切换器
  const isDescOrExplore = type === 'descriptive' || type === 'explore';
  const descEntries: Array<[string, any]> = isDescOrExplore ? Object.entries(results || {}) : [];
  const variableNames = isDescOrExplore ? descEntries.map(([k]) => String(k)) : [];
  const [selectedVar, setSelectedVar] = useState<string>(variableNames[0] || '');
  const activeVar = variableNames.includes(selectedVar) ? selectedVar : (variableNames[0] || '');
  const currentPayload: any = isDescOrExplore && results ? (results as any)[activeVar] : null;
  const statsSource: any = currentPayload?.descriptive || currentPayload?.overall || currentPayload;
  const groupBy = currentPayload?.group_by || currentPayload?.grouping_variable;
  const byGroup = currentPayload?.grouped_stats || currentPayload?.by_group;

  if (isDescOrExplore && variableNames.length > 0) {
    // 提供“摘要变量”选择器，按变量查看摘要
    const firstGroup = byGroup && typeof byGroup === 'object' ? (Object.values(byGroup)[0] as any) : null;
    const hasNumericStats = (obj: any) => obj && (obj.mean !== undefined || obj.median !== undefined || obj.std !== undefined);
    const stats = hasNumericStats(statsSource) ? statsSource : (hasNumericStats(firstGroup) ? firstGroup : null);

    if (stats) {
      items.push({ label: '均值', value: fmt(stats.mean) });
      items.push({ label: '标准差', value: fmt(stats.std) });
      if (stats.q1 !== undefined || stats.q25 !== undefined) {
        items.push({ label: 'Q1(25%)', value: fmt(stats.q1 ?? stats.q25) });
      }
      items.push({ label: '中位数', value: fmt(stats.median) });
      if (stats.q3 !== undefined || stats.q75 !== undefined) {
        items.push({ label: 'Q3(75%)', value: fmt(stats.q3 ?? stats.q75) });
      }
      items.push({ label: '最小值', value: fmt(stats.min) });
      items.push({ label: '最大值', value: fmt(stats.max) });
    }

    // 诊断（若存在）
    const diag = currentPayload?.diagnostics;
    if (diag) {
      if (typeof diag.missing_rate === 'number') items.push({ label: '缺失率', value: `${(diag.missing_rate * 100).toFixed(2)}%` });
      if (typeof diag.unique_count === 'number') items.push({ label: '唯一值个数', value: diag.unique_count });
      if (diag.normality && typeof diag.normality.p_value === 'number') items.push({ label: '正态性p值', value: fmt(diag.normality.p_value, 4) });
      if (diag.outliers) {
        if (typeof diag.outliers.count === 'number') items.push({ label: '异常值数', value: diag.outliers.count });
        if (typeof diag.outliers.rate === 'number') items.push({ label: '异常值率', value: `${(diag.outliers.rate * 100).toFixed(2)}%` });
      }
    }

    const header = (
      <Space size={12}>
        <span>摘要变量</span>
        <Select
          size="small"
          value={activeVar}
          options={variableNames.map(v => ({ label: v, value: v }))}
          style={{ minWidth: 160 }}
          onChange={setSelectedVar}
        />
        {groupBy && (
          <>
            <span>分组变量</span>
            <Tag color="blue">{String(groupBy)}</Tag>
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              显示的是“总体(overall)统计”；如果没有总体统计，则显示该变量的第一个分组的统计（如 sex=男）
            </Typography.Text>
          </>
        )}
      </Space>
    );

    return (
      <Card title={header} size="small" style={{ marginBottom: 12 }}>
        <Descriptions size="small" column={3} bordered>
          {items.map((it, idx) => (
            <Descriptions.Item key={idx} label={it.label}>{it.value}</Descriptions.Item>
          ))}
        </Descriptions>
      </Card>
    );
  }

  return (
    <Card title="结果摘要" size="small" style={{ marginBottom: 12 }}>
      <Descriptions size="small" column={3} bordered>
        {items.map((it, idx) => (
          <Descriptions.Item key={idx} label={it.label}>{it.value}</Descriptions.Item>
        ))}
      </Descriptions>
    </Card>
  );
};

// 数据集/分析类型/变量选择 摘要
const SelectionSummary: React.FC<{ analysis: Analysis; params: any; results?: any }> = ({ analysis, params, results }) => {
  const typeMap: Record<string, string> = {
    descriptive: '描述性分析',
    explore: '探索分析',
    frequency: '频率分析',
    chi_square: '卡方检验',
    correlation: '相关性分析',
    logistic_regression: '二分类逻辑回归',
    logistic_regression_multinomial: '无序多分类逻辑回归',
    logistic_regression_ordinal: '有序多分类逻辑回归',
    logistic_regression_conditional: '条件逻辑回归（分层）',
    linear_regression: '线性回归',
    mendelian_randomization: '孟德尔随机化',
  };

  const getArr = (v: any): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === 'string') return [v];
    return [];
  };

  // 针对不同分析类型的术语映射
  const isCross = analysis.analysis_type === 'crosstab' || analysis.analysis_type === 'chi_square';
  const isFrequency = analysis.analysis_type === 'frequency';
  const isDescriptive = analysis.analysis_type === 'descriptive' || analysis.analysis_type === 'explore';
  const isStratified = analysis.analysis_type === 'stratified';
  const isConditionalLogit = analysis.analysis_type === 'logistic_regression_conditional';
  const isMR = analysis.analysis_type === 'mendelian_randomization';
  const isOrdinalLogit = analysis.analysis_type === 'logistic_regression_ordinal';
  const isMultinomialLogit = analysis.analysis_type === 'logistic_regression_multinomial';
  const dep = getArr(params?.dependent_variables || params?.dependent_variable);
  const indep = getArr(params?.independent_variables || params?.independent_variable);
  const ctrl = getArr(params?.control_variables || params?.controls);
  const dependentVars = dep.length ? dep : (results && typeof results === 'object' ? getArr((results as any).dependent_variable) : dep);
  const independentVars = indep.length ? indep : (results && typeof results === 'object' ? getArr((results as any).independent_variables || (results as any).independent_variable) : indep);
  const controlVars = ctrl.length ? ctrl : (results && typeof results === 'object' ? getArr((results as any).control_variables || (results as any).controls) : ctrl);
  const stratum = getArr(
    params?.strata_variable ||
    params?.stratum_variables ||
    params?.grouping_variables // 兜底，历史参数名
  );
  const group = isDescriptive
    ? getArr(
        params?.grouping_variables ||
        params?.group_by ||
        params?.group_variable ||
        params?.independent_variables ||
        params?.independent_variable
      )
    : getArr(params?.grouping_variables || params?.group_by || params?.group_variable);
  const groupingVars = group.length
    ? group
    : (results && typeof results === 'object'
        ? getArr((results as any).grouping_variables || (results as any).group_by || (results as any).group_variable)
        : group);
  const rowVars = getArr(params?.row_variable || params?.row_variables || params?.dependent_variables || params?.dependent_variable);
  const colVars = getArr(params?.column_variable || params?.column_variables || params?.independent_variables || params?.independent_variable);
  const exposure = getArr(params?.exposure_variables || params?.exposure_variable);
  const outcome = getArr(params?.outcome_variables || params?.outcome_variable);
  const instrument = getArr(params?.instrument_variables || params?.instrument_variable);

  return (
    <Card title="本次分析摘要" size="small" style={{ marginBottom: 12 }}>
      <Descriptions size="small" column={3} bordered>
        <Descriptions.Item label="数据集">{(analysis as any).dataset_name || 'N/A'}</Descriptions.Item>
        <Descriptions.Item label="分析类型">{typeMap[analysis.analysis_type] || analysis.analysis_type}</Descriptions.Item>
        {isCross ? (
          <>
            <Descriptions.Item label="行变量">{rowVars.length ? rowVars.join(', ') : '未指定'}</Descriptions.Item>
            <Descriptions.Item label="列变量">{colVars.length ? colVars.join(', ') : '未指定'}</Descriptions.Item>
          </>
        ) : isFrequency ? (
          <>
            <Descriptions.Item label="分析变量">{dependentVars.length ? dependentVars.join(', ') : '未指定'}</Descriptions.Item>
          </>
        ) : isDescriptive ? (
          <>
            <Descriptions.Item label="分析变量（指标）">{dependentVars.length ? dependentVars.join(', ') : '未指定'}</Descriptions.Item>
            <Descriptions.Item label="分组变量">{groupingVars.length ? groupingVars.join(', ') : '无'}</Descriptions.Item>
          </>
        ) : isStratified ? (
          <>
            <Descriptions.Item label="因变量">{dependentVars.length ? dependentVars.join(', ') : '未指定'}</Descriptions.Item>
            <Descriptions.Item label="自变量">{independentVars.length ? independentVars.join(', ') : '未指定'}</Descriptions.Item>
            <Descriptions.Item label="分层变量">{stratum.length ? stratum.join(', ') : '未指定'}</Descriptions.Item>
          </>
        ) : isMR ? (
          <>
            <Descriptions.Item label="暴露变量">{exposure.length ? exposure.join(', ') : '未指定'}</Descriptions.Item>
            <Descriptions.Item label="结局变量">{outcome.length ? outcome.join(', ') : '未指定'}</Descriptions.Item>
            <Descriptions.Item label="工具变量">{instrument.length ? instrument.join(', ') : '未指定'}</Descriptions.Item>
          </>
        ) : isConditionalLogit ? (
          <>
            <Descriptions.Item label="因变量">{dependentVars.length ? dependentVars.join(', ') : '未指定'}</Descriptions.Item>
            <Descriptions.Item label="自变量">{independentVars.length ? independentVars.join(', ') : '未指定'}</Descriptions.Item>
            <Descriptions.Item label="分层变量">{stratum.length ? stratum.join(', ') : '未指定'}</Descriptions.Item>
            {controlVars.length ? (
              <Descriptions.Item label="协变量/控制">{controlVars.join(', ')}</Descriptions.Item>
            ) : null}
          </>
        ) : isOrdinalLogit || isMultinomialLogit ? (
          <>
            <Descriptions.Item label="因变量（结局）">{dependentVars.length ? dependentVars.join(', ') : '未指定'}</Descriptions.Item>
            {independentVars.length > 0 && (
              <Descriptions.Item label="自变量（预测变量）">{independentVars.join(', ')}</Descriptions.Item>
            )}
            {controlVars.length > 0 && (
              <Descriptions.Item label="协变量/控制">{controlVars.join(', ')}</Descriptions.Item>
            )}
          </>
        ) : (
          <>
            <Descriptions.Item label="因变量">{dependentVars.length ? dependentVars.join(', ') : '未指定'}</Descriptions.Item>
            {independentVars.length > 0 && (
              <Descriptions.Item label="自变量">{independentVars.join(', ')}</Descriptions.Item>
            )}
            {controlVars.length > 0 && (
              <Descriptions.Item label="协变量/控制">{controlVars.join(', ')}</Descriptions.Item>
            )}
          </>
        )}
      </Descriptions>
    </Card>
  );
};

const FrequencyFormulas: React.FC = () => {
  return (
    <Card title="频率分析公式" size="small">
      <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
        <Paragraph>
          <strong>1. 频数 (Frequency):</strong><br/>
          f_i = n_i
        </Paragraph>
        <Paragraph>
          <strong>2. 百分比 (Percentage):</strong><br/>
          P_i = (f_i / N) × 100%
        </Paragraph>
        <Paragraph>
          <strong>3. 有效百分比 (Valid Percentage):</strong><br/>
          VP_i = (f_i / N_valid) × 100%
        </Paragraph>
        <Paragraph>
          <strong>4. 累计有效百分比 (Cumulative Valid Percentage):</strong><br/>
          CVP_i = Σ(VP_j) for j = 1 to i
        </Paragraph>
        <Paragraph>
          其中：<br/>
          • f_i = 第i个类别的频数<br/>
          • n_i = 第i个类别的观察数<br/>
          • N = 总样本量<br/>
          • N_valid = 有效样本量
        </Paragraph>
      </div>
    </Card>
  );
};

const ChiSquareFormulas: React.FC = () => {
  return (
    <Card title="卡方检验公式" size="small">
      <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
        <Paragraph>
          <strong>1. 卡方统计量:</strong><br/>
          χ² = Σ Σ (O_ij - E_ij)² / E_ij
        </Paragraph>
        <Paragraph>
          <strong>2. 期望频数:</strong><br/>
          E_ij = (R_i × C_j) / N
        </Paragraph>
        <Paragraph>
          <strong>3. 自由度:</strong><br/>
          df = (r - 1) × (c - 1)
        </Paragraph>
        <Paragraph>
          <strong>4. Cramér's V (关联强度):</strong><br/>
          V = √(χ² / (N × (min(r,c) - 1)))
        </Paragraph>
        <Paragraph>
          <strong>5. 列联系数:</strong><br/>
          C = √(χ² / (χ² + N))
        </Paragraph>
        <Paragraph>
          <strong>6. 标准化残差:</strong><br/>
          r_ij = (O_ij - E_ij) / √E_ij
        </Paragraph>
        <Paragraph>
          其中：<br/>
          • O_ij = 观察频数<br/>
          • E_ij = 期望频数<br/>
          • R_i = 第i行的边际频数<br/>
          • C_j = 第j列的边际频数<br/>
          • N = 总样本量<br/>
          • r = 行数，c = 列数
        </Paragraph>
      </div>
    </Card>
  );
};

const CorrelationFormulas: React.FC = () => {
  return (
    <Card title="相关性分析公式" size="small">
      <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
        <Paragraph>
          <strong>1. 皮尔逊相关系数:</strong><br/>
          r = Σ((x_i - x̄)(y_i - ȳ)) / √(Σ(x_i - x̄)² × Σ(y_i - ȳ)²)
        </Paragraph>
        <Paragraph>
          <strong>2. 斯皮尔曼相关系数:</strong><br/>
          ρ = 1 - (6Σd²) / (n(n² - 1))
        </Paragraph>
        <Paragraph>
          <strong>3. 肯德尔相关系数:</strong><br/>
          τ = (C - D) / (C + D)
        </Paragraph>
        <Paragraph>
          <strong>4. t检验统计量:</strong><br/>
          t = r√(n-2) / √(1-r²)
        </Paragraph>
        <Paragraph>
          其中：<br/>
          • x_i, y_i = 变量值<br/>
          • x̄, ȳ = 变量均值<br/>
          • d = 等级差<br/>
          • n = 样本量<br/>
          • C = 一致对数量<br/>
          • D = 不一致对数量
        </Paragraph>
      </div>
    </Card>
  );
};

const LogisticRegressionFormulas: React.FC = () => {
  return (
    <Card title="逻辑回归公式" size="small">
      <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
        <Paragraph>
          <strong>1. 逻辑回归模型:</strong><br/>
          logit(p) = ln(p/(1-p)) = β₀ + β₁x₁ + β₂x₂ + ... + βₖxₖ
        </Paragraph>
        <Paragraph>
          <strong>2. 概率预测:</strong><br/>
          p = 1 / (1 + e^(-(β₀ + β₁x₁ + ... + βₖxₖ)))
        </Paragraph>
        <Paragraph>
          <strong>3. 优势比 (Odds Ratio):</strong><br/>
          OR = e^β
        </Paragraph>
        <Paragraph>
          <strong>4. 似然比检验:</strong><br/>
          LR = -2(ln(L₀) - ln(L₁))
        </Paragraph>
        <Paragraph>
          <strong>5. 伪R² (Nagelkerke):</strong><br/>
          R² = 1 - (L₀/L₁)^(2/n)
        </Paragraph>
        <Paragraph>
          其中：<br/>
          • p = 事件发生概率<br/>
          • β₀ = 截距<br/>
          • β₁, β₂, ..., βₖ = 回归系数<br/>
          • x₁, x₂, ..., xₖ = 自变量<br/>
          • L₀ = 零模型似然<br/>
          • L₁ = 完整模型似然
        </Paragraph>
      </div>
    </Card>
  );
};

const MultinomialLogisticFormulas: React.FC = () => {
  return (
    <Card title="无序多分类逻辑回归 - 公式" size="small">
      <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
        <Paragraph>
          <strong>1. 多项Logit模型（基准类别 = 0）:</strong><br/>
          P(Y=j|x) = exp(η<sub>j</sub>) / [1 + Σ<sub>k=1</sub><sup>J-1</sup> exp(η<sub>k</sub>)], 其中 η<sub>j</sub> = β<sub>j0</sub> + β<sub>j</sub><sup>T</sup> x
        </Paragraph>
        <Paragraph>
          <strong>2. 类别概率:</strong><br/>
          P(Y=0|x) = 1 / [1 + Σ<sub>k=1</sub><sup>J-1</sup> exp(η<sub>k</sub>)]
        </Paragraph>
        <Paragraph>
          <strong>3. 解释:</strong><br/>
          每个类别 j 相对于基准类别的系数 β_j 表示自变量变动对 log-odds 的影响。
        </Paragraph>
      </div>
    </Card>
  );
};

const OrdinalLogisticFormulas: React.FC = () => {
  return (
    <Card title="有序多分类逻辑回归（Ordered Logit） - 公式" size="small">
      <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
        <Paragraph>
          <strong>1. 累积对数几率模型:</strong><br/>
          logit[P(Y ≤ k | x)] = θ_k - β^T x, k = 1, ..., K-1
        </Paragraph>
        <Paragraph>
          <strong>2. 阈值（cutpoints）:</strong><br/>
          θ<sub>1</sub> &lt; θ<sub>2</sub> &lt; ... &lt; θ<sub>K-1</sub>，由数据估计；结果中提供阈值参数表。
        </Paragraph>
        <Paragraph>
          <strong>3. 比例优势假设:</strong><br/>
          β 在不同 k 上相同（平行线假设）。
        </Paragraph>
      </div>
    </Card>
  );
};

const ConditionalLogisticFormulas: React.FC = () => {
  return (
    <Card title="条件逻辑回归（分层固定效应近似） - 说明" size="small">
      <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
        <Paragraph>
          <strong>1. 近似实现:</strong><br/>
          通过为每个分层加入固定效应虚拟变量近似条件化分层截距。
        </Paragraph>
        <Paragraph>
          <strong>2. 概率与性能:</strong><br/>
          结果提供整体样本上的预测概率、混淆矩阵及（若可计算）AUC。
        </Paragraph>
        <Paragraph>
          <strong>3. 数据提示:</strong><br/>
          仅保留分层内包含 0/1 的观测；被剔除的分层会在诊断信息中记录。
        </Paragraph>
      </div>
    </Card>
  );
};

const LinearRegressionFormulas: React.FC = () => {
  return (
    <Card title="线性回归公式" size="small">
      <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
        <Paragraph>
          <strong>1. 线性回归模型:</strong><br/>
          y = β₀ + β₁x₁ + β₂x₂ + ... + βₖxₖ + ε
        </Paragraph>
        <Paragraph>
          <strong>2. 最小二乘估计:</strong><br/>
          β̂ = (X'X)⁻¹X'y
        </Paragraph>
        <Paragraph>
          <strong>3. 决定系数 (R²):</strong><br/>
          R² = 1 - (SS_res / SS_tot)
        </Paragraph>
        <Paragraph>
          <strong>4. 调整决定系数:</strong><br/>
          R²_adj = 1 - (1-R²)(n-1)/(n-k-1)
        </Paragraph>
        <Paragraph>
          <strong>5. F统计量:</strong><br/>
          F = (SS_reg / k) / (SS_res / (n-k-1))
        </Paragraph>
        <Paragraph>
          <strong>6. t统计量:</strong><br/>
          t = β̂ᵢ / SE(β̂ᵢ)
        </Paragraph>
        <Paragraph>
          <strong>7. 检验决策:</strong><br/>
          如果 p &lt; α (通常α=0.05)，则拒绝原假设<br/>
          如果 p ≥ α，则接受原假设
        </Paragraph>
        <Paragraph>
          其中：<br/>
          • y = 因变量<br/>
          • β₀ = 截距<br/>
          • β₁, β₂, ..., βₖ = 回归系数<br/>
          • x₁, x₂, ..., xₖ = 自变量<br/>
          • ε = 误差项<br/>
          • SS_res = 残差平方和<br/>
          • SS_tot = 总平方和<br/>
          • SS_reg = 回归平方和<br/>
          • n = 样本量，k = 自变量数量
        </Paragraph>
      </div>
    </Card>
  );
};
