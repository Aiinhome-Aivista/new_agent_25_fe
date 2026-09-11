import React from 'react';
import { ShieldCheck, Cpu, Database, Settings, GitPullRequest, History, Sparkles } from 'lucide-react';
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
  return (
    <header className="header-root">
      {/* Brand Logo & Title */}
      <div className="brand-wrapper">
        <div className="brand-icon-box">
          <ShieldCheck size={24} />
        </div>
        <div className="brand-title-area">
          <h1>
            AI Standards & Code Governance
            <span className="brand-tag">Rules Ingestion Hub</span>
          </h1>
          <p className="brand-subtitle">
            Ingest custom enterprise standards and view language-wise quality guardrails
          </p>
        </div>
      </div>

      {/* Center/Right Status & Action Buttons */}
      <div className="header-status-strip">
        {/* Active LLM Mode Badge */}
        <div className="status-pill" title="Active LLM Reasoning Engine">
          <Cpu size={14} color="#818cf8" />
          <span>LLM:</span>
          <strong>
            {config?.mode === 'Gemini'
              ? `Gemini (${config?.gemini_model || '3.7-flash'})`
              : `Mistral (${config?.mistral_model || 'Local'})`}
          </strong>
        </div>

        {/* Database Status with Live Pulse */}
        <div className="status-pill" title="Persistence & Standards Storage">
          <span className="pulse-dot"></span>
          <Database size={14} color="#34d399" />
          <span>DB:</span>
          <strong style={{ color: '#34d399' }}>
            {config?.mysql_host ? config.mysql_host.split('.')[0] + '...' : 'Connected'}
          </strong>
        </div>

        {/* Review History Trigger */}
        <button
          onClick={onOpenHistory}
          className="btn-secondary"
          title="Browse previous code reviews"
        >
          <History size={14} color="#818cf8" />
          <span>History</span>
          {historyCount > 0 && (
            <span className="tab-counter-badge">{historyCount}</span>
          )}
        </button>

        {/* Standards RAG Catalog */}
        <button
          onClick={onOpenStandards}
          className="btn-secondary"
          title="Inspect approved organizational coding standards"
        >
          <GitPullRequest size={14} color="#818cf8" />
          <span>Standards RAG</span>
        </button>

        {/* System Settings Button */}
        <button
          onClick={onOpenConfig}
          className="btn-icon"
          title="Configure LLM & System Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
};
