import React from 'react';
interface PageContainerProps {
  className?: string;
  includeBlobs?: boolean;
  children: React.ReactNode;
}

const PageContainer: React.FC<PageContainerProps> = ({
  className,
  includeBlobs = true,
  children,
}) => {
  const containerClassName = ['page-shell', className].filter(Boolean).join(' ');

  return (
    <div className={containerClassName}>
      {includeBlobs && (
        <>
          <div className="floating-blob" />
          <div className="floating-blob floating-blob--mint" />
        </>
      )}
      {children}
    </div>
  );
};

export default PageContainer;
