import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Menu, X, HelpCircle, ArrowUpRight } from 'lucide-react';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { cn } from '@/lib/utils';

const EASE_OUT = [0.2, 0.715, 0.205, 0.99];

/** Evalix mark — a rounded "zero-ring" with the brand gradient. */
export const EvalixMark = ({ className, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
    <defs>
      <linearGradient id="evx-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#36C267" />
        <stop offset="0.55" stopColor="#1D9E4B" />
        <stop offset="1" stopColor="#2496ED" />
      </linearGradient>
    </defs>
    <ellipse cx="12" cy="12" rx="8.2" ry="9.6" fill="none" stroke="url(#evx-g)" strokeWidth="3.6" />
    <circle cx="16.6" cy="5.6" r="2.1" fill="#FFD21E" />
  </svg>
);

/**
 * Dock — the floating bottom-centre control tray (reference: learnwithzero `.dock`).
 * Springs up on load, hides while the footer is in view.
 * `links` = [{ label, onClick | to }] for the menu sheet; `help` = string or node.
 */
const Dock = ({ links = [], help, startLabel = 'Start', className }) => {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(null); // 'menu' | 'help' | null

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const startKey = (to) => (
    <Link to={to} className="key key--ink key--lg min-w-[180px] sm:min-w-[220px]" onClick={() => setOpen(null)}>
      <Play className="size-3.5 fill-current" />
      {startLabel}
    </Link>
  );

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#F8F9FB]/60 dark:bg-black/40 backdrop-blur-md"
            onClick={() => setOpen(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key={open}
            role="dialog"
            aria-label={open === 'menu' ? 'Menu' : 'Help'}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="fixed left-1/2 -translate-x-1/2 bottom-[104px] z-[70] w-[min(92vw,420px)] rounded-[24px] bg-bg-surface p-3 shadow-lg"
          >
            {open === 'menu' ? (
              <nav aria-label="Primary Navigation" className="flex flex-col">
                {links.map((l, i) =>
                  l.to ? (
                    <Link
                      key={l.label}
                      to={l.to}
                      onClick={() => setOpen(null)}
                      className="flex items-center justify-between rounded-[16px] px-4 py-3.5 hover:bg-surface-hover"
                    >
                      <span className="font-display text-[22px] tracking-[-0.035em]">{l.label}</span>
                      <ArrowUpRight className="size-4 text-text-muted" />
                    </Link>
                  ) : (
                    <button
                      key={l.label}
                      type="button"
                      onClick={() => {
                        setOpen(null);
                        l.onClick?.();
                      }}
                      className="flex items-center justify-between rounded-[16px] px-4 py-3.5 text-left hover:bg-surface-hover cursor-pointer"
                    >
                      <span className="font-display text-[22px] tracking-[-0.035em]">{l.label}</span>
                      <span className="font-mono text-xs text-text-muted">0{i + 1}</span>
                    </button>
                  )
                )}
                <div className="grid grid-cols-2 gap-2 p-1 pt-3">
                  <SignedOut>
                    <Link to="/login" className="key key--sm" onClick={() => setOpen(null)}>Sign in</Link>
                    <Link to="/register" className="key key--sm key--green" onClick={() => setOpen(null)}>Create account</Link>
                  </SignedOut>
                  <SignedIn>
                    <Link to="/dashboard" className="key key--sm col-span-2" onClick={() => setOpen(null)}>Open dashboard</Link>
                  </SignedIn>
                </div>
              </nav>
            ) : (
              <div className="p-3 text-[15px] leading-relaxed text-text-secondary">{help}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          'fixed left-1/2 z-[80] flex items-center gap-1.5 rounded-[24px] p-1.5 glass shadow-lg',
          'transition-transform duration-[800ms] ease-[cubic-bezier(0.2,0.715,0.205,0.99)]',
          ready ? '-translate-x-1/2 translate-y-0' : '-translate-x-1/2 translate-y-[170%]',
          className
        )}
        style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <SignedIn>{startKey('/live-interview')}</SignedIn>
        <SignedOut>{startKey('/register')}</SignedOut>
        <button
          type="button"
          aria-label={open === 'menu' ? 'Close menu' : 'Open menu'}
          aria-expanded={open === 'menu'}
          onClick={() => setOpen(open === 'menu' ? null : 'menu')}
          className="key key--lg key--icon"
        >
          {open === 'menu' ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
        {help && (
          <button
            type="button"
            aria-label="Help"
            aria-expanded={open === 'help'}
            onClick={() => setOpen(open === 'help' ? null : 'help')}
            className="key key--lg key--icon text-[22px]"
          >
            {open === 'help' ? <X className="size-5" /> : <HelpCircle className="size-5" />}
          </button>
        )}
      </div>
    </>
  );
};

export default Dock;
