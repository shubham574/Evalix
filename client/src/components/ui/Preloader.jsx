import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const Preloader = ({ onComplete }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoaded(true);
      setTimeout(onComplete, 900);
    }, 1200);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.15,
      },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.35, delay: 0.2 },
    },
  };

  const letterVariants = {
    hidden: { y: 60, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.55,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  const slideUpVariants = {
    hidden: { y: '0%' },
    exit: {
      y: '-100%',
      transition: {
        duration: 0.85,
        ease: [0.76, 0, 0.24, 1],
      },
    },
  };

  const brandName = 'Evalix';

  return (
    <AnimatePresence>
      {!isLoaded && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-[#151515] text-[#F8F5EF] flex flex-col items-center justify-center overflow-hidden"
          variants={slideUpVariants}
          initial="hidden"
          exit="exit"
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-block w-3 h-3 rounded-full bg-[#FF6B35]" />
            <span className="text-xs font-mono uppercase tracking-[0.2em] text-[#B5AFA6]">
              AI Interview Arena
            </span>
          </div>

          <motion.div
            className="relative flex items-baseline overflow-hidden px-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {brandName.split('').map((char, index) => (
              <motion.span
                key={index}
                className="text-5xl md:text-7xl font-bold font-display tracking-tight text-[#F8F5EF]"
                variants={letterVariants}
              >
                {char}
              </motion.span>
            ))}
            <motion.span
              variants={letterVariants}
              className="w-3.5 h-3.5 rounded-full bg-[#C7F36B] ml-1.5 inline-block"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Preloader;
