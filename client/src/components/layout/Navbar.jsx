import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMenu, FiX, FiSun, FiMoon, FiMic, FiKey, FiArrowUpRight } from 'react-icons/fi';
import { UserButton, useUser } from '@clerk/clerk-react';
import { useTheme } from '../../hooks/useTheme';
import ApiKeyModal from '../ui/ApiKeyModal';

const Navbar = ({ toggleSidebar, sidebarOpen }) => {
  const { isSignedIn } = useUser();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hasCustomKey, setHasCustomKey] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const checkKey = () => {
      setHasCustomKey(Boolean(localStorage.getItem('custom_gemini_key')));
    };
    checkKey();
    window.addEventListener('apiKeyUpdated', checkKey);
    return () => window.removeEventListener('apiKeyUpdated', checkKey);
  }, []);

  const isAuthPage = ['/login', '/register'].includes(location.pathname);
  if (isAuthPage) return null;

  const getPageInfo = (path) => {
    if (path.includes('dashboard')) return { title: 'Dashboard', section: 'Workspace' };
    if (path.includes('live-interview')) return { title: 'Live Voice Interview', section: 'Voice Studio' };
    if (path.includes('mock-interview')) return { title: 'Mock Simulator', section: 'Evaluation' };
    if (path.includes('job-analysis')) return { title: 'Job & Prep Roadmap', section: 'Prep Tools' };
    if (path.includes('resume-analyzer')) return { title: 'ATS Resume Match', section: 'Prep Tools' };
    if (path.includes('mcq-generator')) return { title: 'MCQ Generator', section: 'Prep Tools' };
    if (path.includes('assessment')) return { title: 'Timed Assessment', section: 'Evaluation' };
    if (path.includes('interview-questions')) return { title: 'Question Bank', section: 'Prep Tools' };
    if (path.includes('history')) return { title: 'Session History', section: 'Records' };
    if (path.includes('profile')) return { title: 'Profile & Settings', section: 'Account' };
    return { title: 'Workspace', section: 'Evalix' };
  };

  const { title, section } = getPageInfo(location.pathname);

  return (
    <>
      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} />

      <header
        className={`sticky top-0 z-30 w-full transition-all duration-200 border-b ${
          scrolled
            ? 'bg-bg-surface/95 backdrop-blur-md border-border-subtle shadow-xs'
            : 'bg-bg-canvas/90 backdrop-blur-xs border-border-subtle'
        } h-15 flex items-center justify-between px-4 sm:px-6 lg:px-8`}
      >
        {/* Left: Sidebar Toggle + Breadcrumb Title */}
        <div className="flex items-center gap-3 min-w-0">
          {isSignedIn && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-[8px] text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-border-subtle lg:hidden transition-colors cursor-pointer shrink-0"
              aria-label="Toggle navigation"
            >
              {sidebarOpen ? <FiX size={17} /> : <FiMenu size={17} />}
            </button>
          )}

          {/* Breadcrumb Context */}
          <div className="flex items-center gap-2 min-w-0 font-display">
            <span className="hidden sm:inline font-mono text-[11px] uppercase tracking-wider text-text-muted">
              {section}
            </span>
            <span className="hidden sm:inline text-text-muted text-xs">/</span>
            <h1 className="text-sm sm:text-base font-bold text-text-primary tracking-tight truncate">
              {title}
            </h1>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Primary Action: New Voice Session */}
          {!location.pathname.includes('live-interview') && (
            <Link
              to="/live-interview"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[9px] bg-[#FF6B35] hover:bg-[#EB5822] text-white font-display font-semibold text-xs transition-all shadow-xs cursor-pointer"
            >
              <FiMic size={13} className="shrink-0" />
              <span className="hidden xs:inline">New Voice Session</span>
              <span className="xs:hidden">Voice</span>
            </Link>
          )}

          {/* Secondary Action: API Key Button */}
          <button
            type="button"
            onClick={() => setIsApiKeyModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[9px] bg-bg-surface hover:bg-surface-hover border border-border-subtle text-xs font-mono text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
            title="Configure Custom Gemini API Key"
          >
            <FiKey size={12} className="text-[#FF6B35] shrink-0" />
            <span className="hidden md:inline font-medium">API Key</span>
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                hasCustomKey ? 'bg-emerald-500' : 'bg-amber-400'
              }`}
            />
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-[9px] bg-bg-surface border border-border-subtle hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary cursor-pointer shrink-0"
            aria-label="Toggle light or dark theme"
          >
            {theme === 'light' ? <FiMoon size={15} /> : <FiSun size={15} />}
          </button>

          {/* User Avatar */}
          {isSignedIn && (
            <div className="flex items-center pl-0.5">
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    userButtonAvatarBox: 'w-7.5 h-7.5 rounded-[8px] border border-border-subtle',
                  },
                }}
              />
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Navbar;
