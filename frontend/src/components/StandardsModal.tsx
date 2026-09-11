import React, { useState, useEffect, useRef } from 'react';
import { X, BookOpen, Check, Shield, Search, Sparkles, Upload, Trash2 } from 'lucide-react';
import { fetchAllStandards, uploadStandardsBulk, deleteStandard } from '../services/api';

interface StandardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // We can ignore the standards prop and fetch all dynamically
}

export const StandardsModal: React.FC<StandardsModalProps> = ({ isOpen, onClose }) => {
  const [search, setSearch] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('ALL');
  const [allStandards, setAllStandards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStandards = async () => {
    try {
      const data = await fetchAllStandards();
      setAllStandards(data);
    } catch (err) {
      console.error("Failed to load all standards", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStandards();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const languages = ['ALL', ...Array.from(new Set(allStandards.map((s: any) => (s.language || 'general').toLowerCase())))];


  const filteredStandards = allStandards.filter((std) => {
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const text = await file.text();
      const json = JSON.parse(text);
      const rulesArray = Array.isArray(json) ? json : [json];
      
      await uploadStandardsBulk(rulesArray);
      await loadStandards();
      alert("Rules uploaded successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to upload rules. Ensure it is a valid JSON array.");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (ruleCode: string) => {
    if (!window.confirm(`Are you sure you want to delete rule ${ruleCode}?`)) return;
    try {
      await deleteStandard(ruleCode);
      await loadStandards();
    } catch (err) {
      console.error(err);
      alert("Failed to delete rule.");
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window" style={{ maxWidth: '900px', height: '85vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex-row items-center gap-2">
            <BookOpen size={20} color="#818cf8" />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
              Knowledge Base & Coding Standards
            </h3>
            <span className="tab-counter-badge">
              {filteredStandards.length} rules
            </span>
          </div>
          <button type="button" onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>

        {/* Search, Filter & Actions */}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input 
                type="file" 
                accept=".json" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileUpload}
              />
              <button 
                type="button" 
                className="btn-primary" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.75rem' }}
              >
                <Upload size={14} style={{ marginRight: '0.3rem' }} />
                Upload Rules (JSON)
              </button>
            </div>
          </div>
        </div>

        {/* Body Standards List */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            These vetted architectural & security guidelines are vectorized in ChromaDB to ground all automated agent recommendations dynamically.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            {filteredStandards.map((std, idx) => (
              <div key={idx} className="issue-card" style={{ padding: '1.15rem', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                  <button 
                    onClick={() => handleDelete(std.rule_code)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    title="Delete Rule"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex-row items-center justify-between gap-2" style={{ flexWrap: 'wrap', paddingRight: '2rem' }}>
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
                  <div className="flex-row items-center gap-2">
                    {std.created_at && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          color: 'var(--text-muted)'
                        }}
                      >
                        {new Date(std.created_at).toLocaleString()}
                      </span>
                    )}
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
