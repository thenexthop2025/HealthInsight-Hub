/**
 * 数据预处理类型定义
 */

// 变量分析结果
export interface VariableAnalysis {
  column_name: string;
  data_type: 'quantitative' | 'qualitative';
  is_numeric: boolean;
  is_categorical: boolean;
  unique_count: number;
  null_count: number;
  null_ratio: number;
  value_range?: {
    min: number;
    max: number;
    mean: number;
    std: number;
  };
  categories?: Record<string, number>;
  total_rows: number;
}

// 正态性检验结果
export interface NormalityTestResult {
  test_name: string;
  statistic?: number;
  p_value?: number;
  is_normal?: boolean;
  sample_size?: number;
  error?: string;
}

export interface ComprehensiveNormalityTest {
  overall_is_normal?: boolean;
  tests: NormalityTestResult[];
  sample_size: number;
  normal_count: number;
  total_tests: number;
  error?: string;
  transformation?: string;
  transformation_parameters?: Record<string, any>;
  transformation_note?: string;
}

export interface NormalizationSuggestion {
  method: string;
  display_name: string;
  overall_is_normal?: boolean;
  sample_size?: number;
  tests: NormalityTestResult[];
  parameters?: Record<string, any>;
  note?: string;
}

// 描述性统计结果
export interface QuantitativeStats {
  count: number;
  mean: number;
  median: number;
  mode?: number;
  std: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  q1: number;
  q3: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
  outlier_count: number;
  outlier_ratio: number;
  lower_bound: number;
  upper_bound: number;
  error?: string;
}

export interface QualitativeStats {
  count: number;
  unique_count: number;
  frequency_table: Array<{
    value: string;
    count: number;
    percentage: number;
  }>;
  most_frequent: {
    value: string | null;
    count: number;
    percentage: number;
  };
  entropy: number;
  error?: string;
}

// 变量分析完整结果
export interface VariableAnalysisResult {
  variable: string;
  variable_analysis: VariableAnalysis;
  normality_test?: ComprehensiveNormalityTest;
  descriptive_stats: QuantitativeStats | QualitativeStats;
  recommendation: string;
  is_normal?: boolean;
  normalization_suggestions?: NormalizationSuggestion[];
  raw_data?: number[];
}

// 数据集变量信息
export interface DatasetVariableInfo {
  dataset_id: number;
  total_columns: number;
  numeric_columns: string[];
  categorical_columns: string[];
  columns: Array<{
    name: string;
    is_numeric: boolean;
    is_categorical: boolean;
    data_type: string;
    unique_count: number;
    null_count: number;
    null_ratio: number;
    error?: string;
  }>;
}

// API响应类型
export interface PreprocessingApiResponse<T = any> {
  success: boolean;
  message: string;
  result?: T;
  error?: string;
}

// 分析请求参数
export interface AnalyzeVariablesRequest {
  dataset_id: number;
  variables: string[];
}

export interface NormalityTestRequest {
  dataset_id: number;
  variable: string;
  transformation?: string;
}

export interface DescriptiveStatsRequest {
  dataset_id: number;
  variable: string;
}

export interface FrequencyAnalysisRequest {
  dataset_id: number;
  variable: string;
}
