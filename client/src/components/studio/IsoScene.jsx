import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * IsoScene — a misty isometric "campus" of practice-track blocks.
 * Evalix's stand-in for the reference's 3D city: pure CSS 3D, no assets.
 * `vivid` renders full colour (finale); otherwise the scene sits under white fog.
 */
const N = 9; // grid size
const LABELS = {
  '1,1': 'React', '3,1': 'APIs', '6,1': 'Kafka', '2,3': 'System design', '6,3': 'Voice', '4,4': 'Evalix',
  '1,5': 'DSA', '7,5': 'Resume', '3,6': 'Node.js', '5,7': 'SQL', '2,7': 'Behavioral', '7,7': 'MCQ',
};
const TINTS = ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#E6F4EA', '#E6F0FB', '#FFF6D6', '#FFFFFF', '#E6F4EA'];
// Deterministic pseudo-random so the skyline is stable between renders
const rand = (i) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const BLOCKS = [];
for (let r = 0; r < N; r += 1) {
  for (let c = 0; c < N; c += 1) {
    const i = r * N + c;
    const label = LABELS[`${c},${r}`] || '';
    if (!label && rand(i + 7) < 0.18) continue; // leave some plazas empty
    const dist = Math.hypot(c - 4, r - 4);
    const h = label === 'Evalix' ? 230 : Math.round(30 + rand(i) * 140 * (1 - dist / 9));
    const color = label ? TINTS[(c + r) % TINTS.length] === '#FFFFFF' ? '#E6F4EA' : TINTS[(c + r) % TINTS.length] : TINTS[Math.floor(rand(i + 3) * TINTS.length)];
    BLOCKS.push([c, r, Math.max(24, h), label === 'Evalix' ? '#FFFFFF' : color, label]);
  }
}

const VIVID = {
  '#E6F4EA': '#36C267',
  '#E6F0FB': '#2496ED',
  '#FFF6D6': '#FFD21E',
  '#FFFFFF': '#FFFFFF',
};

const CELL = 96;

const Block = ({ c, r, h, color, label, vivid, i }) => {
  const top = vivid ? VIVID[color] || color : color;
  const side = (shade) => `color-mix(in srgb, ${top} ${shade}%, #9AA3AE)`;
  const isHero = label === 'Evalix';
  return (
    <motion.div
      className="absolute"
      style={{ left: c * CELL, top: r * CELL, width: CELL - 22, height: CELL - 22, transformStyle: 'preserve-3d' }}
      initial={{ z: 0 }}
      animate={{ z: [h, h + (i % 5 === 0 ? 10 : 3), h] }}
      transition={{ duration: 5 + (i % 4), repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 }}
    >
      {/* roof */}
      <div
        className="absolute inset-0 rounded-[14px] flex items-center justify-center"
        style={{
          background: top,
          boxShadow: isHero ? '0 0 0 3px rgba(29,158,75,0.35), 0 0 40px rgba(54,194,103,0.55)' : 'inset 0 0 0 1px rgba(15,15,15,0.06)',
        }}
      >
        {label && (
          <span
            className={cn(
              'font-display text-[13px] tracking-[-0.02em] whitespace-nowrap px-2 py-0.5 rounded-full',
              vivid && top !== '#FFFFFF' ? 'text-white' : 'text-text-secondary',
              isHero && 'text-[15px] font-medium text-[#167A3A]'
            )}
            style={{ transform: 'rotateZ(45deg)' }}
          >
            {label}
          </span>
        )}
      </div>
      {/* south face — hinged on the roof's bottom edge, folded down to the ground */}
      <div
        className="absolute left-[2px] right-[2px] rounded-b-[8px]"
        style={{ top: '100%', height: h, transformOrigin: 'top', transform: 'rotateX(-90deg)', background: side(80) }}
      />
      {/* east face — hinged on the roof's right edge, folded down to the ground */}
      <div
        className="absolute top-[2px] bottom-[2px] rounded-r-[8px]"
        style={{ left: '100%', width: h, transformOrigin: 'left', transform: 'rotateY(90deg)', background: side(64) }}
      />
    </motion.div>
  );
};

const IsoScene = ({ vivid = false, className, y = '58%', scale = 1 }) => (
  <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
    <div className="absolute left-1/2" style={{ top: `var(--iso-y, ${y})`, perspective: '2600px', transform: `scale(var(--iso-scale, ${scale}))` }}>
      <div
        style={{
          width: CELL * N,
          height: CELL * N,
          transform: 'translate(-50%, -50%) rotateX(58deg) rotateZ(-45deg)',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* ground plate */}
        <div
          className="absolute -inset-[160px] rounded-[80px]"
          style={{
            background: vivid
              ? 'radial-gradient(circle at 50% 50%, #EAF7EE 0%, #DCEFE3 45%, #F4F6FA 75%)'
              : 'radial-gradient(circle at 50% 50%, #FFFFFF 0%, #EEF1F5 60%, #F8F9FB 80%)',
            boxShadow: 'inset 0 0 0 1px rgba(15,15,15,0.05)',
          }}
        />
        {/* road grid */}
        <div
          className="absolute -inset-[160px] rounded-[80px] opacity-60"
          style={{
            backgroundImage:
              'linear-gradient(rgba(15,15,15,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15,15,15,0.05) 1px, transparent 1px)',
            backgroundSize: `${CELL}px ${CELL}px`,
            backgroundPosition: '-11px -11px',
          }}
        />
        {BLOCKS.map(([c, r, h, color, label], i) => (
          <Block key={i} c={c} r={r} h={h} color={color} label={label} vivid={vivid} i={i} />
        ))}
      </div>
    </div>
    {!vivid && (
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,var(--bg-canvas)_0%,color-mix(in_srgb,var(--bg-canvas)_88%,transparent)_26%,color-mix(in_srgb,var(--bg-canvas)_30%,transparent)_48%,transparent_70%)]" />
    )}
  </div>
);

export default IsoScene;
