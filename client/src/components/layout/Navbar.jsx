import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMenu, FiX, FiSun, FiMoon } from 'react-icons/fi';
import { UserButton, useUser } from '@clerk/clerk-react';
import { useTheme } from '../../hooks/useTheme';

const Navbar = ({ toggleSidebar, sidebarOpen }) => {
  const { isSignedIn } = useUser();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  // Don't show full navbar on auth pages or landing if not logged in
  const isAuthPage = ['/login', '/register'].includes(location.pathname);
  if (isAuthPage) return null;

  const getPageTitle = (path) => {
    if (path.includes('dashboard')) return 'Dashboard';
    if (path.includes('job-analysis')) return 'Job Analysis & Prep Plan';
    if (path.includes('resume-analyzer')) return 'Resume Match';
    if (path.includes('mcq-generator')) return 'MCQ Generator';
    if (path.includes('assessment')) return 'Assessment Test';
    if (path.includes('interview-questions')) return 'Interview Questions';
    if (path.includes('mock-interview')) return 'Mock Interview';
    if (path.includes('live-interview')) return 'Live Interview with Shristi';
    if (path.includes('history')) return 'History & Progress';
    if (path.includes('profile')) return 'Account Settings';
    return 'Dashboard';
  };

  return (
    <nav className="sticky top-0 z-30 w-full bg-bg-surface/80 backdrop-blur-md border-b border-border-subtle h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="flex items-center">
        {isSignedIn && (
          <button
            onClick={toggleSidebar}
            className="mr-3 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover focus:outline-none focus:ring-2 focus:ring-accent-primary lg:hidden transition-colors"
            aria-label="Toggle navigation"
          >
            {sidebarOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        )}
        
        <h1 className="text-lg font-semibold text-text-primary hidden sm:block">
          {getPageTitle(location.pathname)}
        </h1>
        
        <Link to="/" className="flex items-center space-x-2 sm:hidden">
          <span className="text-lg font-bold tracking-tight text-text-primary">
            Evalix
          </span>
        </Link>
      </div>

      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Status Indicator */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-bg-canvas border border-border-subtle">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse"></span>
          <span className="text-xs text-text-secondary font-medium">All systems ready</span>
        </div>

        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme} 
          className="p-2 rounded-xl bg-bg-canvas border border-border-subtle hover:bg-surface-hover transition-colors text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
          aria-label="Toggle theme"
        >
          {theme === 'light' ? <FiMoon size={18} /> : <FiSun size={18} />}
        </button>

        {/* User Button */}
        {isSignedIn && (
          <div className="flex items-center">
            <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: 'w-8 h-8' } }} />
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
