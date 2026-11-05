/**
 * 数据预处理Hooks
 */

import { useQuery, useMutation, useQueryClient } from 'react-query';
import { message } from 'antd';
import PreprocessingAPI from '../services/preprocessingAPI';
import {
  AnalyzeVariablesRequest,
  NormalityTestRequest,
  DescriptiveStatsRequest,
  FrequencyAnalysisRequest,
  VariableAnalysisResult,
  DatasetVariableInfo
} from '../types/preprocessing';

// 分析变量
export const useAnalyzeVariables = () => {
  return useMutation({
    mutationFn: (request: AnalyzeVariablesRequest) => PreprocessingAPI.analyzeVariables(request),
    onSuccess: (data) => {
      if (data.success) {
        message.success('变量分析完成');
      } else {
        message.error(data.error || '变量分析失败');
      }
    },
    onError: (error: any) => {
      message.error('变量分析失败');
      console.error('Analyze variables error:', error);
    }
  });
};

// 获取变量信息
export const useVariableInfo = (datasetId: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['variable-info', datasetId],
    queryFn: () => PreprocessingAPI.getVariableInfo(datasetId),
    enabled: enabled && !!datasetId,
    staleTime: 5 * 60 * 1000, // 5分钟
    cacheTime: 10 * 60 * 1000, // 10分钟
  });
};

// 正态性检验
export const useNormalityTest = () => {
  return useMutation({
    mutationFn: (request: NormalityTestRequest) => PreprocessingAPI.normalityTest(request),
    onSuccess: (data) => {
      if (data.success) {
        message.success('正态性检验完成');
      } else {
        message.error(data.error || '正态性检验失败');
      }
    },
    onError: (error: any) => {
      message.error('正态性检验失败');
      console.error('Normality test error:', error);
    }
  });
};

// 描述性统计
export const useDescriptiveStats = () => {
  return useMutation({
    mutationFn: (request: DescriptiveStatsRequest) => PreprocessingAPI.descriptiveStats(request),
    onSuccess: (data) => {
      if (data.success) {
        message.success('描述性统计完成');
      } else {
        message.error(data.error || '描述性统计失败');
      }
    },
    onError: (error: any) => {
      message.error('描述性统计失败');
      console.error('Descriptive stats error:', error);
    }
  });
};

// 频数分析
export const useFrequencyAnalysis = () => {
  return useMutation({
    mutationFn: (request: FrequencyAnalysisRequest) => PreprocessingAPI.frequencyAnalysis(request),
    onSuccess: (data) => {
      if (data.success) {
        message.success('频数分析完成');
      } else {
        message.error(data.error || '频数分析失败');
      }
    },
    onError: (error: any) => {
      message.error('频数分析失败');
      console.error('Frequency analysis error:', error);
    }
  });
};

// 批量分析变量（组合多个API调用）
export const useBatchAnalyzeVariables = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: AnalyzeVariablesRequest) => {
      // 使用analyze-variables接口进行批量分析
      return PreprocessingAPI.analyzeVariables(request);
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        message.success(`成功分析 ${data.result?.analyzed_variables || 0} 个变量`);
        // 刷新变量信息缓存
        queryClient.invalidateQueries(['variable-info', variables.dataset_id]);
      } else {
        message.error(data.error || '批量分析失败');
      }
    },
    onError: (error: any) => {
      message.error('批量分析失败');
      console.error('Batch analyze variables error:', error);
    }
  });
};
