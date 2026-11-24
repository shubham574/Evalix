import React from 'react';

const Badge = ({
  children,
  variant = 'primary',
  className = '',
}) => {
  const variants = {
    primary: 'bg-peach text-[#167A3A] dark:text-[#6FD394]',
    secondary: 'bg-lilac text-[#1D6FB8] dark:text-[#8EC1FF]',
    lime: 'bg-mint text-[#2F6B12] dark:text-[#A8E07E]',
    ink: 'bg-text-primary text-bg-surface',
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    error: 'bg-danger-bg text-danger',
    info: 'bg-lilac text-info',
    default: 'bg-bg-elevated text-text-secondary',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium tracking-[-0.005em] ${variants[variant] || variants.default} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
