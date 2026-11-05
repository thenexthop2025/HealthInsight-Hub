import React, { useEffect, useMemo, useState } from 'react';
import {
  Layout,
  Dropdown,
  Avatar,
  Button,
  Space,
  Typography,
  Tag,
  Modal,
  Form,
  Input,
  Upload,
  message,
  Divider,
  Switch,
  Drawer,
} from 'antd';
import { UserOutlined, LogoutOutlined, SettingOutlined, BellOutlined, LockOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useAuth } from '../hooks/useAuth';
import { profileAPI } from '../services/api';

const { Header } = Layout;
const { Text } = Typography;

const AppHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<{ avatar_path?: string; bio?: string; user?: { full_name?: string; email?: string } } | null>(null);
  const [avatarVersion, setAvatarVersion] = useState<number>(Date.now());
  const [profileOpen, setProfileOpen] = useState(false);
  const [form] = Form.useForm();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    notifyOnDatasetReady: true,
    notifyOnReportReady: true,
    darkHeader: false,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await profileAPI.getMyProfile();
        const profileData = res.data as {
          avatar_path?: string;
          bio?: string;
          user?: { full_name?: string; email?: string };
        };
        setProfile(profileData);
        if (profileData?.user) {
          form.setFieldsValue({
            full_name: profileData.user.full_name,
            email: profileData.user.email,
          });
        }
        setAvatarVersion(Date.now());
      } catch (error) {
        console.warn('加载个人资料失败', error);
      }
    };
    load();
  }, [form, user?.id]);

  const handleUpdateProfile = async (values: any) => {
    try {
      await profileAPI.updateMe(values);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              user: { ...(prev.user || {}), ...values },
            }
          : { user: values },
      );
      message.success('资料已更新');
      setProfileOpen(false);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '更新失败');
    }
  };

  const beforeUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('请上传图片格式文件');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error('头像文件大小不能超过 2MB');
      return Upload.LIST_IGNORE;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('thumbnail', 'true');
    formData.append('max_size', '256');

    try {
      const res = await profileAPI.uploadAvatarWithFormData(formData);
      const nextPath = res.data.avatar_path;
      setProfile((prev) => ({ ...(prev || {}), avatar_path: nextPath }));
      setAvatarVersion(Date.now());
      message.success('头像已更新');
    } catch (e: any) {
      message.error(e?.response?.data?.detail || '上传失败');
    }
    return Upload.LIST_IGNORE;
  };

  const handleLogout = () => {
    logout();
  };

  const items: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => {
        form.setFieldsValue({
          full_name: profile?.user?.full_name || user?.full_name,
          email: profile?.user?.email || user?.email,
        });
        setProfileOpen(true);
      },
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: () => setSettingsOpen(true),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  const getRoleText = (role: string) => {
    const roleMap: { [key: string]: string } = {
      doctor: '医生',
      researcher: '研究人员',
      public_health: '公共卫生人员',
      admin: '管理员',
    };
    return roleMap[role] || role;
  };

  const avatarSrc = useMemo(() => {
    if (!profile?.avatar_path) return undefined;
    const path = profile.avatar_path;
    if (/^https?:\/\//i.test(path)) {
      return path;
    }
    const suffix = path.includes('?') ? '&' : '?';
    return `${path}${suffix}v=${avatarVersion}`;
  }, [profile?.avatar_path, avatarVersion]);

  const displayName = profile?.user?.full_name || user?.full_name;

  return (
    <Header>
      <div className="app-header">
        <div className="app-header__title">
          <div>HealthInsight Hub</div>
          <Text className="app-header__greeting">智能医疗数据分析平台（HIH）</Text>
        </div>

        <Space size={18} align="center">
          <Tag color="gold" className="app-header__role-tag">
            {getRoleText(user?.role || '')}
          </Tag>
          <Text className="app-header__greeting">欢迎，{displayName}</Text>
          <Dropdown menu={{ items }} placement="bottomRight">
            <Button type="text" className="app-header__avatar-btn">
              <Avatar
                size={44}
                className="app-header__avatar"
                src={avatarSrc}
                icon={<UserOutlined />}
              />
            </Button>
          </Dropdown>
        </Space>
      </div>
      <Modal
        title="个人资料"
        open={profileOpen}
        onCancel={() => setProfileOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleUpdateProfile}>
          <Form.Item>
            <div className="profile-avatar-upload">
              <Upload beforeUpload={beforeUpload} showUploadList={false} accept="image/*">
                <Avatar
                  size={96}
                  src={avatarSrc}
                  icon={<UserOutlined />}
                  style={{ cursor: 'pointer' }}
                />
              </Upload>
            </div>
          </Form.Item>
          <Form.Item name="full_name" label="姓名">
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="请输入邮箱" />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="系统设置"
        placement="right"
        width={360}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Typography.Title level={5}>
              <BellOutlined style={{ marginRight: 8 }} />
              通知提醒
            </Typography.Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div className="settings-item">
                <div>
                  <div className="settings-item__title">数据集导入完成提醒</div>
                  <div className="settings-item__desc">当数据集导入或更新完成时，通过消息中心提醒我。</div>
                </div>
                <Switch
                  checked={settings.notifyOnDatasetReady}
                  onChange={(value) => setSettings((prev) => ({ ...prev, notifyOnDatasetReady: value }))}
                />
              </div>
              <div className="settings-item">
                <div>
                  <div className="settings-item__title">报告生成完成提醒</div>
                  <div className="settings-item__desc">报告生成或导出完成后发送通知。</div>
                </div>
                <Switch
                  checked={settings.notifyOnReportReady}
                  onChange={(value) => setSettings((prev) => ({ ...prev, notifyOnReportReady: value }))}
                />
              </div>
            </Space>
          </div>

          <Divider />

          <div>
            <Typography.Title level={5}>
              <LockOutlined style={{ marginRight: 8 }} />
              安全偏好
            </Typography.Title>
            <div className="settings-item">
              <div>
                <div className="settings-item__title">紧凑模式标题栏</div>
                <div className="settings-item__desc">在启用紧凑模式时，标题栏将更紧凑、更简洁。</div>
              </div>
              <Switch
                checked={settings.darkHeader}
                onChange={(value) => setSettings((prev) => ({ ...prev, darkHeader: value }))}
              />
            </div>
          </div>
        </Space>
      </Drawer>
    </Header>
  );
};

export default AppHeader;
