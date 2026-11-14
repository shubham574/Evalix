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
  FiCheck,
} from 'react-icons/fi';
import ApiKeyModal from '../ui/ApiKeyModal';

const NAV_GROUPS = [
  {
    group: 'INTERVIEWS',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: FiHome },
      { label: 'Live Voice Interview', path: '/live-interview', icon: FiMic, badge: 'Voice' },
      { label: 'Mock Simulator', path: '/mock-interview', icon: FiVideo },
    ],
  },
  {
    group: 'PREP TOOLS',
    items: [
      { label: 'Job & Prep Roadmap', path: '/job-analysis', icon: FiBriefcase },
      { label: 'ATS Resume Match', path: '/resume-analyzer', icon: FiFileText },
      { label: 'MCQ Generator', path: '/mcq-generator', icon: FiList },
      { label: 'Question Bank', path: '/interview-questions', icon: FiTool },
    ],
  },
  {
    group: 'ACCOUNT',
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

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-[#151515]/50 backdrop-blur-xs lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Shell */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[244px] bg-bg-surface border-r border-border-subtle flex flex-col justify-between transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-lg' : '-translate-x-full'
        }`}
      >
        {/* Top: Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border-subtle shrink-0">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="text-xl font-display font-bold tracking-tight text-text-primary group-hover:text-[#FF6B35] transition-colors">
              Evalix
            </span>
            <span className="text-[10px] font-mono tracking-widest text-[#FF6B35] font-bold uppercase">
              STUDIO
            </span>
          </Link>
          <span className="px-2 py-0.5 rounded-[5px] bg-bg-canvas text-[10px] font-mono uppercase tracking-wider text-text-muted border border-border-subtle">
            v2.0
          </span>
        </div>

        {/* Middle: Navigation Groups */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6 scrollbar-thin">
          {NAV_GROUPS.map((section) => (
            <div key={section.group} className="space-y-1.5">
              <p className="px-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.14em] text-text-muted">
                {section.group}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`relative flex items-center justify-between px-2.5 py-2 rounded-[10px] text-xs font-display transition-colors duration-150 group ${
                        isActive
                          ? 'bg-[#151515] text-[#F8F5EF] font-semibold'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover font-medium'
                      }`}
                    >
                      <div className="flex items-center min-w-0 gap-2.5">
                        <item.icon
                          className={`shrink-0 w-4 h-4 transition-colors ${
                            isActive
                              ? 'text-[#FF6B35]'
                              : 'text-text-muted group-hover:text-text-primary'
                          }`}
                        />
                        <span className="truncate whitespace-nowrap">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span
                          className={`ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold tracking-wide ${
                            isActive
                              ? 'bg-[#C7F36B] text-[#151515]'
                              : 'bg-[#FF6B35]/15 text-[#FF6B35]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}

                      {/* Active Left Pill Indicator */}
                      {isActive && (
                        <motion.div
                          layoutId="sidebarActivePill"
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#FF6B35]"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Section: Compact API Key Status & Profile */}
        <div className="shrink-0 p-3 border-t border-border-subtle space-y-2.5 bg-bg-surface">
          {/* Compact API Key Status Card (Editorial, no oversized black container) */}
          <div className="rounded-[11px] p-2.5 bg-bg-canvas border border-border-subtle flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    hasCustomKey ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <span className="text-[11px] font-mono font-bold text-text-primary truncate">
                  {hasCustomKey ? 'Gemini (BYOK)' : 'Gemini (Default)'}
                </span>
              </div>
              <p className="text-[10px] font-mono text-text-muted mt-0.5 truncate">
                {hasCustomKey ? 'Unlimited sessions' : 'Standard tier'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className="px-2 py-1 rounded-[6px] bg-bg-surface hover:bg-surface-hover border border-border-subtle text-[10px] font-mono font-semibold text-text-primary inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="Configure Custom Gemini API Key"
            >
              <FiKey size={11} className="text-[#FF6B35]" />
              <span>Key</span>
            </button>
          </div>

          {/* User Account Row */}
          <div className="pt-2 border-t border-border-subtle flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    userButtonAvatarBox: 'w-8 h-8 rounded-[9px] border border-border-subtle',
                  },
                }}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-display font-bold text-text-primary truncate">
                  {user?.fullName || user?.firstName || 'Candidate'}
                </span>
                <Link
                  to="/profile"
                  onClick={() => setSidebarOpen(false)}
                  className="text-[10px] font-mono text-text-muted hover:text-[#FF6B35] transition-colors truncate"
                >
                  Settings &rarr;
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
