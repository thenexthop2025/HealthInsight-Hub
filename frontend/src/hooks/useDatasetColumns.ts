import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { dataAPI } from '../services/api';

type ColumnInfo = {
  name: string;
  dtype: string;
  unique_count: number;
  null_count: number;
  is_numeric: boolean;
  is_categorical: boolean;
};

type ColumnsResponse = {
  data?: {
    columns?: ColumnInfo[];
    total_rows?: number;
  };
  columns?: ColumnInfo[];
  total_rows?: number;
};

export const useDatasetColumns = (datasetId?: number | null) => {
  const query = useQuery<ColumnsResponse>(
    ['dataset-columns', datasetId],
    () => dataAPI.getDatasetColumns(datasetId!),
    {
      enabled: Boolean(datasetId),
      staleTime: 5 * 60 * 1000,
    }
  );

  const columns = useMemo(() => {
    if (!query.data) return [];
    return query.data.data?.columns || query.data.columns || [];
  }, [query.data]);

  const totalRows = query.data?.data?.total_rows ?? query.data?.total_rows ?? 0;

  return {
    ...query,
    columns,
    totalRows,
    isEmpty: columns.length === 0,
  };
};

