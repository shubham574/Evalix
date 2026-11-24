import { toast } from 'react-hot-toast';

/* Studio toasts — white pill, hairline border, soft shadow. Mirrors the global <Toaster> style in App.jsx. */
const baseStyle = {
  background: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '999px',
  boxShadow: 'var(--shadow-md)',
  padding: '10px 16px',
  fontFamily: "'Inter', sans-serif",
  fontSize: '14px',
  fontWeight: 500,
};

export const showSuccess = (message) => {
  toast.success(message, {
    style: baseStyle,
    iconTheme: {
      primary: '#1F8A4C',
      secondary: '#FFFFFF',
    },
  });
};

export const showError = (message) => {
  toast.error(message, {
    style: baseStyle,
    iconTheme: {
      primary: '#1D9E4B',
      secondary: '#FFFFFF',
    },
  });
};

export const showLoading = (message) => {
  return toast.loading(message, {
    style: baseStyle,
    iconTheme: {
      primary: '#1D9E4B',
      secondary: 'var(--bg-elevated)',
    },
  });
};
