import React from 'react';
import { Card, Button, Typography, Row, Col, Divider, Tag } from 'antd';
import { CheckCircleFilled, SafetyCertificateFilled } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

interface PricingTier {
  name: string;
  description: string;
  price: string;
  cadence: string;
  highlights: string[];
  cta: string;
  link: string;
  badge?: string;
  featured?: boolean;
}

const tiers: PricingTier[] = [
  {
    name: 'Starter',
    description: '面向新团队，快速上线数据分析基础流程。',
    price: '¥0',
    cadence: '前 30 天试用',
    highlights: ['10 个私有项目额度', '流程化数据清洗向导', '标准报告模板导出'],
    cta: '开始试用',
    link: '/register',
  },
  {
    name: 'Professional',
    description: '适用于成长型机构，提供协同与高级分析能力。',
    price: '¥惊喜价',
    cadence: '每月（支持按年结算）',
    highlights: [
      '不限项目与数据集体积',
      '高级统计模型与自动化审核',
      '与院内 LDAP / SSO 无缝集成',
    ],
    cta: '预约顾问',
    link: '/support',
    badge: '最受欢迎',
    featured: true,
  },
  {
    name: 'Enterprise',
    description: '面向大型医疗集团，提供合规部署与专属成功团队。',
    price: '定制报价',
    cadence: '年度合同',
    highlights: [
      '私有化 / 专属集群部署',
      '合规审计与安全隔离策略',
      '7×24 专家陪伴支持',
    ],
    cta: '预约演示',
    link: '/support',
  },
];

const Pricing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="public-shell pricing-page">
      <div className="public-shell__nav">
        <Link to="/support">支持中心</Link>
        <Link to="/login">登录</Link>
      </div>

      <section className="pricing-hero">
        <div className="pricing-hero__badge">
          <SafetyCertificateFilled />
          医疗级数据合规
        </div>
        <Title level={1} className="pricing-hero__title">
          灵活匹配医疗数据团队的智能分析套餐
        </Title>
        <Paragraph className="pricing-hero__subtitle">
          覆盖从临床数据整合、质量评估、统计建模，到自动化报告发布的全流程能力，可按照团队规模与合规需求自由扩展。
        </Paragraph>
        <div className="pricing-hero__meta">
          <Tag color="blue">信息安全 · ISO27001 / HIPAA 对标</Tag>
          <Tag color="green">可扩展 · 模块化算力池</Tag>
          <Tag color="gold">高保障 · 专属成功团队</Tag>
        </div>
      </section>

      <Row gutter={[24, 24]} justify="center" className="pricing-grid">
        {tiers.map((tier) => (
          <Col key={tier.name} xs={24} md={12} xl={8}>
            <Card
              className={`pricing-card${tier.featured ? ' pricing-card--featured' : ''}`}
              bordered={false}
            >
              {tier.badge && <span className="pricing-card__badge">{tier.badge}</span>}
              <div className="pricing-card__header">
                <Title level={3}>{tier.name}</Title>
                <Paragraph type="secondary">{tier.description}</Paragraph>
              </div>

              <div className="pricing-card__pricing">
                <span className="pricing-card__price">{tier.price}</span>
                <Text className="pricing-card__cadence">{tier.cadence}</Text>
              </div>

              <Divider className="pricing-card__divider" />

              <ul className="pricing-card__list">
                {tier.highlights.map((item) => (
                  <li key={item}>
                    <CheckCircleFilled />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Button
                type={tier.featured ? 'primary' : 'default'}
                size="large"
                block
                className="pricing-card__cta"
                onClick={() => navigate(tier.link)}
              >
                {tier.cta}
              </Button>
            </Card>
          </Col>
        ))}
      </Row>

      <section className="pricing-faq">
        <Card className="pricing-faq__card" bordered={false}>
          <Title level={4}>常见问题</Title>
          <div className="pricing-faq__content">
            <div>
              <Title level={5}>是否支持院内私有化部署？</Title>
              <Paragraph>
                我们提供多种部署模式，包括私有云与本地化部署，满足等保、HIPAA 等合规要求，并由专属团队提供落地支持。
              </Paragraph>
            </div>
            <div>
              <Title level={5}>如何评估迁移周期？</Title>
              <Paragraph>
                专家会基于现有数据资产与流程进行评估，通常 4-6 周即可完成首批场景上线，并提供运营培训与联合验收。
              </Paragraph>
            </div>
            <div>
              <Title level={5}>能否与现有系统集成？</Title>
              <Paragraph>
                支持 HL7、FHIR、CSV 等多种接口协议，可对接 HIS、LIS、EMR 及第三方数据中台，保障数据实时同步与安全传输。
              </Paragraph>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};

export default Pricing;
