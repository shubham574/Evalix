import React from 'react';
import { Link } from 'react-router-dom';
import { SignIn } from '@clerk/clerk-react';
import { FiArrowLeft, FiCheckCircle, FiMic, FiAward, FiZap } from 'react-icons/fi';
import SEOHead from '../components/common/SEOHead';
import { EvalixOrb, EvalixStarburst } from '../components/ui/EvalixOrb';

const Login = () => {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-bg-canvas text-text-primary">
      <SEOHead
        title="Sign In to Evalix — AI Interview Training Arena"
        description="Sign in to your Evalix account to access your live AI voice mock interviews, resume gap analyses, and readiness scorecards."
        canonicalUrl="https://interview-ai-ten-psi.vercel.app/login"
        keywords={['Evalix login', 'sign in technical mock interview', 'access interview prep account']}
      />

      {/* ─── Left Column: Brand & Live Arena Showcase (Desktop 6 Cols) ─── */}
      <div className="hidden lg:flex lg:col-span-6 bg-[#151515] text-[#F8F5EF] p-12 xl:p-16 flex-col justify-between relative overflow-hidden border-r-2 border-[#151515]">
        {/* Top Brand Header */}
        <div className="flex items-center justify-between relative z-10">
          <Link to="/" className="flex items-baseline gap-1 group">
            <span className="text-xl font-bold font-display tracking-tight text-white">
              Evalix
            </span>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-[#B5AFA6] hover:text-white transition-colors"
          >
            <FiArrowLeft size={14} /> Back to Home
          </Link>
        </div>

        {/* Center Editorial Pitch + Sample Arena Card */}
        <div className="space-y-8 max-w-lg relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[8px] bg-[#282828] text-[#C7F36B] font-mono text-xs uppercase tracking-wider">
            <EvalixStarburst className="w-3.5 h-3.5 text-[#C7F36B]" />
            Welcome Back to the Arena
          </div>

          <h1 className="text-4xl xl:text-5xl font-display font-bold tracking-tight text-white leading-[1.05]">
            Pick up right where your last session left off.
          </h1>

          <p className="text-[#B5AFA6] text-base leading-relaxed">
            Your saved interview transcripts, readiness score progression, and custom role roadmaps are ready.
          </p>

          {/* Sample Interview Question & Readiness Preview Card */}
          <div className="rounded-[20px] bg-[#1F1F1F] border border-[#333333] p-6 space-y-4 shadow-[6px_6px_0px_#FF6B35]">
            <div className="flex items-center justify-between border-b border-[#2E2E2E] pb-3.5">
              <div className="flex items-center gap-3">
                <EvalixOrb state="listening" size="sm" />
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#C7F36B] block">
                    SHRISTI • AI INTERVIEWER
                  </span>
                  <span className="text-xs font-display font-semibold text-white">
                    System Design & Resume Defense
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-[8px] bg-[#282828] text-[11px] font-mono text-[#F8F5EF]">
                Readiness: 88%
              </span>
            </div>

            <p className="text-sm font-display text-[#F8F5EF] leading-snug">
              “Walk me through the hardest scaling bottleneck on your resume and how you measured the latency improvement after deployment.”
            </p>

            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#282828] text-[11px] font-mono text-[#C7F36B]">
                <FiMic size={12} /> Real-Time Voice
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#282828] text-[11px] font-mono text-[#F8F5EF]">
                <FiAward size={12} className="text-[#FF6B35]" /> Rubric Graded
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#282828] text-[11px] font-mono text-[#F8F5EF]">
                <FiZap size={12} className="text-[#8174FF]" /> Instant Model Answers
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Tagline */}
        <div className="flex items-center justify-between text-xs font-mono text-[#B5AFA6] border-t border-[#2E2E2E] pt-6 relative z-10">
          <span>Serious about preparation. Playful about the experience.</span>
          <span className="text-[#C7F36B]">● Systems Ready</span>
        </div>
      </div>

      {/* ─── Right Column: Clean Authentication Form (Desktop 6 Cols) ─── */}
      <div className="lg:col-span-6 flex flex-col justify-between p-6 sm:p-10 lg:p-12 bg-[#F8F5EF] text-[#151515]">
        {/* Mobile Header */}
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/" className="flex lg:hidden items-baseline gap-1">
            <span className="text-lg font-bold font-display">Evalix</span>
            <span className="w-2 h-2 rounded-full bg-[#FF6B35]" />
          </Link>

          <Link
            to="/register"
            className="text-xs font-mono uppercase tracking-wider text-[#52504C] hover:text-[#FF6B35] font-semibold"
          >
            New here? Create free account →
          </Link>
        </div>

        {/* Centered Clerk SignIn Container */}
        <div className="my-auto mx-auto w-full max-w-md py-8 flex flex-col items-center">
          <div className="w-full mb-6 text-center lg:text-left">
            <span className="text-xs font-mono uppercase tracking-wider text-[#FF6B35] font-bold">
              AUTHENTICATION
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#151515] mt-1">
              Sign in to your training arena
            </h2>
          </div>

          <SignIn
            routing="path"
            path="/login"
            signUpUrl="/register"
            forceRedirectUrl="/dashboard"
          />
        </div>

        {/* Footer reassurance */}
        <div className="text-center lg:text-left text-xs text-[#52504C] flex flex-wrap items-center justify-center lg:justify-between gap-2 pt-4 border-t border-[#D8D0C5]">
          <span className="inline-flex items-center gap-1.5">
            <FiCheckCircle className="text-[#1F8A4C]" size={14} /> Free practice tier included
          </span>
          <Link to="/" className="hover:text-[#151515] underline">
            Return to Evalix Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
