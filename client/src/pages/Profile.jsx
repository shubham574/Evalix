import React, { useState } from 'react';
import { UserProfile } from '@clerk/clerk-react';
import { FiUser, FiKey, FiSun, FiMoon } from 'react-icons/fi';
import SEOHead from '../components/common/SEOHead';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ApiKeyModal from '../components/ui/ApiKeyModal';
import { useTheme } from '../hooks/useTheme';

const Profile = () => {
  const { theme, toggleTheme } = useTheme();
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const hasCustomKey =
    typeof window !== 'undefined' && Boolean(localStorage.getItem('user_gemini_api_key'));

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <SEOHead title="Profile & Settings — Evalix" />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <h1 className="heading-page text-text-primary">Profile &amp; Settings</h1>
          <p className="text-sm sm:text-base text-text-secondary mt-1">
            Manage your <strong className="text-text-primary font-semibold">Clerk account</strong>, <strong className="text-text-primary font-semibold">color theme</strong>, and <strong className="text-text-primary font-semibold">personal Gemini API key</strong>.
          </p>
        </div>
      </div>

      {/* Quick Workspace Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 border border-border-subtle flex items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted block">
              Theme
            </span>
            <h3 className="font-display font-bold text-base text-text-primary mt-0.5">
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Switch between warm light and dark interface themes.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={theme === 'dark' ? FiSun : FiMoon}
            onClick={toggleTheme}
          >
            Switch to {theme === 'dark' ? 'Light' : 'Dark'}
          </Button>
        </Card>

        <Card className="p-5 border border-border-subtle flex items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted block">
              Bring Your Own Key (BYOK)
            </span>
            <h3 className="font-display font-bold text-base text-text-primary mt-0.5">
              {hasCustomKey ? 'Custom Gemini Key Active' : 'Default Shared Quota'}
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Connect a free <strong className="text-text-primary font-semibold">Google AI Studio key</strong> for dedicated rate limits.
            </p>
          </div>
          <Button
            variant={hasCustomKey ? 'secondary' : 'primary'}
            size="sm"
            icon={FiKey}
            onClick={() => setApiKeyModalOpen(true)}
          >
            {hasCustomKey ? 'Update Key' : 'Connect Key'}
          </Button>
        </Card>
      </div>

      {/* Clerk UserProfile Container */}
      <div className="rounded-[22px] border border-border-subtle bg-bg-surface p-4 sm:p-6 overflow-x-auto flex justify-center">
        <UserProfile routing="path" path="/profile" />
      </div>

      <ApiKeyModal isOpen={apiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} />
    </div>
  );
};

export default Profile;
