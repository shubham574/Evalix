/*
 * Gamification + interaction primitives, modelled on behaviour recovered from the reference
 * bundles with `rea analyze-javascript-application` (see docs/design-system.md):
 *   - learnwithzero `award(kind, el, xp, label)` + `.xpm__arc` XP meter      → awardXP / XPPill
 *   - why.zero `_attachHoldMode` / `_handleHoldTrigger` (hold-to-advance)     → HoldKey
 *   - why.zero `_updateRulerNavState` / ruler segments                        → ScrollRuler
 *   - learnwithzero `zero-motion-off` sessionStorage switch                   → motion toggle
 * Re-implemented from scratch for Evalix; no reference code is copied.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scrollToId } from '@/hooks/useSmoothScroll';

// Reference easing curves (learnwithzero CustomEase "zero" / "zeroOut")
export const EASE_ZERO = [0.625, 0.05, 0, 1];
export const EASE_ZERO_OUT = [0.16, 1, 0.3, 1];

// ─── XP store ────────────────────────────────────────────────────────────────
const XP_KEY = 'evalix:xp';
const AWARDED_KEY = 'evalix:xp-awarded';
const safeGet = (k, d) => {
  try {
    const v = localStorage.getItem(k);
    return v == null ? d : JSON.parse(v);
  } catch {
    return d;
  }
};
const safeSet = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable — XP stays in-memory */
  }
};

/** Award XP once per `id`. Emits `evalix:xp` so any XPPill updates and toasts. */
export const awardXP = (id, amount, label) => {
  const awarded = safeGet(AWARDED_KEY, []);
  if (awarded.includes(id)) return false;
  const total = safeGet(XP_KEY, 0) + amount;
  safeSet(XP_KEY, total);
  safeSet(AWARDED_KEY, [...awarded, id]);
  window.dispatchEvent(new CustomEvent('evalix:xp', { detail: { total, amount, label } }));
  return true;
};

const LEVEL = 250; // XP per level — the arc fills toward the next level

/** Top-right XP meter with an arc, plus a toast above the dock for each award. */
export const XPPill = ({ className }) => {
  const [total, setTotal] = useState(() => safeGet(XP_KEY, 0));
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const on = (e) => {
      setTotal(e.detail.total);
      setToast({ ...e.detail, key: Date.now() });
    };
    window.addEventListener('evalix:xp', on);
    return () => window.removeEventListener('evalix:xp', on);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const pct = (total % LEVEL) / LEVEL;
  const C = 2 * Math.PI * 9;

  return (
    <>
      <span
        className={cn('key key--sm gap-2 !px-3 tabular-nums', className)}
        title={`Level ${Math.floor(total / LEVEL) + 1} · ${LEVEL - (total % LEVEL)} XP to next level`}
      >
        <svg width="22" height="22" viewBox="0 0 22 22" className="-rotate-90" aria-hidden="true">
          <circle cx="11" cy="11" r="9" fill="none" stroke="var(--line)" strokeWidth="2.5" />
          <motion.circle
            cx="11" cy="11" r="9" fill="none" stroke="#FFD21E" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={C}
            animate={{ strokeDashoffset: C - pct * C }}
            transition={{ duration: 0.8, ease: EASE_ZERO_OUT }}
          />
        </svg>
        <motion.span key={total} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4, ease: EASE_ZERO_OUT }}>
          {total}
        </motion.span>
        <span className="text-text-muted">XP</span>
      </span>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            role="status"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.5, ease: EASE_ZERO_OUT }}
            className="fixed left-1/2 -translate-x-1/2 bottom-[96px] z-[85] inline-flex items-center gap-2 rounded-full glass shadow-md pl-2 pr-4 h-10 text-[14px]"
          >
            <span className="inline-flex h-7 items-center gap-1 rounded-full bg-[#FFD21E] px-2.5 text-[13px] text-[#0F0F0F]">
              <Sparkles className="size-3.5" /> +{toast.amount}
            </span>
            {toast.label}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ─── Hold key ────────────────────────────────────────────────────────────────
/**
 * Press-and-hold control. Progress is driven per frame; letting go within 500ms keeps part of
 * the progress (same "resume" grace as the reference hold mode). Keyboard: hold Space/Enter.
 */
export const HoldKey = ({ duration = 1.6, onComplete, label = 'Hold to answer', doneLabel = 'Nice answer', className }) => {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const raf = useRef(null);
  const start = useRef(0);
  const releasedAt = useRef(0);
  const keptProgress = useRef(0);
  const holding = useRef(false);

  const tick = useCallback(() => {
    if (!holding.current) return;
    const p = Math.min((performance.now() - start.current) / 1000 / duration, 1);
    setProgress(p);
    if (p >= 1) {
      holding.current = false;
      setDone(true);
      onComplete?.();
      return;
    }
    raf.current = requestAnimationFrame(tick);
  }, [duration, onComplete]);

  const begin = (e) => {
    if (holding.current || done) return;
    e?.preventDefault?.();
    holding.current = true;
    const now = performance.now();
    const since = now - releasedAt.current;
    const resume = releasedAt.current && since < 500 ? keptProgress.current * (1 - since / 500) : 0;
    start.current = now - resume * duration * 1000;
    raf.current = requestAnimationFrame(tick);
  };
  const end = () => {
    if (!holding.current) return;
    holding.current = false;
    cancelAnimationFrame(raf.current);
    keptProgress.current = progress;
    releasedAt.current = performance.now();
    setProgress(0);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <button
      type="button"
      aria-label={done ? doneLabel : label}
      aria-pressed={done}
      onPointerDown={begin}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && begin(e)}
      onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && end()}
      onContextMenu={(e) => e.preventDefault()}
      className={cn('group relative inline-flex flex-col items-center gap-3 select-none touch-none cursor-pointer', className)}
    >
      <span className="relative inline-flex size-[84px] items-center justify-center">
        {/* ripples while holding */}
        {progress > 0 && !done &&
          [0, 1].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full ring-2 ring-[#36C267]"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
            />
          ))}
        <svg width="84" height="84" viewBox="0 0 84 84" className="absolute inset-0 -rotate-90" aria-hidden="true">
          <circle cx="42" cy="42" r={R} fill="none" stroke="var(--line)" strokeWidth="4" />
          <circle
            cx="42" cy="42" r={R} fill="none" stroke="#1D9E4B" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C - (done ? 1 : progress) * C}
          />
        </svg>
        <span
          className={cn(
            'relative inline-flex size-[62px] items-center justify-center rounded-full transition-transform duration-150',
            done ? 'key--green' : 'key--ink',
            progress > 0 && !done && 'scale-95'
          )}
        >
          <Mic className="size-6" />
        </span>
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-secondary">{done ? doneLabel : label}</span>
    </button>
  );
};

// ─── Scroll ruler ────────────────────────────────────────────────────────────
/** Top-centre ruler that tracks scroll progress and jumps between sections. */
export const ScrollRuler = ({ sections, className }) => {
  const [p, setP] = useState(0);
  const [active, setActive] = useState(null);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      setP(max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0);
      let cur = null;
      for (const s of sections) {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top < innerHeight * 0.45) cur = s.id;
      }
      setActive(cur);
      // Per-stage reward, as why.zero awards XP for each ruler stage reached
      if (cur) {
        const s = sections.find((x) => x.id === cur);
        awardXP(`stage-${cur}`, 20, `Reached ${s?.label || cur}`);
      }
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, [sections]);

  const ticks = 41;
  return (
    <nav aria-label="Page progress" className={cn('fixed left-1/2 top-3 z-[55] -translate-x-1/2 hidden lg:flex flex-col items-center', className)}>
      <div className="relative flex items-end gap-[5px] h-4">
        {Array.from({ length: ticks }).map((_, i) => (
          <span
            key={i}
            className="w-px rounded-full bg-text-primary transition-opacity duration-300"
            style={{ height: i % 10 === 0 ? 14 : i % 5 === 0 ? 10 : 6, opacity: i / (ticks - 1) <= p ? 0.75 : 0.18 }}
          />
        ))}
        <motion.span
          className="absolute -bottom-1 h-[22px] w-[2px] rounded-full bg-[#1D9E4B]"
          animate={{ left: `${p * 100}%` }}
          transition={{ duration: 0.3, ease: EASE_ZERO_OUT }}
        />
      </div>
      <div className="mt-1.5 flex gap-3 font-mono text-[10px] uppercase tracking-[0.1em]">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollToId(s.id)}
            className={cn('cursor-pointer transition-colors', active === s.id ? 'text-text-primary' : 'text-text-muted hover:text-text-primary')}
          >
            {s.label}
          </button>
        ))}
      </div>
    </nav>
  );
};

// ─── Motion toggle ───────────────────────────────────────────────────────────
const MOTION_KEY = 'evalix-motion-off';
export const isMotionOff = () => {
  try {
    return sessionStorage.getItem(MOTION_KEY) === '1';
  } catch {
    return false;
  }
};
/** Flip the motion setting and reload so every animation system re-reads it (reference behaviour). */
export const toggleMotion = () => {
  try {
    sessionStorage.setItem(MOTION_KEY, isMotionOff() ? '' : '1');
  } catch {
    /* ignore */
  }
  location.reload();
};
