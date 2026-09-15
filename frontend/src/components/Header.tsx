import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, Database, Settings, GitPullRequest, History, Sparkles, Sun, Moon } from 'lucide-react';
import { ServerConfig } from '../types/review';

interface HeaderProps {
  config: ServerConfig | null;
  onOpenConfig: () => void;
  onOpenStandards: () => void;
  onOpenHistory: () => void;
  historyCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  config,
  onOpenConfig,
  onOpenStandards,
  onOpenHistory,
  historyCount = 0
}) => {
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [isLightMode]);

  const toggleTheme = () => {
    setIsLightMode(!isLightMode);
  };

  return (
    <header className="header-root bg-card/90">
      {/* Brand Logo & Title */}
      <div className="flex items-center gap-[0.85rem]">
        <div className="brand-icon-box bg-gradient-to-br from-primary via-[var(--color-button-orange)] to-[var(--color-hover-orange)] text-white shadow-[0_4px_18px_rgba(var(--primary-orange-rgb),0.4),inset_0_1px_1px_rgba(255,255,255,0.4)]">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h1 className="text-[1.15rem] font-[800] tracking-[-0.02em] text-primary flex items-center gap-[0.6rem]">
            AI Standards & Code Governance
            <span className="brand-tag text-[var(--primary)] border-primary bg-primary/18">Rules Ingestion Hub</span>
          </h1>
          <p className="text-[0.72rem] text-text-secondary font-[400] mt-[0.1rem]">
            Ingest custom enterprise standards and view language-wise quality guardrails
          </p>
        </div>
      </div>

      {/* Center/Right Status & Action Buttons */}
      <div className="flex items-center gap-[0.6rem] flex-wrap">
        {/* Active LLM Mode Badge */}
        <div className="status-pill bg-surface-1/80 border border-border-subtle text-text-secondary hover:border-border-medium hover:bg-surface-2/90" title="Active LLM Reasoning Engine">
          <Cpu size={14} color="var(--primary)" />
          <span>LLM:</span>
          <strong className="text-foreground font-[600]">
            {config?.mode === 'Gemini'
              ? `Gemini (${config?.gemini_model || '3.7-flash'})`
              : `Mistral (${config?.mistral_model || 'Local'})`}
          </strong>
        </div>

        {/* Database Status with Live Pulse */}
        <div className="status-pill bg-surface-1/80 border border-border-subtle text-text-secondary hover:border-border-medium hover:bg-surface-2/90" title="Persistence & Standards Storage">
          <span className="w-[7px] h-[7px] rounded-full bg-ready shadow-[0_0_10px_var(--color-ready)] animate-[pulse-ring_2s_infinite_ease-in-out]"></span>
          <Database size={14} color="var(--color-ready)" />
          <span>DB:</span>
          <strong className="text-[var(--color-ready)] font-[600]">
            {config?.mysql_host ? config.mysql_host.split('.')[0] + '...' : 'Connected'}
          </strong>
        </div>

        {/* Review History Trigger */}
        <button
          onClick={onOpenHistory}
          className="btn-secondary bg-white/5 text-text-primary border border-border-medium hover:bg-primary/10 hover:border-primary/20 hover:text-primary"
          title="Browse previous code reviews"
        >
          <History size={14} color="var(--primary)" />
          <span>History</span>
          {historyCount > 0 && (
            <span className="text-[0.68rem] font-mono py-[0.15rem] px-[0.45rem] rounded-[6px] bg-white/10 text-text-primary">{historyCount}</span>
          )}
        </button>

        {/* Standards RAG Catalog */}
        <button
          onClick={onOpenStandards}
          className="btn-secondary bg-white/5 text-text-primary border border-border-medium hover:bg-primary/10 hover:border-primary/20 hover:text-primary"
          title="Inspect approved organizational coding standards"
        >
          <GitPullRequest size={14} color="var(--primary)" />
          <span>Standards RAG</span>
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-[9px] bg-card p-2 hover:bg-accent/10 text-foreground border border-border-subtle  inline-flex items-center justify-center cursor-pointer transition-all duration-150 ease-[ease] hover:bg-[rgba(255,255,255,0.08)] hover:border-border"
          title={isLightMode ? "Switch to Dark Mode" : "Switch to Light Mode"}
        >
          {isLightMode ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        {/* System Settings Button */}
        <button
          onClick={onOpenConfig}
          className="w-9 h-9 rounded-[9px] bg-card p-2 hover:bg-accent/10 text-foreground border border-border-subtle  inline-flex items-center justify-center cursor-pointer transition-all duration-150 ease-[ease] hover:bg-[rgba(255,255,255,0.08)] hover:border-border"
          title="Configure LLM & System Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
};
