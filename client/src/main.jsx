import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Publishable Key');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      appearance={{
        variables: {
          colorPrimary: '#1D9E4B',
          colorBackground: '#FFFFFF',
          colorInputBackground: '#FFFFFF',
          colorInputText: '#0F0F0F',
          colorText: '#0F0F0F',
          colorTextSecondary: '#3F4240',
          colorDanger: '#D92D20',
          colorSuccess: '#1F8A4C',
          colorWarning: '#C26A06',
          borderRadius: '14px',
          fontFamily: "'Google Sans Flex', 'Inter', sans-serif",
          fontFamilyButtons: "'Google Sans Flex', 'Inter', sans-serif",
        },
        elements: {
          card: 'shadow-none border-0 rounded-[28px] bg-transparent',
          headerTitle: 'font-display font-normal text-[#0F0F0F] tracking-[-0.04em]',
          headerSubtitle: 'text-[#3F4240]',
          formButtonPrimary:
            'key--ink font-display font-normal rounded-[16px] normal-case',
          socialButtonsBlockButton:
            'bg-white text-[#0F0F0F] rounded-[16px] shadow-[inset_0_-3px_0_rgba(0,0,0,0.07),0_0_0_1px_rgba(0,0,0,0.06),0_12px_22px_-14px_rgba(0,0,0,0.3)]',
          formFieldInput:
            'bg-white border border-[rgba(15,15,15,0.1)] focus:border-[#1D9E4B] text-[#0F0F0F] rounded-[14px]',
          footerActionLink: 'text-[#1D9E4B] hover:text-[#178A40] font-medium',
        },
      }}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
