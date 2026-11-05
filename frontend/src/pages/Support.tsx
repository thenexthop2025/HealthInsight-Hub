import React from 'react';
import { Card, Typography, Form, Input, Button } from 'antd';
import { Link } from 'react-router-dom';

const { Title, Text } = Typography;

const Support: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        background: 'linear-gradient(135deg, #fffdf7 0%, #f5fbff 50%, #ffffff 100%)',
        padding: '20px 60px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* 顶部右侧链接 - 与 Pricing 页面样式一致 */}
      <div className="public-shell__nav">
        <Link to="/pricing">PRICING</Link>
        <Link to="/login">LOGIN</Link>
      </div>

      <div style={{ marginLeft: 150, marginTop: 140, width: '100%', maxWidth: 720 }}>
        <Title level={2} style={{ color: '#0b2b5e', marginBottom: 16 }}>Support</Title>
        <Text style={{ color: '#163968' }}>Tell us what you need. We'll get back shortly.</Text>

        <Card style={{ borderRadius: 20, marginTop: 20 }}>
          <Form layout="vertical">
            <Form.Item label="Your email" required>
              <Input placeholder="name@example.com" />
            </Form.Item>
            <Form.Item label="Subject" required>
              <Input placeholder="Brief subject" />
            </Form.Item>
            <Form.Item label="Message" required>
              <Input.TextArea rows={6} placeholder="Describe your issue or request..." />
            </Form.Item>
            <Form.Item>
              <Button type="primary">Send message</Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default Support;


