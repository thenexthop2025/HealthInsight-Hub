import React, { useState } from 'react';
import { Card, Table, Space, Input, Select, Button } from 'antd';
import { FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery } from 'react-query';
import { auditAPI } from '../services/api';
import PageContainer from '../components/PageContainer';
import PageHero from '../components/PageHero';

const { Option } = Select;

const AuditLogs: React.FC = () => {
  const [filters, setFilters] = useState<{ actor_id?: number; action?: string }>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading } = useQuery(['auditLogs', filters, page, pageSize], () =>
    auditAPI
      .getLogs({
        actor_id: filters.actor_id,
        action: filters.action,
        skip: (page - 1) * pageSize,
        limit: pageSize,
        sort: 'created_at:desc',
      })
      .then((r) => r.data)
  );

  // 计算统计数据
  const totalLogs = data?.total || 0;
  const recentLogs = data?.items?.filter((log: any) => {
    const logTime = new Date(log.created_at);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return logTime > oneDayAgo;
  }).length || 0;
  
  const actionTypes = data?.items?.reduce((acc: Record<string, number>, log: any) => {
    acc[log.action] = (acc[log.action] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  
  const uniqueActors = new Set(data?.items?.map((log: any) => log.actor_id) || []).size;

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '操作者ID', dataIndex: 'actor_id', key: 'actor_id', width: 120 },
    { title: '动作', dataIndex: 'action', key: 'action', width: 180 },
    { title: '目标类型', dataIndex: 'target_type', key: 'target_type', width: 120 },
    { title: '目标ID', dataIndex: 'target_id', key: 'target_id', width: 120 },
    { title: '详情', dataIndex: 'details', key: 'details' },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 200 },
  ];

  // 搜索操作
  const handleSearch = () => {
    setPage(1); // 重置到第一页
  };

  const heroActions = (
    <Space>
      <Button
        icon={<SearchOutlined />}
        onClick={handleSearch}
        className="enhanced-btn"
      >
        搜索日志
      </Button>
    </Space>
  );

  return (
    <PageContainer>
      <PageHero
        icon={<FileTextOutlined className="page-hero__title-icon" />}
        badge="日志管理"
        title="审计日志"
        subtitle="查看关键用户操作日志，追踪系统活动和安全事件（仅管理员）"
        stats={[
          { label: '总日志数', value: totalLogs },
          { label: '今日日志', value: recentLogs },
          { label: '操作类型', value: Object.keys(actionTypes).length },
          { label: '操作者数', value: uniqueActors },
        ]}
        actions={heroActions}
      />

      <Card
        className="page-section-card"
        title="日志列表"
        extra={
          <Space>
            <Input
              placeholder="操作者ID"
              style={{ width: 160 }}
              onChange={(e) => {
                const v = e.target.value.trim();
                setFilters((f) => ({ ...f, actor_id: v ? Number(v) : undefined }));
              }}
            />
            <Select
              allowClear
              placeholder="动作"
              style={{ width: 200 }}
              onChange={(v) => setFilters((f) => ({ ...f, action: v as string | undefined }))}
            >
              <Option value="create_user">create_user</Option>
              <Option value="update_user">update_user</Option>
              <Option value="set_active">set_active</Option>
              <Option value="change_role">change_role</Option>
              <Option value="reset_password">reset_password</Option>
              <Option value="delete_user">delete_user</Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={data?.items || []}
          loading={isLoading}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total: data?.total || 0,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>
    </PageContainer>
  );
};

export default AuditLogs;

