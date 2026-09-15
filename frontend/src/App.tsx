import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { RulesManager } from './components/RulesManager';
import { PushReadinessCard } from './components/PushReadinessCard';
import { IssuesList } from './components/IssuesList';
import { AcceptanceCriteriaSection } from './components/AcceptanceCriteriaSection';
import { MissingTestsSection } from './components/MissingTestsSection';
import { DiffViewer } from './components/DiffViewer';
import { HistoryModal } from './components/HistoryModal';
import { StandardsModal } from './components/StandardsModal';
import { ConfigModal } from './components/ConfigModal';
import { ReviewResult, ServerConfig } from './types/review';
import { fetchStandards, fetchServerConfig, fetchReviewHistory } from './services/api';
import {
  LayoutDashboard,
  CheckSquare,
  TestTube,
  FileCode,
  Sparkles
} from 'lucide-react';

export const App: React.FC = () => {
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [currentDiff, setCurrentDiff] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'ac' | 'tests' | 'diff'>('overview');
  const [standards, setStandards] = useState<any[]>([]);
  const [historySessions, setHistorySessions] = useState<any[]>([]);
  const [config, setConfig] = useState<ServerConfig | null>(null);

  // Modals state
  const [isStandardsOpen, setIsStandardsOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Toast notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadInitialData = async () => {
    try {
      const [cfg, stds, hist] = await Promise.allSettled([
        fetchServerConfig(),
        fetchStandards(),
        fetchReviewHistory()
      ]);

      if (cfg.status === 'fulfilled') setConfig(cfg.value);
      if (stds.status === 'fulfilled') setStandards(stds.value);
      if (hist.status === 'fulfilled') setHistorySessions(hist.value);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleSelectHistorySession = (loadedReview: ReviewResult) => {
    setReviewResult(loadedReview);
    if ((loadedReview as any).session?.git_diff) {
      setCurrentDiff((loadedReview as any).session.git_diff);
    }
    setActiveTab('overview');
    showToast(`Loaded Session: ${loadedReview.reviewMetadata?.sessionId?.slice(0, 8) || 'Historical'}`);
  };

  return (
    <div className="app-container">
      {/* Prime Header */}
      <Header
        config={config}
        onOpenConfig={() => setIsConfigOpen(true)}
        onOpenStandards={() => setIsStandardsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={historySessions.length}
      />

      {/* Main Workspace View */}
      <main className="main-content">
        {/* Rules Ingestion & Language-Wise Standards Explorer */}
        <RulesManager onNotify={(msg) => showToast(msg)} />

        {/* Results Panel */}
        {reviewResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Top Push Readiness Verdict Hero */}
            <PushReadinessCard
              status={reviewResult.pushReadiness}
              riskLevel={reviewResult.riskLevel}
              summary={reviewResult.summary}
              blockingCount={reviewResult.blockingIssues}
              warningCount={reviewResult.warningIssues}
              passedChecksCount={reviewResult.passedChecksCount}
              missingTestsCount={reviewResult.missingTestsCount}
              durationMs={reviewResult.reviewMetadata?.durationMs || 0}
              model={reviewResult.reviewMetadata?.model || 'LLM Agent'}
              sessionId={reviewResult.reviewMetadata?.sessionId}
              onTabSelect={(tab) => setActiveTab(tab)}
            />

            {/* Navigation Tabs Bar */}
            <div className="tab-bar-root">
              <button
                onClick={() => setActiveTab('overview')}
                className={`tab-nav-btn ${activeTab === 'overview' ? 'active' : ''}`}
              >
                <LayoutDashboard size={15} />
                <span>Findings & Remediation</span>
                <span className="tab-counter-badge">{reviewResult.issues.length}</span>
              </button>

              <button
                onClick={() => setActiveTab('ac')}
                className={`tab-nav-btn ${activeTab === 'ac' ? 'active' : ''}`}
              >
                <CheckSquare size={15} />
                <span>Acceptance Criteria</span>
                <span className="tab-counter-badge">
                  {reviewResult.acceptanceCriteriaResults?.length || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('tests')}
                className={`tab-nav-btn ${activeTab === 'tests' ? 'active' : ''}`}
              >
                <TestTube size={15} />
                <span>Missing Tests & Edge Cases</span>
                <span className="tab-counter-badge">
                  {reviewResult.missingTests?.length || 0}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('diff')}
                className={`tab-nav-btn ${activeTab === 'diff' ? 'active' : ''}`}
              >
                <FileCode size={15} />
                <span>Visual Diff Inspector</span>
              </button>
            </div>

            {/* Tab Views */}
            {activeTab === 'overview' && (
              <IssuesList issues={reviewResult.issues} />
            )}

            {activeTab === 'ac' && (
              <AcceptanceCriteriaSection
                criteriaResults={reviewResult.acceptanceCriteriaResults || []}
              />
            )}

            {activeTab === 'tests' && (
              <MissingTestsSection
                missingTests={reviewResult.missingTests || []}
              />
            )}

            {activeTab === 'diff' && (
              <DiffViewer
                diffText={currentDiff}
                issues={reviewResult.issues}
              />
            )}
          </div>
        )}
      </main>

      {/* Modals & Dialogs */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={historySessions}
        onSelectSession={handleSelectHistorySession}
      />

      <StandardsModal
        isOpen={isStandardsOpen}
        onClose={() => setIsStandardsOpen(false)}
        standards={standards}
      />

      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={config}
        onConfigUpdated={(newCfg) => setConfig(newCfg)}
      />

      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="toast-container">
          <div className="toast-item">
            <Sparkles size={16} color="var(--primary-orange)" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer-root bg-card">
        AI Code Review Agent — Enterprise Standards Ingestion & Pre-Push Gatekeeper Engine (Python Flask + MySQL + React)
      </footer>
    </div>
  );
};
