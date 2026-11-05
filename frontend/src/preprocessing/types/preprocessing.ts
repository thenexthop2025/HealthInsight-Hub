/**
 * 数据预处理类型定义
 */

export interface PreprocessingConfig {
  type: string;
  params: Record<string, any>;
}

export interface DataInfo {
  shape: [number, number];
  columns: string[];
  dtypes: Record<string, string>;
  memory_usage: number;
  missing_values: Record<string, number>;
  missing_percentage: Record<string, number>;
  duplicate_rows: number;
  preprocessing_log: PreprocessingLogEntry[];
}

export interface PreprocessingLogEntry {
  operation: string;
  timestamp: string;
  data_shape_before: [number, number];
  details: Record<string, any>;
}

export interface ColumnStatistics {
  column: string;
  dtype: string;
  count: number;
  missing_count: number;
  missing_percentage: number;
  unique_count: number;
  duplicate_count: number;
  mean?: number;
  median?: number;
  std?: number;
  min?: number;
  max?: number;
  skewness?: number;
  kurtosis?: number;
  most_frequent?: string;
  most_frequent_count?: number;
  value_distribution?: Record<string, number>;
}

export interface DataQualityReport {
  overall_score: number;
  issues: QualityIssue[];
  warnings: QualityWarning[];
  recommendations: string[];
  column_analysis: Record<string, ColumnAnalysis>;
}

export interface QualityIssue {
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  affected_columns?: string[];
  duplicate_count?: number;
}

export interface QualityWarning {
  type: string;
  message: string;
  duplicate_count?: number;
  column?: string;
  min_value?: number;
  max_value?: number;
}

export interface ColumnAnalysis {
  issues: string[];
  data_type: string;
  missing_count: number;
  unique_count: number;
}

export interface PreprocessingResult {
  preprocessing_type: string;
  result_data?: any;
  data_info: DataInfo;
  preprocessing_log: PreprocessingLogEntry[];
  outliers_info?: Record<string, any>;
  quality_report?: DataQualityReport;
  consistency_report?: ConsistencyReport;
  validation_report?: ValidationReport;
}

export interface ConsistencyReport {
  overall_consistent: boolean;
  violations: ConsistencyViolation[];
  column_consistency: Record<string, ColumnConsistency>;
}

export interface ConsistencyViolation {
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  count?: number;
  missing_columns?: string[];
}

export interface ColumnConsistency {
  issue: string;
  count: number;
  percentage: number;
}

export interface ValidationReport {
  passed_rules: string[];
  failed_rules: ValidationRuleFailure[];
  overall_valid: boolean;
}

export interface ValidationRuleFailure {
  name: string;
  type: string;
  message: string;
}

export interface PreprocessingStep {
  id: string;
  type: string;
  name: string;
  description: string;
  params: Record<string, any>;
  enabled: boolean;
}

export interface PreprocessingPipeline {
  id: string;
  name: string;
  description: string;
  steps: PreprocessingStep[];
  created_at: string;
  updated_at: string;
}

export type PreprocessingType = 
  | 'clean_missing'
  | 'remove_duplicates'
  | 'detect_outliers'
  | 'remove_outliers'
  | 'standardize_text'
  | 'convert_types'
  | 'validate_quality'
  | 'validate_consistency'
  | 'validate_business_rules'
  | 'normalize'
  | 'encode_categorical'
  | 'create_features'
  | 'select_features'
  | 'transform_skewed';

export type MissingValueStrategy = 
  | 'drop'
  | 'drop_columns'
  | 'fill_mean'
  | 'fill_median'
  | 'fill_mode'
  | 'fill_forward'
  | 'fill_backward';

export type OutlierDetectionMethod = 
  | 'iqr'
  | 'zscore'
  | 'modified_zscore';

export type NormalizationMethod = 
  | 'standard'
  | 'minmax'
  | 'robust';

export type EncodingMethod = 
  | 'label'
  | 'onehot';

export type FeatureType = 
  | 'sum'
  | 'mean'
  | 'product'
  | 'ratio'
  | 'difference'
  | 'polynomial'
  | 'log'
  | 'sqrt';

export type SkewedTransformMethod = 
  | 'log'
  | 'sqrt'
  | 'box_cox';

