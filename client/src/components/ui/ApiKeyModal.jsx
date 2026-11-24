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
          className="fixed inset-0 bg-bg-canvas/70 backdrop-blur-md"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="api-key-modal-title"
          className="relative w-full max-w-lg max-h-[calc(100vh-2rem)] overflow-y-auto bg-bg-surface border border-border-subtle rounded-[28px] shadow-lg z-10"
        >
          {/* Soft pastel wash behind the header */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(60%_100%_at_15%_0%,rgba(255,170,130,0.35),transparent_70%),radial-gradient(50%_90%_at_85%_0%,rgba(176,160,255,0.3),transparent_70%)]" />

          <div className="relative p-6 sm:p-8">
            <div className="flex justify-between items-start gap-4 mb-7">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 shrink-0 rounded-[16px] bg-peach flex items-center justify-center text-[#167A3A] shadow-xs">
                  <FiKey className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="eyebrow">BYOK Integration</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        hasExistingKey
                          ? 'bg-mint text-[#2F6B12] dark:text-[#C7F36B]'
                          : 'bg-bg-elevated text-text-muted'
                      }`}
                    >
                      {hasExistingKey ? 'CONNECTED' : 'DEFAULT KEY'}
                    </span>
                  </div>
                  <h2 id="api-key-modal-title" className="font-display font-normal text-[22px] leading-tight tracking-[-0.035em] text-text-primary">
                    Custom <span className="serif italic text-[#1D9E4B]">Gemini</span> API Key
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 shrink-0 flex items-center justify-center text-text-muted hover:text-text-primary bg-bg-surface/70 hover:bg-surface-hover border border-border-subtle rounded-full transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <FiX className="w-4 h-4" />
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
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-[14px] bg-bg-elevated text-xs font-mono">
                  <span className="text-text-muted shrink-0">Active Key:</span>
                  <span className="text-text-primary truncate">{maskedPreview}</span>
                </div>
              )}

              <div className="bg-tint-sand rounded-[18px] p-5 text-sm text-text-secondary">
                <div className="flex items-start gap-3.5">
                  <span className="w-8 h-8 shrink-0 rounded-full bg-bg-surface flex items-center justify-center text-[#1D9E4B] shadow-xs">
                    <FiShield className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="font-display font-normal text-text-primary mb-1">
                      Client-side Storage Security
                    </p>
                    <p className="text-xs leading-relaxed text-text-secondary">
                      Your key is securely saved only in browser <code className="font-mono text-text-primary">localStorage</code> and forwarded as an authorization header to your Gemini API calls for unlimited live voice and interview questions. Leave blank or click remove to revert to system shared rate limits.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border-subtle flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4">
              {hasExistingKey ? (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="self-center sm:self-auto inline-flex items-center gap-1.5 text-xs font-mono text-danger hover:underline cursor-pointer"
                >
                  <FiTrash2 size={13} /> Remove Custom Key
                </button>
              ) : (
                <span className="self-center sm:self-auto text-[11px] font-mono text-text-muted">No custom key stored</span>
              )}

              <div className="flex gap-2.5 justify-end">
                <Button variant="secondary" onClick={onClose} className="flex-1 sm:flex-none">
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} icon={FiCheckCircle} className="flex-1 sm:flex-none">
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
