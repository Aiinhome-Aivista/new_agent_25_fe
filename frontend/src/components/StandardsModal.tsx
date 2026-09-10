import React, { useState } from 'react';
import { X, BookOpen, Check, Shield, Search, Sparkles } from 'lucide-react';

interface StandardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  standards: any[];
}

export const StandardsModal: React.FC<StandardsModalProps> = ({ isOpen, onClose, standards }) => {
  const [search, setSearch] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('ALL');

  if (!isOpen) return null;

  const languages = ['ALL', 'java', 'python', 'javascript'];

  const filteredStandards = standards.filter((std) => {
    const matchesLang =
      selectedLanguage === 'ALL' ||
      std.language?.toLowerCase() === selectedLanguage.toLowerCase();

    const matchesSearch =
      !search.trim() ||
      std.title?.toLowerCase().includes(search.toLowerCase()) ||
      std.rule_code?.toLowerCase().includes(search.toLowerCase()) ||
      std.description?.toLowerCase().includes(search.toLowerCase());

    return matchesLang && matchesSearch;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window" style={{ maxWidth: '820px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex-row items-center gap-2">
            <BookOpen size={20} color="#818cf8" />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
              Approved Enterprise Coding Standards (RAG Catalog)
            </h3>
            <span className="tab-counter-badge">
              {filteredStandards.length} rules
            </span>
          </div>
          <button type="button" onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>

        {/* Search & Language Filter */}
        <div style={{ padding: '1rem 1.75rem 0.25rem 1.75rem' }}>
          <div className="flex-row items-center justify-between gap-3" style={{ flexWrap: 'wrap' }}>
            <div
              className="flex-row items-center gap-2"
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                padding: '0.45rem 0.85rem',
                flex: 1,
                minWidth: '220px'
              }}
            >
              <Search size={14} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search coding standards (e.g. SEC-001, SQLi, Spring)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.76rem',
                  color: '#ffffff',
                  width: '100%'
                }}
              />
            </div>

            <div className="scenario-chips-wrapper">
              {languages.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedLanguage(lang)}
                  className={`scenario-chip ${selectedLanguage === lang ? 'active' : ''}`}
                >
                  <span style={{ textTransform: 'uppercase' }}>{lang}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Body Standards List */}
        <div className="modal-body">
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            These vetted architectural & security guidelines are vectorized in the RAG pipeline to ground all automated agent recommendations.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            {filteredStandards.map((std, idx) => (
              <div key={idx} className="issue-card" style={{ padding: '1.15rem' }}>
                <div className="flex-row items-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
                  <div className="flex-row items-center gap-2">
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-mono)',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        background: 'rgba(99, 102, 241, 0.18)',
                        color: '#a5b4fc',
                        border: '1px solid rgba(99, 102, 241, 0.35)'
                      }}
                    >
                      {std.rule_code}
                    </span>
                    <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#ffffff' }}>
                      {std.title}
                    </h4>
                  </div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '6px',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {std.language} / {std.framework}
                  </span>
                </div>

                <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {std.description}
                </p>

                {std.good_example && (
                  <div className="grid-2" style={{ marginTop: '0.35rem' }}>
                    {std.bad_example && (
                      <div
                        style={{
                          padding: '0.75rem',
                          borderRadius: '10px',
                          background: 'rgba(244, 63, 94, 0.08)',
                          border: '1px solid rgba(244, 63, 94, 0.3)',
                          color: '#fda4af',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.7rem'
                        }}
                      >
                        <span style={{ color: '#fb7185', fontWeight: 700, display: 'block', marginBottom: '0.25rem', fontFamily: 'var(--font-sans)' }}>
                          ❌ Non-Compliant Pattern:
                        </span>
                        <pre style={{ overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                          {std.bad_example}
                        </pre>
                      </div>
                    )}

                    <div
                      style={{
                        padding: '0.75rem',
                        borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.08)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        color: '#6ee7b7',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.7rem'
                      }}
                    >
                      <span style={{ color: '#34d399', fontWeight: 700, display: 'block', marginBottom: '0.25rem', fontFamily: 'var(--font-sans)' }}>
                        ✅ Approved Standard Pattern:
                      </span>
                      <pre style={{ overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                        {std.good_example}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
