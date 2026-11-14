import React from 'react';
import { motion } from 'motion/react';

const Button = ({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon: Icon,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-display font-semibold rounded-[12px] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-canvas relative select-none';

  const variants = {
    primary:
      'bg-[#FF6B35] text-white border border-[#151515]/15 shadow-[0_2px_0_#151515] hover:bg-[#EB5822] hover:shadow-[0_4px_0_#151515] active:translate-y-[1px] active:shadow-[0_1px_0_#151515]',
    secondary:
      'bg-bg-surface hover:bg-surface-hover text-text-primary border border-border-subtle shadow-xs hover:border-text-primary/40',
    dark:
      'bg-[#151515] text-[#F8F5EF] border border-[#151515] hover:bg-[#282828] shadow-[0_2px_0_#FF6B35]',
    lime:
      'bg-[#C7F36B] text-[#151515] border border-[#151515] shadow-[0_2px_0_#151515] hover:bg-[#b8e955]',
    danger:
      'bg-danger text-white border border-danger/20 hover:opacity-95 shadow-xs',
    ghost:
      'hover:bg-surface-hover text-text-secondary hover:text-text-primary',
  };

  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs tracking-tight gap-1.5',
    md: 'px-5 py-2.5 text-sm tracking-tight gap-2',
    lg: 'px-7 py-3.5 text-base tracking-tight gap-2.5',
  };

  const disabledStyles =
    disabled || loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer';
  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={!(disabled || loading) ? { y: -1 } : {}}
      whileTap={!(disabled || loading) ? { y: 1 } : {}}
      transition={{ type: 'spring', stiffness: 450, damping: 28 }}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${widthStyles} ${disabledStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin -ml-0.5 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" />
      ) : null}
      {children}
    </motion.button>
  );
};

export default Button;
