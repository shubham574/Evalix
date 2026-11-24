import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="border-t border-border-subtle py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center text-[13px] text-text-secondary gap-4">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#1D9E4B]" />
          <p>© {new Date().getFullYear()} Evalix — AI interview practice.</p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <Link to="/mock-interview-for-react-developers" className="link-underline hover:text-text-primary transition-colors">
            React track
          </Link>
          <Link to="/system-design-mock-interview" className="link-underline hover:text-text-primary transition-colors">
            System design
          </Link>
          <Link to="/resume-based-interview-questions" className="link-underline hover:text-text-primary transition-colors">
            Resume prep
          </Link>
          <Link to="/mock-interview-for-freshers" className="link-underline hover:text-text-primary transition-colors">
            Freshers track
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
