import { useState, useEffect, createContext, useContext } from 'react';
import api, { authAPI } from '../services/api';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'doctor' | 'researcher' | 'public_health' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  register: (userData: {
    username: string;
    email: string;
    password: string;
    full_name: string;
  }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          api.defaults.headers.Authorization = `Bearer ${token}`;
          const response = await authAPI.getMe();
          setUser(response.data);
        } catch (error) {
          localStorage.removeItem('access_token');
          delete api.defaults.headers.Authorization;
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await authAPI.login({ username, password });
      const { access_token, refresh_token } = response.data;
      
      // 保存访问令牌和刷新令牌
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      // 立即设置默认Authorization头，避免某些环境下localStorage读取延迟
      api.defaults.headers.Authorization = `Bearer ${access_token}`;
      
      // 获取用户信息
      const userResponse = await authAPI.getMe();
      setUser(userResponse.data);
    } catch (error: any) {
      // 处理错误消息（可能是字符串或对象）
      const detail = error.response?.data?.detail;
      let errorMessage = '登录失败';
      
      if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (detail && typeof detail === 'object') {
        if (detail.message) {
          errorMessage = detail.message;
          if (detail.errors && Array.isArray(detail.errors)) {
            errorMessage += ': ' + detail.errors.join(', ');
          }
        }
      }
      
      throw new Error(errorMessage);
    }
  };

  const logout = () => {
    // 清除所有认证信息
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete api.defaults.headers.Authorization;
    setUser(null);
  };

  const register = async (userData: {
    username: string;
    email: string;
    password: string;
    full_name: string;
  }) => {
    try {
      await authAPI.register(userData);
    } catch (error: any) {
      // 处理错误消息（可能是字符串或对象）
      const detail = error.response?.data?.detail;
      let errorMessage = '注册失败';
      
      if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (detail && typeof detail === 'object') {
        if (detail.message) {
          errorMessage = detail.message;
          if (detail.errors && Array.isArray(detail.errors)) {
            errorMessage += ': ' + detail.errors.join(', ');
          }
        } else {
          errorMessage = JSON.stringify(detail);
        }
      }
      
      throw new Error(errorMessage);
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    register,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
