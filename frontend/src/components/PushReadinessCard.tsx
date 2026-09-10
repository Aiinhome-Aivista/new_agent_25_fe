import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  HelpCircle,
  CheckCircle2,
  AlertOctagon,
  Copy,
  Check,
  Download,
  Share2,
  Clock,
  Cpu,
  Hash
} from 'lucide-react';
import { PushReadinessStatus, RiskLevel } from '../types/review';

interface PushReadinessCardProps {
  status: PushReadinessStatus;
  riskLevel: RiskLevel;
  summary: string;
  blockingCount: number;
  warningCount: number;
  passedChecksCount: number;
  missingTestsCount: number;
  durationMs: number;
  model: string;
  sessionId?: string;
  onTabSelect?: (tab: 'overview' | 'ac' | 'tests' | 'diff') => void;
}

export const PushReadinessCard: React.FC<PushReadinessCardProps> = ({
  status,
  riskLevel,
  summary,
  blockingCount,
  warningCount,
  passedChecksCount,
  missingTestsCount,
  durationMs,
  model,
  sessionId,
  onTabSelect
}) => {
  const [copiedPr, setCopiedPr] = useState(false);

  const getVerdictDetails = () => {
    switch (status) {
      case 'READY':
        return {
          title: 'READY TO PUSH',
          subtitle: 'All deterministic quality gates, security baselines, and test scenarios passed successfully.',
          heroClass: 'verdict-hero verdict-hero-ready',
          icon: <ShieldCheck size={32} color="#10b981" />
        };
      case 'MINOR_FIXES_REQUIRED':
        return {
          title: 'MINOR FIXES REQUIRED',
          subtitle: 'Non-blocking improvements, standards alignment, or optional test coverage suggested.',
          heroClass: 'verdict-hero verdict-hero-warning',
          icon: <AlertTriangle size={32} color="#f59e0b" />
        };
      case 'DO_NOT_PUSH':
        return {
          title: 'DO NOT PUSH — GATE BLOCKED',
          subtitle: 'Critical security vulnerability, policy violation, or failed mandatory criterion detected.',
          heroClass: 'verdict-hero verdict-hero-blocked',
          icon: <XCircle size={32} color="#f43f5e" />
        };
      case 'LIMITED_REVIEW':
      default:
        return {
          title: 'LIMITED REVIEW',
          subtitle: 'Review executed with partial context or missing acceptance criteria.',
          heroClass: 'verdict-hero verdict-hero-limited',
          icon: <HelpCircle size={32} color="#06b6d4" />
        };
    }
  };

  const verdict = getVerdictDetails();

  const getRiskBadge = () => {
    switch (riskLevel) {
      case 'LOW':
        return <span className="risk-level-badge risk-level-low">LOW RISK</span>;
      case 'MEDIUM':
        return <span className="risk-level-badge risk-level-medium">MEDIUM RISK</span>;
      case 'HIGH':
        return <span className="risk-level-badge risk-level-high">HIGH RISK</span>;
      case 'CRITICAL':
        return <span className="risk-level-badge risk-level-critical">CRITICAL RISK</span>;
      default:
        return <span className="risk-level-badge" style={{ background: 'rgba(255,255,255,0.08)' }}>UNKNOWN</span>;
    }
  };

  const handleCopyPrComment = () => {
    const prComment = `## 🛡️ AI Code Review Agent — Gate Verdict: **${verdict.title}**
**Risk Level:** ${riskLevel} | **Evaluator:** ${model} (${(durationMs / 1000).toFixed(2)}s)

### 📊 Summary
${summary}

### 🔍 Gatekeeper Metrics
- 🚫 **Blocking Issues:** ${blockingCount}
- ⚠️ **Warnings:** ${warningCount}
- ✅ **Passed Checks:** ${passedChecksCount}
- 🧪 **Missing Tests:** ${missingTestsCount}

*Automated Pre-Push Gatekeeper Engine*`;

    navigator.clipboard.writeText(prComment);
    setCopiedPr(true);
    setTimeout(() => setCopiedPr(false), 2500);
  };

  return (
    <div className={verdict.heroClass}>
      {/* Top Section */}
      <div className="verdict-header">
        <div className="verdict-badge-box">
          <div className="verdict-icon-container">
            {verdict.icon}
          </div>
          <div>
            <div className="flex-row items-center gap-3">
              <h2 className="verdict-title-text">{verdict.title}</h2>
              {getRiskBadge()}
            </div>
            <p className="verdict-subtitle-text">{verdict.subtitle}</p>
          </div>
        </div>

        {/* Execution Metadata & Export Actions */}
        <div className="verdict-meta-strip">
          <div className="flex-row items-center gap-2">
            <Cpu size={12} />
            <span>Model: <strong style={{ color: '#c7d2fe' }}>{model}</strong></span>
          </div>
          <div className="flex-row items-center gap-2">
            <Clock size={12} />
            <span>Latency: <strong style={{ color: '#f8fafc' }}>{(durationMs / 1000).toFixed(2)}s</strong></span>
          </div>
          {sessionId && (
            <div className="flex-row items-center gap-2">
              <Hash size={12} />
              <span>Session: <strong style={{ color: 'var(--text-muted)' }}>{sessionId.slice(0, 8)}...</strong></span>
            </div>
          )}
          <button
            onClick={handleCopyPrComment}
            className="btn-secondary"
            style={{ marginTop: '0.35rem', padding: '0.35rem 0.75rem', fontSize: '0.72rem' }}
          >
            {copiedPr ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
            <span>{copiedPr ? 'PR Summary Copied!' : 'Copy PR Comment'}</span>
          </button>
        </div>
      </div>

      {/* Summary Narrative Box */}
      <div className="verdict-summary-box">
        <strong style={{ color: '#818cf8', marginRight: '0.5rem' }}>
          Orchestrator Verdict Summary:
        </strong>
        {summary}
      </div>

      {/* 4 Interactive KPI Metric Cards */}
      <div className="grid-4">
        <div
          onClick={() => onTabSelect && onTabSelect('overview')}
          className={`metric-kpi-card ${blockingCount > 0 ? 'danger' : ''}`}
          style={{ cursor: onTabSelect ? 'pointer' : 'default' }}
          title="Click to view issues"
        >
          <div className="metric-label">
            <span>Blocking Issues</span>
            <AlertOctagon size={16} color={blockingCount > 0 ? '#f43f5e' : 'var(--text-muted)'} />
          </div>
          <div className="metric-value" style={{ color: blockingCount > 0 ? '#fb7185' : '#ffffff' }}>
            {blockingCount}
          </div>
        </div>

        <div
          onClick={() => onTabSelect && onTabSelect('overview')}
          className={`metric-kpi-card ${warningCount > 0 ? 'warning' : ''}`}
          style={{ cursor: onTabSelect ? 'pointer' : 'default' }}
          title="Click to view warnings"
        >
          <div className="metric-label">
            <span>Warnings</span>
            <AlertTriangle size={16} color={warningCount > 0 ? '#f59e0b' : 'var(--text-muted)'} />
          </div>
          <div className="metric-value" style={{ color: warningCount > 0 ? '#fcd34d' : '#ffffff' }}>
            {warningCount}
          </div>
        </div>

        <div
          className="metric-kpi-card success"
          title="Security & compliance checks passed"
        >
          <div className="metric-label">
            <span>Passed Checks</span>
            <CheckCircle2 size={16} color="#10b981" />
          </div>
          <div className="metric-value" style={{ color: '#6ee7b7' }}>
            {passedChecksCount}
          </div>
        </div>

        <div
          onClick={() => onTabSelect && onTabSelect('tests')}
          className={`metric-kpi-card ${missingTestsCount > 0 ? 'brand' : ''}`}
          style={{ cursor: onTabSelect ? 'pointer' : 'default' }}
          title="Click to view missing test scenarios"
        >
          <div className="metric-label">
            <span>Missing Tests</span>
            <ShieldCheck size={16} color={missingTestsCount > 0 ? '#818cf8' : 'var(--text-muted)'} />
          </div>
          <div className="metric-value" style={{ color: missingTestsCount > 0 ? '#a5b4fc' : '#ffffff' }}>
            {missingTestsCount}
          </div>
        </div>
      </div>
    </div>
  );
};
