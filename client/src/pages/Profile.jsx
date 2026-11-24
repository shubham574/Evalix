import React, { useState } from 'react';
import { UserProfile } from '@clerk/clerk-react';
import { FiKey, FiSun, FiMoon, FiUser } from 'react-icons/fi';
import { motion } from 'motion/react';
import SEOHead from '../components/common/SEOHead';
import Button from '../components/ui/Button';
import ApiKeyModal from '../components/ui/ApiKeyModal';
import { useTheme } from '../hooks/useTheme';
import { PageHeader, Eyebrow, Reveal } from '@/components/studio';
import { Switch } from '@/components/shadcn/switch';
import { cn } from '@/lib/utils';

const SPRING = { type: 'spring', stiffness: 300, damping: 26 };

const Profile = () => {
  const { theme, toggleTheme } = useTheme();
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const hasCustomKey =
    typeof window !== 'undefined' && Boolean(localStorage.getItem('user_gemini_api_key'));
  const isDark = theme === 'dark';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <SEOHead title="Profile & Settings — Evalix" />

      <PageHeader
        eyebrow="Account"
        title="Profile &"
        accent="settings"
        className="pb-4"
        description={
          <>
            Manage your <strong className="text-text-primary font-medium">Clerk account</strong>,{' '}
            <strong className="text-text-primary font-medium">color theme</strong>, and{' '}
            <strong className="text-text-primary font-medium">personal Gemini API key</strong>.
          </>
        }
      />

      {/* Quick workspace controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Theme */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={SPRING}
          className="rounded-[28px] bg-bg-surface border border-border-subtle shadow-sm hover:shadow-md transition-shadow p-6 sm:p-7 flex flex-col gap-6"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="size-11 rounded-full bg-sky text-[#1D5FAF] dark:text-[#8EC1FF] flex items-center justify-center">
              {isDark ? <FiMoon size={17} /> : <FiSun size={17} />}
            </span>
            <label className="inline-flex items-center gap-2.5 cursor-pointer text-[13px] text-text-secondary">
              <span>Dark</span>
              <Switch
                checked={isDark}
                onCheckedChange={toggleTheme}
                aria-label={`Switch to ${isDark ? 'Light' : 'Dark'}`}
              />
            </label>
          </div>
          <div className="space-y-2">
            <Eyebrow>Theme</Eyebrow>
            <h3 className="font-display font-normal tracking-[-0.03em] text-xl text-text-primary">
              {isDark ? 'Dark Mode' : 'Light Mode'}
            </h3>
            <p className="text-[13px] text-text-secondary leading-relaxed">
              Switch between warm light and dark interface themes.
            </p>
          </div>
        </motion.div>

        {/* BYOK */}
        <motion.div
          whileHover={{ y: -4 }}
          transition={SPRING}
          className={cn(
            'rounded-[28px] border p-6 sm:p-7 flex flex-col gap-6 shadow-sm hover:shadow-md transition-shadow',
            hasCustomKey ? 'bg-mint border-[#5DAA3A]/15' : 'bg-peach border-[#1D9E4B]/15'
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <span
              className={cn(
                'size-11 rounded-full bg-bg-surface shadow-xs flex items-center justify-center',
                hasCustomKey ? 'text-[#2F6B12] dark:text-[#A8E07E]' : 'text-[#1D9E4B]'
              )}
            >
              <FiKey size={17} />
            </span>
            <Button
              variant={hasCustomKey ? 'secondary' : 'primary'}
              size="sm"
              icon={FiKey}
              onClick={() => setApiKeyModalOpen(true)}
            >
              {hasCustomKey ? 'Update Key' : 'Connect Key'}
            </Button>
          </div>
          <div className="space-y-2">
            <Eyebrow>Bring your own key (BYOK)</Eyebrow>
            <h3 className="font-display font-normal tracking-[-0.03em] text-xl text-text-primary">
              {hasCustomKey ? 'Custom Gemini Key Active' : 'Default Shared Quota'}
            </h3>
            <p className="text-[13px] text-text-secondary leading-relaxed">
              Connect a free <strong className="text-text-primary font-medium">Google AI Studio key</strong> for dedicated rate limits.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Clerk UserProfile container */}
      <Reveal y={16}>
        <div className="rounded-[32px] border border-border-subtle bg-bg-surface shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 sm:px-8 py-5 border-b border-border-subtle">
            <span className="size-9 rounded-full bg-bg-elevated flex items-center justify-center text-text-secondary">
              <FiUser size={15} />
            </span>
            <div>
              <Eyebrow>Account</Eyebrow>
              <p className="font-display font-normal tracking-[-0.02em] text-text-primary mt-1">Your Clerk profile</p>
            </div>
          </div>
          <div className="p-3 sm:p-6 overflow-x-auto flex justify-center">
            <UserProfile routing="path" path="/profile" />
          </div>
        </div>
      </Reveal>

      <ApiKeyModal isOpen={apiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} />
    </div>
  );
};

export default Profile;
