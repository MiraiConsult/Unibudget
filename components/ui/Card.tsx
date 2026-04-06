import React, { ReactNode } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div className={`bg-white shadow rounded-xl p-6 border border-slate-200/80 ${className}`} {...props}>
      {children}
    </div>
  );
};

interface CardHeaderProps {
    children: ReactNode;
    className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => {
    return (
        <div className={`mb-4 ${className}`}>
            {children}
        </div>
    );
};

interface CardTitleProps {
    children: ReactNode;
    className?: string;
}

export const CardTitle: React.FC<CardTitleProps> = ({ children, className = '' }) => {
    return (
        <h2 className={`text-lg font-semibold text-slate-900 ${className}`}>
            {children}
        </h2>
    );
};