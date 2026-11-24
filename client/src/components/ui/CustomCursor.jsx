import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'motion/react';

const CustomCursor = () => {
  const location = useLocation();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updatePosition = (e) => {
      setPosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => setIsVisible(false);
    const handleMouseEnter = () => setIsVisible(true);
    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    const handleHoverStart = (e) => {
      const target = e.target;
      if (
        target.tagName?.toLowerCase() === 'a' ||
        target.tagName?.toLowerCase() === 'button' ||
        target.closest?.('a') ||
        target.closest?.('button') ||
        target.classList?.contains('cursor-pointer')
      ) {
        setIsHovering(true);
      }
    };

    const handleHoverEnd = () => setIsHovering(false);

    window.addEventListener('mousemove', updatePosition);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mouseenter', handleMouseEnter);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseover', handleHoverStart);
    document.addEventListener('mouseout', handleHoverEnd);

    return () => {
      window.removeEventListener('mousemove', updatePosition);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mouseenter', handleMouseEnter);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseover', handleHoverStart);
      document.removeEventListener('mouseout', handleHoverEnd);
    };
  }, [isVisible]);

  if (!isVisible || location.pathname !== '/') return null;

  return (
    <>
      <motion.div
        className={`fixed top-0 left-0 w-8 h-8 rounded-full border-[1.5px] border-[#1D9E4B]/70 pointer-events-none z-[10000] hidden lg:block transition-colors duration-300 ${isHovering ? 'bg-[#1D9E4B]/10 backdrop-blur-[2px]' : 'bg-transparent'}`}
        animate={{
          x: position.x - 16,
          y: position.y - 16,
          scale: isHovering ? 1.45 : isClicking ? 0.85 : 1,
          opacity: isHovering ? 1 : 0.85,
        }}
        transition={{
          type: 'spring',
          stiffness: 220,
          damping: 20,
          mass: 0.1,
        }}
      />
      <motion.div
        className="fixed top-0 left-0 w-2 h-2 rounded-full bg-[#1D9E4B] shadow-[0_0_0_3px_rgba(29,158,75,0.18)] pointer-events-none z-[10000] hidden lg:block"
        animate={{
          x: position.x - 4,
          y: position.y - 4,
          scale: isHovering ? 0 : isClicking ? 0.6 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 350,
          damping: 22,
          mass: 0.1,
        }}
      />
    </>
  );
};

export default CustomCursor;
