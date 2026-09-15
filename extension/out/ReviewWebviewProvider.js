"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewWebviewProvider = void 0;
const vscode = require("vscode");
const GitService_1 = require("./GitService");
class ReviewWebviewProvider {
    constructor(_extensionUri, _diagnosticsManager) {
        this._extensionUri = _extensionUri;
        this._diagnosticsManager = _diagnosticsManager;
    }
    resolveWebviewView(webviewView, context, _token) {
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
                    const workspaceFolders = vscode.workspace.workspaceFolders;
                    if (workspaceFolders && workspaceFolders.length > 0) {
                        const uri = vscode.Uri.file(`${workspaceFolders[0].uri.fsPath}/${data.file}`.replace(/\\/g, '/'));
                        const doc = await vscode.workspace.openTextDocument(uri);
                        const editor = await vscode.window.showTextDocument(doc);
                        if (data.line > 0) {
                            const pos = new vscode.Position(data.line - 1, 0);
                            editor.selection = new vscode.Selection(pos, pos);
                            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
                        }
                    }
                    break;
                }
            }
        });
    }
    async executeReview(acceptanceCriteria = '', language = 'java') {
        if (!this._view)
            return;
        this._view.webview.postMessage({ type: 'statusUpdate', status: 'COLLECTING_DIFF' });
        const diff = await GitService_1.GitService.getWorkingDiff();
        const branch = await GitService_1.GitService.getCurrentBranch();
        if (!diff || !diff.trim()) {
            vscode.window.showWarningMessage('AI Code Review: No working git diff detected. Please modify or stage files first.');
            this._view.webview.postMessage({
                type: 'reviewResult',
                result: {
                    pushReadiness: 'LIMITED_REVIEW',
                    summary: 'No git diff changes were detected in the local repository.',
                    blockingIssues: 0,
                    warningIssues: 0,
                    issues: []
                }
            });
            return;
        }
        this._view.webview.postMessage({ type: 'statusUpdate', status: 'RUNNING_AGENTS' });
        const config = vscode.workspace.getConfiguration('aiCodeReview');
        const backendUrl = config.get('backendUrl', 'http://localhost:5000');
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
            const reviewData = await response.json();
            // Update native VS Code diagnostics in code editor
            this._diagnosticsManager.setFindings(reviewData.issues || []);
            // Notify Webview
            this._view.webview.postMessage({
                type: 'reviewResult',
                result: reviewData
            });
            if (reviewData.pushReadiness === 'DO_NOT_PUSH') {
                vscode.window.showErrorMessage(`⛔ Pre-Push Review BLOCKED (${reviewData.blockingIssues} blocker(s)). See AI Code Review panel for details.`);
            }
            else if (reviewData.pushReadiness === 'READY') {
                vscode.window.showInformationMessage('✅ Pre-Push Review PASSED! Code is ready for push.');
            }
            else {
                vscode.window.showWarningMessage(`⚠️ Pre-Push Review: Minor fixes recommended (${reviewData.warningIssues} warning(s)).`);
            }
        }
        catch (err) {
            vscode.window.showErrorMessage(`AI Code Review Agent Error: ${err.message}`);
            this._view.webview.postMessage({ type: 'error', message: err.message });
        }
    }
    _getHtmlForWebview(webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-font-family); font-size: 12px; color: var(--vscode-foreground); padding: 12px; background: transparent; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; width: 100%; font-weight: 600; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    textarea { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 6px; border-radius: 4px; font-family: monospace; resize: vertical; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-weight: bold; font-size: 11px; margin-top: 6px; }
    .ready { background: #10b98133; color: #10b981; border: 1px solid #10b981; }
    .warning { background: #f59e0b33; color: #f59e0b; border: 1px solid #f59e0b; }
    .danger { background: #ef444433; color: #ef4444; border: 1px solid #ef4444; }
    .card { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); padding: 10px; border-radius: 6px; margin-top: 10px; }
    .issue-item { border-left: 3px solid #6366f1; padding: 4px 8px; margin-top: 6px; background: var(--vscode-sideBar-background); cursor: pointer; }
    .issue-item:hover { background: var(--vscode-list-hoverBackground); }
  </style>
</head>
<body>
  <h3>🛡️ AI Pre-Push Code Review</h3>
  <p style="opacity: 0.8; margin-bottom: 8px;">Run multi-agent inspection against your local diff.</p>
  
  <label style="font-weight: 600; display: block; margin-bottom: 4px;">Acceptance Criteria (Optional):</label>
  <textarea id="acInput" rows="4" placeholder="Enter acceptance criteria or user story conditions..."></textarea>
  
  <label style="font-weight: 600; display: block; margin-top: 10px; margin-bottom: 4px;">Language <span style="color:var(--vscode-errorForeground);">*</span>:</label>
  <select id="langSelect" style="width: 100%; box-sizing: border-box; background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); border: 1px solid var(--vscode-dropdown-border); padding: 6px; border-radius: 4px;">
    <option value="" disabled selected>Select Language</option>
    <option value="python">Python</option>
    <option value="java">Java</option>
    <option value="typescript">TypeScript</option>
    <option value="javascript">JavaScript</option>
    <option value="go">Go</option>
    <option value="csharp">C#</option>
  </select>
  
  <div style="margin-top: 10px;">
    <button id="runBtn" disabled style="opacity: 0.5; cursor: not-allowed;">🔍 Run Review Before Push</button>
  </div>

  <div id="statusDiv" style="margin-top: 10px; font-style: italic; color: var(--vscode-descriptionForeground);"></div>
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
      statusDiv.innerText = '⚡ Extracting Git diff & orchestrating review agents...';
      vscode.postMessage({
        type: 'triggerReview',
        acceptanceCriteria: acInput.value,
        language: langSelect.value
      });
    });

    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'statusUpdate') {
        statusDiv.innerText = 'Analyzing: ' + message.status;
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

    function renderResult(res) {
      let badgeClass = 'ready';
      if (res.pushReadiness === 'DO_NOT_PUSH') badgeClass = 'danger';
      else if (res.pushReadiness === 'MINOR_FIXES_REQUIRED') badgeClass = 'warning';

      let html = '<div class="card">';
      html += '<div><strong>Push Verdict:</strong> <span class="badge ' + badgeClass + '">' + res.pushReadiness + '</span></div>';
      html += '<p style="margin: 8px 0; font-size: 11px;">' + (res.summary || '') + '</p>';
      html += '<div style="display: flex; gap: 8px; font-size: 11px; margin-top: 6px;">';
      html += '<span>🚫 Blockers: <strong>' + (res.blockingIssues || 0) + '</strong></span>';
      html += '<span>⚠️ Warnings: <strong>' + (res.warningIssues || 0) + '</strong></span>';
      html += '</div></div>';

      if (res.issues && res.issues.length > 0) {
        html += '<h4 style="margin-top: 14px; margin-bottom: 6px;">Grounded Findings (' + res.issues.length + ')</h4>';
        res.issues.forEach((issue) => {
          html += '<div class="issue-item" onclick="openIssueFile(\\'' + issue.file + '\\', ' + issue.line + ')">';
          html += '<div><strong>[' + issue.severity + ']</strong> ' + issue.message + '</div>';
          html += '<div style="opacity: 0.7; font-size: 10px; margin-top: 2px;">📄 ' + issue.file + ':' + (issue.line || 0) + '</div>';
          html += '</div>';
        });
      }

      resultContainer.innerHTML = html;
    }

    function openIssueFile(file, line) {
      vscode.postMessage({ type: 'openFile', file: file, line: line });
    }
  </script>
</body>
</html>`;
    }
}
exports.ReviewWebviewProvider = ReviewWebviewProvider;
ReviewWebviewProvider.viewType = 'aiCodeReview.reviewView';
//# sourceMappingURL=ReviewWebviewProvider.js.map