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
  const baseStyles = 'rounded-[22px] overflow-hidden relative transition-[box-shadow,border-color,transform] duration-500 ease-[cubic-bezier(0.2,0.715,0.205,0.99)]';

  const variants = {
    default: 'bg-bg-surface border border-border-subtle shadow-sm flex flex-col',
    solid: 'bg-bg-elevated border border-border-subtle flex flex-col',
    // "ink" used to be a black panel — it is now the brand tint
    ink: 'bg-peach border border-[#1D9E4B]/15 text-text-primary flex flex-col',
    tactile: 'bg-bg-surface border border-border-subtle shadow-md flex flex-col',
    gradient: 'aura bg-bg-surface/60 border border-border-subtle shadow-sm flex flex-col',
    peach: 'bg-peach border border-[#1D9E4B]/15 flex flex-col',
    lilac: 'bg-lilac border border-[#2496ED]/15 flex flex-col',
    mint: 'bg-mint border border-[#5DAA3A]/15 flex flex-col',
    sky: 'bg-sky border border-[#3B82F6]/15 flex flex-col',
    glass: 'glass shadow-md flex flex-col',
  };

  const hoverStyles = hover
    ? 'hover:shadow-lg hover:border-text-primary/15 cursor-pointer group'
    : '';

  const CardWrapper = hover || onClick ? motion.div : 'div';
  const motionProps =
    hover || onClick
      ? {
          whileHover: { y: -4 },
          transition: { type: 'spring', stiffness: 300, damping: 26 },
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
