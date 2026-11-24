import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Aura } from '../studio';

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
          className="fixed inset-0 z-[9999] bg-bg-canvas text-text-primary flex flex-col items-center justify-center overflow-hidden isolate"
          variants={slideUpVariants}
          initial="hidden"
          exit="exit"
        >
          <Aura intensity={0.85} />

          <div className="relative flex items-center gap-2.5 mb-5 glass shadow-xs rounded-full px-4 py-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#1D9E4B] animate-pulse-soft" />
            <span className="eyebrow">AI Interview Arena</span>
          </div>

          <motion.div
            className="relative flex items-baseline overflow-hidden px-4 pb-2"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {brandName.split('').map((char, index) => (
              <motion.span
                key={index}
                className="text-6xl md:text-8xl font-normal font-display tracking-[-0.05em] text-text-primary"
                variants={letterVariants}
              >
                {char}
              </motion.span>
            ))}
            <motion.span
              variants={letterVariants}
              className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-[conic-gradient(from_200deg,#1D9E4B,#8FDDAA,#2496ED,#C7F36B,#1D9E4B)] ml-2 inline-block"
            />
          </motion.div>

          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="relative serif italic text-xl md:text-2xl text-text-secondary mt-1"
          >
            practice out loud.
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Preloader;
