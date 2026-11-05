/**
 * 数据预处理API服务
 */

import api from '../../services/api';
import { 
  PreprocessingConfig, 
  PreprocessingResult, 
  DataInfo, 
  ColumnStatistics,
  PreprocessingStep 
} from '../types/preprocessing';

export const preprocessingAPI = {
  /**
   * 对数据集进行预处理
   */
  preprocessDataset: async (datasetId: number, config: PreprocessingConfig): Promise<PreprocessingResult> => {
    const response = await api.post(`/preprocessing/preprocess/${datasetId}`, config);
    return response.data.result;
  },

  /**
   * 获取数据集基本信息
   */
  getDatasetInfo: async (datasetId: number): Promise<{ data_info: DataInfo; data_types: Record<string, string> }> => {
    const response = await api.get(`/preprocessing/preprocess/${datasetId}/info`);
    return response.data;
  },

  /**
   * 获取单个列的统计信息
   */
  getColumnStatistics: async (datasetId: number, columnName: string): Promise<ColumnStatistics> => {
    const response = await api.get(`/preprocessing/preprocess/${datasetId}/column/${columnName}/stats`);
    return response.data.statistics;
  },

  /**
   * 批量执行数据预处理步骤
   */
  batchPreprocess: async (datasetId: number, steps: PreprocessingStep[]): Promise<any> => {
    const response = await api.post(`/preprocessing/preprocess/${datasetId}/batch`, steps);
    return response.data;
  }
};

