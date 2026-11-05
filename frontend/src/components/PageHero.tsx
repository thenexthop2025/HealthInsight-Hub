import React from 'react';

interface PageHeroStat {
  label: string;
  value: React.ReactNode;
}

interface PageHeroProps {
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  stats?: PageHeroStat[];
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

const PageHero: React.FC<PageHeroProps> = ({
  icon,
  badge,
  title,
  subtitle,
  stats,
  meta,
  actions,
  className,
}) => {
  const heroClass = ['page-hero', className].filter(Boolean).join(' ');

  return (
    <div className={heroClass}>
      {badge && <div className="page-hero__badge">{badge}</div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-hero__title">
            {icon}
            {title}
          </div>
          {subtitle && <div className="page-hero__subtitle">{subtitle}</div>}
          {meta && <div className="page-hero__meta">{meta}</div>}
        </div>
        {actions && <div>{actions}</div>}
      </div>
      {stats && stats.length > 0 && (
        <div className="page-hero__stats">
          {stats.map((stat, index) => (
            <div key={index} className="page-hero__stats-item">
              <span className="page-hero__stats-value">{stat.value}</span>
              <span className="page-hero__stats-label">{stat.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PageHero;
