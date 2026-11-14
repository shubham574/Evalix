import React from 'react';
import { motion } from 'motion/react';

const Loader = ({ fullScreen = false, size = 'md', label = '' }) => {
  const sizes = {
    sm: 'w-5 h-5 border-2',
    md: 'w-9 h-9 border-3',
    lg: 'w-14 h-14 border-4',
  };

  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.85, ease: 'linear' }}
        className={`${sizes[size] || sizes.md} rounded-full border-border-subtle border-t-[#FF6B35]`}
      />
      {label && (
        <span className="text-xs font-display font-medium text-text-secondary tracking-wide">
          {label}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-bg-canvas/90 backdrop-blur-xs flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return <div className="flex justify-center items-center p-4">{spinner}</div>;
};

export default Loader;
