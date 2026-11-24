import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMenu, FiX, FiSun, FiMoon, FiMic, FiKey } from 'react-icons/fi';
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
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const checkKey = () => setHasCustomKey(Boolean(localStorage.getItem('custom_gemini_key')));
    checkKey();
    window.addEventListener('apiKeyUpdated', checkKey);
    return () => window.removeEventListener('apiKeyUpdated', checkKey);
  }, []);

  const isAuthPage = ['/login', '/register'].includes(location.pathname);
  if (isAuthPage) return null;

  const getPageInfo = (path) => {
    if (path.includes('dashboard')) return { title: 'Dashboard', section: 'Workspace' };
    if (path.includes('live-interview')) return { title: 'Live Voice Interview', section: 'Voice studio' };
    if (path.includes('mock-interview')) return { title: 'Mock Simulator', section: 'Evaluation' };
    if (path.includes('job-analysis')) return { title: 'Job & Prep Roadmap', section: 'Prep tools' };
    if (path.includes('resume-analyzer')) return { title: 'ATS Resume Match', section: 'Prep tools' };
    if (path.includes('mcq-generator')) return { title: 'MCQ Generator', section: 'Prep tools' };
    if (path.includes('assessment')) return { title: 'Timed Assessment', section: 'Evaluation' };
    if (path.includes('interview-questions')) return { title: 'Question Bank', section: 'Prep tools' };
    if (path.includes('history')) return { title: 'Session History', section: 'Records' };
    if (path.includes('profile')) return { title: 'Profile & Settings', section: 'Account' };
    return { title: 'Workspace', section: 'Evalix' };
  };

  const { title, section } = getPageInfo(location.pathname);

  const iconBtn =
    'key key--sm key--icon !w-10 text-text-secondary hover:text-text-primary shrink-0';

  return (
    <>
      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} />

      <header
        className={`sticky top-0 z-30 w-full transition-all duration-300 ${
          scrolled ? 'bg-bg-canvas/75 backdrop-blur-xl' : 'bg-transparent'
        } h-[72px] flex items-center justify-between px-4 sm:px-6 lg:px-10`}
      >
        {/* Left: menu + breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          {isSignedIn && (
            <button
              onClick={toggleSidebar}
              className={`${iconBtn} lg:hidden`}
              aria-label="Toggle navigation"
            >
              {sidebarOpen ? <FiX size={17} /> : <FiMenu size={17} />}
            </button>
          )}

          <div className="flex items-center gap-2.5 min-w-0">
            <span className="hidden sm:inline text-[13px] text-text-muted">{section}</span>
            <span className="hidden sm:inline text-text-muted/60">/</span>
            <h1 className="text-[15px] font-display font-normal text-text-primary tracking-[-0.02em] truncate">
              {title}
            </h1>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!location.pathname.includes('live-interview') && (
            <Link
              to="/live-interview"
              className="key key--sm key--ink pl-2.5"
            >
              <span className="w-6 h-6 rounded-[8px] bg-white/15 inline-flex items-center justify-center">
                <FiMic size={13} />
              </span>
              <span className="hidden sm:inline">New voice session</span>
              <span className="sm:hidden">Voice</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => setIsApiKeyModalOpen(true)}
            className="hidden sm:inline-flex key key--sm text-text-secondary hover:text-text-primary"
            title="Configure custom Gemini API key"
          >
            <FiKey size={13} />
            <span className="hidden md:inline">API key</span>
            <span className={`w-1.5 h-1.5 rounded-full ${hasCustomKey ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className={iconBtn}
            aria-label="Toggle light or dark theme"
          >
            {theme === 'light' ? <FiMoon size={15} /> : <FiSun size={15} />}
          </button>

          {isSignedIn && (
            <div className="flex items-center pl-1">
              <UserButton
                afterSignOutUrl="/"
                appearance={{ elements: { userButtonAvatarBox: 'w-10 h-10 rounded-full' } }}
              />
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Navbar;
