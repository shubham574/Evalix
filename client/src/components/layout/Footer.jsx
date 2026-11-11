import React from 'react';

const Footer = () => {
  return (
    <footer className="border-t border-gray-200 bg-white py-6 mt-auto">
      <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} Evalix. All rights reserved.</p>
        <div className="flex space-x-4 mt-4 md:mt-0">
          <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-primary transition-colors">Contact Support</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
