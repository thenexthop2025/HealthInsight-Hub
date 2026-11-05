/**
 * 数据预处理相关Hooks
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { preprocessingAPI } from '../services/preprocessingAPI';
import { 
  PreprocessingConfig, 
  PreprocessingResult, 
  DataInfo, 
  ColumnStatistics,
  PreprocessingStep 
} from '../types/preprocessing';

export const useDatasetInfo = (datasetId: number) => {
  return useQuery(
    ['dataset-info', datasetId],
    () => preprocessingAPI.getDatasetInfo(datasetId),
    {
      enabled: !!datasetId,
      staleTime: 5 * 60 * 1000, // 5分钟
    }
  );
};

export const useColumnStatistics = (datasetId: number, columnName: string) => {
  return useQuery(
    ['column-statistics', datasetId, columnName],
    () => preprocessingAPI.getColumnStatistics(datasetId, columnName),
    {
      enabled: !!datasetId && !!columnName,
      staleTime: 5 * 60 * 1000,
    }
  );
};

export const usePreprocessing = () => {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const preprocessMutation = useMutation(
    ({ datasetId, config }: { datasetId: number; config: PreprocessingConfig }) =>
      preprocessingAPI.preprocessDataset(datasetId, config),
    {
      onMutate: () => {
        setIsProcessing(true);
      },
      onSuccess: (data, variables) => {
        // 使相关查询失效，触发重新获取
        queryClient.invalidateQueries(['dataset-info', variables.datasetId]);
        setIsProcessing(false);
      },
      onError: () => {
        setIsProcessing(false);
      },
    }
  );

  const batchPreprocessMutation = useMutation(
    ({ datasetId, steps }: { datasetId: number; steps: PreprocessingStep[] }) =>
      preprocessingAPI.batchPreprocess(datasetId, steps),
    {
      onMutate: () => {
        setIsProcessing(true);
      },
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries(['dataset-info', variables.datasetId]);
        setIsProcessing(false);
      },
      onError: () => {
        setIsProcessing(false);
      },
    }
  );

  const preprocessDataset = useCallback(
    (datasetId: number, config: PreprocessingConfig) => {
      return preprocessMutation.mutateAsync({ datasetId, config });
    },
    [preprocessMutation]
  );

  const batchPreprocess = useCallback(
    (datasetId: number, steps: PreprocessingStep[]) => {
      return batchPreprocessMutation.mutateAsync({ datasetId, steps });
    },
    [batchPreprocessMutation]
  );

  return {
    preprocessDataset,
    batchPreprocess,
    isProcessing,
    isLoading: preprocessMutation.isLoading || batchPreprocessMutation.isLoading,
    error: preprocessMutation.error || batchPreprocessMutation.error,
  };
};

