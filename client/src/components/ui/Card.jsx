import React from 'react';
import { motion } from 'motion/react';

const Card = ({
  children,
  variant = 'default',
  className = '',
  padding = 'p-6',
  hover = false,
  onClick,
  ...props
}) => {
  const baseStyles = 'rounded-[18px] overflow-hidden relative transition-all duration-200';

  const variants = {
    default: 'bg-bg-surface border border-border-subtle shadow-xs flex flex-col',
    solid: 'bg-bg-elevated border border-border-subtle flex flex-col',
    ink: 'bg-[#151515] text-[#F8F5EF] border border-[#2E2E2E] flex flex-col',
    tactile: 'bg-bg-surface border-[1.5px] border-[#151515] shadow-[4px_4px_0px_#151515] flex flex-col',
    gradient: 'bg-bg-surface border border-border-subtle shadow-xs flex flex-col',
  };

  const hoverStyles = hover
    ? 'hover:border-[#FF6B35] hover:shadow-md cursor-pointer group'
    : '';

  const CardWrapper = hover || onClick ? motion.div : 'div';
  const motionProps =
    hover || onClick
      ? {
          whileHover: { y: -2 },
          onClick,
        }
      : {};

  return (
    <CardWrapper
      className={`${baseStyles} ${variants[variant] || variants.default} ${hoverStyles} ${className}`}
      {...motionProps}
      {...props}
    >
      <div className={`relative z-10 w-full flex-1 ${padding}`}>{children}</div>
    </CardWrapper>
  );
};

export default Card;
