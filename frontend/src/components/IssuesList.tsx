import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Check,
  Copy,
  FileText,
  ChevronRight,
  Lock,
  Wrench,
  Search,
  CheckCircle2
} from 'lucide-react';
import { GroundedIssue, Severity } from '../types/review';

interface IssuesListProps {
  issues: GroundedIssue[];
}

export const IssuesList: React.FC<IssuesListProps> = ({ issues }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const categories = ['ALL', 'Security', 'Acceptance Criteria', 'Quality', 'Standards', 'Error Handling'];

  const filteredIssues = issues.filter((issue) => {
    const matchesCategory =
      selectedCategory === 'ALL' ||
      issue.category?.toLowerCase() === selectedCategory.toLowerCase();

    const matchesSearch =
      !searchQuery.trim() ||
      issue.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.file.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.suggestion.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.rule_id && issue.rule_id.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const handleCopySuggestion = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getSeverityBadge = (sev: Severity, isBlocking?: boolean) => {
    switch (sev) {
      case 'CRITICAL':
        return (
          <span className="severity-pill severity-critical">
            <Lock size={12} /> BLOCKING CRITICAL
          </span>
        );
      case 'ERROR':
        return (
          <span className="severity-pill severity-error">
            <ShieldAlert size={12} /> ERROR
          </span>
        );
      case 'WARNING':
        return (
          <span className="severity-pill severity-warning">
            <AlertTriangle size={12} /> WARNING
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="severity-pill severity-info">
            <Info size={12} /> INFO
          </span>
        );
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.35rem' }}>
      {/* Header and Filter Toolbar */}
      <div className="controls-header">
        <div className="flex-row items-center gap-2">
          <Wrench size={18} color="#818cf8" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
            Grounded Findings & Fix Recommendations
          </h3>
          <span className="tab-counter-badge">
            {filteredIssues.length} of {issues.length}
          </span>
        </div>

        {/* Search & Category Pills */}
        <div className="flex-row items-center gap-2" style={{ flexWrap: 'wrap' }}>
          {/* Quick Search */}
          <div
            className="flex-row items-center gap-1.5"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '0.3rem 0.65rem'
            }}
          >
            <Search size={13} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search findings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '0.72rem',
                color: '#ffffff',
                width: '130px'
              }}
            />
          </div>

          {/* Category Chips */}
          <div className="scenario-chips-wrapper">
            {categories.map((cat) => {
              const count = cat === 'ALL'
                ? issues.length
                : issues.filter((i) => i.category?.toLowerCase() === cat.toLowerCase()).length;

              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`scenario-chip ${selectedCategory === cat ? 'active' : ''}`}
                >
                  <span>{cat}</span>
                  {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Issues Cards List */}
      <div style={{ marginTop: '1.15rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {filteredIssues.length === 0 ? (
          <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 0.75rem auto' }} />
            <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
              No issues detected in this category
            </p>
            <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
              The current diff satisfies all relevant quality and security rules.
            </p>
          </div>
        ) : (
          filteredIssues.map((issue, idx) => {
            const issueKey = `${issue.file}-${issue.line}-${idx}`;
            const isBlocking = issue.is_blocking || issue.severity === 'CRITICAL';

            return (
              <div
                key={issueKey}
                className={`issue-card ${isBlocking ? 'issue-card-blocking' : ''}`}
              >
                {/* Issue Header Strip */}
                <div className="flex-row items-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
                  <div className="flex-row items-center gap-2">
                    {getSeverityBadge(issue.severity, issue.is_blocking)}
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>
                      {issue.category}
                    </span>
                    {issue.rule_id && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontFamily: 'var(--font-mono)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '6px',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        {issue.rule_id}
                      </span>
                    )}
                  </div>

                  {/* File & Line Tag */}
                  <div className="file-loc-tag">
                    <FileText size={12} />
                    <span>
                      {issue.file}:{issue.line > 0 ? issue.line : 'file'}
                    </span>
                  </div>
                </div>

                {/* Main Message */}
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f8fafc', lineHeight: 1.5 }}>
                  {issue.message}
                </p>

                {/* Observed Evidence Box */}
                {issue.evidence && (
                  <div className="evidence-box">
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginBottom: '0.25rem' }}>
                      // Observed Code Evidence:
                    </div>
                    <pre style={{ color: '#e2e8f0', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                      {issue.evidence}
                    </pre>
                  </div>
                )}

                {/* Remediation Suggestion Card */}
                {issue.suggestion && (
                  <div className="remediation-box">
                    <div
                      className="flex-row items-center justify-between gap-2"
                      style={{ marginBottom: '0.4rem' }}
                    >
                      <span
                        className="flex-row items-center gap-1"
                        style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a5b4fc' }}
                      >
                        <ChevronRight size={14} /> Recommended Remediation:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopySuggestion(issue.suggestion, issueKey)}
                        className="btn-ghost"
                        title="Copy suggested fix"
                      >
                        {copiedId === issueKey ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                        <span style={{ fontSize: '0.68rem' }}>
                          {copiedId === issueKey ? 'Copied' : 'Copy Fix'}
                        </span>
                      </button>
                    </div>
                    <p style={{ fontSize: '0.76rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                      {issue.suggestion}
                    </p>
                    {issue.fix_code && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginBottom: '0.25rem' }}>
                          // Suggested Fix Code:
                        </div>
                        <pre style={{ color: '#e2e8f0', background: 'rgba(0,0,0,0.4)', padding: '0.5rem', borderRadius: '4px', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                          {issue.fix_code}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
