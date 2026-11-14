import React from 'react';
import { Link } from 'react-router-dom';
import { SignUp } from '@clerk/clerk-react';
import { FiArrowLeft, FiCheckCircle, FiMic, FiFileText, FiTrendingUp } from 'react-icons/fi';
import SEOHead from '../components/common/SEOHead';
import { EvalixOrb, EvalixStarburst } from '../components/ui/EvalixOrb';

const Register = () => {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-bg-canvas text-text-primary">
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

      {/* ─── Left Column: Brand & Arena Onboarding Showcase (Desktop 6 Cols) ─── */}
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

        {/* Center Editorial Pitch + Feature Stack */}
        <div className="space-y-8 max-w-lg relative z-10 my-auto py-8">
          <h1 className="text-4xl xl:text-5xl font-display font-bold tracking-tight text-white leading-[1.05]">
            Practice with purpose. Perform with confidence.
          </h1>

          <p className="text-[#B5AFA6] text-base leading-relaxed">
            Join students, fresh graduates, and software engineers who practice speaking technical answers aloud before facing real hiring panels.
          </p>

          {/* 3 Arena Pillars Card */}
          <div className="rounded-[20px] bg-[#1F1F1F] border border-[#333333] p-6 space-y-5 shadow-[6px_6px_0px_#C7F36B]">
            <div className="flex items-center justify-between border-b border-[#2E2E2E] pb-4">
              <div className="flex items-center gap-3">
                <EvalixOrb state="speaking" size="sm" />
                <div>
                  <span className="text-xs font-mono uppercase text-[#FF6B35] font-semibold block">
                    WHAT YOU UNLOCK INSTANTLY
                  </span>
                  <span className="text-sm font-display font-bold text-white">
                    Full-Stack Interview Training Suite
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-[8px] bg-[#C7F36B] text-[#151515] text-[11px] font-mono font-bold">
                FREE TIER
              </span>
            </div>

            <div className="space-y-3.5 text-sm">
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-[8px] bg-[#FF6B35]/20 text-[#FF6B35] flex items-center justify-center shrink-0 mt-0.5">
                  <FiMic size={15} />
                </span>
                <div>
                  <p className="font-display font-bold text-white">
                    Live Voice Interviews with Shristi
                  </p>
                  <p className="text-xs text-[#B5AFA6]">
                    Speak naturally and tackle adaptive follow-up questions in real time.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-[8px] bg-[#C7F36B]/20 text-[#C7F36B] flex items-center justify-center shrink-0 mt-0.5">
                  <FiFileText size={15} />
                </span>
                <div>
                  <p className="font-display font-bold text-white">
                    Resume Claim Defense & ATS Matcher
                  </p>
                  <p className="text-xs text-[#B5AFA6]">
                    Upload your PDF resume and target JD to uncover skill gaps and custom questions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-[8px] bg-[#8174FF]/20 text-[#8174FF] flex items-center justify-center shrink-0 mt-0.5">
                  <FiTrendingUp size={15} />
                </span>
                <div>
                  <p className="font-display font-bold text-white">
                    Quantitative Rubric Scorecards & Timed MCQs
                  </p>
                  <p className="text-xs text-[#B5AFA6]">
                    Compare your spoken response against hiring-grade ideal answers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Tagline */}
        <div className="flex items-center justify-between text-xs font-mono text-[#B5AFA6] border-t border-[#2E2E2E] pt-6 relative z-10">
          <span>No credit card required to start practicing.</span>
          <span className="text-[#C7F36B]">● Voice Engine Online</span>
        </div>
      </div>

      {/* ─── Right Column: Clean Registration Form (Desktop 6 Cols) ─── */}
      <div className="lg:col-span-6 flex flex-col justify-between p-6 sm:p-10 lg:p-12 bg-[#F8F5EF] text-[#151515]">
        {/* Mobile Header */}
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/" className="flex lg:hidden items-baseline gap-1">
            <span className="text-lg font-bold font-display">Evalix</span>
            <span className="w-2 h-2 rounded-full bg-[#FF6B35]" />
          </Link>

          <Link
            to="/login"
            className="text-xs font-mono uppercase tracking-wider text-[#52504C] hover:text-[#FF6B35] font-semibold"
          >
            Already have an account? Sign In →
          </Link>
        </div>

        {/* Centered Clerk SignUp Container */}
        <div className="my-auto mx-auto w-full max-w-md py-8 flex flex-col items-center">
          <div className="w-full mb-6 text-center lg:text-left">
            <span className="text-xs font-mono uppercase tracking-wider text-[#FF6B35] font-bold">
              CREATE YOUR ACCOUNT
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#151515] mt-1">
              Enter the Interview Training Arena
            </h2>
          </div>

          <SignUp
            routing="path"
            path="/register"
            signInUrl="/login"
            forceRedirectUrl="/dashboard"
          />
        </div>

        {/* Footer reassurance */}
        <div className="text-center lg:text-left text-xs text-[#52504C] flex flex-wrap items-center justify-center lg:justify-between gap-2 pt-4 border-t border-[#D8D0C5]">
          <span className="inline-flex items-center gap-1.5">
            <FiCheckCircle className="text-[#1F8A4C]" size={14} /> Instant access to Shristi AI & Resume Prep
          </span>
          <Link to="/" className="hover:text-[#151515] underline">
            Return to Evalix Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
