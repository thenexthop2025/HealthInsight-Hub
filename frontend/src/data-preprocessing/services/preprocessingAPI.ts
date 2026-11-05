/**
 * 数据预处理API服务
 */

import api from '../../services/api';
import {
  PreprocessingApiResponse,
  AnalyzeVariablesRequest,
  NormalityTestRequest,
  DescriptiveStatsRequest,
  FrequencyAnalysisRequest,
  VariableAnalysisResult,
  DatasetVariableInfo,
  ComprehensiveNormalityTest,
  QuantitativeStats,
  QualitativeStats
} from '../types/preprocessing';

export class PreprocessingAPI {
  /**
   * 分析多个变量
   */
  static async analyzeVariables(request: AnalyzeVariablesRequest): Promise<PreprocessingApiResponse<{
    results: VariableAnalysisResult[];
    total_variables: number;
    analyzed_variables: number;
  }>> {
    const response = await api.post('/api/data-preprocessing/analyze-variables', {
      dataset_id: request.dataset_id,
      variables: request.variables
    });
    return response.data;
  }

  /**
   * 获取数据集变量信息
   */
  static async getVariableInfo(datasetId: number): Promise<PreprocessingApiResponse<DatasetVariableInfo>> {
    const response = await api.get(`/api/data-preprocessing/variable-info/${datasetId}`);
    return response.data;
  }

  /**
   * 正态性检验
   */
  static async normalityTest(request: NormalityTestRequest): Promise<PreprocessingApiResponse<{
    variable: string;
    normality_test: ComprehensiveNormalityTest;
  }>> {
    const response = await api.post('/api/data-preprocessing/normality-test', {
      dataset_id: request.dataset_id,
      variable: request.variable,
      transformation: request.transformation
    });
    return response.data;
  }

  /**
   * 描述性统计
   */
  static async descriptiveStats(request: DescriptiveStatsRequest): Promise<PreprocessingApiResponse<{
    variable: string;
    data_type: string;
    descriptive_stats: QuantitativeStats | QualitativeStats;
  }>> {
    const response = await api.post('/api/data-preprocessing/descriptive-stats', {
      dataset_id: request.dataset_id,
      variable: request.variable
    });
    return response.data;
  }

  /**
   * 频数分析
   */
  static async frequencyAnalysis(request: FrequencyAnalysisRequest): Promise<PreprocessingApiResponse<{
    variable: string;
    frequency_analysis: QualitativeStats;
  }>> {
    const response = await api.post('/api/data-preprocessing/frequency-analysis', {
      dataset_id: request.dataset_id,
      variable: request.variable
    });
    return response.data;
  }
}

export default PreprocessingAPI;
