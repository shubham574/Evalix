import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Volume2 } from 'lucide-react';
import { EvalixOrb } from '../ui/EvalixOrb';
import { cn } from '@/lib/utils';

const EASE_OUT = [0.2, 0.715, 0.205, 0.99];

/**
 * Speaker badge — Shristi's orb with a small audio chip, set inline with headlines
 * (reference: the presenter avatar with a speaker badge after each heading).
 */
export const Speaker = ({ className, state = 'speaking', size = 'md' }) => (
  <span className={cn('relative inline-flex align-middle', className)}>
    <EvalixOrb state={state} size={size} glow={false} />
    <span className="absolute -right-1 -bottom-1 inline-flex size-5 items-center justify-center rounded-full bg-[#0F0F0F] text-white ring-2 ring-bg-canvas">
      <Volume2 className="size-3" />
    </span>
  </span>
);

/**
 * Say — centred section headline with the speaker badge, revealing word by word.
 * (reference: `.say` — weight 400, -0.04em, balanced.)
 */
export const Say = ({ children, words, after, className, as: Tag = 'h2', speaker = true }) => {
  const list = words || String(children).split(' ');
  return (
    <Tag className={cn('heading-section text-center text-text-primary mx-auto max-w-4xl', className)}>
      {list.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom pb-[0.08em] -mb-[0.08em]">
          <motion.span
            className="inline-block"
            initial={{ y: '105%' }}
            whileInView={{ y: '0%' }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: i * 0.05 }}
          >
            {w}
            {i < list.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
      {after}
      {speaker && (
        <motion.span
          className="inline-flex ml-3 align-middle"
          initial={{ scale: 0, rotate: -20 }}
          whileInView={{ scale: 1, rotate: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1], delay: list.length * 0.05 + 0.1 }}
        >
          <Speaker />
        </motion.span>
      )}
    </Tag>
  );
};

/**
 * DrawPath — a hand-drawn connector line that draws itself as you scroll
 * (reference: the curved line linking "Learn the job by doing it" steps).
 */
export const DrawPath = ({ d, viewBox = '0 0 400 1200', className, stroke = 'currentColor' }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 60%'] });
  const len = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return (
    <svg ref={ref} viewBox={viewBox} preserveAspectRatio="none" className={cn('pointer-events-none', className)} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--line)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <motion.path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        style={{ pathLength: len }}
      />
    </svg>
  );
};
