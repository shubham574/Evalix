import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserButton } from '@clerk/clerk-react';
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
  FiFileText
} from 'react-icons/fi';
import ApiKeyModal from '../ui/ApiKeyModal';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: FiHome },
  { label: 'Job Analysis', path: '/job-analysis', icon: FiBriefcase },
  { label: 'Resume Analyzer', path: '/resume-analyzer', icon: FiFileText },
  { label: 'MCQ Generator', path: '/mcq-generator', icon: FiList },
  { label: 'Interview Qs', path: '/interview-questions', icon: FiTool },
  { label: 'Live Interview', path: '/live-interview', icon: FiMic },
  { label: 'Mock Interview', path: '/mock-interview', icon: FiVideo },
  { label: 'History & Progress', path: '/history', icon: FiClock },
  { label: 'Settings', path: '/profile', icon: FiSettings },
];

const Sidebar = ({ isOpen, setSidebarOpen }) => {
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = React.useState(false);

  return (
    <>
      <ApiKeyModal isOpen={isApiKeyModalOpen} onClose={() => setIsApiKeyModalOpen(false)} />
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-bg-surface border-r border-border-subtle transform transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo Section */}
        <div className="h-16 flex items-center px-6 border-b border-border-subtle mb-4 hidden lg:flex">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold tracking-tight text-text-primary">
              Evalix
            </span>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin pt-20 lg:pt-0">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                  isActive
                    ? 'text-text-primary bg-bg-elevated font-semibold shadow-sm'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active-indicator"
                      className="absolute left-0 w-1 h-8 bg-accent-primary rounded-r-full"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <item.icon
                    className={`flex-shrink-0 w-5 h-5 mr-3 transition-colors ${
                      isActive ? 'text-accent-primary' : 'text-text-secondary group-hover:text-text-primary'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
        
        <div className="p-4 border-t border-border-subtle">
          <div className="bg-bg-elevated border border-border-subtle rounded-xl p-4 text-center">
            <div className="flex justify-center mb-2">
              <div className="w-10 h-10 rounded-full bg-accent-primary/10 flex items-center justify-center text-accent-primary">
                <FiKey className="w-5 h-5" />
              </div>
            </div>
            <h4 className="text-sm font-bold text-text-primary mb-1">Bring Your Own Key</h4>
            <p className="text-xs text-text-secondary mb-3">Add Gemini API key for unlimited AI usage</p>
            <button 
              onClick={() => setIsApiKeyModalOpen(true)}
              className="w-full bg-accent-primary text-white text-xs font-bold py-2 rounded-lg hover:opacity-90 shadow-md shadow-accent-primary/20 transition-all"
            >
              Add API Key
            </button>
          </div>
        </div>

        {/* User Account Pinned */}
        <div className="p-4 border-t border-border-subtle flex items-center justify-between">
          <div className="flex items-center space-x-3 w-full">
            <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: 'w-10 h-10' } }} />
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium text-text-primary truncate">Account</span>
              <span className="text-xs text-text-secondary truncate">Settings & Profile</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
