import * as vscode from 'vscode';
import { GitService } from './GitService';
import { DiagnosticsManager } from './DiagnosticsManager';

export class ReviewWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'aiCodeReview.reviewView';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _diagnosticsManager: DiagnosticsManager
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'triggerReview': {
          await this.executeReview(data.acceptanceCriteria, data.language);
          break;
        }
        case 'openFile': {
          await this.openFileAtLine(data.file, data.line);
          break;
        }
        case 'applyFix': {
          await this.applyFixToCode(data.file, data.line, data.fixCode);
          break;
        }
        case 'copyToClipboard': {
          if (data.text) {
            await vscode.env.clipboard.writeText(data.text);
            vscode.window.showInformationMessage('📋 ' + (data.message || 'Copied to clipboard!'));
          }
          break;
        }
      }
    });
  }

  private async openFileAtLine(filePath: string, line: number) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return;

    try {
      const rootPath = workspaceFolders[0].uri.fsPath;
      const normalizedPath = filePath.replace(/\\/g, '/');
      const uri = vscode.Uri.file(`${rootPath}/${normalizedPath}`.replace(/\/+/g, '/'));
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);
      if (line > 0) {
        const lineIdx = Math.max(0, line - 1);
        const pos = new vscode.Position(lineIdx, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      }
    } catch (err: any) {
      vscode.window.showWarningMessage(`Could not open file ${filePath}: ${err.message}`);
    }
  }

  public async applyFixToCode(filePath: string, line: number, fixCode: string) {
    if (fixCode === undefined || fixCode === null) {
      vscode.window.showWarningMessage('No valid fix code available to apply.');
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return;

    try {
      const rootPath = workspaceFolders[0].uri.fsPath;
      const normalizedPath = filePath.replace(/\\/g, '/');
      const uri = vscode.Uri.file(`${rootPath}/${normalizedPath}`.replace(/\/+/g, '/'));
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc);

      // Clean markdown fences from fixCode
      let cleanFix = fixCode.replace(/^```[a-zA-Z]*\r?\n?/, '').replace(/\r?\n?```$/, '').trim();

      const edit = new vscode.WorkspaceEdit();
      const lineIdx = Math.max(0, (line || 1) - 1);
      
      if (lineIdx < doc.lineCount) {
        const targetLine = doc.lineAt(lineIdx);
        if (cleanFix === '') {
          // Deleting stray line
          edit.delete(uri, targetLine.rangeIncludingLineBreak);
        } else {
          // Preserve original leading whitespace/indentation
          const leadingIndentMatch = targetLine.text.match(/^(\s*)/);
          const leadingIndent = leadingIndentMatch ? leadingIndentMatch[1] : '';
          let finalReplacement = '';
          if (targetLine.text.includes('0.0.0.0') && (cleanFix.includes('127.0.0.1') || cleanFix.includes('host=')) && !cleanFix.includes('uvicorn.run') && !cleanFix.includes('app.run')) {
            finalReplacement = targetLine.text.replace(/['"]0\.0\.0\.0['"]/, '"127.0.0.1"');
          } else {
            const indentedFixLines = cleanFix.split(/\r?\n/).map((l, i) => {
              if (i === 0 && !l.startsWith(' ') && !l.startsWith('\t')) {
                return leadingIndent + l;
              }
              return l;
            });
            finalReplacement = indentedFixLines.join('\n');
          }
          edit.replace(uri, targetLine.range, finalReplacement);
        }
      } else if (cleanFix !== '') {
        const endPos = new vscode.Position(doc.lineCount, 0);
        edit.insert(uri, endPos, '\n' + cleanFix);
      }

      const success = await vscode.workspace.applyEdit(edit);
      if (success) {
        await doc.save();
        const pos = new vscode.Position(lineIdx, 0);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        vscode.window.showInformationMessage(`✅ Fix applied successfully to ${filePath}:${line || 1}!`);
      } else {
        vscode.window.showErrorMessage(`Failed to apply fix to ${filePath}`);
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`Error applying fix: ${err.message}`);
    }
  }

  public async executeReview(acceptanceCriteria: string = '', language: string = 'typescript') {
    if (!this._view) return;

    this._view.webview.postMessage({ type: 'statusUpdate', status: 'COLLECTING_DIFF' });

    const diff = await GitService.getWorkingDiff();
    const branch = await GitService.getCurrentBranch();

    if (!diff || !diff.trim()) {
      vscode.window.showWarningMessage('AI Code Review: No working git diff detected. Please modify or stage files first.');
      this._view.webview.postMessage({
        type: 'reviewResult',
        result: {
          pushReadiness: 'LIMITED_REVIEW',
          summary: 'No git diff changes were detected in the local repository.',
          blockingIssues: 0,
          warningIssues: 0,
          passedChecksCount: 0,
          issues: [],
          passedChecks: [],
          acceptanceCriteriaResults: []
        }
      });
      return;
    }

    const langExtensions: Record<string, string[]> = {
      'python': ['.py'],
      'java': ['.java'],
      'typescript': ['.ts', '.tsx'],
      'javascript': ['.js', '.jsx'],
      'go': ['.go'],
      'csharp': ['.cs']
    };

    const expectedExts = langExtensions[language.toLowerCase()] || [];
    if (expectedExts.length > 0) {
      const hasMatchingFile = expectedExts.some(ext => {
        const escapedExt = ext.replace('.', '\\.');
        return new RegExp(`\\+\\+\\+ b/.*${escapedExt}(\\s|$)`, 'im').test(diff);
      });
      
      if (!hasMatchingFile) {
        vscode.window.showErrorMessage('Language is not matched');
        this._view.webview.postMessage({ type: 'error', message: 'Language is not matched' });
        return;
      }
    }

    this._view.webview.postMessage({ type: 'statusUpdate', status: 'RUNNING_AGENTS' });

    const config = vscode.workspace.getConfiguration('aiCodeReview');
    const backendUrl = config.get<string>('backendUrl', 'http://localhost:5000');

    try {
      const response = await fetch(`${backendUrl}/api/v1/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          git_diff: diff,
          acceptance_criteria: acceptanceCriteria,
          language: language,
          branch: branch,
          repository_name: vscode.workspace.name || 'local-repo'
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reviewData: any = await response.json();

      // Update native VS Code diagnostics in code editor
      this._diagnosticsManager.setFindings(reviewData.issues || []);

      // Notify Webview
      this._view.webview.postMessage({
        type: 'reviewResult',
        result: reviewData
      });

      if (reviewData.pushReadiness === 'DO_NOT_PUSH') {
        vscode.window.showErrorMessage(`⛔ Pre-Push Review BLOCKED (${reviewData.blockingIssues} blocker(s)). See AI Code Review panel for fixes & suggestions.`);
      } else if (reviewData.pushReadiness === 'READY') {
        vscode.window.showInformationMessage('✅ Pre-Push Review PASSED! Code is ready for push.');
      } else {
        vscode.window.showWarningMessage(`⚠️ Pre-Push Review: Minor fixes recommended (${reviewData.warningIssues || 0} warning(s)).`);
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`AI Code Review Agent Error: ${err.message}`);
      this._view.webview.postMessage({ type: 'error', message: err.message });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    :root {
      --font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif);
      --bg-color: transparent;
      --card-bg: var(--vscode-editor-background, #1e1e1e);
      --item-bg: var(--vscode-sideBar-background, #252526);
      --border-color: var(--vscode-panel-border, #333333);
      --primary-color: #3b82f6;
      --success-color: #10b981;
      --warning-color: #f59e0b;
      --danger-color: #ef4444;
      --info-color: #6366f1;
    }
    * { box-sizing: border-box; }
    body {
      font-family: var(--font-family);
      font-size: 12px;
      color: var(--vscode-foreground);
      padding: 10px;
      margin: 0;
      background: var(--bg-color);
    }
    h3, h4, h5 { margin: 0 0 6px 0; font-weight: 600; }
    button {
      background: var(--vscode-button-background, #0e639c);
      color: var(--vscode-button-foreground, #ffffff);
      border: none;
      padding: 7px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 600;
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: background 0.15s ease, opacity 0.15s ease;
    }
    button:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
    button.btn-sm { padding: 4px 8px; font-size: 11px; }
    button.btn-secondary {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #ffffff);
    }
    button.btn-secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground, #45494e);
    }
    button.btn-success {
      background: #059669;
      color: #ffffff;
    }
    button.btn-success:hover {
      background: #10b981;
    }
    textarea, select {
      width: 100%;
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      padding: 6px 8px;
      border-radius: 4px;
      font-family: inherit;
      font-size: 12px;
      margin-bottom: 8px;
    }
    textarea:focus, select:focus {
      outline: 1px solid var(--vscode-focusBorder, #007fd4);
    }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .badge-ready { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #059669; }
    .badge-warning { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #d97706; }
    .badge-danger { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #dc2626; }
    .badge-info { background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid #4f46e5; }
    
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      padding: 10px;
      border-radius: 6px;
      margin-top: 10px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      margin-top: 14px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: var(--vscode-foreground);
    }
    .finding-card {
      background: var(--item-bg);
      border: 1px solid var(--border-color);
      border-left: 3px solid var(--primary-color);
      border-radius: 5px;
      padding: 8px 10px;
      margin-top: 8px;
    }
    .finding-card.severity-CRITICAL, .finding-card.severity-ERROR { border-left-color: var(--danger-color); }
    .finding-card.severity-WARNING { border-left-color: var(--warning-color); }
    .finding-card.severity-INFO { border-left-color: var(--info-color); }

    .suggestion-box {
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.25);
      border-radius: 4px;
      padding: 6px 8px;
      margin-top: 6px;
      font-size: 11px;
      line-height: 1.4;
    }
    .code-box {
      background: var(--vscode-textCodeBlock-background, #1e1e1e);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 6px 8px;
      margin-top: 6px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--vscode-editor-foreground, #d4d4d4);
      overflow-x: auto;
    }
    .btn-row {
      display: flex;
      gap: 6px;
      margin-top: 8px;
      flex-wrap: wrap;
    }
    .stats-row {
      display: flex;
      gap: 8px;
      font-size: 11px;
      margin-top: 6px;
      flex-wrap: wrap;
    }
    .stats-chip {
      background: rgba(255,255,255,0.05);
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid var(--border-color);
    }
    .clickable-file {
      cursor: pointer;
      color: var(--vscode-textLink-foreground, #3794ff);
      text-decoration: underline;
    }
    .clickable-file:hover {
      color: var(--vscode-textLink-activeForeground, #2488ff);
    }
    details {
      margin-top: 6px;
      background: var(--item-bg);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 6px 8px;
    }
    summary {
      cursor: pointer;
      font-weight: 600;
      outline: none;
      user-select: none;
    }
  </style>
</head>
<body>
  <h3>🛡️ AI Pre-Push Code Review</h3>
  <p style="opacity: 0.8; margin-bottom: 8px; font-size: 11px;">Run multi-agent inspection with instant fix suggestions.</p>
  
  <label style="font-weight: 600; display: block; margin-bottom: 4px;">Acceptance Criteria (Optional):</label>
  <textarea id="acInput" rows="3" placeholder="e.g. Reject null email, validate max length, enforce auth..."></textarea>
  
  <label style="font-weight: 600; display: block; margin-bottom: 4px;">Language <span style="color:var(--vscode-errorForeground);">*</span>:</label>
  <select id="langSelect">
    <option value="" disabled selected>Select Language</option>
    <option value="python">Python</option>
    <option value="typescript">TypeScript</option>
    <option value="javascript">JavaScript</option>
    <option value="java">Java</option>
    <option value="go">Go</option>
    <option value="csharp">C#</option>
  </select>
  
  <div>
    <button id="runBtn" style="width: 100%; padding: 8px;" disabled style="opacity: 0.5; cursor: not-allowed;">
      🔍 Run Review Before Push
    </button>
  </div>

  <div id="statusDiv" style="margin-top: 8px; font-style: italic; color: var(--vscode-descriptionForeground); font-size: 11px;"></div>
  
  <div id="resultContainer"></div>

  <script>
    const vscode = acquireVsCodeApi();
    const runBtn = document.getElementById('runBtn');
    const acInput = document.getElementById('acInput');
    const langSelect = document.getElementById('langSelect');
    const statusDiv = document.getElementById('statusDiv');
    const resultContainer = document.getElementById('resultContainer');

    langSelect.addEventListener('change', () => {
      if (langSelect.value) {
        runBtn.disabled = false;
        runBtn.style.opacity = '1';
        runBtn.style.cursor = 'pointer';
      } else {
        runBtn.disabled = true;
        runBtn.style.opacity = '0.5';
        runBtn.style.cursor = 'not-allowed';
      }
    });

    runBtn.addEventListener('click', () => {
      if (!langSelect.value) return;
      runBtn.disabled = true;
      runBtn.style.opacity = '0.5';
      runBtn.style.cursor = 'not-allowed';
      statusDiv.innerHTML = '⚡ <span>Extracting Git diff & orchestrating review agents...</span>';
      vscode.postMessage({
        type: 'triggerReview',
        acceptanceCriteria: acInput.value,
        language: langSelect.value
      });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'statusUpdate') {
        statusDiv.innerText = '⚡ Agent Status: ' + message.status;
      } else if (message.type === 'reviewResult') {
        runBtn.disabled = false;
        runBtn.style.opacity = '1';
        runBtn.style.cursor = 'pointer';
        statusDiv.innerText = '';
        renderResult(message.result);
      } else if (message.type === 'error') {
        runBtn.disabled = false;
        runBtn.style.opacity = '1';
        runBtn.style.cursor = 'pointer';
        statusDiv.innerText = '❌ Error: ' + message.message;
      }
    });

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function isLikelyCode(text) {
      if (text === '') return true;
      if (!text || typeof text !== 'string') return false;
      const t = text.trim();
      // If it looks like an English sentence explaining what to do
      if (/^(ensure|make sure|you should|please|change the|it is recommended|import .* at the top|before the line)/i.test(t)) {
        return false;
      }
      return true;
    }

    function renderResult(res) {
      let badgeClass = 'badge-ready';
      if (res.pushReadiness === 'DO_NOT_PUSH') badgeClass = 'badge-danger';
      else if (res.pushReadiness === 'MINOR_FIXES_REQUIRED') badgeClass = 'badge-warning';

      let html = '<div class="card">';
      html += '<div style="display: flex; justify-content: space-between; align-items: center;">';
      html += '<strong>Push Verdict:</strong> <span class="badge ' + badgeClass + '">' + (res.pushReadiness || 'UNKNOWN') + '</span>';
      html += '</div>';
      
      html += '<p style="margin: 8px 0; font-size: 11px; line-height: 1.4;">' + escapeHtml(res.summary || '') + '</p>';
      
      html += '<div class="stats-row">';
      html += '<span class="stats-chip">🚫 Blockers: <strong>' + (res.blockingIssues || 0) + '</strong></span>';
      html += '<span class="stats-chip">⚠️ Errors: <strong>' + (res.warningIssues || 0) + '</strong></span>';
      html += '<span class="stats-chip">🛡️ Checks Passed: <strong>' + (res.passedChecksCount || (res.passedChecks ? res.passedChecks.length : 0)) + '</strong></span>';
      html += '</div></div>';

      // 1. Grounded Findings & Fix Suggestions
      if (res.issues && res.issues.length > 0) {
        html += '<div class="section-title">';
        html += '<span>🚨 Issues & Fix Recommendations (' + res.issues.length + ')</span>';
        html += '</div>';

        res.issues.forEach((issue, idx) => {
          const sev = issue.severity || 'WARNING';
          let sevBadge = 'badge-warning';
          if (sev === 'CRITICAL' || sev === 'ERROR') sevBadge = 'badge-danger';
          else if (sev === 'INFO') sevBadge = 'badge-info';

          html += '<div class="finding-card severity-' + sev + '">';
          
          // Header
          html += '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">';
          html += '<span class="badge ' + sevBadge + '">' + sev + '</span>';
          html += '<span style="font-size: 10px; opacity: 0.8;">' + escapeHtml(issue.category || 'Quality') + '</span>';
          html += '</div>';

          // Location
          html += '<div style="font-size: 11px; margin-bottom: 4px;">';
          html += '<span class="clickable-file" onclick="openIssueFile(\\'' + escapeHtml(issue.file) + '\\', ' + (issue.line || 0) + ')">📄 ' + escapeHtml(issue.file) + (issue.line ? ':' + issue.line : '') + '</span>';
          html += '</div>';

          // Defect Message
          html += '<div style="font-weight: 600; font-size: 11px; margin-bottom: 6px;">' + escapeHtml(issue.message) + '</div>';

          // Fix Suggestion Box
          if (issue.suggestion) {
            html += '<div class="suggestion-box">';
            html += '<strong>💡 Fix Suggestion:</strong> ' + escapeHtml(issue.suggestion);
            html += '</div>';
          }

          // Suggested Fix Code
          const hasValidCode = (issue.fix_code !== undefined && issue.fix_code !== null) && isLikelyCode(issue.fix_code);
          if (hasValidCode) {
            html += '<div style="margin-top: 6px; font-weight: 600; font-size: 10px; opacity: 0.9;">🔧 Suggested Fix Code:</div>';
            if (issue.fix_code === '') {
              html += '<pre class="code-box" style="color: #f87171;"><code>[Delete / Remove this line]</code></pre>';
            } else {
              html += '<pre class="code-box"><code>' + escapeHtml(issue.fix_code) + '</code></pre>';
            }
          }

          // Action Buttons
          html += '<div class="btn-row">';
          if (hasValidCode) {
            html += '<button class="btn-sm btn-success" onclick="applyFix(\\'' + escapeHtml(issue.file) + '\\', ' + (issue.line || 0) + ', ' + idx + ')">⚡ Apply Fix</button>';
            html += '<button class="btn-sm btn-secondary" onclick="copyFix(' + idx + ')">📋 Copy Fix</button>';
          }
          html += '<button class="btn-sm btn-secondary" onclick="openIssueFile(\\'' + escapeHtml(issue.file) + '\\', ' + (issue.line || 0) + ')">📄 Open File</button>';
          html += '</div>';

          html += '</div>';
        });
      }

      // 2. Acceptance Criteria Verification
      if (res.acceptanceCriteriaResults && res.acceptanceCriteriaResults.length > 0) {
        html += '<div class="section-title">';
        html += '<span>📋 Acceptance Criteria Verification</span>';
        html += '</div>';

        res.acceptanceCriteriaResults.forEach((ac) => {
          const isPassed = ac.is_satisfied;
          html += '<div class="finding-card" style="border-left-color: ' + (isPassed ? '#10b981' : '#ef4444') + ';">';
          html += '<div style="display: flex; justify-content: space-between; margin-bottom: 4px;">';
          html += '<strong>' + escapeHtml(ac.criterion_id || 'AC') + '</strong>';
          html += '<span class="badge ' + (isPassed ? 'badge-ready' : 'badge-danger') + '">' + (isPassed ? '✅ Satisfied' : '❌ Unmet') + '</span>';
          html += '</div>';
          html += '<div style="font-size: 11px; margin-bottom: 4px;">' + escapeHtml(ac.description) + '</div>';
          if (ac.evidence) {
            html += '<div style="font-size: 10px; opacity: 0.8; font-style: italic;">Evidence: ' + escapeHtml(ac.evidence) + '</div>';
          }
          html += '</div>';
        });
      }

      // 3. Passed Checks
      if (res.passedChecks && res.passedChecks.length > 0) {
        html += '<details style="margin-top: 12px;">';
        html += '<summary style="font-size: 11px;">🛡️ Passed Checks (' + res.passedChecks.length + ')</summary>';
        res.passedChecks.forEach((pc) => {
          html += '<div style="padding: 4px 0; border-bottom: 1px solid var(--border-color); font-size: 11px;">';
          html += '<div>✅ <strong>' + escapeHtml(pc.check_name) + '</strong> (' + escapeHtml(pc.category || 'Security') + ')</div>';
          if (pc.description) {
            html += '<div style="font-size: 10px; opacity: 0.8; margin-left: 18px;">' + escapeHtml(pc.description) + '</div>';
          }
          html += '</div>';
        });
        html += '</details>';
      }

      window.currentResult = res;
      resultContainer.innerHTML = html;
    }

    function openIssueFile(file, line) {
      vscode.postMessage({ type: 'openFile', file: file, line: line });
    }

    function applyFix(file, line, issueIndex) {
      if (window.currentResult && window.currentResult.issues && window.currentResult.issues[issueIndex]) {
        const issue = window.currentResult.issues[issueIndex];
        vscode.postMessage({
          type: 'applyFix',
          file: file,
          line: line,
          fixCode: issue.fix_code
        });
      }
    }

    function copyFix(issueIndex) {
      if (window.currentResult && window.currentResult.issues && window.currentResult.issues[issueIndex]) {
        const issue = window.currentResult.issues[issueIndex];
        vscode.postMessage({
          type: 'copyToClipboard',
          text: issue.fix_code,
          message: 'Copied fix code to clipboard!'
        });
      }
    }
  </script>
</body>
</html>`;
  }
}
