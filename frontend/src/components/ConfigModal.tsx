import React, { useState, useEffect } from 'react';
import { X, Save, Cpu, Database, ShieldAlert, Check, Sparkles, Sliders } from 'lucide-react';
import { ServerConfig } from '../types/review';
import { updateServerConfig } from '../services/api';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ServerConfig | null;
  onConfigUpdated: (newConfig: ServerConfig) => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfigUpdated
}) => {
  if (!isOpen || !config) return null;

  const [mode, setMode] = useState(config.mode || 'Gemini');
  const [geminiModel, setGeminiModel] = useState(config.gemini_model || 'gemini-3.7-flash');
  const [mistralLocalUrl, setMistralLocalUrl] = useState(
    config.mistral_local_url || 'http://122.163.121.176:3041'
  );
  const [strictGatekeeper, setStrictGatekeeper] = useState(config.strict_gatekeeper ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateServerConfig({
        mode,
        gemini_model: geminiModel,
        mistral_local_url: mistralLocalUrl,
        strict_gatekeeper: strictGatekeeper
      });
      onConfigUpdated({
        ...config,
        mode,
        gemini_model: geminiModel,
        mistral_local_url: mistralLocalUrl,
        strict_gatekeeper: strictGatekeeper
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 900);
    } catch (e: any) {
      alert('Failed to update system config: ' + (e.message || e));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex-row items-center gap-2">
            <Sliders size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)' }}>
              System & Gatekeeper Configuration
            </h3>
          </div>
          <button type="button" onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* LLM Mode Selector */}
          <div>
            <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--foreground)', display: 'block', marginBottom: '0.45rem' }}>
              LLM Reasoning Engine Provider
            </label>
            <div className="grid-2">
              <button
                type="button"
                onClick={() => setMode('Gemini')}
                className={`issue-card ${mode === 'Gemini' ? 'glass-panel-glow' : ''}`}
                style={{
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: mode === 'Gemini' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(10, 15, 29, 0.7)',
                  borderColor: mode === 'Gemini' ? 'var(--brand-primary)' : 'var(--border-subtle)'
                }}
              >
                <div className="flex-row items-center justify-between">
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--foreground)' }}>Google Gemini</span>
                  <Sparkles size={14} color="var(--primary)" />
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Cloud-hosted fast grounded reasoning (gemini-3.7-flash)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('Mistral')}
                className={`issue-card ${mode === 'Mistral' ? 'glass-panel-glow' : ''}`}
                style={{
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: mode === 'Mistral' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(10, 15, 29, 0.7)',
                  borderColor: mode === 'Mistral' ? 'var(--brand-primary)' : 'var(--border-subtle)'
                }}
              >
                <div className="flex-row items-center justify-between">
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--foreground)' }}>Mistral AI</span>
                  <Cpu size={14} color="var(--primary)" />
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  On-premise / Local vLLM private deployment
                </p>
              </button>
            </div>
          </div>

          {/* Model Specific Settings */}
          {mode === 'Gemini' ? (
            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Gemini Model Identifier
              </label>
              <input
                type="text"
                value={geminiModel}
                onChange={(e) => setGeminiModel(e.target.value)}
                className="code-textarea"
                style={{ minHeight: 'auto', padding: '0.6rem 0.85rem' }}
              />
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Mistral Local Endpoint URL
              </label>
              <input
                type="text"
                value={mistralLocalUrl}
                onChange={(e) => setMistralLocalUrl(e.target.value)}
                className="code-textarea"
                style={{ minHeight: 'auto', padding: '0.6rem 0.85rem' }}
              />
            </div>
          )}

          {/* MySQL Database Info (Read-Only) */}
          <div
            style={{
              padding: '0.95rem 1.15rem',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div className="flex-row items-center gap-1.5" style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.35rem' }}>
              <Database size={15} color="var(--color-ready)" />
              <span>Enterprise MySQL Storage Topology</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              <div>Host: <strong style={{ color: 'var(--foreground)' }}>{config.mysql_host}:{config.mysql_port}</strong></div>
              <div>Database: <strong style={{ color: 'var(--foreground)' }}>{config.mysql_database}</strong> (User: {config.mysql_user})</div>
              <div>Status: <strong style={{ color: 'var(--color-ready)' }}>Connected to MySQL Cluster</strong></div>
            </div>
          </div>

          {/* Strict Gatekeeper Mode Switch */}
          <div
            className="flex-row items-center justify-between gap-3"
            style={{
              padding: '0.95rem 1.15rem',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--foreground)' }}>
                Deterministic Pre-Push Gatekeeper
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                Strictly block push on any detected security leak, hardcoded secret, or broken acceptance criterion.
              </p>
            </div>
            <input
              type="checkbox"
              checked={strictGatekeeper}
              onChange={(e) => setStrictGatekeeper(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--brand-primary)', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary bg-white/5 text-text-primary border border-border-medium hover:bg-white/10 hover:border-white/20 hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-prime bg-gradient-to-br from-primary to-[var(--hover-orange)] text-white border-white/15"
          >
            {savedSuccess ? <Check size={14} color="var(--color-ready)" /> : <Save size={14} />}
            <span>{savedSuccess ? 'Settings Saved!' : isSaving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
