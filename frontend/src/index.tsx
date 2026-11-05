import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from 'react-query';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import * as echarts from 'echarts';
import { AuthProvider } from './hooks/useAuth';
import App from './App';
import './index.css';
import { reportEChartsTheme } from './theme/reportTheme';

// 全局处理ResizeObserver错误
const resizeObserverErrorHandler = (e: ErrorEvent) => {
  if (e.message === 'ResizeObserver loop completed with undelivered notifications.') {
    e.stopImmediatePropagation();
    e.preventDefault();
    return false;
  }
};

// 添加多种错误处理方式
window.addEventListener('error', resizeObserverErrorHandler);
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason && e.reason.message && e.reason.message.includes('ResizeObserver')) {
    e.preventDefault();
  }
});

// 重写console.error来过滤ResizeObserver错误
const originalConsoleError = console.error;
console.error = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('ResizeObserver')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// 重写ResizeObserver来完全避免错误
if (window.ResizeObserver) {
  const OriginalResizeObserver = window.ResizeObserver;
window.ResizeObserver = class extends OriginalResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super((entries: ResizeObserverEntry[], observer: ResizeObserver) => {
        try {
          callback(entries, observer);
        } catch (error: unknown) {
          if (error instanceof Error && error.message && error.message.includes('ResizeObserver loop completed with undelivered notifications')) {
            // 静默忽略这个错误
            return;
          }
          throw error;
        }
      });
    }
  };
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const echartsGlobal = echarts as unknown as { __reportThemeRegistered?: boolean; registerTheme: typeof echarts.registerTheme };
if (!echartsGlobal.__reportThemeRegistered) {
  echartsGlobal.registerTheme('reportTheme', reportEChartsTheme);
  echartsGlobal.__reportThemeRegistered = true;
}

root.render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <ConfigProvider 
        locale={zhCN}
        componentSize="middle"
        theme={{
          token: {
            // 减少动画和过渡效果，降低ResizeObserver触发频率
            motionDurationSlow: '0.1s',
            motionDurationMid: '0.1s',
            motionDurationFast: '0.1s',
          }
        }}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </ConfigProvider>
    </BrowserRouter>
  </QueryClientProvider>
);
