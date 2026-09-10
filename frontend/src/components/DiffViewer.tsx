import React, { useState } from 'react';
import { FileCode, AlertCircle, CheckCircle2, ChevronRight, FileDiff, ShieldAlert } from 'lucide-react';
import { GroundedIssue } from '../types/review';

interface DiffViewerProps {
  diffText: string;
  issues: GroundedIssue[];
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diffText, issues }) => {
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);

  if (!diffText || !diffText.trim()) {
    return (
      <div className="glass-panel" style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <FileCode size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto' }} />
        <p style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
          No Git Diff Available
        </p>
        <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
          Provide unified diff content above to inspect changes line-by-line.
        </p>
      </div>
    );
  }

  // Parse diff blocks by file
  const fileBlocks = diffText.split(/(?=^diff --git )/m).filter((b) => b.trim());

  // Current active block
  const currentBlock = fileBlocks[activeFileIndex] || fileBlocks[0] || '';
  const currentLines = currentBlock.split('\n');

  // Compute addition / deletion statistics
  const addCount = currentLines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;
  const delCount = currentLines.filter((l) => l.startsWith('-') && !l.startsWith('---')).length;

  return (
    <div className="diff-root">
      {/* Diff Toolbar / File Switcher Tabs */}
      <div className="diff-toolbar">
        <div className="flex-row items-center gap-2" style={{ flexShrink: 0 }}>
          <FileDiff size={16} color="#818cf8" />
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#f8fafc' }}>
            Modified Files ({fileBlocks.length}):
          </span>
        </div>

        {/* File Tabs */}
        <div className="flex-row items-center gap-1.5" style={{ overflowX: 'auto', flex: 1 }}>
          {fileBlocks.map((block, idx) => {
            const firstLines = block.split('\n').slice(0, 5).join(' ');
            const match = firstLines.match(/diff --git a\/(.*?)\s+b\/(.*)/);
            const fileName = match ? match[2] : `File ${idx + 1}`;
            const fileIssues = issues.filter(
              (i) => i.file.includes(fileName) || fileName.includes(i.file)
            );

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveFileIndex(idx)}
                className={`diff-file-btn ${activeFileIndex === idx ? 'active' : ''}`}
              >
                <span>{fileName.split('/').pop() || fileName}</span>
                {fileIssues.length > 0 && (
                  <span
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '10px',
                      background: '#f43f5e',
                      color: '#ffffff'
                    }}
                  >
                    {fileIssues.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Diff Stats */}
        <div className="flex-row items-center gap-2" style={{ flexShrink: 0, fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
          <span style={{ color: '#34d399', fontWeight: 700 }}>+{addCount}</span>
          <span style={{ color: '#fb7185', fontWeight: 700 }}>-{delCount}</span>
        </div>
      </div>

      {/* Code Lines Display */}
      <div className="diff-content-area">
        {currentLines.map((line, lIdx) => {
          let lineClass = 'diff-line-row';
          let prefix = ' ';

          if (line.startsWith('+') && !line.startsWith('+++')) {
            lineClass = 'diff-line-row diff-added';
            prefix = '+';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            lineClass = 'diff-line-row diff-deleted';
            prefix = '-';
          } else if (line.startsWith('@@')) {
            lineClass = 'diff-hunk';
          }

          return (
            <div key={lIdx} className={lineClass}>
              <span className="diff-line-num">{lIdx + 1}</span>
              <span style={{ whiteSpace: 'pre', color: 'inherit' }}>{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
