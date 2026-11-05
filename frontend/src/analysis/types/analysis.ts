/**
 * 分析相关类型定义
 */

export interface Analysis {
  id: number;
  name: string;
  analysis_type: string;
  status: string;
  created_at: string;
  completed_at?: string;
  results?: any;
  parameters?: any;
}

export interface ChartConfig {
  type: string;
  name: string;
  description: string;
}

export interface AnalysisFormData {
  dataset_id: number;
  analysis_type: string;
  dependent_variables?: string[];
  independent_variables?: string[];
  control_variables?: string[];
  categorical_variables?: string[];
  row_variable?: string;
  column_variable?: string;
  descriptive_subtype?: string;
  analysis_name?: string;
}

export type AnalysisType = 
  | 'descriptive'
  | 'frequency'
  | 'crosstab'
  | 'explore'
  | 'pp_plot'
  | 'correlation'
  | 'chi_square'
  | 'logistic_regression'
  | 'logistic_regression_multinomial'
  | 'logistic_regression_ordinal'
  | 'logistic_regression_conditional'
  | 'linear_regression'
  | 'machine_learning'
  | 'stratified'
  | 'mendelian_randomization';

export type DescriptiveSubtype = 
  | 'descriptive'
  | 'frequency'
  | 'crosstab'
  | 'explore'
  | 'pp_plot';

// 分析结果类型定义
export interface ChiSquareResults {
  row_variable: string;
  column_variable: string;
  contingency_table: Record<string, Record<string, number>>;
  expected: Record<string, Record<string, number>>;
  residuals: Record<string, Record<string, number>>;
  chi_square_statistic: number;
  p_value: number;
  degrees_of_freedom: number;
  cramers_v: number;
  contingency_coefficient: number;
  sample_size: number;
  is_significant: boolean;
  interpretation: {
    significance: string;
    effect_size: string;
    cramers_v_interpretation: string;
  };
  warnings?: {
    expected_freq_ratio: number;
    expected_freq_ok: number;
    total_cells: number;
  };
}

export interface RegressionResults {
  dependent_variable: string;
  independent_variables: string[];
  control_variables: string[];
  model_summary: {
    r_squared: number;
    adj_r_squared: number;
    aic: number;
    bic: number;
    f_statistic: number;
    f_p_value: number;
    sample_size: number;
  };
  coefficients: Array<{
    variable: string;
    coefficient: number;
    std_error: number;
    t_statistic: number;
    p_value: number;
    significant: boolean;
    confidence_interval: [number, number];
  }>;
  residuals: {
    values: number[];
    mean: number;
    std: number;
  };
  predictions: number[];
  actual_values: number[];
}

export interface LogisticRegressionResults {
  dependent_variable: string;
  independent_variables: string[];
  control_variables: string[];
  model_performance: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
  };
  coefficients: Array<{
    variable: string;
    coefficient: number;
    odds_ratio: number;
    interpretation: string;
  }>;
  predictions: {
    test_predictions: number[];
    test_probabilities: number[][];
    test_actual: number[];
  };
  sample_size: number;
  training_size: number;
  test_size: number;
}

export interface CorrelationResults {
  variables: string[];
  correlations: Record<string, {
    pearson: {
      r: number;
      p: number;
      interpretation: string;
    };
    spearman: {
      r: number;
      p: number;
      interpretation: string;
    };
    kendall: {
      r: number;
      p: number;
      interpretation: string;
    };
    sample_size: number;
  }>;
  pearson_matrix: Record<string, Record<string, number>>;
  spearman_matrix: Record<string, Record<string, number>>;
  kendall_matrix: Record<string, Record<string, number>>;
  sample_size: number;
}

export interface FrequencyResults {
  [variable: string]: {
    variable: string;
    summary: {
      total: number;
      valid: number;
      missing: number;
    };
    levels: Array<{
      value: string;
      count: number;
      percent: number;
      valid_percent: number;
      cumulative_valid_percent: number;
    }>;
    missing: null;
  };
}

export interface ExploreResults {
  [variable: string]: {
    type: 'numeric' | 'categorical';
    descriptive?: {
      count: number;
      missing_count: number;
      mean: number | null;
      std: number | null;
      min: number | null;
      max: number | null;
      median: number | null;
      q25: number | null;
      q75: number | null;
      skewness: number | null;
      kurtosis: number | null;
    };
    raw_data?: {
      values: number[];
      sample_size: number;
    };
    frequency?: {
      counts: Record<string, number>;
      total: number;
      unique: number;
    };
  };
}

export interface AnalysisResults {
  chi_square?: ChiSquareResults;
  regression?: RegressionResults;
  logistic_regression?: LogisticRegressionResults;
  correlation?: CorrelationResults;
  frequency?: FrequencyResults;
  explore?: ExploreResults;
  error?: string;
  warnings?: Record<string, any>;
}
