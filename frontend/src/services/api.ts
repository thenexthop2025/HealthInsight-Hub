import axios from 'axios';
import type {
  CreateUserPayload,
  UpdateUserPayload,
  UserEntity,
  UserListParams,
  UserListResponse,
} from '../types/user';

// API Base URL configuration
// In development: uses setupProxy.js to proxy to backend
// In production: can be set via REACT_APP_API_URL environment variable
// If not set, defaults to same-origin (empty string)
const API_BASE_URL = process.env.REACT_APP_API_URL || '';
if (typeof window !== 'undefined') {
  console.info('[API] base URL:', API_BASE_URL || '(relative/same-origin)');
}

const api = axios.create({
  baseURL: API_BASE_URL || undefined,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// 请求拦截器 - 添加认证token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else if (config.headers.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理认证错误和自动刷新token
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // 如果是401错误且不是刷新token的请求
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/refresh')) {
      if (isRefreshing) {
        // 如果正在刷新token，将请求加入队列
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          return api(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken) {
        try {
          // 尝试刷新token
          const response = await api.post('/api/auth/refresh', { refresh_token: refreshToken });
          const { access_token, refresh_token: new_refresh_token } = response.data;
          
          // 保存新token
          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', new_refresh_token);
          api.defaults.headers.Authorization = `Bearer ${access_token}`;
          
          // 处理队列中的请求
          processQueue(null);
          
          // 重试原始请求
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          // 刷新token失败，清除所有认证信息
          processQueue(refreshError);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user');
          delete api.defaults.headers.Authorization;
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      } else {
        // 没有refresh token，直接跳转登录
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        delete api.defaults.headers.Authorization;
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

// 认证相关API
export const authAPI = {
  login: (credentials: { username: string; password: string }) =>
    api.post('/api/auth/login', credentials),
  register: (userData: {
    username: string;
    email: string;
    password: string;
    full_name: string;
  }) => api.post('/api/auth/register', userData),
  getMe: () => api.get('/api/auth/me'),
};

// 个人资料/头像 API
export const profileAPI = {
  getMyProfile: () => api.get('/api/users/me/profile'),
  updateMe: (data: any) => api.patch('/api/users/me', data),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadAvatarWithFormData: (formData: FormData) =>
    api.post('/api/users/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// 用户管理API
export const userAPI = {
  getUsers: (params?: UserListParams) =>
    api.get<UserListResponse>('/api/users/', { params }),
  getUser: (id: number) => api.get<UserEntity>(`/api/users/${id}`),
  createUser: (data: CreateUserPayload) => api.post<UserEntity>('/api/users/', data),
  updateUser: (id: number, data: UpdateUserPayload) =>
    api.put<UserEntity>(`/api/users/${id}`, data),
  updateStatus: (id: number, is_active: boolean) =>
    api.patch<UserEntity>(`/api/users/${id}/status`, { is_active }),
  updateRole: (id: number, role: UserEntity['role']) =>
    api.patch<UserEntity>(`/api/users/${id}/role`, { role }),
  resetPassword: (id: number, new_password: string) =>
    api.patch<{ message: string }>(`/api/users/${id}/password`, { new_password }),
  deleteUser: (id: number) => api.delete(`/api/users/${id}`),
};

// 数据管理API
export const dataAPI = {
  getDataSources: (params?: { skip?: number; limit?: number }) =>
    api.get('/api/data/sources', { params }),
  createDataSource: (data: any) => api.post('/api/data/sources', data),
  getDataSource: (id: number) => api.get(`/api/data/sources/${id}`),
  
  getDatasets: (params?: { skip?: number; limit?: number; data_source_id?: number }) =>
    api.get('/api/data/datasets', { params }),
  getDataset: (id: number) => api.get(`/api/data/datasets/${id}`),
  uploadDataset: (formData: FormData) =>
    api.post('/api/data/datasets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (evt) => {
        // 允许调用方通过 config.onUploadProgress 自行处理
      },
    }),
  previewDataset: (id: number, rows?: number) =>
    api.get(`/api/data/datasets/${id}/preview`, { params: { rows } }),
  getDatasetColumns: (id: number) =>
    api.get(`/api/data/datasets/${id}/columns`),
  deleteDataset: (id: number, params?: { soft?: boolean; force?: boolean }) => 
    api.delete(`/api/data/datasets/${id}`, { params }),
};

// 分析API
export const analysisAPI = {
  getAnalyses: (params?: { skip?: number; limit?: number }) =>
    api.get('/api/analysis/', { params }),
  getAnalysis: (id: number) => api.get(`/api/analysis/${id}`),
  createAnalysis: (data: any) => api.post('/api/analysis/', data),
  updateAnalysis: (id: number, data: any) => api.put(`/api/analysis/${id}`, data),
  deleteAnalysis: (id: number) => api.delete(`/api/analysis/${id}`),
  deleteAllAnalyses: () => api.delete('/api/analysis/'),
  runAnalysis: (data: any) => api.post('/api/analysis/run', data),
  runAnalysisSync: (data: any) => api.post('/api/analysis/run-sync', data),
};

// 报告API
export const reportAPI = {
  getReports: (params?: { skip?: number; limit?: number }) =>
    api.get('/api/reports/', { params }),
  getReport: (id: number) => api.get(`/api/reports/${id}`),
  createReport: (data: any) => api.post('/api/reports/', data),
  generateReport: (analysisId: number, reportType?: string) =>
    api.post(`/api/reports/generate/${analysisId}`, null, {
      params: { report_type: reportType || 'pdf' },
    }),
  downloadReport: (id: number) =>
    api.get(`/api/reports/download/${id}`, { responseType: 'blob' }),
  deleteReport: (id: number) => api.delete(`/api/reports/${id}`),
};

// 审计日志 API
export const auditAPI = {
  getLogs: (params?: { actor_id?: number; action?: string; target_id?: number; skip?: number; limit?: number; sort?: string }) =>
    api.get('/api/audit/logs', { params }),
};

// 统一数据API - 使用新的配置驱动系统
export const unifiedDataAPI = {
  // 数据源管理
  getDataSources: () => api.get('/api/unified/sources'),
  getDataSourcesConfig: () => api.get('/api/config/sources'),
  createDataSource: (data: any) => api.post('/api/config/sources', data),
  updateDataSource: (id: string, data: any) => api.put(`/api/config/sources/${id}`, data),
  deleteDataSource: (id: string) => api.delete(`/api/config/sources/${id}`),
  testDataSource: (id: string) => api.post(`/api/config/sources/${id}/test`),
  
  // 数据集管理
  getDatasets: (params?: { 
    query?: string; 
    category?: string; 
    source?: string; 
    limit?: number; 
    offset?: number;
  }) => api.get('/api/unified/datasets', { params }),
  
  // 字段数量更新
  updateFieldCounts: () => api.post('/api/unified/datasets/update-field-counts'),
  getFieldCountsStatus: () => api.get('/api/unified/datasets/field-counts-status'),
  updateDatasetFieldCount: (datasetId: string) => api.post(`/api/unified/datasets/${datasetId}/update-field-count`),
  getDatasetsConfig: () => api.get('/api/config/datasets'),
  createDataset: (data: any) => api.post('/api/config/datasets', data),
  updateDataset: (id: string, data: any) => api.put(`/api/config/datasets/${id}`, data),
  deleteDataset: (id: string) => api.delete(`/api/config/datasets/${id}`),
  deleteAllDatasets: () => api.delete('/api/config/datasets'),
  
  // 数据集操作
  getDatasetDetails: (datasetId: string) => 
    api.get(`/api/unified/datasets/${datasetId}`),
  importDataset: (datasetId: string, name: string, description?: string, queryParams?: any) =>
    api.post(`/api/unified/datasets/${datasetId}/import`, {
      name,
      description,
      query_params: queryParams
    }),
  previewDataset: (datasetId: string, rows?: number) =>
    api.get(`/api/unified/datasets/${datasetId}/preview`, { 
      params: { rows: rows || 10 } 
    }),
  getDatasetParameters: (datasetId: string) =>
    api.get(`/api/unified/datasets/${datasetId}/parameters`),
  previewDatasetWithParams: (datasetId: string, queryParams: any) =>
    api.post(`/api/unified/datasets/${datasetId}/preview`, queryParams, {
      headers: { 'Content-Type': 'application/json' },
    }),
  getCategories: () => api.get('/api/unified/datasets/categories'),
  getSources: () => api.get('/api/unified/sources'),

  // 数据集自动发现
  discoverDatasets: (dataSourceId: string) => 
    api.post(`/api/dataset-discovery/discover/${dataSourceId}`),
  generateDatasets: (dataSourceId: string) => 
    api.post(`/api/dataset-discovery/generate/${dataSourceId}`),
  getDiscoveryStatus: (dataSourceId: string) => 
    api.get(`/api/dataset-discovery/status/${dataSourceId}`),
  
  // 兼容旧API的方法名
  searchDatasets: (params?: { 
    query?: string; 
    category?: string; 
    source?: string; 
    limit?: number; 
    offset?: number;
  }) => api.get('/api/unified/datasets', { params }),
  getApiStatus: () => api.get('/api/unified/sources').then(res => ({
    data: {
      status: 'success',
      message: 'API状态正常',
      sources: res.data.sources || []
    }
  })),
  testApiConfig: () => api.post('/api/unified/sources').then(res => ({
    data: {
      status: 'success',
      message: 'API测试成功'
    }
  })),
  getApiConfig: () => api.get('/api/config/sources'),
  updateApiConfig: (useWonderApi: boolean) => 
    api.post('/api/config/sources', null, { 
      params: { use_wonder_api: useWonderApi } 
    }),
  getPreviewCache: (datasetId: string) => api.get(`/api/unified/datasets/${datasetId}/preview-cache`),
  saveFilterParams: (datasetId: string, filterParams: any) => 
    api.post(`/api/unified/datasets/${datasetId}/filter-params`, filterParams),
  getFilterParams: (datasetId: string) => 
    api.get(`/api/unified/datasets/${datasetId}/filter-params`),
  getAllFilterParams: () => 
    api.get('/api/unified/filter-params/all'),
};

// 对数据源的公共API别名
export const externalDataAPI = unifiedDataAPI;

export default api;

// 仪表盘统计
export const dashboardAPI = {
  getStats: () => api.get('/api/dashboard/stats'),
};
