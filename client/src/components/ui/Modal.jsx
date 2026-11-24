import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FiX } from 'react-icons/fi';

const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md', size }) => {
  const sizeMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };
  const resolvedWidth = size ? (sizeMap[size] || maxWidth) : maxWidth;

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-[#F8F9FB]/55 dark:bg-black/50 backdrop-blur-md"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.97, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 30, stiffness: 340 }}
              role="dialog"
              aria-modal="true"
              className={`w-full ${resolvedWidth} bg-bg-surface border border-border-subtle shadow-lg rounded-[28px] overflow-hidden pointer-events-auto`}
            >
              <div className="flex justify-between items-center px-7 pt-6 pb-4">
                <h3 className="text-xl font-display font-normal tracking-[-0.03em] text-text-primary">{title}</h3>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-9 h-9 inline-flex items-center justify-center rounded-full text-text-muted hover:text-text-primary bg-bg-elevated hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>
              <div className="px-7 pb-7 text-text-primary">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Modal;
