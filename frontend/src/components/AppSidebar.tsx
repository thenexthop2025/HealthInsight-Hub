import React, { useState } from 'react';
import { Layout, Menu, Upload, message } from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  CloudOutlined,
  BarChartOutlined,
  FileTextOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  FolderOutlined,
  AppstoreOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const { Sider } = Layout;

const AppSidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>(localStorage.getItem('systemLogo') || '');
  const [showLogoUpload, setShowLogoUpload] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '平台总览',
    },
    {
      key: 'data-management',
      icon: <FolderOutlined />,
      label: '数据管理',
      children: [
        {
          key: '/global',
          icon: <CloudOutlined />,
          label: '外部数据集',
        },
        {
          key: '/data',
          icon: <DatabaseOutlined />,
          label: '内部数据集',
        },
      ],
    },
    {
      key: 'preprocessing',
      icon: <AppstoreOutlined />,
      label: '数据预处理',
      children: [
        {
          key: '/preprocessing',
          icon: <BarChartOutlined />,
          label: '变量特征分析',
        },
        {
          key: '/data-quality-check',
          icon: <CheckCircleOutlined />,
          label: '数据质量检查',
        },
        {
          key: '/data-cleaning',
          icon: <ToolOutlined />,
          label: '数据清洗',
        },
        {
          key: '/data-format-conversion',
          icon: <DatabaseOutlined />,
          label: '数据格式转换',
        },
      ],
    },
    {
      key: '/analysis',
      icon: <BarChartOutlined />,
      label: '数据分析',
    },
    {
      key: '/reports',
      icon: <FileTextOutlined />,
      label: '报告管理',
    },
    ...(user?.role === 'admin'
      ? [
          {
            key: 'system',
            icon: <SettingOutlined />,
            label: '系统管理',
            children: [
              {
                key: '/config',
                icon: <ToolOutlined />,
                label: '配置管理',
              },
              {
                key: '/users',
                icon: <TeamOutlined />,
                label: '用户管理',
              },
              {
                key: '/audit',
                icon: <EditOutlined />,
                label: '审计日志',
              },
            ],
          },
        ]
      : []),
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    // 只处理叶子节点（实际页面路由）
    if (key.startsWith('/')) {
      navigate(key);
    }
  };

  const handleLogoUpload = (file: File) => {
    // 验证文件类型
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('只能上传图片文件！');
      return false;
    }

    // 验证文件大小（限制为2MB）
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('图片大小不能超过 2MB！');
      return false;
    }

    // 读取文件并转换为base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setLogoUrl(base64);
      localStorage.setItem('systemLogo', base64);
      message.success('Logo上传成功！');
      setShowLogoUpload(false);
    };
    reader.readAsDataURL(file);

    return false; // 阻止默认上传行为
  };

  return (
    <Sider
      trigger={null}
      collapsible
      collapsedWidth={72}
      collapsed={collapsed}
      width={280}
      className="app-sidebar"
      theme="light"
    >
      <div className="app-sidebar__header">
        {!collapsed && (
            <div 
              className="app-sidebar__logo"
              onMouseEnter={() => user?.role === 'admin' && setShowLogoUpload(true)}
              onMouseLeave={() => setShowLogoUpload(false)}
              style={{ position: 'relative' }}
            >
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  style={{ 
                    width: 48, 
                    height: 48, 
                    objectFit: 'contain',
                    borderRadius: 8
                  }} 
                />
              ) : (
                <div 
                  style={{ 
                    width: 48, 
                    height: 48, 
                    background: 'linear-gradient(135deg, rgba(31, 79, 255, 0.2), rgba(76, 224, 210, 0.2))',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    color: '#1890ff',
                    fontWeight: 'bold'
                  }}
                >
                  HIH
                </div>
              )}
              {user?.role === 'admin' && showLogoUpload && (
                <Upload
                  beforeUpload={handleLogoUpload}
                  showUploadList={false}
                  accept="image/*"
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: 48,
                      height: 48,
                      background: 'rgba(0, 0, 0, 0.5)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#fff'
                    }}
                  >
                    <EditOutlined />
                  </div>
                </Upload>
              )}
              <div>
                <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: 0.5 }}>HIH</div>
                <small className="app-sidebar__tagline" style={{ fontWeight: 700, fontSize: 13 }}>
                  你身边的数据分析专家
                </small>
              </div>
            </div>
          )}
        <div
          className="app-sidebar__toggle"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      </div>

      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={handleMenuClick}
      />
    </Sider>
  );
};

export default AppSidebar;
