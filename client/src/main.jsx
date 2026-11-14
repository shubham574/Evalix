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
          colorPrimary: '#FF6B35',
          colorBackground: '#FFFFFF',
          colorInputBackground: '#F8F5EF',
          colorInputText: '#151515',
          colorText: '#151515',
          colorTextSecondary: '#52504C',
          colorDanger: '#DC2626',
          colorSuccess: '#1F8A4C',
          colorWarning: '#D97706',
          borderRadius: '11px',
          fontFamily: "'Inter', sans-serif",
          fontFamilyButtons: "'Space Grotesk', sans-serif",
        },
        elements: {
          card: 'shadow-none border border-[#D8D0C5] rounded-[20px] bg-white',
          headerTitle: 'font-display font-bold text-[#151515] tracking-tight',
          headerSubtitle: 'text-[#52504C]',
          formButtonPrimary:
            'bg-[#FF6B35] hover:bg-[#EB5822] text-white font-display font-semibold rounded-[12px] shadow-[0_2px_0_#151515] transition-all',
          socialButtonsBlockButton:
            'border border-[#D8D0C5] bg-[#F8F5EF] hover:bg-[#E9E3D9] text-[#151515] rounded-[11px] font-medium',
          formFieldInput:
            'bg-[#F8F5EF] border border-[#D8D0C5] focus:border-[#FF6B35] text-[#151515] rounded-[11px]',
          footerActionLink: 'text-[#FF6B35] hover:text-[#EB5822] font-semibold',
        },
      }}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
