import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const Preloader = ({ onComplete }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Wait a brief moment to show the loader, then exit
    const timer = setTimeout(() => {
      setIsLoaded(true);
      setTimeout(onComplete, 1500); // Wait for exit animation to complete before removing
    }, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  // Staggered text animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.5, delay: 0.5 },
    },
  };

  const letterVariants = {
    hidden: { y: 100, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1], // easeOutExpo
      },
    },
  };

  const slideUpVariants = {
    hidden: { y: '0%' },
    exit: {
      y: '-100%',
      transition: {
        duration: 1.2,
        ease: [0.76, 0, 0.24, 1], // custom elegant ease
      },
    },
  };

  const brandName = "Evalix";

  return (
    <AnimatePresence>
      {!isLoaded && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-bg-canvas flex items-center justify-center overflow-hidden"
          variants={slideUpVariants}
          initial="hidden"
          exit="exit"
        >
          {/* Subtle glowing background orb */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1.2, opacity: 0.5 }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className="w-[50vw] h-[50vw] bg-accent-primary/20 rounded-full blur-[100px]"
            />
          </div>

          <motion.div
            className="relative flex overflow-hidden"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {brandName.split('').map((char, index) => (
              <motion.span
                key={index}
                className="text-5xl md:text-7xl font-bold font-display text-text-primary"
                variants={letterVariants}
              >
                {char}
              </motion.span>
            ))}
            <motion.div 
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.5, delay: 1, ease: "easeInOut" }}
              className="absolute -bottom-2 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-accent-primary to-transparent origin-left"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Preloader;
