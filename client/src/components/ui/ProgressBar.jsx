import React from 'react';
import { motion } from 'motion/react';

const ProgressBar = ({ progress = 0, label, showValue = true, colorClass = 'bg-primary' }) => {
  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-2 text-[13px] font-medium">
          {label && <span className="text-text-secondary">{label}</span>}
          {showValue && <span className="text-text-primary tabular-nums">{progress}%</span>}
        </div>
      )}
      <div className="w-full bg-bg-elevated rounded-full h-1.5 overflow-hidden">
        <motion.div
          className={`h-full ${colorClass} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
