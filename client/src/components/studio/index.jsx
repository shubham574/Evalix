/* Evalix studio primitives — small, composable pieces used across marketing & app pages. */
import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue, useSpring, useTransform, animate } from 'motion/react';
import { cn } from '@/lib/utils';

const EASE = [0.22, 1, 0.36, 1];

/** Small uppercase mono label, optionally with a leading index like "01". */
export const Eyebrow = ({ index, children, className, dot = false }) => (
  <span className={cn('eyebrow inline-flex items-center gap-2.5', className)}>
    {dot && <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E4B]" />}
    {index && <span className="text-[#1D9E4B]">{index}</span>}
    {index && <span className="w-6 h-px bg-border-subtle" />}
    <span>{children}</span>
  </span>
);

/** Fade + rise when scrolled into view. */
export const Reveal = ({ children, delay = 0, y = 28, className, as = 'div', once = true }) => {
  const Comp = motion[as] || motion.div;
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-80px' }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
};

/** Masked line-by-line headline reveal. Pass an array of lines (strings or nodes). */
export const SplitHeadline = ({ lines, className, lineClassName, delay = 0, as = 'h2' }) => {
  const Tag = as;
  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
          <motion.span
            className={cn('block', lineClassName)}
            initial={{ y: '105%' }}
            whileInView={{ y: '0%' }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 1.05, ease: EASE, delay: delay + i * 0.09 }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
};

/** Infinite horizontal marquee. Children are duplicated for a seamless loop. */
export const Marquee = ({ children, className, speed = 38, reverse = false, pauseOnHover = true }) => (
  <div className={cn('group relative flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]', className)}>
    {[0, 1].map((k) => (
      <div
        key={k}
        aria-hidden={k === 1}
        className={cn(
          'flex shrink-0 items-center gap-[inherit] min-w-full justify-around animate-marquee',
          pauseOnHover && 'group-hover:[animation-play-state:paused]'
        )}
        style={{ animationDuration: `${speed}s`, animationDirection: reverse ? 'reverse' : 'normal' }}
      >
        {children}
      </div>
    ))}
  </div>
);

/** Count up to a number when it enters the viewport. */
export const NumberTicker = ({ value = 0, decimals = 0, duration = 1.6, className, suffix = '', prefix = '' }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return undefined;
    const controls = animate(0, Number(value) || 0, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
};

/** Card that tilts subtly and shows a soft spotlight following the cursor. */
export const SpotlightCard = ({ children, className, tint = 'rgba(29,158,75,0.10)' }) => {
  const ref = useRef(null);
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const rx = useSpring(useTransform(my, [0, 100], [3, -3]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 100], [-3, 3]), { stiffness: 200, damping: 20 });
  const bg = useTransform([mx, my], ([x, y]) => `radial-gradient(420px circle at ${x}% ${y}%, ${tint}, transparent 60%)`);

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 100);
    my.set(((e.clientY - r.top) / r.height) * 100);
  };
  const onLeave = () => {
    mx.set(50);
    my.set(50);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1200 }}
      className={cn('relative overflow-hidden rounded-[28px] border border-border-subtle bg-card shadow-sm', className)}
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: bg }} />
      <div className="relative">{children}</div>
    </motion.div>
  );
};

/** Animated pastel mesh "aura" blob background. Place inside a relative container. */
export const Aura = ({ className, intensity = 1 }) => (
  <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
    <div
      className="absolute -inset-[15%] animate-aura"
      style={{ background: 'var(--aura)', opacity: intensity, filter: 'blur(30px)' }}
    />
  </div>
);

/** Soft circular score dial. */
export const ScoreRing = ({ value = 0, size = 120, stroke = 8, color = '#1D9E4B', track = 'var(--bg-elevated)', children, className }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c - (pct / 100) * c }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
};

/** Section page header for app pages: eyebrow + big title + optional description and actions. */
export const PageHeader = ({ eyebrow, title, accent, description, actions, className }) => (
  <header className={cn('flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between pt-6 pb-10', className)}>
    <div className="max-w-3xl space-y-4">
      {eyebrow && <Eyebrow dot>{eyebrow}</Eyebrow>}
      <h1 className="heading-page text-text-primary text-balance">
        {title}
        {accent && (
          <>
            {' '}
            <span className="serif italic text-[#1D9E4B]">{accent}</span>
          </>
        )}
      </h1>
      {description && <p className="text-[15px] sm:text-base text-text-secondary leading-relaxed max-w-2xl text-pretty">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
  </header>
);
