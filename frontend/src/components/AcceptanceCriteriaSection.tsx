import React from 'react';
import { CheckSquare, CheckCircle2, XCircle, AlertCircle, Sparkles, FileText } from 'lucide-react';
import { AcceptanceCriteriaResult } from '../types/review';

interface AcceptanceCriteriaSectionProps {
  criteriaResults: AcceptanceCriteriaResult[];
}

export const AcceptanceCriteriaSection: React.FC<AcceptanceCriteriaSectionProps> = ({
  criteriaResults
}) => {
  const satisfiedCount = criteriaResults.filter((c) => c.is_satisfied).length;
  const totalCount = criteriaResults.length;
  const satisfactionRate = totalCount > 0 ? Math.round((satisfiedCount / totalCount) * 100) : 100;

  return (
    <div className="glass-panel" style={{ padding: '1.35rem' }}>
      {/* Header */}
      <div className="controls-header">
        <div className="flex-row items-center gap-2">
          <CheckSquare size={18} color="#818cf8" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
            Acceptance Criteria Verification Matrix
          </h3>
          <span className="tab-counter-badge">
            {satisfiedCount} of {totalCount} Satisfied ({satisfactionRate}%)
          </span>
        </div>
      </div>

      {totalCount === 0 ? (
        <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <CheckSquare size={36} color="#818cf8" style={{ margin: '0 auto 0.75rem auto' }} />
          <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
            No explicit Acceptance Criteria parsed
          </p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            Provide numbered requirements in the Acceptance Criteria box to verify condition satisfaction.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: '1.15rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {criteriaResults.map((item, idx) => {
            const isSatisfied = item.is_satisfied;
            return (
              <div
                key={idx}
                className={`ac-card ${isSatisfied ? 'satisfied' : 'failed'}`}
              >
                <div className="flex-row items-center justify-between gap-2" style={{ flexWrap: 'wrap' }}>
                  <div className="flex-row items-center gap-2">
                    {isSatisfied ? (
                      <span
                        className="flex-row items-center gap-1"
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#34d399',
                          background: 'rgba(16, 185, 129, 0.15)',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid rgba(16, 185, 129, 0.35)'
                        }}
                      >
                        <CheckCircle2 size={13} /> SATISFIED
                      </span>
                    ) : (
                      <span
                        className="flex-row items-center gap-1"
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#fb7185',
                          background: 'rgba(244, 63, 94, 0.15)',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          border: '1px solid rgba(244, 63, 94, 0.35)'
                        }}
                      >
                        <XCircle size={13} /> NOT SATISFIED
                      </span>
                    )}

                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px'
                      }}
                    >
                      {item.criterion_id || `AC-${idx + 1}`}
                    </span>

                    {item.priority && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          color: item.priority === 'HIGH' ? '#fcd34d' : 'var(--text-muted)'
                        }}
                      >
                        [{item.priority} PRIORITY]
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc' }}>
                    {item.description}
                  </p>

                  {item.checkable_condition && (
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      <strong style={{ color: '#c7d2fe' }}>Grounded Condition: </strong>
                      {item.checkable_condition}
                    </p>
                  )}
                </div>

                {item.evidence && (
                  <div className="evidence-box" style={{ marginTop: '0.25rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', marginBottom: '0.2rem' }}>
                      // Verification Evidence from Diff:
                    </div>
                    <pre style={{ color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                      {item.evidence}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
