import { toast } from 'react-hot-toast';

export const showSuccess = (message) => {
  toast.success(message, {
    style: {
      background: '#151515',
      color: '#F8F5EF',
      border: '1.5px solid #C7F36B',
      borderRadius: '12px',
      fontFamily: "'Inter', sans-serif",
      fontSize: '14px',
      fontWeight: 500,
    },
    iconTheme: {
      primary: '#C7F36B',
      secondary: '#151515',
    },
  });
};

export const showError = (message) => {
  toast.error(message, {
    style: {
      background: '#151515',
      color: '#F8F5EF',
      border: '1.5px solid #FF6B35',
      borderRadius: '12px',
      fontFamily: "'Inter', sans-serif",
      fontSize: '14px',
      fontWeight: 500,
    },
    iconTheme: {
      primary: '#FF6B35',
      secondary: '#F8F5EF',
    },
  });
};

export const showLoading = (message) => {
  return toast.loading(message, {
    style: {
      background: '#151515',
      color: '#F8F5EF',
      border: '1.5px solid #333333',
      borderRadius: '12px',
      fontFamily: "'Inter', sans-serif",
      fontSize: '14px',
    },
  });
};
