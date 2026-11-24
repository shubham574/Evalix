import React, { useRef, useState } from 'react';
import { motion, useSpring, useTransform, useMotionTemplate } from 'motion/react';

const TiltCard = ({ children, className = '' }) => {
  const ref = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  // Use springs for smooth interpolation
  const x = useSpring(0, { stiffness: 300, damping: 30 });
  const y = useSpring(0, { stiffness: 300, damping: 30 });

  // Transform raw mouse values into rotation angles — kept subtle for the studio look
  const rotateX = useTransform(y, [-0.5, 0.5], ['6deg', '-6deg']);
  const rotateY = useTransform(x, [-0.5, 0.5], ['-6deg', '6deg']);

  // Glow effect positioning
  const glowX = useTransform(x, [-0.5, 0.5], ['0%', '100%']);
  const glowY = useTransform(y, [-0.5, 0.5], ['0%', '100%']);
  // Soft pastel spotlight (peach core, lilac falloff) — studio look, no dark tint
  const glowBg = useMotionTemplate`radial-gradient(420px circle at ${glowX} ${glowY}, rgba(255, 170, 130, 0.22) 0%, rgba(176, 160, 255, 0.12) 35%, transparent 65%)`;

  const handleMouseMove = (e) => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    
    // Calculate mouse position relative to card center (from -0.5 to 0.5)
    const mouseX = (e.clientX - rect.left) / rect.width - 0.5;
    const mouseY = (e.clientY - rect.top) / rect.height - 0.5;

    x.set(mouseX);
    y.set(mouseY);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1000,
      }}
      className={`relative group ${className}`}
    >
      {/* Dynamic Glowing highlight that follows the mouse */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-[inherit] z-20 transition-opacity duration-300"
        style={{
          background: glowBg,
          opacity: isHovered ? 1 : 0,
        }}
      />
      {children}
    </motion.div>
  );
};

export default TiltCard;
