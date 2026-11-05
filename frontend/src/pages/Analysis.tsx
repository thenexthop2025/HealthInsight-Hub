import React, { useState } from 'react';
import { Row, Col, message } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import AnalysisForm from '../components/analysis/AnalysisForm';
import AnalysisHistory from '../components/analysis/AnalysisHistory';
import AnalysisResults from '../components/analysis/AnalysisResults';
import PageContainer from '../components/PageContainer';
import PageHero from '../components/PageHero';

const AnalysisPage: React.FC = () => {
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [resultModalVisible, setResultModalVisible] = useState(false);

  // 处理分析完成
  const handleAnalysisComplete = (analysisId: string) => {
    message.success('分析完成！');
    // 可以在这里添加其他处理逻辑
  };

  // 处理查看结果
  const handleViewResults = (analysis: any) => {
    setSelectedAnalysis(analysis);
    setResultModalVisible(true);
  };

  // 关闭结果模态框
  const handleCloseResults = () => {
    setResultModalVisible(false);
    setSelectedAnalysis(null);
  };

  return (
    <PageContainer>
      <PageHero
        icon={<BarChartOutlined className="page-hero__title-icon" />}
        badge="智能分析"
        title="数据分析"
        subtitle="选择分析模型、配置变量并查看历史结果，全面探索疾病与生活习惯的关联。"
      />

      <Row gutter={[16, 16]}>
        {/* 分析配置表单 */}
        <Col xs={24} lg={8}>
          <AnalysisForm onAnalysisComplete={handleAnalysisComplete} />
        </Col>

        {/* 分析历史 */}
        <Col xs={24} lg={16}>
          <AnalysisHistory onViewResults={handleViewResults} />
        </Col>
      </Row>

      {/* 分析结果模态框 */}
      <AnalysisResults
        visible={resultModalVisible}
        analysis={selectedAnalysis}
        onClose={handleCloseResults}
      />
    </PageContainer>
  );
};

export default AnalysisPage;
