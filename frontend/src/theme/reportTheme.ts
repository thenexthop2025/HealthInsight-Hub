export const reportPalette = {
  background: '#f5f7fa',
  surface: '#ffffff',
  surfaceMuted: '#f1f5f9',
  border: '#d7dde5',
  textPrimary: '#1f2933',
  textSecondary: '#4b5563',
  textMuted: '#6b7280',
  primary: '#65a30d', // Lime-600
  accent: '#0ea5a3', // teal-like blue-green
  blue: '#3b82f6', // Blue-500
  gray400: '#9ca3af',
  gray200: '#e5e7eb',
  danger: '#ef4444', // Red-500
  success: '#22c55e', // Green-500
};

export const reportTypography = {
  title: {
    fontFamily: "'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontWeight: 700,
    fontSize: 20,
    lineHeight: 1.4,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontFamily: "'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontWeight: 600,
    fontSize: 14,
    lineHeight: 1.6,
    color: reportPalette.textSecondary,
  },
  body: {
    fontFamily: "'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontWeight: 400,
    fontSize: 13,
    lineHeight: 1.7,
    color: reportPalette.textSecondary,
  },
  caption: {
    fontFamily: "'Helvetica Neue', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontWeight: 500,
    fontSize: 12,
    lineHeight: 1.5,
    color: reportPalette.textMuted,
  },
};

export const reportLayout = {
  cardRadius: 12,
  cardShadow: '0 8px 28px rgba(15, 23, 42, 0.08)',
  blockSpacing: 28,
  sectionSpacing: 20,
  gutter: 16,
};

export const reportEChartsTheme = {
  color: [reportPalette.primary, reportPalette.blue, reportPalette.accent, reportPalette.gray400],
  backgroundColor: 'rgba(255,255,255,0)',
  textStyle: {
    fontFamily: reportTypography.body.fontFamily,
    color: reportPalette.textPrimary,
  },
  title: {
    textStyle: {
      color: reportPalette.textPrimary,
      fontWeight: 600,
      fontSize: 16,
    },
    subtextStyle: {
      color: reportPalette.textMuted,
      fontSize: 12,
    },
  },
  legend: {
    textStyle: {
      color: reportPalette.textSecondary,
      fontSize: 12,
    },
    bottom: 0,
    icon: 'roundRect',
    itemWidth: 12,
    itemHeight: 12,
  },
  grid: {
    top: 56,
    left: 48,
    right: 32,
    bottom: 48,
  },
  tooltip: {
    backgroundColor: '#ffffff',
    borderColor: reportPalette.gray200,
    borderWidth: 1,
    textStyle: {
      color: reportPalette.textPrimary,
      fontSize: 12,
    },
    extraCssText: 'box-shadow:0 8px 24px rgba(15, 23, 42, 0.12); border-radius:10px;',
  },
  axisPointer: {
    lineStyle: {
      color: reportPalette.gray400,
    },
    crossStyle: {
      color: reportPalette.gray400,
    },
  },
  axisLabel: {
    color: reportPalette.textSecondary,
  },
  axisLine: {
    lineStyle: {
      color: reportPalette.gray200,
    },
  },
  splitLine: {
    lineStyle: {
      color: [reportPalette.gray200],
      type: 'dashed',
    },
  },
};

export const significanceMarker = {
  threshold: 0.05,
  marker: '★',
  color: reportPalette.primary,
};

export const reportTheme = {
  palette: reportPalette,
  typography: reportTypography,
  layout: reportLayout,
  echarts: reportEChartsTheme,
  significance: significanceMarker,
};
