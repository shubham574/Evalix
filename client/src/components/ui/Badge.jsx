import React from 'react';

const Badge = ({
  children,
  variant = 'primary',
  className = '',
}) => {
  const variants = {
    primary: 'bg-[#FF6B35]/12 text-[#FF6B35] border border-[#FF6B35]/30',
    secondary: 'bg-[#8174FF]/12 text-[#8174FF] border border-[#8174FF]/30',
    lime: 'bg-[#C7F36B] text-[#151515] border border-[#151515]/20',
    ink: 'bg-[#151515] text-[#F8F5EF] border border-[#151515]',
    success: 'bg-success/15 text-success border border-success/30',
    warning: 'bg-warning/15 text-warning border border-warning/30',
    error: 'bg-danger/15 text-danger border border-danger/30',
    info: 'bg-[#8174FF]/15 text-[#8174FF] border border-[#8174FF]/30',
    default: 'bg-bg-elevated text-text-secondary border border-border-subtle',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-xs font-display font-semibold tracking-tight ${variants[variant] || variants.default} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
