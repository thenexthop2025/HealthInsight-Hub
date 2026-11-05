/**
 * 统计表格组件
 */

import React from 'react';
import { Table, Typography, Select, Space } from 'antd';
import { Analysis } from '../types/analysis';

const { Title } = Typography;

export const generateStatisticsTable = (analysis: Analysis, chartType?: string) => {
  if (!analysis.results) {
    return <div>暂无统计表格数据</div>;
  }

  const safeParse = (s: string) => {
    try {
      return JSON.parse(s);
    } catch (_) {
      try {
        const sanitized = s
          .replace(/\bNaN\b/g, 'null')
          .replace(/\bInfinity\b/g, 'null')
          .replace(/\b-?Infinity\b/g, 'null');
        return JSON.parse(sanitized);
      } catch {
        return null;
      }
    }
  };

  const results = typeof analysis.results === 'string' 
    ? safeParse(analysis.results) 
    : analysis.results;

  const actualType = analysis.analysis_type;

  if (actualType === 'descriptive' || actualType === 'explore') {
    return <DescriptiveTable results={results} showDiagnostics={actualType === 'explore'} />;
  }

  if (actualType === 'frequency') {
    return <FrequencyTable results={results} />;
  }

  if (actualType === 'chi_square') {
    return <ChiSquareTable results={results} chartType={chartType} />;
  }

  if (actualType === 'crosstab') {
    return <CrosstabTable results={results} />;
  }

  if (actualType === 'correlation') {
    return <CorrelationTable results={results} />;
  }

  if (actualType === 'logistic_regression' || actualType === 'logistic_regression_multinomial' || actualType === 'logistic_regression_ordinal' || actualType === 'logistic_regression_conditional' || actualType === 'linear_regression') {
    return <RegressionTable results={results} analysisType={actualType} />;
  }

  if (actualType === 'stratified') {
    return <StratifiedTable results={results} />;
  }
  if (actualType === 'mendelian_randomization') {
    return <MendelianTable results={results} />;
  }

  return <div>暂无统计表格数据</div>;
};

const FrequencyTable: React.FC<{ results: any }> = ({ results }) => {
  const entries: Array<[string, any]> = Object.entries(results);
  
  return (
    <div>
      {entries.map(([variable, data]) => {
        const levels = data?.levels || [];
        const summary = data?.summary || {};
        
        const columns = [
          { title: '取值', dataIndex: 'value', key: 'value' },
          { title: '计数', dataIndex: 'count', key: 'count' },
          { title: '百分比(%)', dataIndex: 'percent', key: 'percent' },
          { title: '有效百分比(%)', dataIndex: 'valid_percent', key: 'valid_percent' },
          { title: '累计有效百分比(%)', dataIndex: 'cumulative_valid_percent', key: 'cumulative_valid_percent' },
        ];
        
        const dataSource = levels.map((item: any, index: number) => ({
          key: `${variable}-${item.value}-${index}`,
          value: item.value,
          count: item.count,
          percent: (item.percent ?? 0).toFixed(2),
          valid_percent: (item.valid_percent ?? 0).toFixed(2),
          cumulative_valid_percent: (item.cumulative_valid_percent ?? 0).toFixed(2),
        }));

        return (
          <div key={variable} style={{ marginBottom: 24 }}>
            <Title level={5}>{variable}</Title>
            <Table 
              columns={columns} 
              dataSource={dataSource} 
              pagination={false} 
              size="small" 
            />
            <div style={{ marginTop: 8, color: '#666' }}>
              有效样本：{summary.valid ?? 0}，缺失：{summary.missing ?? 0}，总计：{summary.total ?? 0}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * 描述性统计表
 * 兼容多种返回结构：
 * - results[variable].descriptive 或 descriptive_stats
 * - results[variable].overall / grouped_stats
 */
const DescriptiveTable: React.FC<{ results: any; showDiagnostics?: boolean }> = ({ results, showDiagnostics }) => {
  const toNum = (v: any): number | null => {
    if (v === null || v === undefined || v === '' || Number.isNaN(v)) return null;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  type Row = {
    key: string;
    variable: string;
    count?: number | null;
    mean?: number | null;
    std?: number | null;
    min?: number | null;
    max?: number | null;
    median?: number | null;
  };

  const rows: Row[] = [];

  Object.entries(results || {}).forEach(([variable, payload]: [string, any]) => {
    if (!payload) return;

    // 1) overall/simple stats
    const overall =
      payload.descriptive ||
      payload.descriptive_stats ||
      payload.overall ||
      payload;

    const pushRowFrom = (stats: any, labelSuffix = '') => {
      const medianVal = stats.median ?? stats.q50 ?? stats.q_50 ?? stats.quantile_50;
      rows.push({
        key: `${variable}${labelSuffix}`,
        // 全部场景移除“（总体）”字样，仅保留变量名或分组标签
        variable: labelSuffix === '（总体）' ? `${variable}` : `${variable}${labelSuffix}`,
        count: toNum(stats.count ?? stats.n ?? stats.sample_size),
        mean: toNum(stats.mean),
        std: toNum(stats.std ?? stats.std_dev ?? stats.stddev),
        min: toNum(stats.min),
        max: toNum(stats.max),
        median: toNum(medianVal),
      });
    };

    // 如果有 grouped_stats，仅输出各组（按要求去除“总体”行）
    if (payload.grouped_stats && typeof payload.grouped_stats === 'object') {
      Object.entries(payload.grouped_stats).forEach(([group, stats]: [string, any]) => {
        pushRowFrom(stats, `（${group}）`);
      });
    } else {
      // 普通单变量
      if (overall && typeof overall === 'object') {
        pushRowFrom(overall);
      }
    }
  });

  // 统一：不再使用“（总体）”字样
  const finalRows = rows;

  const columns = [
    { title: '变量', dataIndex: 'variable', key: 'variable' },
    { title: '样本数', dataIndex: 'count', key: 'count', render: (v: any) => v ?? '-' },
    { title: '均值', dataIndex: 'mean', key: 'mean', render: (v: number | null) => (v ?? '-') && (v !== null ? v.toFixed(4) : '-') },
    { title: '标准差', dataIndex: 'std', key: 'std', render: (v: number | null) => (v !== null ? v.toFixed(4) : '-') },
    { title: '最小值', dataIndex: 'min', key: 'min', render: (v: number | null) => (v !== null ? v.toFixed(4) : '-') },
    { title: '最大值', dataIndex: 'max', key: 'max', render: (v: number | null) => (v !== null ? v.toFixed(4) : '-') },
    { title: '中位数', dataIndex: 'median', key: 'median', render: (v: number | null) => (v !== null ? v.toFixed(4) : '-') },
  ];

  // Explore: 诊断表格（若有）
  const diagnosticsRows: Array<{ key: string; variable: string; missing_rate?: string; unique_count?: number; normality_p?: string; outlier_count?: number; outlier_rate?: string; }> = [];
  if (showDiagnostics) {
    Object.entries(results || {}).forEach(([variable, payload]: [string, any]) => {
      const diag = payload?.diagnostics;
      if (!diag) return;
      diagnosticsRows.push({
        key: `diag-${variable}`,
        variable,
        missing_rate: typeof diag.missing_rate === 'number' ? `${(diag.missing_rate*100).toFixed(2)}%` : undefined,
        unique_count: diag.unique_count,
        normality_p: (diag.normality && typeof diag.normality.p_value === 'number') ? diag.normality.p_value.toFixed(4) : undefined,
        outlier_count: diag.outliers?.count,
        outlier_rate: typeof diag.outliers?.rate === 'number' ? `${(diag.outliers.rate*100).toFixed(2)}%` : undefined,
      });
    });
  }

  return (
    <div>
      <Title level={5}>统计摘要</Title>
      <Table
        columns={columns}
        dataSource={finalRows}
        pagination={false}
        size="small"
      />
      {showDiagnostics && diagnosticsRows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Title level={5}>诊断</Title>
          <Table
            columns={[
              { title: '变量', dataIndex: 'variable', key: 'variable' },
              { title: '缺失率', dataIndex: 'missing_rate', key: 'missing_rate' },
              { title: '唯一值', dataIndex: 'unique_count', key: 'unique_count' },
              { title: '正态性p', dataIndex: 'normality_p', key: 'normality_p' },
              { title: '异常值数', dataIndex: 'outlier_count', key: 'outlier_count' },
              { title: '异常值率', dataIndex: 'outlier_rate', key: 'outlier_rate' },
            ]}
            dataSource={diagnosticsRows}
            pagination={false}
            size="small"
          />
        </div>
      )}
    </div>
  );
};


const ChiSquareTable: React.FC<{ results: any; chartType?: string }> = ({ results, chartType }) => {
  const contingencyTable = results?.contingency_table || results?.counts || {};
  const expected = results?.expected || {};
  const residuals = results?.adjusted_residuals || results?.residuals || {};
  const categories = Object.keys(contingencyTable);
  const subcategories = Object.keys(contingencyTable[categories[0]] || {});

  const makeTable = (title: string, data: any) => {
    const columns = [
      { title: '变量', dataIndex: 'variable', key: 'variable' },
      ...subcategories.map(subcat => ({
        title: subcat,
        dataIndex: subcat,
        key: subcat
      }))
    ];

    const dataSource = categories.map(cat => ({
      key: cat,
      variable: cat,
      ...Object.fromEntries(subcategories.map(subcat => [subcat, data[cat]?.[subcat] || 0]))
    }));

    return (
      <div style={{ marginBottom: 16 }}>
        <Title level={5}>{title}</Title>
        <Table 
          columns={columns} 
          dataSource={dataSource} 
          pagination={false} 
          size="small" 
        />
      </div>
    );
  };

  // 百分比切换
  const [mode, setMode] = React.useState<'count' | 'row%' | 'col%'>('count');
  const transform = (table: any) => {
    if (mode === 'count') return table;
    const out: any = {};
    if (mode === 'row%') {
      categories.forEach(r => {
        const sum = subcategories.reduce((s, c) => s + Number((table?.[r]?.[c]) ?? 0), 0) || 1;
        out[r] = {};
        subcategories.forEach(c => out[r][c] = Number((((table?.[r]?.[c] ?? 0) / sum) * 100).toFixed(2)));
      });
    } else {
      const colSums = subcategories.map(c => categories.reduce((s, r) => s + Number((table?.[r]?.[c]) ?? 0), 0) || 1);
      categories.forEach(r => {
        out[r] = {};
        subcategories.forEach((c, j) => out[r][c] = Number((((table?.[r]?.[c] ?? 0) / colSums[j]) * 100).toFixed(2)));
      });
    }
    return out;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <Space size={8}>
          <span>显示</span>
          <Select size="small" value={mode} onChange={setMode} style={{ width: 120 }}
            options={[{ value: 'count', label: '计数' }, { value: 'row%', label: '行百分比' }, { value: 'col%', label: '列百分比' }]} />
        </Space>
      </div>
      {/* 期望频数与检验摘要 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={5}>检验摘要</Title>
        <Table
          columns={[
            { title: '指标', dataIndex: 'metric', key: 'metric' },
            { title: '数值', dataIndex: 'value', key: 'value' },
            { title: '说明', dataIndex: 'desc', key: 'desc' },
          ]}
          dataSource={[
            { key: 'chi2', metric: '卡方统计量', value: results?.chi_square_statistic?.toFixed?.(4) || 'N/A', desc: '' },
            { key: 'df', metric: '自由度', value: results?.degrees_of_freedom ?? 'N/A', desc: '' },
            { key: 'p', metric: 'p值', value: results?.p_value?.toFixed?.(4) || 'N/A', desc: '' },
            { key: 'cv', metric: "Cramér's V", value: results?.cramers_v?.toFixed?.(4) || 'N/A', desc: '效应量' },
            { key: 'warn1', metric: '期望频数≥5占比', value: (results?.warnings?.expected_freq_ratio_ge_5 !== undefined ? (results.warnings.expected_freq_ratio_ge_5 * 100).toFixed(1) + '%' : 'N/A'), desc: '建议≥80%' },
            { key: 'warn2', metric: '期望频数<5单元格数', value: results?.warnings?.num_cells_lt_5 ?? 'N/A', desc: '' },
            { key: 'warn3', metric: '期望频数<1单元格数', value: results?.warnings?.num_cells_lt_1 ?? 'N/A', desc: '' },
            ...(results?.fisher_exact ? [{ key: 'fisher', metric: 'Fisher精确检验p', value: (results.fisher_exact.p_value as number).toFixed(4), desc: '仅2×2' }] : []),
            ...(results?.yates_correction ? [{ key: 'yatesp', metric: 'Yates校正p', value: (results.yates_correction.p_value as number).toFixed(4), desc: '仅2×2' }] : []),
            ...(results?.odds_ratio_ci ? [{ key: 'or', metric: 'OR (95%CI)', value: `${(results.odds_ratio_ci.odds_ratio as number).toFixed(3)} [${(results.odds_ratio_ci.ci_95?.[0] as number).toFixed(3)}, ${(results.odds_ratio_ci.ci_95?.[1] as number).toFixed(3)}]`, desc: '仅2×2' }] : []),
          ]}
          pagination={false}
          size="small"
        />
      </div>

      {(!chartType || chartType === 'heatmap' || chartType === 'bar_chart') && (
        <>
          {makeTable(mode === 'count' ? '观察频数表' : (mode === 'row%' ? '观察行百分比(%)' : '观察列百分比(%)'), transform(contingencyTable))}
        </>
      )}
      {chartType === 'expected_vs_observed' && (
        <>
          {makeTable(mode === 'count' ? '观察频数表' : (mode === 'row%' ? '观察行百分比(%)' : '观察列百分比(%)'), transform(contingencyTable))}
          {Object.keys(expected).length > 0 && makeTable('期望频数表', expected)}
        </>
      )}
      {chartType === 'residuals' && (
        <>
          {makeTable(mode === 'count' ? '观察频数表' : (mode === 'row%' ? '观察行百分比(%)' : '观察列百分比(%)'), transform(contingencyTable))}
          {Object.keys(residuals).length > 0 && makeTable('调整标准化残差表', residuals)}
        </>
      )}
      {chartType === 'mosaic' && (
        <>
          {makeTable('观察频数表', contingencyTable)}
          {Object.keys(expected).length > 0 && makeTable('期望频数表', expected)}
          {Object.keys(residuals).length > 0 && makeTable('标准化残差表', residuals)}
        </>
      )}
      
      <div style={{ marginTop: 24 }}>
        <Title level={5}>卡方检验结果</Title>
        <Table
          columns={[
            { title: '统计量', dataIndex: 'statistic', key: 'statistic' },
            { title: '数值', dataIndex: 'value', key: 'value' },
            { title: '解释', dataIndex: 'interpretation', key: 'interpretation' }
          ]}
          dataSource={[
            {
              key: 'chi2',
              statistic: '卡方统计量',
              value: results.chi_square_statistic?.toFixed(4) || 'N/A',
              interpretation: '衡量观察频数与期望频数的差异'
            },
            {
              key: 'p_value',
              statistic: 'p值',
              value: results.p_value?.toFixed(4) || 'N/A',
              interpretation: results.p_value < 0.05 ? '显著 (p < 0.05)' : '不显著 (p ≥ 0.05)'
            },
            {
              key: 'df',
              statistic: '自由度',
              value: results.degrees_of_freedom || 'N/A',
              interpretation: '(行数-1) × (列数-1)'
            },
            {
              key: 'cramers_v',
              statistic: "Cramér's V",
              value: results.cramers_v?.toFixed(4) || 'N/A',
              interpretation: results.cramers_v < 0.1 ? '弱关联' : results.cramers_v < 0.3 ? '中等关联' : '强关联'
            },
            ...(results?.mantel_haenszel ? [{
              key: 'mh_or',
              statistic: 'MH 合并OR',
              value: (results.mantel_haenszel.common_or != null) ? Number(results.mantel_haenszel.common_or).toFixed(3) : 'N/A',
              interpretation: results.mantel_haenszel.stratify_by ? `分层变量: ${results.mantel_haenszel.stratify_by}` : ''
            }] : []),
            ...(results?.mantel_haenszel ? [{
              key: 'mh_chi2',
              statistic: 'MH χ²',
              value: (results.mantel_haenszel.chi_square != null) ? Number(results.mantel_haenszel.chi_square).toFixed(4) : 'N/A',
              interpretation: 'Mantel–Haenszel 近似检验'
            }] : [])
          ]}
          pagination={false}
          size="small"
        />
      </div>

      {results?.post_hoc?.cell_p_value_holm && (
        <div style={{ marginTop: 24 }}>
          <Title level={5}>事后检验（单元格，Holm校正p）</Title>
          {makeTable('Holm校正p值表', results.post_hoc.cell_p_value_holm)}
        </div>
      )}
    </div>
  );
};

const CorrelationTable: React.FC<{ results: any }> = ({ results }) => {
  const correlations = results?.correlations || {};
  
  return (
    <div>
      <Title level={5}>相关性分析结果</Title>
      <Table
        columns={[
          { title: '变量对', dataIndex: 'pair', key: 'pair' },
          { title: '皮尔逊相关系数', dataIndex: 'pearson_r', key: 'pearson_r' },
          { title: '皮尔逊p值', dataIndex: 'pearson_p', key: 'pearson_p' },
          { title: '斯皮尔曼相关系数', dataIndex: 'spearman_r', key: 'spearman_r' },
          { title: '斯皮尔曼p值', dataIndex: 'spearman_p', key: 'spearman_p' },
          { title: '样本量', dataIndex: 'sample_size', key: 'sample_size' }
        ]}
        dataSource={Object.entries(correlations).map(([key, value]: [string, any]) => ({
          key,
          pair: key,
          pearson_r: value.pearson?.r?.toFixed(4) || 'N/A',
          pearson_p: value.pearson?.p?.toFixed(4) || 'N/A',
          spearman_r: value.spearman?.r?.toFixed(4) || 'N/A',
          spearman_p: value.spearman?.p?.toFixed(4) || 'N/A',
          sample_size: value.sample_size || 'N/A'
        }))}
        pagination={false}
        size="small"
      />
    </div>
  );
};

const RegressionTable: React.FC<{ results: any; analysisType: string }> = ({ results, analysisType }) => {
  const coefficients = results?.coefficients || [];
  const modelSummary = results?.model_summary || {};
  const modelPerf = results?.model_performance || {};
  const isLogistic = analysisType === 'logistic_regression' || analysisType === 'logistic_regression_multinomial' || analysisType === 'logistic_regression_ordinal' || analysisType === 'logistic_regression_conditional';
  const isLinear = analysisType === 'linear_regression';
  const hasModelSummary = isLinear && modelSummary && Object.keys(modelSummary).length > 0;

  return (
    <div>
      <Title level={5}>{isLogistic ? '逻辑回归' : '线性回归'}结果</Title>

      {hasModelSummary && (
        <div style={{ marginBottom: 16 }}>
          <Title level={5}>模型摘要</Title>
          <Table
            columns={[
              { title: '指标', dataIndex: 'metric', key: 'metric' },
              { title: '数值', dataIndex: 'value', key: 'value' }
            ]}
            dataSource={[
              { key: 'r2', metric: 'R²', value: modelSummary.r_squared?.toFixed(4) || 'N/A' },
              { key: 'adj_r2', metric: '调整R²', value: modelSummary.adj_r_squared?.toFixed(4) || 'N/A' },
              { key: 'aic', metric: 'AIC', value: modelSummary.aic?.toFixed(2) || 'N/A' },
              { key: 'bic', metric: 'BIC', value: modelSummary.bic?.toFixed(2) || 'N/A' },
              { key: 'f_stat', metric: 'F统计量', value: modelSummary.f_statistic?.toFixed(4) || 'N/A' },
              { key: 'f_p', metric: 'F检验p值', value: modelSummary.f_p_value?.toFixed(4) || 'N/A' },
              { key: 'n', metric: '样本量', value: modelSummary.sample_size || results?.sample_size || 'N/A' },
            ]}
            pagination={false}
            size="small"
          />
        </div>
      )}

      {isLogistic && analysisType !== 'logistic_regression_ordinal' && (
        <div style={{ marginBottom: 16 }}>
          <Title level={5}>模型性能</Title>
          <Table
            columns={[
              { title: '指标', dataIndex: 'metric', key: 'metric' },
              { title: '数值', dataIndex: 'value', key: 'value' }
            ]}
            dataSource={[
              { key: 'acc', metric: '准确率', value: typeof modelPerf.accuracy === 'number' ? modelPerf.accuracy.toFixed(4) : 'N/A' },
              ...(typeof modelPerf.auc === 'number' ? [{ key: 'auc', metric: 'AUC', value: modelPerf.auc.toFixed(4) }] : []),
              { key: 'precision', metric: '精确率', value: typeof modelPerf.precision === 'number' ? modelPerf.precision.toFixed(4) : 'N/A' },
              { key: 'recall', metric: '召回率', value: typeof modelPerf.recall === 'number' ? modelPerf.recall.toFixed(4) : 'N/A' },
              { key: 'f1', metric: 'F1分数', value: typeof modelPerf.f1_score === 'number' ? modelPerf.f1_score.toFixed(4) : 'N/A' },
              ...(modelPerf.precision_macro !== undefined ? [{ key: 'prec_macro', metric: '宏平均精确率', value: modelPerf.precision_macro.toFixed?.(4) ?? 'N/A' }] : []),
              ...(modelPerf.recall_macro !== undefined ? [{ key: 'rec_macro', metric: '宏平均召回率', value: modelPerf.recall_macro.toFixed?.(4) ?? 'N/A' }] : []),
              ...(modelPerf.f1_macro !== undefined ? [{ key: 'f1_macro', metric: '宏平均F1', value: modelPerf.f1_macro.toFixed?.(4) ?? 'N/A' }] : []),
              ...(modelPerf.precision_weighted !== undefined ? [{ key: 'prec_w', metric: '加权精确率', value: modelPerf.precision_weighted.toFixed?.(4) ?? 'N/A' }] : []),
              ...(modelPerf.recall_weighted !== undefined ? [{ key: 'rec_w', metric: '加权召回率', value: modelPerf.recall_weighted.toFixed?.(4) ?? 'N/A' }] : []),
              ...(modelPerf.f1_weighted !== undefined ? [{ key: 'f1_w', metric: '加权F1', value: modelPerf.f1_weighted.toFixed?.(4) ?? 'N/A' }] : []),
              { key: 'n', metric: '样本量', value: results?.sample_size || 'N/A' },
              { key: 'train', metric: '训练集大小', value: results?.training_size || 'N/A' },
              { key: 'test', metric: '测试集大小', value: results?.test_size || 'N/A' },
            ]}
            pagination={false}
            size="small"
          />
          {Array.isArray(results?.diagnostics?.notes) && results.diagnostics.notes.length > 0 && (
            <ul style={{ marginTop: 8, paddingLeft: 18, color: '#777' }}>
              {results.diagnostics.notes.map((note: string, idx: number) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 阈值参数（有序logit） */}
      {results?.thresholds && Object.keys(results.thresholds).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Title level={5}>阈值参数（cutpoints）</Title>
          <Table
            columns={[{ title: '参数名', dataIndex: 'name', key: 'name' }, { title: '值', dataIndex: 'value', key: 'value' }]}
            dataSource={Object.entries(results.thresholds).map(([k, v]: [string, any]) => ({ key: k, name: k, value: typeof v === 'number' ? v.toFixed(4) : String(v) }))}
            pagination={false}
            size="small"
          />
        </div>
      )}

      <Title level={5}>回归系数</Title>
      <Table
        columns={[
          { title: '变量', dataIndex: 'variable', key: 'variable' },
          { title: '系数', dataIndex: 'coefficient', key: 'coefficient' },
          { title: '标准误', dataIndex: 'std_error', key: 'std_error' },
          { title: 't统计量', dataIndex: 't_statistic', key: 't_statistic' },
          { title: 'p值', dataIndex: 'p_value', key: 'p_value' },
          { title: '显著性', dataIndex: 'significant', key: 'significant' },
          { title: '95%置信区间', dataIndex: 'ci', key: 'ci' }
        ]}
        dataSource={coefficients.map((coef: any, index: number) => {
          let ciText = 'N/A';
          if (Array.isArray(coef.confidence_interval)) {
            const lo = coef.confidence_interval[0];
            const hi = coef.confidence_interval[1];
            ciText = `[${(typeof lo === 'number' ? lo.toFixed(4) : lo)}, ${(typeof hi === 'number' ? hi.toFixed(4) : hi)}]`;
          } else if (typeof coef.coefficient === 'number' && typeof coef.std_error === 'number') {
            const lo = coef.coefficient - 1.96 * coef.std_error;
            const hi = coef.coefficient + 1.96 * coef.std_error;
            ciText = `[${lo.toFixed(4)}, ${hi.toFixed(4)}]`;
          }
          return {
            key: index,
            variable: coef.variable,
            coefficient: (typeof coef.coefficient === 'number') ? coef.coefficient.toFixed(4) : 'N/A',
            std_error: (typeof coef.std_error === 'number') ? coef.std_error.toFixed(4) : 'N/A',
            t_statistic: (typeof coef.t_statistic === 'number') ? coef.t_statistic.toFixed(4) : 'N/A',
            p_value: (typeof coef.p_value === 'number') ? coef.p_value.toFixed(4) : 'N/A',
            significant: coef.significant ? '是' : '否',
            ci: ciText,
          };
        })}
        pagination={false}
        size="small"
      />
    </div>
  );
};

// 交叉表统计表
const CrosstabTable: React.FC<{ results: any }> = ({ results }) => {
  const counts = results?.counts || {};
  const rows = Object.keys(counts);
  const cols = rows.length ? Object.keys(counts[rows[0]] || {}) : [];

  const columns = [
    { title: '行/列', dataIndex: 'row', key: 'row' },
    ...cols.map(c => ({ title: c, dataIndex: c, key: c })),
  ];

  const dataSource = rows.map(r => ({
    key: r,
    row: r,
    ...Object.fromEntries(cols.map(c => [c, counts?.[r]?.[c] ?? 0]))
  }));

  return (
    <div>
      <Title level={5}>交叉表（计数）</Title>
      <Table columns={columns} dataSource={dataSource} pagination={false} size="small" />
    </div>
  );
};

// 分层分析表
const StratifiedTable: React.FC<{ results: any }> = ({ results }) => {
  const strata = Array.isArray(results?.strata) ? results.strata : [];
  const measure = results?.measure || 'Effect';
  const overall = results?.overall_random || results?.overall_fixed || results?.overall;
  const hetero = results?.heterogeneity;
  const columns: any[] = [
    { title: '分层', dataIndex: 'stratum', key: 'stratum' },
    { title: measure, dataIndex: 'effect', key: 'effect', render: (v: number) => (typeof v === 'number' ? v.toFixed(4) : 'N/A') },
    { title: '下限', dataIndex: 'ci_lo', key: 'ci_lo', render: (v: number) => (typeof v === 'number' ? v.toFixed(4) : 'N/A') },
    { title: '上限', dataIndex: 'ci_hi', key: 'ci_hi', render: (v: number) => (typeof v === 'number' ? v.toFixed(4) : 'N/A') },
    { title: '权重', dataIndex: 'weight', key: 'weight', render: (v: number) => (typeof v === 'number' ? v.toFixed(4) : 'N/A') },
    { title: '样本量', dataIndex: 'n', key: 'n', render: (v: number) => (v !== undefined ? v : 'N/A') },
    { title: '备注', dataIndex: 'notes', key: 'notes', render: (v: string) => v || '-' },
  ];
  const dataSource = strata.map((s: any, i: number) => ({
    key: i,
    stratum: s.stratum,
    effect: s.effect,
    ci_lo: Array.isArray(s.ci) ? s.ci[0] : null,
    ci_hi: Array.isArray(s.ci) ? s.ci[1] : null,
    weight: s.weight,
    n: s.n ?? (s.n0 && s.n1 ? s.n0 + s.n1 : undefined),
    notes: s.notes,
  }));
  return (
    <div>
      <Title level={5}>分层效应表</Title>
      <Table columns={columns} dataSource={dataSource} pagination={false} size="small" />
      {overall && (
        <div style={{ marginTop: 12, color: '#555' }}>
          合并效应（{results?.overall_random ? '随机效应' : results?.overall_fixed ? '固定效应' : '总体'}）：
          {typeof overall.effect === 'number' ? overall.effect.toFixed(4) : 'N/A'}
          {Array.isArray(overall.ci) && overall.ci.length === 2
            ? `（95% CI: ${overall.ci[0].toFixed(4)} ~ ${overall.ci[1].toFixed(4)}）`
            : ''}
        </div>
      )}
      {hetero && (
        <div style={{ marginTop: 4, color: '#777' }}>
          异质性 Q={hetero.Q.toFixed(3)} (df={hetero.df})，p={hetero.p_value.toFixed(4)}，I²={hetero.I2.toFixed(2)}%
        </div>
      )}
      {results?.auto_binarized && (
        <div style={{ marginTop: 4, color: '#777' }}>
          自动二分：变量 {results.auto_binarized.original_variable}，策略 {results.auto_binarized.strategy}
          {results.auto_binarized.threshold ? `，阈值 ${results.auto_binarized.threshold}` : ''}
          {Array.isArray(results.auto_binarized.retained)
            ? `，保留类别 ${results.auto_binarized.retained.join(', ')}`
            : ''}
        </div>
      )}
      {Array.isArray(results?.notes) && results.notes.length > 0 && (
        <ul style={{ marginTop: 6, paddingLeft: 18, color: '#777' }}>
          {results.notes.map((note: string, idx: number) => (
            <li key={idx}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

// MR 工具变量表
const MendelianTable: React.FC<{ results: any }> = ({ results }) => {
  const forest = Array.isArray(results?.forest) ? results.forest : [];
  const columns: any[] = [
    { title: '工具变量', dataIndex: 'study', key: 'study' },
    { title: 'Ratio', dataIndex: 'effect', key: 'effect', render: (v: number) => (typeof v === 'number' ? v.toFixed(4) : 'N/A') },
    { title: '下限', dataIndex: 'ci_lo', key: 'ci_lo', render: (v: number) => (typeof v === 'number' ? v.toFixed(4) : 'N/A') },
    { title: '上限', dataIndex: 'ci_hi', key: 'ci_hi', render: (v: number) => (typeof v === 'number' ? v.toFixed(4) : 'N/A') },
  ];
  const dataSource = forest.map((r: any, i: number) => ({
    key: i,
    study: r.study,
    effect: r.effect,
    ci_lo: Array.isArray(r.ci) ? r.ci[0] : null,
    ci_hi: Array.isArray(r.ci) ? r.ci[1] : null,
  }));
  return (
    <div>
      <Title level={5}>工具变量效应（Wald ratio）</Title>
      <Table columns={columns} dataSource={dataSource} pagination={false} size="small" />
    </div>
  );
};
