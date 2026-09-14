import React, { useState } from 'react';
import { X, History, ArrowRight, ShieldCheck, AlertTriangle, XCircle, Search, Clock, Calendar, Database } from 'lucide-react';
import { fetchReviewDetails } from '../services/api';
import { ReviewResult } from '../types/review';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: any[];
  onSelectSession: (review: ReviewResult) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  sessions,
  onSelectSession
}) => {
  const [search, setSearch] = useState('');
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredSessions = sessions.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.id && s.id.toLowerCase().includes(q)) ||
      (s.repository_name && s.repository_name.toLowerCase().includes(q)) ||
      (s.branch && s.branch.toLowerCase().includes(q)) ||
      (s.push_readiness && s.push_readiness.toLowerCase().includes(q)) ||
      (s.model_used && s.model_used.toLowerCase().includes(q))
    );
  });

  const handleLoadSession = async (sessionId: string) => {
    setLoadingSessionId(sessionId);
    try {
      const fullReview = await fetchReviewDetails(sessionId);
      onSelectSession(fullReview);
      onClose();
    } catch (e: any) {
      alert('Failed to load session details: ' + (e.message || e));
    } finally {
      setLoadingSessionId(null);
    }
  };

  const getVerdictIcon = (verdict: string) => {
    switch (verdict) {
      case 'READY':
        return <ShieldCheck size={16} color="var(--color-ready)" />;
      case 'MINOR_FIXES_REQUIRED':
        return <AlertTriangle size={16} color="var(--color-warning)" />;
      case 'DO_NOT_PUSH':
        return <XCircle size={16} color="var(--color-danger)" />;
      default:
        return <ShieldCheck size={16} color="var(--color-info)" />;
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'READY':
        return (
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--color-ready)',
              border: '1px solid rgba(16, 185, 129, 0.35)'
            }}
          >
            READY
          </span>
        );
      case 'MINOR_FIXES_REQUIRED':
        return (
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--color-warning)',
              border: '1px solid rgba(245, 158, 11, 0.35)'
            }}
          >
            MINOR FIXES
          </span>
        );
      case 'DO_NOT_PUSH':
        return (
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: '6px',
              background: 'rgba(244, 63, 94, 0.15)',
              color: 'var(--color-danger)',
              border: '1px solid rgba(244, 63, 94, 0.35)'
            }}
          >
            DO NOT PUSH
          </span>
        );
      default:
        return (
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: '6px',
              background: 'rgba(6, 182, 212, 0.15)',
              color: 'var(--color-info)',
              border: '1px solid rgba(6, 182, 212, 0.35)'
            }}
          >
            {verdict}
          </span>
        );
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-window" style={{ maxWidth: '780px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="flex-row items-center gap-2">
            <History size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--foreground)' }}>
              Review Session History
            </h3>
            <span className="tab-counter-badge">
              {filteredSessions.length} total
            </span>
          </div>
          <button type="button" onClick={onClose} className="btn-icon">
            <X size={16} />
          </button>
        </div>

        {/* Search & Filter */}
        <div style={{ padding: '1rem 1.75rem 0.25rem 1.75rem' }}>
          <div
            className="flex-row items-center gap-2"
            style={{
              background: 'var(--background)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '0.5rem 0.85rem'
            }}
          >
            <Search size={15} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by repository, branch, session ID, or model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'var(--background)',
                border: 'none',
                outline: 'none',
                fontSize: '0.78rem',
                color: 'var(--foreground)',
                width: '100%'
              }}
            />
          </div>
        </div>

        {/* Body Sessions List */}
        <div className="modal-body">
          {filteredSessions.length === 0 ? (
            <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Database size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto' }} />
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--foreground)' }}>
                No review sessions recorded
              </p>
              <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Run a code review to automatically persist findings and audit logs in the database.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredSessions.map((s) => {
                const isCurrentLoading = loadingSessionId === s.id;
                return (
                  <div
                    key={s.id}
                    className="issue-card bg-sidebar border-border"
                    style={{ padding: '1rem 1.15rem' }}
                  >
                    <div className="flex-row items-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
                      <div className="flex-row items-center gap-2">
                        {getVerdictIcon(s.push_readiness)}
                        {getVerdictBadge(s.push_readiness)}
                        <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--foreground)' }}>
                          {s.repository_name || 'workspace'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          ({s.branch || 'main'})
                        </span>
                      </div>

                      <div className="flex-row items-center gap-2">
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Clock size={11} /> {s.duration_ms ? (s.duration_ms / 1000).toFixed(1) + 's' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleLoadSession(s.id)}
                          disabled={isCurrentLoading}
                          className="btn-prime bg-gradient-to-br from-primary to-[var(--hover-orange)] text-white border-white/15"
                          style={{ padding: '0.35rem 0.8rem', fontSize: '0.72rem' }}
                        >
                          <span>{isCurrentLoading ? 'Loading...' : 'Inspect'}</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {s.summary || 'No summary recorded.'}
                    </p>

                    <div className="flex-row items-center justify-between" style={{ fontSize: '0.68rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.4rem' }}>
                      <span>Model: <strong style={{ color: 'var(--primary)' }}>{s.model_used || 'LLM Agent'}</strong></span>
                      <span>Session ID: <code style={{ color: 'var(--text-disabled)' }}>{s.id?.slice(0, 12)}...</code></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary cursor-pointer text-primary-foreground hover:bg-primary/95 bg-primary/80 text-text-primary border border-border-medium hover:border-white/20 hover:text-white">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
