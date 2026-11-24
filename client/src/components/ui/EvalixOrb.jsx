import React from 'react';
import { motion } from 'motion/react';

/**
 * EvalixOrb — the AI interviewer's presence: an iridescent glass sphere with two soft "eyes".
 * States: 'idle' | 'speaking' | 'listening' | 'thinking' | 'evaluating'
 */
export const EvalixOrb = ({
  state = 'idle',
  size = 'md',
  className = '',
  showLabel = false,
  glow = true,
}) => {
  const sizeMap = {
    sm: 'w-9 h-9',
    md: 'w-14 h-14',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
  };

  const stateConfig = {
    idle: {
      gradient: 'conic-gradient(from 210deg, #7FE0A4, #D8F5E2, #BFE0FF, #4FA8F0, #7FE0A4)',
      glow: 'rgba(54,194,103,0.32)',
      label: 'Ready',
      badge: 'bg-peach text-[#167A3A]',
    },
    speaking: {
      gradient: 'conic-gradient(from 0deg, #1D9E4B, #7FE0A4, #E9FBEF, #36C267, #1D9E4B)',
      glow: 'rgba(29,158,75,0.45)',
      label: 'AI speaking',
      badge: 'bg-peach text-[#167A3A]',
    },
    listening: {
      gradient: 'conic-gradient(from 90deg, #2496ED, #BFE0FF, #9BE3D0, #36C267, #2496ED)',
      glow: 'rgba(36,150,237,0.4)',
      label: 'Listening',
      badge: 'bg-sky text-[#1D6FB8]',
    },
    thinking: {
      gradient: 'conic-gradient(from 120deg, #2496ED, #BFE0FF, #FFE68A, #2496ED)',
      glow: 'rgba(36,150,237,0.4)',
      label: 'Thinking',
      badge: 'bg-sky text-[#1D6FB8]',
    },
    evaluating: {
      gradient: 'conic-gradient(from 300deg, #1D9E4B, #FFD21E, #BFE0FF, #2496ED, #1D9E4B)',
      glow: 'rgba(255,210,30,0.35)',
      label: 'Evaluating',
      badge: 'bg-butter text-[#8A6400]',
    },
  };

  const current = stateConfig[state] || stateConfig.idle;
  const eyeW = size === 'sm' ? 4 : size === 'lg' || size === 'xl' ? 9 : 6;
  const eyeH = size === 'sm' ? 8 : size === 'lg' || size === 'xl' ? 17 : 11;
  const spinning = state === 'thinking' || state === 'evaluating';

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className={`relative flex items-center justify-center ${sizeMap[size] || sizeMap.md}`}>
        {/* Soft outer glow */}
        {glow && <motion.div
          className="absolute inset-[-18%] rounded-full blur-xl"
          style={{ background: current.glow }}
          animate={{ scale: state === 'speaking' ? [1, 1.25, 1] : [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ repeat: Infinity, duration: state === 'speaking' ? 1 : 2.8, ease: 'easeInOut' }}
        />}

        {/* Iridescent sphere */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: current.gradient }}
          animate={spinning ? { rotate: 360 } : { rotate: [0, 25, 0] }}
          transition={spinning ? { repeat: Infinity, duration: 5, ease: 'linear' } : { repeat: Infinity, duration: 6, ease: 'easeInOut' }}
        />
        {/* Glass shading + highlight */}
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_26%,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.25)_28%,transparent_55%)]" />
        <div className="absolute inset-0 rounded-full shadow-[inset_0_-6px_14px_rgba(10,60,40,0.18),inset_0_2px_6px_rgba(255,255,255,0.6)]" />

        {/* Eyes */}
        <motion.div
          animate={
            state === 'speaking'
              ? { scaleY: [1, 0.4, 1.1, 0.55, 1] }
              : state === 'listening'
              ? { x: [-1.5, 1.5, -1.5] }
              : state === 'thinking'
              ? { y: [-1.5, 1.5, -1.5] }
              : { scaleY: [1, 1, 0.12, 1, 1] }
          }
          transition={{ repeat: Infinity, duration: state === 'speaking' ? 0.75 : state === 'idle' ? 4 : 1.6, ease: 'easeInOut' }}
          className="relative flex items-center"
          style={{ gap: eyeW + 1 }}
        >
          {[0, 1].map((i) => (
            <span
              key={i}
              className="block rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]"
              style={{ width: eyeW, height: eyeH }}
            />
          ))}
        </motion.div>
      </div>

      {showLabel && (
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${current.badge}`}>
          {current.label}
        </span>
      )}
    </div>
  );
};

/** EvalixStarburst — small geometric accent for headings & badges */
export const EvalixStarburst = ({ className = 'w-5 h-5 text-[#1D9E4B]' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 1L14.39 8.26L21.5 5.5L16.74 11.61L24 14L16.74 16.39L21.5 22.5L14.39 19.74L12 24L9.61 19.74L2.5 22.5L7.26 16.39L0 14L7.26 11.61L2.5 5.5L9.61 8.26L12 1Z" />
  </svg>
);

export default EvalixOrb;
