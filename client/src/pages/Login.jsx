import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { SignIn } from '@clerk/clerk-react';
import { FiArrowLeft, FiCheckCircle, FiMic, FiAward, FiZap } from 'react-icons/fi';
import SEOHead from '../components/common/SEOHead';
import { EvalixOrb, EvalixStarburst } from '../components/ui/EvalixOrb';
import { Aura, Eyebrow, ScoreRing } from '@/components/studio';

const EASE = [0.22, 1, 0.36, 1];

const BrandDot = () => (
  <span
    aria-hidden
    className="inline-block w-2.5 h-2.5 rounded-full bg-[conic-gradient(from_200deg,#1D9E4B,#8FDDAA,#2496ED,#C7F36B,#1D9E4B)] shadow-[0_0_0_3px_rgba(29,158,75,0.12)]"
  />
);

const Login = () => {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-bg-surface text-text-primary overflow-x-clip">
      <SEOHead
        title="Sign In to Evalix — AI Interview Training Arena"
        description="Sign in to your Evalix account to access your live AI voice mock interviews, resume gap analyses, and readiness scorecards."
        canonicalUrl="https://interview-ai-ten-psi.vercel.app/login"
        keywords={['Evalix login', 'sign in technical mock interview', 'access interview prep account']}
      />

      {/* ─── Left Column: Clean Authentication Form ─── */}
      <div className="flex flex-col justify-between min-h-screen p-5 sm:p-10 lg:p-12 bg-bg-surface">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-medium tracking-[-0.03em] text-text-primary">
            <BrandDot />
            <span>Evalix</span>
          </Link>

          <Link
            to="/register"
            className="text-[13px] font-display font-normal text-text-secondary hover:text-[#1D9E4B] transition-colors text-right"
          >
            New here? <span className="link-underline text-text-primary">Create free account →</span>
          </Link>
        </div>

        {/* Centered Clerk SignIn Container */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="my-auto mx-auto w-full max-w-md py-10 flex flex-col items-center"
        >
          <div className="w-full mb-8 text-center lg:text-left space-y-3">
            <Eyebrow dot>Authentication</Eyebrow>
            <h2 className="heading-page text-text-primary text-balance">
              Sign in to your <span className="serif italic text-[#1D9E4B]">training arena</span>
            </h2>
          </div>

          <SignIn
            routing="path"
            path="/login"
            signUpUrl="/register"
            forceRedirectUrl="/dashboard"
          />
        </motion.div>

        {/* Footer reassurance */}
        <div className="text-xs text-text-secondary flex flex-wrap items-center justify-center lg:justify-between gap-3 pt-5 border-t border-border-subtle">
          <span className="inline-flex items-center gap-1.5">
            <FiCheckCircle className="text-success" size={14} /> Free practice tier included
          </span>
          <Link to="/" className="link-underline hover:text-text-primary">
            Return to Evalix Home
          </Link>
        </div>
      </div>

      {/* ─── Right Column: Pastel aura showcase (desktop) ─── */}
      <div className="hidden lg:block p-3 min-h-screen">
        <div className="relative isolate h-full min-h-[calc(100vh-1.5rem)] rounded-[32px] overflow-hidden bg-bg-canvas border border-border-subtle grain flex flex-col justify-between p-10 xl:p-14">
          <Aura />

          {/* Top row */}
          <div className="relative z-10 flex items-center justify-between">
            <Link
              to="/"
              className="glass shadow-xs inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-display font-normal text-text-primary hover:bg-bg-surface transition-colors"
            >
              <FiArrowLeft size={14} /> Back to Home
            </Link>
            <span className="glass shadow-xs inline-flex items-center gap-2 rounded-full px-4 py-2 eyebrow">
              <EvalixStarburst className="w-3.5 h-3.5 text-[#1D9E4B]" />
              Welcome Back to the Arena
            </span>
          </div>

          {/* Editorial pitch + floating preview */}
          <div className="relative z-10 my-auto py-10 space-y-10 max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}
              className="space-y-5"
            >
              <h1 className="font-display font-normal text-[clamp(2.6rem,4.2vw,4.25rem)] leading-[0.98] text-text-primary text-balance">
                Pick up right where your <span className="serif italic text-[#1D9E4B]">last session left off.</span>
              </h1>
              <p className="text-text-secondary text-base xl:text-lg leading-relaxed max-w-md">
                Your saved interview transcripts, readiness score progression, and custom role roadmaps are ready.
              </p>
            </motion.div>

            {/* Floating glass score card */}
            <motion.div
              initial={{ opacity: 0, y: 32, rotate: -1.5 }}
              animate={{ opacity: 1, y: 0, rotate: -1.5 }}
              transition={{ duration: 1, ease: EASE, delay: 0.25 }}
              className="relative"
            >
              <div className="animate-float">
                <div className="glass shadow-lg rounded-[28px] p-6 xl:p-7 space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <EvalixOrb state="listening" size="sm" />
                      <div className="min-w-0">
                        <span className="eyebrow block mb-1.5">Shristi • AI Interviewer</span>
                        <span className="text-sm font-display font-normal text-text-primary block truncate">
                          System Design & Resume Defense
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center shrink-0">
                      <ScoreRing value={88} size={64} stroke={6}>
                        <span className="font-display font-normal text-lg tracking-[-0.04em] text-text-primary">88</span>
                      </ScoreRing>
                      <span className="text-[10px] font-mono text-text-muted mt-1">Readiness: 88%</span>
                    </div>
                  </div>

                  <p className="serif italic text-[22px] xl:text-2xl leading-snug text-text-primary">
                    “Walk me through the hardest scaling bottleneck on your resume and how you measured the latency improvement after deployment.”
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-mint text-[#2F6B12] text-[11px] font-mono">
                      <FiMic size={12} /> Real-Time Voice
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-peach text-[#167A3A] text-[11px] font-mono">
                      <FiAward size={12} /> Rubric Graded
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-lilac text-[#5B4BE0] text-[11px] font-mono">
                      <FiZap size={12} /> Instant Model Answers
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Bottom tagline */}
          <div className="relative z-10 flex items-center justify-between gap-4 text-xs font-mono text-text-secondary border-t border-text-primary/10 pt-6">
            <span>Serious about preparation. Playful about the experience.</span>
            <span className="inline-flex items-center gap-1.5 text-success shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-soft" /> Systems Ready
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
