import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { Mic, FileText, ListChecks, Sparkles, Code2, Database, Network, Users } from 'lucide-react';
import { EvalixOrb } from '../ui/EvalixOrb';
import { EASE_ZERO_OUT } from './Gamify';
import { cn } from '@/lib/utils';

/**
 * SkyScene — Evalix's take on why.zero.university's stage art: a mint→aqua sky with god-rays,
 * calligraphic teal-gradient words set asymmetrically against small sans words
 * ("College would land You" → "Practice would land You the offer"), and white "coins"
 * orbiting the central figure (their 3D hand → Shristi's orb).
 */
const COINS = [
  { icon: Mic, x: -320, y: -120, r: -18, d: 0 },
  { icon: Code2, x: -250, y: 120, r: 12, d: 0.4 },
  { icon: Database, x: -130, y: 230, r: -8, d: 0.8 },
  { icon: FileText, x: 260, y: -160, r: 16, d: 0.2 },
  { icon: Network, x: 330, y: 60, r: -12, d: 0.6 },
  { icon: ListChecks, x: 170, y: 220, r: 10, d: 1 },
  { icon: Users, x: -40, y: -250, r: 6, d: 1.2 },
  { icon: Sparkles, x: 90, y: -240, r: -10, d: 1.4 },
];

const Calli = ({ children, className }) => (
  <span
    className={cn('serif italic leading-[0.85] tracking-[-0.03em] bg-clip-text text-transparent', className)}
    style={{ backgroundImage: 'linear-gradient(180deg, #6FAE9C 0%, #2F6E5E 55%, #1C4839 100%)' }}
  >
    {children}
  </span>
);

const SkyScene = ({ children, id, className }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const leftX = useTransform(scrollYProgress, [0, 1], ['-6%', '4%']);
  const rightX = useTransform(scrollYProgress, [0, 1], ['6%', '-4%']);
  const orbit = useTransform(scrollYProgress, [0, 1], [-12, 12]);

  return (
    <section
      ref={ref}
      id={id}
      aria-label="Capabilities"
      className={cn('relative overflow-hidden', className)}
      style={{ background: 'linear-gradient(180deg, #F8F9FB 0%, #E3F5EF 18%, #C6EBE1 55%, #A6DCCF 100%)' }}
    >
      {/* god-rays from the top right */}
      <div
        aria-hidden
        className="absolute -top-1/3 -right-1/4 h-[160%] w-[100%] opacity-90 blur-xl"
        style={{
          background:
            'repeating-conic-gradient(from 195deg at 82% 0%, rgba(255,255,255,0.95) 0deg 5deg, rgba(255,255,255,0) 5deg 12deg)',
          maskImage: 'radial-gradient(70% 70% at 80% 0%, #000 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(70% 70% at 80% 0%, #000 0%, transparent 75%)',
        }}
      />
      {/* bloom */}
      <div aria-hidden className="absolute left-1/2 top-[34%] -translate-x-1/2 size-[520px] rounded-full bg-white/70 blur-3xl" />

      {/* stage */}
      <div className="relative mx-auto h-[760px] sm:h-[820px] max-w-[1320px] px-5">
        {/* calligraphic composition */}
        <motion.div style={{ x: leftX }} className="absolute left-5 sm:left-10 top-[90px] sm:top-[110px]">
          <h2 className="text-left">
            <Calli className="block text-[clamp(4.5rem,12vw,10.5rem)]">Practice</Calli>
            <span className="block -mt-2 pl-[22%] font-display text-[clamp(1.4rem,2.6vw,2.4rem)] tracking-[-0.04em] text-[#2F6E5E]">would</span>
          </h2>
        </motion.div>
        <motion.div style={{ x: rightX }} className="absolute right-5 sm:right-10 bottom-[130px] text-right">
          <span className="block pr-[8%] font-display text-[clamp(1.4rem,2.6vw,2.4rem)] tracking-[-0.04em] text-[#2F6E5E]">land</span>
          <Calli className="block text-[clamp(5rem,13vw,11.5rem)]">You</Calli>
          <span className="block -mt-1 font-display text-[clamp(1.1rem,1.8vw,1.6rem)] tracking-[-0.03em] text-[#2F6E5E]/80">the offer.</span>
        </motion.div>

        {/* central figure + orbiting coins */}
        <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2">
          <motion.div style={{ rotate: orbit }} className="relative">
            {COINS.map(({ icon: Icon, x, y, r, d }, i) => (
              <motion.span
                key={i}
                className={cn('absolute left-0 top-0', i > 5 && 'hidden sm:block')}
                style={{ x: x * 0.85, y: y * 0.85 }}
                initial={{ opacity: 0, scale: 0.6 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease: EASE_ZERO_OUT, delay: 0.1 + i * 0.06 }}
              >
                <motion.span
                  className="-ml-7 -mt-7 inline-flex size-14 items-center justify-center rounded-full bg-white text-[#2F6E5E] shadow-[inset_0_-4px_0_rgba(0,0,0,0.06),0_14px_24px_-12px_rgba(28,72,57,0.45)]"
                  style={{ rotate: r, rotateX: 28 }}
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4 + (i % 3), repeat: Infinity, ease: 'easeInOut', delay: d }}
                >
                  <Icon className="size-6" />
                </motion.span>
              </motion.span>
            ))}
          </motion.div>
          <EvalixOrb state="speaking" size="xl" className="scale-[1.35]" />
        </div>
      </div>

      {children}
    </section>
  );
};

export default SkyScene;
