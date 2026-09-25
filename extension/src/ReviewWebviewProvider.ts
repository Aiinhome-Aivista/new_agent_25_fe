import * as vscode from 'vscode';
import { GitService } from './GitService';
import { DiagnosticsManager } from './DiagnosticsManager';

export class ReviewWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'aiCodeReview.reviewView';
  private _view?: vscode.WebviewView;
  private _latestReviewData?: any;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _diagnosticsManager: DiagnosticsManager
  ) { }

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
          await this.applyFixToCode(data.file, data.line, data.fixCode, data.issueIndex);
          break;
        }
        case 'copyToClipboard': {
          if (data.text) {
            await vscode.env.clipboard.writeText(data.text);
            vscode.window.showInformationMessage('📋 ' + (data.message || 'Copied to clipboard!'));
          }
          break;
        }
        case 'exportDocx': {
          await this.exportDocxReport(data.sessionId, data.reviewData);
          break;
        }
        case 'indexWorkspace': {
          // Extension command trigger করো
          vscode.commands.executeCommand('aiCodeReview.indexWorkspace');
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

  public async applyFixToCode(filePath: string, line: number, fixCode: string, issueIndex?: number) {
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
        let replaceRange: vscode.Range = doc.lineAt(lineIdx).rangeIncludingLineBreak;
        let replaceRangeWithoutBreak: vscode.Range = doc.lineAt(lineIdx).range;
        
        // If end_line exists for this issue, we delete the entire block
        if (issueIndex !== undefined && this._latestReviewData && this._latestReviewData.issues && this._latestReviewData.issues[issueIndex]) {
          const issue = this._latestReviewData.issues[issueIndex];
          if (issue.end_line) {
            const endLineIdx = Math.max(lineIdx, Math.min(doc.lineCount - 1, (issue.end_line || issue.line || 1) - 1));
            replaceRange = new vscode.Range(lineIdx, 0, endLineIdx + 1, 0); // Include break for block
            replaceRangeWithoutBreak = new vscode.Range(lineIdx, 0, endLineIdx, doc.lineAt(endLineIdx).text.length);
          }
        }

        const targetLine = doc.lineAt(lineIdx);
        if (cleanFix === '') {
          // Deleting line(s)
          edit.delete(uri, replaceRange);
        } else {
          // Preserve original leading whitespace/indentation
          const leadingIndentMatch = targetLine.text.match(/^(\s*)/);
          const leadingIndent = leadingIndentMatch ? leadingIndentMatch[1] : '';
          let finalReplacement = '';
          if (targetLine.text.includes('0.0.0.0') && (cleanFix.includes('127.0.0.1') || cleanFix.includes('host=')) && !cleanFix.includes('uvicorn.run') && !cleanFix.includes('app.run')) {
            finalReplacement = targetLine.text.replace(/['"]0\.0\.0\.0['"]/, '"127.0.0.1"');
          } else {
            const fixLines = cleanFix.split(/\r?\n/);
            let minIndent = Infinity;
            for (const line of fixLines) {
              if (line.trim().length > 0) {
                const match = line.match(/^(\s*)/);
                const indentLen = match ? match[1].length : 0;
                if (indentLen < minIndent) minIndent = indentLen;
              }
            }
            if (minIndent === Infinity) minIndent = 0;

            const indentedFixLines = fixLines.map(l => {
              if (l.trim().length === 0) return leadingIndent;
              return leadingIndent + l.substring(minIndent);
            });
            finalReplacement = indentedFixLines.join('\n');
          }
          edit.replace(uri, replaceRangeWithoutBreak, finalReplacement);
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
        if (this._view && issueIndex !== undefined) {
          this._view.webview.postMessage({ type: 'fixApplied', issueIndex });
        }
      } else {
        vscode.window.showErrorMessage(`Failed to apply fix to ${filePath}`);
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`Error applying fix: ${err.message}`);
    }
  }

  /**
   * Index complete হলে extension.ts থেকে call হয় — webview-কে notify করে।
   */
  public notifyIndexComplete(result: { indexedFiles: number; totalChunks: number }) {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'indexComplete',
        indexedFiles: result.indexedFiles,
        totalChunks: result.totalChunks
      });
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
      const response = await (fetch(`${backendUrl}/api/v1/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          git_diff: diff,
          acceptance_criteria: acceptanceCriteria,
          language: language,
          branch: branch,
          repository_name: vscode.workspace.name || 'local-repo'
        })
      }) as unknown as Promise<{ ok: boolean; status: number; json(): Promise<any> }>);

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reviewData: any = await response.json();
      this._latestReviewData = reviewData;

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

  private async exportDocxReport(sessionId: string | undefined, reviewData: any) {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const defaultUri = workspaceFolders && workspaceFolders.length > 0 
        ? vscode.Uri.joinPath(workspaceFolders[0].uri, `Code_Review_Report_${sessionId || 'Unsaved'}.docx`)
        : undefined;

      const saveUri = await vscode.window.showSaveDialog({
        defaultUri,
        filters: { 'Word Documents': ['docx'] },
        saveLabel: 'Export Report'
      });

      if (!saveUri) return;

      const config = vscode.workspace.getConfiguration('aiCodeReview');
      const backendUrl = config.get<string>('backendUrl', 'http://localhost:5000');
      
      let response;
      if (sessionId) {
        response = await ((fetch as unknown as (
          url: string,
          options: { method: string }
        ) => Promise<{ ok: boolean; statusText: string; arrayBuffer(): Promise<ArrayBuffer> }>)(
          `${backendUrl}/api/v1/reviews/${sessionId}/export-docx`,
          { method: 'GET' }
        ));
      } else {
        response = await fetch(`${backendUrl}/api/v1/reviews/export-docx`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reviewData)
        });
      }

      if (!response.ok) {
        throw new Error(`Failed to export report: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      await vscode.workspace.fs.writeFile(saveUri, new Uint8Array(arrayBuffer));

      const openAction = 'Open File';
      const selection = await vscode.window.showInformationMessage('Report exported successfully!', openAction);
      if (selection === openAction) {
        vscode.env.openExternal(saveUri);
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`Error exporting report: ${err.message}`);
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
      --border-color: var(--vscode-panel-border, #D8D8D8);
      --orange-border: #FF8A55;
      --primary-color: #FF5A14;
      --hover-orange: #F56B2F;
      --button-orange: #FF7A45;
      --button-orange-rgb: 255, 122, 69;
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
      background: var(--button-orange);
      color: #ffffff;
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
    #runBtn {
      background: var(--primary-color);
      color: #ffffff;
    }
    #runBtn:hover {
      background: var(--hover-orange);
    }
    button.btn-sm { padding: 4px 8px; font-size: 11px; }
    button.btn-secondary {
      background: rgba(var(--button-orange-rgb), 0.2); /* 20% opacity dynamic */
      border: 1px solid var(--button-orange);
      color: var(--vscode-button-secondaryForeground, #ffffff);
    }
    button.btn-secondary:hover {
      background: var(--hover-orange);
      color: #ffffff;
    }
    button.btn-success {
      background: var(--orange-border);
      color: #ffffff;
    }
    button.btn-success:hover {
      background: var(--hover-orange);
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
      outline: 1px solid var(--orange-border);
    }
    .custom-select-wrapper {
      position: relative;
      width: 100%;
      margin-bottom: 8px;
    }
    .custom-select-display {
      background: var(--vscode-input-background, #3c3c3c);
      color: var(--vscode-input-foreground, #cccccc);
      border: 1px solid var(--vscode-input-border, #3c3c3c);
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .custom-select-wrapper.open .custom-select-display {
      outline: 1px solid var(--orange-border);
    }
    .custom-select-display::after {
      content: '▼';
      font-size: 8px;
      margin-left: 8px;
    }
    .custom-select-options {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: var(--vscode-input-background, #3c3c3c);
      border: 1px solid var(--orange-border);
      border-radius: 4px;
      margin-top: 4px;
      z-index: 1000;
      display: none;
      max-height: 200px;
      overflow-y: auto;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }
    .custom-select-wrapper.open .custom-select-options {
      display: block;
    }
    .custom-option {
      padding: 6px 8px;
      cursor: pointer;
      color: var(--vscode-input-foreground, #cccccc);
    }
    .custom-option:hover, .custom-option.selected {
      background: var(--orange-border);
      color: #ffffff;
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

  <!-- Codebase Index Status Bar -->
  <div id="indexStatusBar" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding: 6px 8px; background: var(--item-bg); border: 1px solid var(--border-color); border-radius: 4px; font-size: 11px;">
    <span id="indexStatusText" style="opacity: 0.8;">⚪ Codebase not indexed</span>
    <button id="indexBtn" class="btn-sm btn-secondary" onclick="indexCodebase()" style="font-size: 10px; padding: 3px 8px;">🗂️ Index Workspace</button>
  </div>

  <label style="font-weight: 600; display: block; margin-bottom: 4px;">Acceptance Criteria (Optional):</label>
  <textarea id="acInput" rows="3" placeholder="e.g. Reject null email, validate max length, enforce auth..."></textarea>
  
  <label style="font-weight: 600; display: block; margin-bottom: 4px;">Language <span style="color:var(--vscode-errorForeground);">*</span>:</label>
  <div class="custom-select-wrapper" id="customLangSelectWrapper">
    <div class="custom-select-display" id="customLangSelectDisplay">Select Language</div>
    <div class="custom-select-options" id="customLangSelectOptions">
      <div class="custom-option" data-value="python">Python</div>
      <div class="custom-option" data-value="typescript">TypeScript</div>
      <div class="custom-option" data-value="javascript">JavaScript</div>
      <div class="custom-option" data-value="java">Java</div>
      <div class="custom-option" data-value="go">Go</div>
      <div class="custom-option" data-value="csharp">C#</div>
    </div>
  </div>
  <input type="hidden" id="langSelect" value="" />
  
  <div>
    <button id="runBtn" style="width: 100%; padding: 8px; opacity: 0.5; cursor: not-allowed; border: none;" disabled>
      Run Review Before Push
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

    // Custom dropdown logic
    const customWrapper = document.getElementById('customLangSelectWrapper');
    const customDisplay = document.getElementById('customLangSelectDisplay');
    const customOptions = document.getElementById('customLangSelectOptions');

    customDisplay.addEventListener('click', (e) => {
      e.stopPropagation();
      customWrapper.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      customWrapper.classList.remove('open');
    });

    customOptions.querySelectorAll('.custom-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        customDisplay.innerText = option.innerText;
        langSelect.value = option.dataset.value;
        customWrapper.classList.remove('open');
        
        customOptions.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
        option.classList.add('selected');
        
        langSelect.dispatchEvent(new Event('change'));
      });
    });

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
      } else if (message.type === 'indexComplete') {
        // Index সম্পূর্ণ হলে status badge update
        const indexStatusText = document.getElementById('indexStatusText');
        const indexBtn = document.getElementById('indexBtn');
        if (indexStatusText) {
          indexStatusText.innerHTML = '✅ <strong>' + message.indexedFiles + '</strong> files indexed (' + message.totalChunks + ' chunks)';
          indexStatusText.style.color = 'var(--success-color)';
          indexStatusText.style.opacity = '1';
        }
        if (indexBtn) {
          indexBtn.innerText = '🔄 Re-index';
        }
      } else if (message.type === 'fixApplied') {
        if (window.currentResult && window.currentResult.issues) {
           const index = parseInt(message.issueIndex, 10);
           const issue = window.currentResult.issues[index];
           if (issue) {
              if (issue.severity === 'CRITICAL' || issue.severity === 'ERROR') {
                 window.currentResult.blockingIssues = Math.max(0, (window.currentResult.blockingIssues || 0) - 1);
              } else if (issue.severity === 'WARNING') {
                 window.currentResult.warningIssues = Math.max(0, (window.currentResult.warningIssues || 0) - 1);
              }
              window.currentResult.issues.splice(index, 1);
              if (window.currentResult.blockingIssues === 0 && window.currentResult.pushReadiness === 'DO_NOT_PUSH') {
                 window.currentResult.pushReadiness = window.currentResult.warningIssues > 0 ? 'MINOR_FIXES_REQUIRED' : 'READY';
              }
              renderResult(window.currentResult);
           }
        }
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
      html += '<div><strong>Push Verdict:</strong> <span class="badge ' + badgeClass + '">' + (res.pushReadiness || 'UNKNOWN') + '</span></div>';
      html += '<button class="btn-sm btn-secondary" onclick="exportDocx(\\'' + (res.session ? res.session.id : '') + '\\')">📄 Export Report</button>';
      html += '</div>';
      
      html += '<p style="margin: 8px 0; font-size: 11px; line-height: 1.4;">' + escapeHtml(res.summary || '') + '</p>';
      
      html += '<div class="stats-row">';
      html += '<span class="stats-chip">🚫 Blockers: <strong>' + (res.blockingIssues || 0) + '</strong></span>';
      html += '<span class="stats-chip">⚠️ Warnings: <strong>' + (res.warningIssues || 0) + '</strong></span>';
      html += '<span class="stats-chip">🛡️ Checks Passed: <strong>' + (res.passedChecksCount || (res.passedChecks ? res.passedChecks.length : 0)) + '</strong></span>';
      if (res.missingTestsCount !== undefined || (res.missingTests && res.missingTests.length > 0)) {
         html += '<span class="stats-chip">🧪 Missing Tests: <strong>' + (res.missingTestsCount || (res.missingTests ? res.missingTests.length : 0)) + '</strong></span>';
      }
      html += '<span class="stats-chip">🔁 Code Duplication: <strong>' + (res.duplicates ? res.duplicates.length : 0) + '</strong></span>';
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

          // Relevant Files
          if (issue.relevant_files && issue.relevant_files.length > 0) {
            html += '<div style="margin-bottom: 6px; font-size: 10px;">';
            html += '<strong style="color: var(--vscode-textLink-foreground);">🔗 Relevant Files:</strong> ';
            issue.relevant_files.forEach((file) => {
               html += '<span class="clickable-file" style="margin-right: 4px; padding: 2px 4px; background: rgba(128,128,128,0.2); border-radius: 3px;" onclick="openIssueFile(\\'' + escapeHtml(file) + '\\', 0)">' + escapeHtml(file) + '</span>';
            });
            html += '</div>';
          }

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
            html += '<button class="btn-sm btn-success" onclick="applyFix(\\'' + escapeHtml(issue.file) + '\\', ' + (issue.line || 0) + ', ' + idx + ')"> Apply Fix</button>';
            html += '<button class="btn-sm btn-secondary" onclick="copyFix(' + idx + ')"> Copy Fix</button>';
          }
          html += '<button class="btn-sm btn-secondary" onclick="openIssueFile(\\'' + escapeHtml(issue.file) + '\\', ' + (issue.line || 0) + ')"> Open File</button>';
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

      // 4. Missing Unit Tests & Edge Cases
      if (res.missingTests && res.missingTests.length > 0) {
        html += '<div class="section-title">';
        html += '<span>🧪 Missing Unit Tests & Edge Cases (' + res.missingTests.length + ')</span>';
        html += '</div>';

        res.missingTests.forEach((mt, idx) => {
          let typeBadge = 'badge-info';
          let displayType = (mt.scenario_type || 'EDGE CASE').toUpperCase().replace('_', ' ');
          if (displayType.includes('HAPPY')) typeBadge = 'badge-ready';
          else if (displayType.includes('NEGATIVE')) typeBadge = 'badge-warning';
          else if (displayType.includes('REGRESSION')) typeBadge = 'badge-danger';

          html += '<div class="finding-card">';
          
          // Header
          html += '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">';
          html += '<span class="badge ' + typeBadge + '">' + displayType + '</span>';
          if (mt.priority) {
             let prioBadge = mt.priority === 'HIGH' ? 'badge-danger' : 'badge-warning';
             html += '<span class="badge ' + prioBadge + '" style="font-size: 9px;">Priority: ' + escapeHtml(mt.priority) + '</span>';
          }
          html += '</div>';

          // Location
          html += '<div style="font-size: 11px; margin-bottom: 4px;">';
          const lineNum = mt.target_line || mt.line_number || 0;
          const displayFile = escapeHtml(mt.target_file) + (lineNum ? ':' + lineNum : '');
          html += '<span class="clickable-file" onclick="openIssueFile(\\'' + escapeHtml(mt.target_file) + '\\', ' + lineNum + ')">📄 ' + displayFile + '</span>';
          if (mt.target_method) {
             html += ' <span style="opacity: 0.7;">(Method: <code>' + escapeHtml(mt.target_method) + '</code>)</span>';
          }
          html += '</div>';

          // Description
          html += '<div style="font-weight: 600; font-size: 11px; margin-bottom: 6px;">' + escapeHtml(mt.description) + '</div>';

          // Suggested Test Code
          if (mt.suggested_test_code) {
             html += '<div style="margin-top: 6px; font-weight: 600; font-size: 10px; opacity: 0.9;">🔧 Suggested Test Code:</div>';
             html += '<pre class="code-box"><code>' + escapeHtml(mt.suggested_test_code) + '</code></pre>';
          }

          // Action Buttons
          html += '<div class="btn-row">';
          if (mt.suggested_test_code) {
             html += '<button class="btn-sm btn-secondary" onclick="copyTestCode(' + idx + ')">📋 Copy Test Code</button>';
          }
          html += '<button class="btn-sm btn-secondary" onclick="openIssueFile(\\'' + escapeHtml(mt.target_file) + '\\', ' + lineNum + ')">📄 Open File</button>';
          html += '</div>';

          html += '</div>';
        });
      }

      // 5. Reusable Components
      if (res.reusableComponents && res.reusableComponents.length > 0) {
        html += '<div class="section-title">';
        html += '<span>♻️ Reusable Components Detected (' + res.reusableComponents.length + ')</span>';
        html += '</div>';

        res.reusableComponents.forEach((rc, idx) => {
          html += '<div class="finding-card" style="border-left-color: var(--primary-color);">';
          html += '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">';
          html += '<span class="badge badge-info">' + escapeHtml(rc.component_type || 'COMPONENT') + '</span>';
          html += '</div>';
          html += '<div style="font-weight: 600; font-size: 11px; margin-bottom: 2px;">' + escapeHtml(rc.name) + '</div>';
          html += '<div style="font-size: 11px; margin-bottom: 4px; opacity: 0.9;">' + escapeHtml(rc.description) + '</div>';
          if (rc.file_path) {
            html += '<div style="font-size: 10px; margin-bottom: 4px;">';
            html += '<span class="clickable-file" onclick="openIssueFile(\\'' + escapeHtml(rc.file_path) + '\\', 0)">📄 ' + escapeHtml(rc.file_path) + '</span>';
            html += '</div>';
          }
          if (rc.snippet) {
             html += '<div style="margin-top: 6px; font-weight: 600; font-size: 10px; opacity: 0.9;">💻 Code Snippet:</div>';
             html += '<pre class="code-box"><code>' + escapeHtml(rc.snippet) + '</code></pre>';
          }
          html += '<div class="btn-row">';
          if (rc.snippet) {
             html += '<button class="btn-sm btn-secondary" onclick="copyReusableCode(' + idx + ')">📋 Copy Snippet</button>';
          }
          html += '</div>';
          html += '</div>';
        });
      }
      // Duplicate Code Section
      if (res.duplicates && res.duplicates.length > 0) {
        html += '<div class="section-title">';
        html += '<span>🔁 Duplicate Code Detected (' + res.duplicates.length + ')</span>';
        html += '</div>';
        res.duplicates.forEach((dup) => {
          html += '<div class="finding-card severity-WARNING" style="border-left-color: #a78bfa;">';
          html += '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">';
          html += '<span class="badge" style="background: rgba(167,139,250,0.2); color: #c4b5fd; border: 1px solid #7c3aed;">DUPLICATE</span>';
          html += '<span style="font-size: 10px; opacity: 0.8;">Code Duplication</span>';
          html += '</div>';
          html += '<div style="font-size: 11px; margin-bottom: 4px;">';
          html += '<span class="clickable-file" onclick="openIssueFile(\\'' + escapeHtml(dup.file) + '\\', ' + (dup.line || 0) + ')">📄 ' + escapeHtml(dup.file) + (dup.line ? ':' + dup.line : '') + '</span>';
          html += '</div>';
          html += '<div style="font-weight: 600; font-size: 11px; margin-bottom: 4px;">' + escapeHtml(dup.message) + '</div>';
          if (dup.suggestion) {
            html += '<div class="suggestion-box"><strong>💡 Fix:</strong> ' + escapeHtml(dup.suggestion) + '</div>';
          }
          if (dup.duplicate_in_file) {
            html += '<div class="btn-row"><button class="btn-sm btn-secondary" onclick="openIssueFile(\\'' + escapeHtml(dup.duplicate_in_file) + '\\', ' + (dup.duplicate_at_line || 0) + ')">📂 Go to Original</button></div>';
          }
          html += '</div>';
        });
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
          fixCode: issue.fix_code,
          issueIndex: issueIndex
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

    function copyTestCode(idx) {
      if (window.currentResult && window.currentResult.missingTests && window.currentResult.missingTests[idx]) {
        const test = window.currentResult.missingTests[idx];
        vscode.postMessage({
          type: 'copyToClipboard',
          text: test.suggested_test_code,
          message: 'Copied test code to clipboard!'
        });
      }
    }

    function copyReusableCode(idx) {
      if (window.currentResult && window.currentResult.reusableComponents && window.currentResult.reusableComponents[idx]) {
        const rc = window.currentResult.reusableComponents[idx];
        vscode.postMessage({
          type: 'copyToClipboard',
          text: rc.snippet,
          message: 'Copied reusable snippet to clipboard!'
        });
      }
    }

    function exportDocx(sessionId) {
      vscode.postMessage({
        type: 'exportDocx',
        sessionId: sessionId,
        reviewData: window.currentResult
      });
    }

    function indexCodebase() {
      const indexBtn = document.getElementById('indexBtn');
      const indexStatusText = document.getElementById('indexStatusText');
      if (indexBtn) {
        indexBtn.disabled = true;
        indexBtn.innerText = '⏳ Indexing...';
      }
      if (indexStatusText) {
        indexStatusText.innerHTML = '⏳ Indexing workspace...';
        indexStatusText.style.color = '';
        indexStatusText.style.opacity = '0.8';
      }
      vscode.postMessage({ type: 'indexWorkspace' });
      // Progress notification VS Code-এ দেখাবে, indexComplete message-এ status update হবে
      setTimeout(() => {
        if (indexBtn) indexBtn.disabled = false;
      }, 3000);
    }
  </script>
</body>
</html>`;
  }
}
