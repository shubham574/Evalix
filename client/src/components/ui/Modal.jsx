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
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
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
            className="fixed inset-0 z-40 bg-[#151515]/60 backdrop-blur-xs"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              transition={{ type: 'spring', damping: 28, stiffness: 360 }}
              className={`w-full ${resolvedWidth} bg-bg-surface border-[1.5px] border-border-subtle shadow-lg rounded-[20px] overflow-hidden pointer-events-auto`}
            >
              <div className="flex justify-between items-center px-6 py-4 border-b border-border-subtle bg-bg-canvas/50">
                <h3 className="text-lg font-display font-bold text-text-primary">{title}</h3>
                <button
                  onClick={onClose}
                  className="text-text-muted hover:text-text-primary transition-colors focus:outline-none p-1.5 rounded-[10px] hover:bg-surface-hover cursor-pointer"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 text-text-primary">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Modal;
