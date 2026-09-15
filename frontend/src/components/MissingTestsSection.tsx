import React, { useState } from 'react';
import { TestTube2, Copy, Check, Target, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';
import { MissingTest } from '../types/review';

interface MissingTestsSectionProps {
  missingTests: MissingTest[];
}

export const MissingTestsSection: React.FC<MissingTestsSectionProps> = ({ missingTests }) => {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopyCode = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getScenarioTypeBadge = (type: string) => {
    switch (type) {
      case 'negative_path':
        return (
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              padding: '0.15rem 0.5rem',
              borderRadius: '6px',
              background: 'rgba(244, 63, 94, 0.16)',
              color: 'var(--color-danger)',
              border: '1px solid rgba(244, 63, 94, 0.35)'
            }}
          >
            NEGATIVE PATH
          </span>
        );
      case 'edge_case':
        return (
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              padding: '0.15rem 0.5rem',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.16)',
              color: 'var(--color-warning)',
              border: '1px solid rgba(245, 158, 11, 0.35)'
            }}
          >
            EDGE CASE
          </span>
        );
      case 'regression':
        return (
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              padding: '0.15rem 0.5rem',
              borderRadius: '6px',
              background: 'rgba(139, 92, 246, 0.16)',
              color: 'var(--primary)',
              border: '1px solid rgba(139, 92, 246, 0.35)'
            }}
          >
            REGRESSION
          </span>
        );
      case 'happy_path':
      default:
        return (
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              padding: '0.15rem 0.5rem',
              borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.16)',
              color: 'var(--color-ready)',
              border: '1px solid rgba(16, 185, 129, 0.35)'
            }}
          >
            HAPPY PATH
          </span>
        );
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.35rem' }}>
      {/* Header */}
      <div className="controls-header">
        <div className="flex-row items-center gap-2">
          <TestTube2 size={18} color="var(--primary)" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
            Missing Unit Tests & Edge Case Coverage
          </h3>
          <span className="tab-counter-badge">
            {missingTests.length} recommended scenarios
          </span>
        </div>
      </div>

      {missingTests.length === 0 ? (
        <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={36} color="var(--color-ready)" style={{ margin: '0 auto 0.75rem auto' }} />
          <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--foreground)' }}>
            Comprehensive Test Coverage Observed
          </p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            All core branches, negative flows, and validation assertions are present in the diff.
          </p>
        </div>
      ) : (
        <div className="grid-2" style={{ marginTop: '1.15rem' }}>
          {missingTests.map((test, idx) => (
            <div key={idx} className="test-scenario-card">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="flex-row items-center justify-between gap-2">
                  {getScenarioTypeBadge(test.scenario_type)}
                  <div className="file-loc-tag">
                    <Target size={12} />
                    <span title={test.target_file}>
                      {test.target_file.split('/').pop() || test.target_file}
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.5 }}>
                  {test.description}
                </p>
              </div>

              {test.suggested_test_code && (
                <div className="test-code-snippet">
                  <div
                    className="flex-row items-center justify-between"
                    style={{ marginBottom: '0.35rem', color: 'var(--text-muted)' }}
                  >
                    <span style={{ fontSize: '0.68rem' }}>// Suggested Test Method:</span>
                    <button
                      type="button"
                      onClick={() => handleCopyCode(test.suggested_test_code!, idx)}
                      className="btn-ghost"
                      title="Copy test code"
                    >
                      {copiedId === idx ? <Check size={12} color="var(--color-ready)" /> : <Copy size={12} />}
                      <span style={{ fontSize: '0.68rem' }}>
                        {copiedId === idx ? 'Copied' : 'Copy Test'}
                      </span>
                    </button>
                  </div>
                  <pre style={{ overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                    {test.suggested_test_code}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
