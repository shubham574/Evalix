import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="border-t border-border-subtle bg-bg-surface py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-xs font-mono text-text-secondary gap-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FF6B35]" />
          <p>© {new Date().getFullYear()} Evalix — AI Interview Training Arena.</p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Link to="/mock-interview-for-react-developers" className="hover:text-[#FF6B35] transition-colors">
            React Track
          </Link>
          <Link to="/system-design-mock-interview" className="hover:text-[#FF6B35] transition-colors">
            System Design
          </Link>
          <Link to="/resume-based-interview-questions" className="hover:text-[#FF6B35] transition-colors">
            Resume Prep
          </Link>
          <Link to="/mock-interview-for-freshers" className="hover:text-[#FF6B35] transition-colors">
            Freshers Track
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
