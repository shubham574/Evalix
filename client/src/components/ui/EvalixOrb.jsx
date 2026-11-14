import React from 'react';
import { motion } from 'motion/react';

/**
 * EvalixOrb — The distinctive AI eye-orb / assistant character for Evalix.
 * Supports states: 'idle' | 'speaking' | 'listening' | 'thinking' | 'evaluating'
 */
export const EvalixOrb = ({
  state = 'idle',
  size = 'md',
  className = '',
  showLabel = false,
}) => {
  const sizeMap = {
    sm: 'w-9 h-9',
    md: 'w-14 h-14',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32',
  };

  const stateConfig = {
    idle: {
      ring: '#FF6B35',
      pupil: '#C7F36B',
      label: 'Ready',
      badgeBg: 'bg-[#FF6B35]/15 text-[#FF6B35] border-[#FF6B35]/30',
    },
    speaking: {
      ring: '#FF6B35',
      pupil: '#FF6B35',
      label: 'AI Speaking',
      badgeBg: 'bg-[#FF6B35]/20 text-[#FF6B35] border-[#FF6B35]/40',
    },
    listening: {
      ring: '#C7F36B',
      pupil: '#C7F36B',
      label: 'Listening',
      badgeBg: 'bg-[#C7F36B]/20 text-[#C7F36B] border-[#C7F36B]/40',
    },
    thinking: {
      ring: '#8174FF',
      pupil: '#8174FF',
      label: 'Thinking',
      badgeBg: 'bg-[#8174FF]/20 text-[#8174FF] border-[#8174FF]/40',
    },
    evaluating: {
      ring: '#8174FF',
      pupil: '#C7F36B',
      label: 'Evaluating',
      badgeBg: 'bg-[#8174FF]/20 text-[#C7F36B] border-[#8174FF]/40',
    },
  };

  const current = stateConfig[state] || stateConfig.idle;

  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
      <div className={`relative flex items-center justify-center ${sizeMap[size] || sizeMap.md}`}>
        {/* Outer tactile orbit ring */}
        <motion.div
          animate={
            state === 'speaking'
              ? { scale: [1, 1.12, 1], rotate: [0, 8, -8, 0] }
              : state === 'listening'
              ? { scale: [1, 1.08, 1] }
              : state === 'thinking' || state === 'evaluating'
              ? { rotate: 360 }
              : { scale: [1, 1.03, 1] }
          }
          transition={
            state === 'thinking' || state === 'evaluating'
              ? { repeat: Infinity, duration: 4, ease: 'linear' }
              : { repeat: Infinity, duration: state === 'speaking' ? 1.1 : 2.4, ease: 'easeInOut' }
          }
          className="absolute inset-0 rounded-full border-2 border-dashed"
          style={{ borderColor: current.ring }}
        />

        {/* Core Ink Black sphere */}
        <div className="relative w-[82%] h-[82%] rounded-full bg-[#151515] border-2 border-[#2E2E2E] flex items-center justify-center overflow-hidden shadow-md">
          {/* Subtle top highlight */}
          <div className="absolute top-1.5 left-1/4 w-1/2 h-1.5 rounded-full bg-white/10" />

          {/* Expressive AI Twin-Eye / Visor */}
          <motion.div
            animate={
              state === 'speaking'
                ? { scaleY: [1, 0.35, 1.15, 0.5, 1] }
                : state === 'listening'
                ? { x: [-2, 2, -2], scale: [1, 1.08, 1] }
                : state === 'thinking'
                ? { y: [-2, 2, -2], rotate: [0, 10, -10, 0] }
                : { scaleY: [1, 1, 0.15, 1, 1] }
            }
            transition={{
              repeat: Infinity,
              duration: state === 'speaking' ? 0.75 : state === 'idle' ? 4 : 1.6,
              ease: 'easeInOut',
            }}
            className="flex items-center gap-1.5"
          >
            <span
              className="block rounded-full transition-colors duration-300"
              style={{
                width: size === 'sm' ? '5px' : size === 'lg' || size === 'xl' ? '10px' : '7px',
                height: size === 'sm' ? '9px' : size === 'lg' || size === 'xl' ? '18px' : '12px',
                backgroundColor: current.pupil,
              }}
            />
            <span
              className="block rounded-full transition-colors duration-300"
              style={{
                width: size === 'sm' ? '5px' : size === 'lg' || size === 'xl' ? '10px' : '7px',
                height: size === 'sm' ? '9px' : size === 'lg' || size === 'xl' ? '18px' : '12px',
                backgroundColor: current.pupil,
              }}
            />
          </motion.div>
        </div>
      </div>

      {showLabel && (
        <span
          className={`px-2.5 py-0.5 rounded-[8px] text-[11px] font-mono uppercase tracking-wider font-semibold border ${current.badgeBg}`}
        >
          {current.label}
        </span>
      )}
    </div>
  );
};

/**
 * EvalixStarburst — Minimal geometric starburst accent for editorial headings & badges
 */
export const EvalixStarburst = ({ className = 'w-5 h-5 text-[#FF6B35]' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 1L14.39 8.26L21.5 5.5L16.74 11.61L24 14L16.74 16.39L21.5 22.5L14.39 19.74L12 24L9.61 19.74L2.5 22.5L7.26 16.39L0 14L7.26 11.61L2.5 5.5L9.61 8.26L12 1Z" />
  </svg>
);

export default EvalixOrb;
