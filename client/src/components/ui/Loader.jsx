import React from 'react';
import { motion } from 'motion/react';

const dotSizes = { sm: 6, md: 9, lg: 12 };

const Loader = ({ fullScreen = false, size = 'md', label = '', text = '' }) => {
  const caption = label || text;
  const d = dotSizes[size] || dotSizes.md;

  const spinner = (
    <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {['#1D9E4B', '#2496ED', '#8BC34A'].map((c, i) => (
          <motion.span
            key={c}
            className="rounded-full"
            style={{ width: d, height: d, backgroundColor: c }}
            animate={{ y: [0, -d, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.14, ease: 'easeInOut' }}
          />
        ))}
      </div>
      {caption ? (
        <span className="text-[13px] font-medium text-text-secondary tracking-[-0.01em]">{caption}</span>
      ) : (
        <span className="sr-only">Loading</span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-bg-canvas/85 backdrop-blur-md flex items-center justify-center z-50">
        {spinner}
      </div>
    );
  }

  return <div className="flex justify-center items-center p-6">{spinner}</div>;
};

export default Loader;
