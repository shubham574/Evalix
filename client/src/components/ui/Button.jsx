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
    'group inline-flex items-center justify-center font-display font-normal rounded-[16px] transition-[transform,box-shadow,background-color,color] duration-150 ease-[cubic-bezier(0.2,0.715,0.205,0.99)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-canvas relative select-none whitespace-nowrap';

  const variants = {
    // Keycap controls — reverse-engineered from the reference's .key / .key--ink
    primary: 'key--ink',
    secondary: 'bg-bg-surface text-text-primary shadow-[var(--shadow-key)]',
    dark: 'key--ink',
    lime: 'key--green',
    danger: 'bg-danger text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.2),0_0_0_1px_rgba(0,0,0,0.08),0_12px_22px_-14px_rgba(217,45,32,0.6)] hover:opacity-95',
    ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
  };

  const sizes = {
    sm: 'h-10 px-4 text-[14px] tracking-[-0.01em] gap-1.5 rounded-[13px]',
    md: 'h-12 px-5.5 text-[15px] tracking-[-0.012em] gap-2',
    lg: 'h-[60px] px-8 text-[17px] tracking-[-0.012em] gap-2.5 rounded-[20px]',
  };

  const disabledStyles =
    disabled || loading ? 'opacity-45 cursor-not-allowed pointer-events-none' : 'cursor-pointer';
  const widthStyles = fullWidth ? 'w-full' : '';

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={!(disabled || loading) ? { y: -1 } : {}}
      whileTap={!(disabled || loading) ? { y: 1 } : {}}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${widthStyles} ${disabledStyles} ${className}`}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin -ml-0.5 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : Icon ? (
        <Icon className="h-4 w-4 shrink-0" />
      ) : null}
      {children}
    </motion.button>
  );
};

export default Button;
