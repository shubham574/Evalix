import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FiKey, FiX, FiCheckCircle, FiShield, FiTrash2 } from 'react-icons/fi';
import Button from './Button';
import Input from './Input';
import toast from 'react-hot-toast';

const ApiKeyModal = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [hasExistingKey, setHasExistingKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const storedKey = localStorage.getItem('custom_gemini_key');
      if (storedKey) {
        setApiKey(storedKey);
        setHasExistingKey(true);
      } else {
        setApiKey('');
        setHasExistingKey(false);
      }
    }
  }, [isOpen]);

  const handleSave = () => {
    if (!apiKey.trim()) {
      handleRemove();
      return;
    }
    localStorage.setItem('custom_gemini_key', apiKey.trim());
    window.dispatchEvent(new Event('apiKeyUpdated'));
    toast.success('Custom Gemini API Key saved (BYOK Active)');
    onClose();
  };

  const handleRemove = () => {
    localStorage.removeItem('custom_gemini_key');
    setApiKey('');
    setHasExistingKey(false);
    window.dispatchEvent(new Event('apiKeyUpdated'));
    toast.success('Custom API Key removed. Using system default.');
    onClose();
  };

  if (!isOpen) return null;

  const maskedPreview = apiKey
    ? `${apiKey.slice(0, 6)}••••••••••••••••${apiKey.slice(-4)}`
    : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#151515]/60 backdrop-blur-xs"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          className="relative w-full max-w-lg bg-bg-surface border border-border-subtle rounded-[20px] shadow-lg overflow-hidden z-10"
        >
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-[12px] bg-[#FF6B35]/12 border border-[#FF6B35]/30 flex items-center justify-center text-[#FF6B35]">
                  <FiKey className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#FF6B35] font-semibold">
                      BYOK INTEGRATION
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                        hasExistingKey
                          ? 'bg-[#C7F36B]/25 text-emerald-700 dark:text-[#C7F36B] font-bold'
                          : 'bg-bg-canvas text-text-muted border border-border-subtle'
                      }`}
                    >
                      {hasExistingKey ? 'CONNECTED' : 'DEFAULT KEY'}
                    </span>
                  </div>
                  <h2 className="text-xl font-display font-bold text-text-primary tracking-tight">
                    Custom Gemini API Key
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-[10px] transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <Input
                id="custom-gemini-key"
                label="Google Gemini API Key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                icon={FiKey}
                className="font-mono text-sm"
              />

              {hasExistingKey && maskedPreview && (
                <div className="flex items-center justify-between px-3 py-2 rounded-[10px] bg-bg-canvas border border-border-subtle text-xs font-mono">
                  <span className="text-text-muted">Active Key:</span>
                  <span className="text-text-primary font-bold">{maskedPreview}</span>
                </div>
              )}

              <div className="bg-bg-canvas border border-border-subtle rounded-[14px] p-4 text-sm text-text-secondary">
                <div className="flex items-start gap-3">
                  <FiShield className="w-5 h-5 text-[#FF6B35] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-display font-semibold text-text-primary mb-1">
                      Client-side Storage Security
                    </p>
                    <p className="text-xs leading-relaxed text-text-muted">
                      Your key is securely saved only in browser <code className="font-mono text-text-primary font-semibold">localStorage</code> and forwarded as an authorization header to your Gemini API calls for unlimited live voice and interview questions. Leave blank or click remove to revert to system shared rate limits.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7 flex items-center justify-between">
              {hasExistingKey ? (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-red-500 hover:text-red-600 hover:underline cursor-pointer"
                >
                  <FiTrash2 size={13} /> Remove Custom Key
                </button>
              ) : (
                <span className="text-[11px] font-mono text-text-muted">No custom key stored</span>
              )}

              <div className="flex gap-2.5">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} icon={FiCheckCircle}>
                  Save Key
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ApiKeyModal;
