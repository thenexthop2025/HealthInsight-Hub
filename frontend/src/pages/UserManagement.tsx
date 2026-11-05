import React, { useMemo, useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Popconfirm,
  Switch,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { userAPI } from '../services/api';
import { extractErrorMessage } from '../utils/error';
import { formatDateTime } from '../utils/datetime';
import PageContainer from '../components/PageContainer';
import PageHero from '../components/PageHero';
import type {
  UserEntity,
  CreateUserPayload,
  UpdateUserPayload,
  PaginatedResponse,
  UserListResponse,
} from '../types/user';

const { Option } = Select;

const UserManagement: React.FC = () => {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserEntity | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [resetForm] = Form.useForm();
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserEntity | null>(null);
  const queryClient = useQueryClient();

  // 获取用户列表
  const { data: users, isLoading: usersLoading } = useQuery<UserListResponse>(
    'users',
    async () => {
      const res = await userAPI.getUsers();
      return res.data;
    }
  );

  // 创建用户
  const createUserMutation = useMutation(
    (data: CreateUserPayload) => userAPI.createUser(data),
    {
      onSuccess: () => {
        message.success('用户创建成功');
        queryClient.invalidateQueries('users');
        setCreateModalVisible(false);
        form.resetFields();
      },
      onError: (error: unknown) => {
        message.error(extractErrorMessage(error, '创建失败'));
      },
    }
  );

  // 更新用户
  const updateUserMutation = useMutation(
    ({ id, data }: { id: number; data: UpdateUserPayload }) =>
      userAPI.updateUser(id, data),
    {
      onSuccess: () => {
        message.success('用户更新成功');
        queryClient.invalidateQueries('users');
        setEditModalVisible(false);
        editForm.resetFields();
        setSelectedUser(null);
      },
      onError: (error: unknown) => {
        message.error(extractErrorMessage(error, '更新失败'));
      },
    }
  );

  const updateStatusMutation = useMutation(
    ({ id, is_active }: { id: number; is_active: boolean }) =>
      userAPI.updateStatus(id, is_active),
    {
      onSuccess: (_, variables) => {
        message.success(variables.is_active ? '账号已启用' : '账号已冻结');
        queryClient.invalidateQueries('users');
      },
      onError: (error: unknown) => {
        message.error(extractErrorMessage(error, '状态更新失败'));
      },
    }
  );

  const resetPasswordMutation = useMutation(
    ({ id, new_password }: { id: number; new_password: string }) =>
      userAPI.resetPassword(id, new_password),
    {
      onSuccess: () => {
        message.success('密码已重置');
        queryClient.invalidateQueries('users');
        setResetModalVisible(false);
        resetForm.resetFields();
        setResetTarget(null);
      },
      onError: (error: unknown) => {
        message.error(extractErrorMessage(error, '密码重置失败'));
      },
    }
  );

  // 删除用户
  const deleteUserMutation = useMutation(
    (id: number) => userAPI.deleteUser(id),
    {
      onSuccess: () => {
        message.success('用户删除成功');
        queryClient.invalidateQueries('users');
      },
      onError: (error: unknown) => {
        message.error(extractErrorMessage(error, '删除失败'));
      },
    }
  );

  const handleToggleStatus = (user: UserEntity) => {
    updateStatusMutation.mutate({ id: user.id, is_active: !user.is_active });
  };

  const openResetModal = (user: UserEntity) => {
    setResetTarget(user);
    resetForm.resetFields();
    setResetModalVisible(true);
  };

  const handleResetPassword = (values: { new_password: string }) => {
    if (!resetTarget) return;
    resetPasswordMutation.mutate({
      id: resetTarget.id,
      new_password: values.new_password,
    });
  };

  // 处理用户创建
  const handleCreateUser = (values: CreateUserPayload) => {
    createUserMutation.mutate(values);
  };

  // 处理用户编辑
  const handleEditUser = (values: UpdateUserPayload) => {
    if (selectedUser) {
      updateUserMutation.mutate({ id: selectedUser.id, data: values });
    }
  };

  // 编辑用户
  const editUser = (user: UserEntity) => {
    setSelectedUser(user);
    editForm.setFieldsValue({
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
    });
    setEditModalVisible(true);
  };

  // 获取角色标签
  const getRoleTag = (role: UserEntity['role']) => {
    const roleMap: { [key: string]: { color: string; text: string } } = {
      doctor: { color: 'blue', text: '医生' },
      researcher: { color: 'green', text: '研究人员' },
      public_health: { color: 'orange', text: '公共卫生人员' },
      admin: { color: 'red', text: '管理员' },
    };
    const roleInfo = roleMap[role] || { color: 'default', text: role };
    return <Tag color={roleInfo.color}>{roleInfo.text}</Tag>;
  };

  // 用户表格列
  const userColumns: ColumnsType<UserEntity> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '姓名',
      dataIndex: 'full_name',
      key: 'full_name',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: UserEntity['role']) => getRoleTag(role),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? '活跃' : '停用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => formatDateTime(date),
    },
    {
      title: '操作',
      key: 'actions',
          render: (_: unknown, record: UserEntity) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => editUser(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            danger={!record.is_active}
            icon={record.is_active ? <LockOutlined /> : <UnlockOutlined />}
            onClick={() => handleToggleStatus(record)}
          >
            {record.is_active ? '冻结账号' : '解冻账号'}
          </Button>
          <Button type="link" onClick={() => openResetModal(record)}>
            重置密码
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => deleteUserMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const userList = useMemo(() => {
    if (!users) return [] as UserEntity[];
    if (Array.isArray(users)) return users;
    if (
      users &&
      typeof users === 'object' &&
      Array.isArray((users as PaginatedResponse<UserEntity>).items)
    ) {
      return (users as PaginatedResponse<UserEntity>).items;
    }
    console.warn('Unexpected users payload', users);
    return [] as UserEntity[];
  }, [users]);
  const activeCount = useMemo(
    () => userList.filter((user: UserEntity) => user.is_active).length,
    [userList]
  );
  const adminCount = useMemo(
    () => userList.filter((user: UserEntity) => user.role === 'admin').length,
    [userList]
  );
  const frozenCount = useMemo(
    () => userList.filter((user: UserEntity) => !user.is_active).length,
    [userList]
  );

  const heroActions = (
    <Space>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={() => setCreateModalVisible(true)}
        className="enhanced-btn"
      >
        创建用户
      </Button>
    </Space>
  );

  return (
    <PageContainer>
      <PageHero
        icon={<UserOutlined className="page-hero__title-icon" />}
        badge="系统设置"
        title="用户管理"
        subtitle="管理系统用户，包括医生、研究人员、公共卫生人员和管理员。"
        stats={[
          { label: '用户总数', value: userList.length },
          { label: '活跃用户', value: activeCount },
          { label: '管理员', value: adminCount },
          { label: '冻结账号', value: frozenCount },
        ]}
        actions={heroActions}
      />

      <Card
        className="page-section-card"
        title={<span className="page-section-card__title">用户列表</span>}
      >
        <Table
          columns={userColumns}
          dataSource={userList}
          loading={usersLoading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            total: Array.isArray(users)
              ? userList.length
              : (users as PaginatedResponse<UserEntity> | undefined)?.total ?? userList.length,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      {/* 创建用户模态框 */}
      <Modal
        title="创建用户"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={createUserMutation.isLoading}
      >
        <Form form={form} onFinish={handleCreateUser} layout="vertical">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item
            name="full_name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Option value="doctor">医生</Option>
              <Option value="researcher">研究人员</Option>
              <Option value="public_health">公共卫生人员</Option>
              <Option value="admin">管理员</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少8位' },
              { 
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+/,
                message: '密码必须包含大小写字母、数字和特殊字符'
              }
            ]}
            help="密码要求：至少8位，包含大小写字母、数字和特殊字符"
          >
            <Input.Password placeholder="请输入密码" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑用户模态框 */}
      <Modal
        title="编辑用户"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setSelectedUser(null);
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateUserMutation.isLoading}
      >
        <Form form={editForm} onFinish={handleEditUser} layout="vertical">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item
            name="full_name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Option value="doctor">医生</Option>
              <Option value="researcher">研究人员</Option>
              <Option value="public_health">公共卫生人员</Option>
              <Option value="admin">管理员</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="is_active"
            label="状态"
            valuePropName="checked"
          >
            <Switch
              checkedChildren={<UnlockOutlined />}
              unCheckedChildren={<LockOutlined />}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={resetTarget ? `重置密码：${resetTarget.username}` : '重置密码'}
        open={resetModalVisible}
        onCancel={() => {
          setResetModalVisible(false);
          resetForm.resetFields();
          setResetTarget(null);
        }}
        onOk={() => resetForm.submit()}
        confirmLoading={resetPasswordMutation.isLoading}
      >
        <Form form={resetForm} onFinish={handleResetPassword} layout="vertical">
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码至少8位' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+/,
                message: '密码必须包含大小写字母、数字和特殊字符',
              },
            ]}
            help="密码要求：至少8位，包含大小写字母、数字和特殊字符"
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default UserManagement;
