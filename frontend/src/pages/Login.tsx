import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';

// no tabs / select on login page

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      message.success('登录成功');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('登录错误:', error);
      const errorMessage = error?.response?.data?.detail || error?.message || '登录失败';
      message.error(typeof errorMessage === 'string' ? errorMessage : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__links">
        <Link to="/pricing" className="login-page__link">PRICING</Link>
        <Link to="/support" className="login-page__link">SUPPORT</Link>
      </div>
      <div className="login-card-wrap">
        <Card className="login-card">
        {/* 仅登录表单，底部提供登录与注册按钮（注册跳转到页面） */}
        <Form
          name="login"
          onFinish={onLogin}
          autoComplete="off"
          size="large"
          className="login-card__form"
        >
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}> 
            <Input placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}> 
            <Input.Password placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <div className="login-card__actions">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="login-card__action-btn"
                block
              >
                登录
              </Button>
              <Link to="/register" style={{ flex: 1, display: 'block' }}>
                <Button
                  block
                  type="primary"
                  className="login-card__action-btn"
                >
                  注册
                </Button>
              </Link>
            </div>
          </Form.Item>
        </Form>
      </Card>
      </div>
    </div>
  );
};

export default Login;
