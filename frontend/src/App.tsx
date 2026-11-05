import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import DataManagement from './pages/DataManagement';
import DataPreprocessing from './pages/DataPreprocessing';
import DataQualityCheck from './pages/DataQualityCheck';
import DataCleaning from './pages/DataCleaning';
import DataFormatConversion from './pages/DataFormatConversion';
import Analysis from './pages/Analysis';
import Reports from './pages/Reports';
import Pricing from './pages/Pricing';
import Support from './pages/Support';
import UserManagement from './pages/UserManagement';
import GlobalDatasets from './pages/GlobalDatasets';
import ConfigManagement from './pages/ConfigManagement';
import AuditLogs from './pages/AuditLogs';
import AppHeader from './components/AppHeader';
import AppSidebar from './components/AppSidebar';
import ErrorBoundary from './components/ErrorBoundary';

const { Content } = Layout;

const App: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div>加载中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/support" element={<Support />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Layout>
        <AppSidebar />
        <Layout>
          <AppHeader />
          <Content className="app-content-wrapper">
            <div className="app-content-card">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/data" element={<DataManagement />} />
                <Route path="/global" element={<GlobalDatasets />} />
                <Route path="/preprocessing" element={<DataPreprocessing />} />
                <Route path="/data-quality-check" element={<DataQualityCheck />} />
                <Route path="/data-cleaning" element={<DataCleaning />} />
                <Route path="/data-format-conversion" element={<DataFormatConversion />} />
                <Route path="/config" element={<ConfigManagement />} />
                <Route path="/analysis" element={<Analysis />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/support" element={<Support />} />
                {user.role === 'admin' && (
                  <>
                    <Route path="/users" element={<UserManagement />} />
                    <Route path="/audit" element={<AuditLogs />} />
                  </>
                )}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </div>
          </Content>
        </Layout>
      </Layout>
    </ErrorBoundary>
  );
};

export default App;
