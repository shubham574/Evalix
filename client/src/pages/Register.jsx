import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { SignUp } from '@clerk/clerk-react';
import { FiArrowLeft, FiCheckCircle, FiMic, FiFileText, FiTrendingUp } from 'react-icons/fi';
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

const features = [
  {
    icon: FiMic,
    tint: 'bg-peach text-[#167A3A]',
    title: 'Live Voice Interviews with Shristi',
    desc: 'Speak naturally and tackle adaptive follow-up questions in real time.',
  },
  {
    icon: FiFileText,
    tint: 'bg-mint text-[#2F6B12]',
    title: 'Resume Claim Defense & ATS Matcher',
    desc: 'Upload your PDF resume and target JD to uncover skill gaps and custom questions.',
  },
  {
    icon: FiTrendingUp,
    tint: 'bg-lilac text-[#5B4BE0]',
    title: 'Quantitative Rubric Scorecards & Timed MCQs',
    desc: 'Compare your spoken response against hiring-grade ideal answers.',
  },
];

const Register = () => {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-bg-surface text-text-primary overflow-x-clip">
      <SEOHead
        title="Start Free Interview Prep — Create Your Evalix Account"
        description="Create your free Evalix account. Practice live voice mock interviews with AI interviewer Shristi, defend your resume projects, and take timed technical assessments."
        canonicalUrl="https://interview-ai-ten-psi.vercel.app/register"
        keywords={[
          'sign up Evalix',
          'free ai mock interview',
          'register coding interview prep',
          'technical interview practice account',
        ]}
      />

      {/* ─── Left Column: Clean Registration Form ─── */}
      <div className="flex flex-col justify-between min-h-screen p-5 sm:p-10 lg:p-12 bg-bg-surface">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-medium tracking-[-0.03em] text-text-primary">
            <BrandDot />
            <span>Evalix</span>
          </Link>

          <Link
            to="/login"
            className="text-[13px] font-display font-normal text-text-secondary hover:text-[#1D9E4B] transition-colors text-right"
          >
            Already have an account? <span className="link-underline text-text-primary">Sign In →</span>
          </Link>
        </div>

        {/* Centered Clerk SignUp Container */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE }}
          className="my-auto mx-auto w-full max-w-md py-10 flex flex-col items-center"
        >
          <div className="w-full mb-8 text-center lg:text-left space-y-3">
            <Eyebrow dot>Create your account</Eyebrow>
            <h2 className="heading-page text-text-primary text-balance">
              Enter the Interview <span className="serif italic text-[#1D9E4B]">Training Arena</span>
            </h2>
          </div>

          <SignUp
            routing="path"
            path="/register"
            signInUrl="/login"
            forceRedirectUrl="/dashboard"
          />
        </motion.div>

        {/* Footer reassurance */}
        <div className="text-xs text-text-secondary flex flex-wrap items-center justify-center lg:justify-between gap-3 pt-5 border-t border-border-subtle">
          <span className="inline-flex items-center gap-1.5">
            <FiCheckCircle className="text-success" size={14} /> Instant access to Shristi AI & Resume Prep
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
              Free practice tier
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
                Practice with purpose. <span className="serif italic text-[#1D9E4B]">Perform with confidence.</span>
              </h1>
              <p className="text-text-secondary text-base xl:text-lg leading-relaxed max-w-md">
                Join students, fresh graduates, and software engineers who practice speaking technical answers aloud before facing real hiring panels.
              </p>
            </motion.div>

            {/* Floating glass card stack */}
            <motion.div
              initial={{ opacity: 0, y: 32, rotate: 1.25 }}
              animate={{ opacity: 1, y: 0, rotate: 1.25 }}
              transition={{ duration: 1, ease: EASE, delay: 0.25 }}
              className="relative"
            >
              <div className="animate-float">
                <div className="glass shadow-lg rounded-[28px] p-6 xl:p-7 space-y-5">
                  <div className="flex items-center justify-between gap-4 pb-4 border-b border-text-primary/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <EvalixOrb state="speaking" size="sm" />
                      <div className="min-w-0">
                        <span className="eyebrow block mb-1.5">What You Unlock Instantly</span>
                        <span className="text-sm font-display font-normal text-text-primary block truncate">
                          Full-Stack Interview Training Suite
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 px-3 py-1.5 rounded-full bg-[#C7F36B] text-[#0F0F0F] text-[11px] font-mono">
                      Free tier
                    </span>
                  </div>

                  <div className="space-y-4">
                    {features.map(({ icon: Icon, tint, title, desc }) => (
                      <div key={title} className="flex items-start gap-3.5">
                        <span className={`w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0 ${tint}`}>
                          <Icon size={16} />
                        </span>
                        <div>
                          <p className="font-display font-normal text-[15px] tracking-[-0.02em] text-text-primary">{title}</p>
                          <p className="text-[13px] text-text-secondary leading-relaxed">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mini scorecard preview */}
              <motion.div
                initial={{ opacity: 0, y: 16, rotate: -4 }}
                animate={{ opacity: 1, y: 0, rotate: -4 }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.55 }}
                className="absolute -bottom-10 -right-6 xl:-right-12"
              >
                <div className="glass shadow-md rounded-[22px] px-4 py-3.5 flex items-center gap-3">
                  <ScoreRing value={82} size={52} stroke={5} color="#2496ED">
                    <span className="font-display font-normal text-sm tracking-[-0.04em] text-text-primary">82</span>
                  </ScoreRing>
                  <div>
                    <span className="eyebrow block mb-1">Sample scorecard</span>
                    <span className="text-[13px] font-display font-normal text-text-primary">Rubric graded</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Bottom tagline */}
          <div className="relative z-10 flex items-center justify-between gap-4 text-xs font-mono text-text-secondary border-t border-text-primary/10 pt-6">
            <span>No credit card required to start practicing.</span>
            <span className="inline-flex items-center gap-1.5 text-success shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-soft" /> Voice Engine Online
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
