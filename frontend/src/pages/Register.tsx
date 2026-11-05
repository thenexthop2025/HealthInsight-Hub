import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Select } from 'antd';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';

const { Option } = Select;

const Register: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const actionButtonStyle: React.CSSProperties = {
    height: '50px',
    borderRadius: '25px',
    fontSize: '18px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #4a90e2, #6ab4ff)',
    border: 'none',
    color: '#ffffff',
    boxShadow: '0 12px 24px rgba(74, 144, 226, 0.35)',
  };

  const onRegister = async (values: {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    full_name: string;
  }) => {
    if (values.password !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: values.username,
        email: values.email,
        password: values.password,
        full_name: values.full_name,
      });
      message.success('注册成功，请登录');
      navigate('/login');
    } catch (error: any) {
      console.error('注册错误:', error);
      // 更详细的错误处理
      let errorMessage = '注册失败';
      
      if (error?.message && typeof error.message === 'string') {
        errorMessage = error.message;
      } else if (error?.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          errorMessage = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
        } else {
          errorMessage = JSON.stringify(detail);
        }
      }
      
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        backgroundImage: "url('/images/login-bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
        padding: '20px 60px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* 右上角链接 */}
      <div style={{
        position: 'absolute',
        top: 16,
        right: 24,
        zIndex: 20,
        display: 'flex',
        gap: 20,
        fontWeight: 700
      }}>
        <Link to="/pricing" style={{ color: '#0b2b5e', textShadow: '0 1px 2px rgba(255,255,255,0.6)' }}>PRICING</Link>
        <Link to="/support" style={{ color: '#0b2b5e', textShadow: '0 1px 2px rgba(255,255,255,0.6)' }}>SUPPORT</Link>
      </div>

      <div className="login-card-wrap">
        <Card
          style={{
            width: '100%',
            maxWidth: 450,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
            borderRadius: '20px',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            zIndex: 10,
            position: 'relative'
          }}
        >
          <h2 style={{ 
            textAlign: 'center', 
            marginBottom: 24, 
            fontSize: 24, 
            fontWeight: 800,
            color: '#0b2b5e'
          }}>
            用户注册
          </h2>

          <Form
            name="register"
            onFinish={onRegister}
            autoComplete="off"
            size="large"
            initialValues={{}}
          >
            <Form.Item 
              name="username" 
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' }
              ]}
            >
              <Input placeholder="用户名" />
            </Form.Item>

            <Form.Item 
              name="email" 
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' }
              ]}
            >
              <Input placeholder="邮箱" />
            </Form.Item>

            <Form.Item 
              name="full_name" 
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <Input placeholder="姓名" />
            </Form.Item>

            {/* 公开注册不允许选择角色，后端默认赋予安全角色 */}

            <Form.Item 
              name="password" 
              rules={[
                { required: true, message: '请输入密码' },
                { min: 8, message: '密码至少8个字符' },
                {
                  pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+/,
                  message: '密码必须包含大小写字母、数字和特殊字符'
                }
              ]}
              help="密码要求：至少8位，包含大小写字母、数字和特殊字符"
            >
              <Input.Password placeholder="密码" />
            </Form.Item>

            <Form.Item 
              name="confirmPassword" 
              rules={[
                { required: true, message: '请确认密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  },
                }),
              ]}
            >
              <Input.Password placeholder="确认密码" />
            </Form.Item>

            <Form.Item>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 12,
                  width: '100%'
                }}
              >
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  style={{
                    ...actionButtonStyle,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  block
                >
                  注册
                </Button>
                <Link to="/login" style={{ flex: 1, display: 'block' }}>
                  <Button
                    block
                    type="default"
                    style={{
                      height: '50px',
                      borderRadius: '25px',
                      fontSize: '18px',
                      fontWeight: '700',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    返回登录
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

export default Register;
