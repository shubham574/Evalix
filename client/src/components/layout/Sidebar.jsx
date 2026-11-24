import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { UserButton, useUser } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FiHome,
  FiVideo,
  FiClock,
  FiSettings,
  FiKey,
  FiTool,
  FiBriefcase,
  FiList,
  FiMic,
  FiFileText,
  FiArrowUpRight,
} from 'react-icons/fi';
import ApiKeyModal from '../ui/ApiKeyModal';
import { EvalixMark } from '../studio/Dock';

const NAV_GROUPS = [
  {
    group: 'Interviews',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: FiHome },
      { label: 'Live Voice Interview', path: '/live-interview', icon: FiMic, badge: 'Voice' },
      { label: 'Mock Simulator', path: '/mock-interview', icon: FiVideo },
    ],
  },
  {
    group: 'Prep tools',
    items: [
      { label: 'Job & Prep Roadmap', path: '/job-analysis', icon: FiBriefcase },
      { label: 'ATS Resume Match', path: '/resume-analyzer', icon: FiFileText },
      { label: 'MCQ Generator', path: '/mcq-generator', icon: FiList },
      { label: 'Question Bank', path: '/interview-questions', icon: FiTool },
    ],
  },
  {
    group: 'Account',
    items: [
      { label: 'Session History', path: '/history', icon: FiClock },
      { label: 'Profile & Settings', path: '/profile', icon: FiSettings },
    ],
  },
];

const Sidebar = ({ isOpen, setSidebarOpen }) => {
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [hasCustomKey, setHasCustomKey] = useState(false);
  const { user } = useUser();
  const location = useLocation();

  const checkKeyStatus = () => {
    const key = localStorage.getItem('custom_gemini_key');
    setHasCustomKey(Boolean(key && key.trim()));
  };

  useEffect(() => {
    checkKeyStatus();
    window.addEventListener('apiKeyUpdated', checkKeyStatus);
    window.addEventListener('storage', checkKeyStatus);
    return () => {
      window.removeEventListener('apiKeyUpdated', checkKeyStatus);
      window.removeEventListener('storage', checkKeyStatus);
    };
  }, []);

  return (
    <>
      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} />

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-[#F8F9FB]/60 dark:bg-black/50 backdrop-blur-md lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar shell — floating panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[268px] p-3 lg:sticky lg:top-0 lg:h-screen transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col rounded-[24px] bg-wall shadow-[0_0_0_1px_var(--line)] lg:shadow-none overflow-hidden">
          {/* Brand */}
          <div className="h-[72px] flex items-center justify-between px-6 shrink-0">
            <Link to="/" className="flex items-center gap-2.5 group">
              <EvalixMark size={26} />
              <span className="text-[22px] font-display font-normal tracking-[-0.05em] text-text-primary">
                Evalix
              </span>
            </Link>
            <span className="px-2 py-0.5 rounded-full bg-bg-elevated text-[10px] font-mono tracking-wider text-text-muted">
              v2
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-2 space-y-7">
            {NAV_GROUPS.map((section) => (
              <div key={section.group} className="space-y-1">
                <p className="px-3 pb-1.5 eyebrow !text-[10px]">{section.group}</p>
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`relative flex items-center justify-between px-3 h-11 rounded-[14px] text-[14.5px] tracking-[-0.012em] transition-colors duration-200 group ${
                        isActive
                          ? 'text-text-primary'
                          : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface/70'
                      }`}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="sidebarActivePill"
                          className="absolute inset-0 rounded-[14px] bg-bg-surface shadow-[var(--shadow-key)]"
                          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                        />
                      )}
                      <span className="relative flex items-center min-w-0 gap-3">
                        <item.icon
                          className={`shrink-0 w-[17px] h-[17px] transition-colors ${
                            isActive ? 'text-[#1D9E4B]' : 'text-text-muted group-hover:text-text-primary'
                          }`}
                        />
                        <span className="truncate whitespace-nowrap">{item.label}</span>
                      </span>

                      {item.badge && (
                        <span
                          className={`relative ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            'bg-peach text-[#167A3A]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Bottom: key status + account */}
          <div className="shrink-0 p-3 space-y-2">
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className="w-full text-left rounded-[16px] p-3.5 bg-bg-surface shadow-[var(--shadow-key)] hover:-translate-y-px transition cursor-pointer group"
              title="Configure custom Gemini API key"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-medium text-text-primary">
                  <span className={`w-2 h-2 rounded-full ${hasCustomKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                  {hasCustomKey ? 'Your Gemini key' : 'Shared Gemini key'}
                </span>
                <FiKey size={14} className="text-[#1D9E4B]" />
              </div>
              <p className="mt-1 text-xs text-text-secondary flex items-center gap-1">
                {hasCustomKey ? 'Personal rate limits' : 'Add your own key'}
                <FiArrowUpRight size={12} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition" />
              </p>
            </button>

            <div className="flex items-center gap-3 px-2 py-2">
              <UserButton
                afterSignOutUrl="/"
                appearance={{ elements: { userButtonAvatarBox: 'w-9 h-9 rounded-full' } }}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-[13.5px] font-medium text-text-primary truncate tracking-[-0.01em]">
                  {user?.fullName || user?.firstName || 'Candidate'}
                </span>
                <Link
                  to="/profile"
                  onClick={() => setSidebarOpen(false)}
                  className="text-xs text-text-muted hover:text-[#1D9E4B] transition-colors truncate"
                >
                  View profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
