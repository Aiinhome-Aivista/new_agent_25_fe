import * as vscode from 'vscode';
import { ReviewWebviewProvider } from './ReviewWebviewProvider';
import { DiagnosticsManager } from './DiagnosticsManager';
import { WorkspaceIndexer } from './WorkspaceIndexer';

export function activate(context: vscode.ExtensionContext) {
  console.log('AI Code Review Agent extension activated.');

  const diagnosticsManager = new DiagnosticsManager();
  const provider = new ReviewWebviewProvider(context.extensionUri, diagnosticsManager);

  // Register Webview Provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ReviewWebviewProvider.viewType, provider)
  );

  // Register Code Action Provider for QuickFix & Suggestions in Code Editor
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { scheme: 'file' },
      diagnosticsManager,
      { providedCodeActionKinds: DiagnosticsManager.providedCodeActionKinds }
    )
  );

  // Register "Review Before Push" Command
  const reviewCmd = vscode.commands.registerCommand('ai-code-review.reviewBeforePush', async () => {
    vscode.commands.executeCommand('workbench.view.extension.ai-code-review-explorer');
    await provider.executeReview();
  });

  // Register Clear Diagnostics Command
  const clearCmd = vscode.commands.registerCommand('ai-code-review.clearDiagnostics', () => {
    diagnosticsManager.clear();
    vscode.window.showInformationMessage('AI Code Review issues cleared.');
  });

  // Register Copy Fix Command
  const copyFixCmd = vscode.commands.registerCommand('ai-code-review.copyFix', async (fixCode: string) => {
    if (fixCode) {
      await vscode.env.clipboard.writeText(fixCode);
      vscode.window.showInformationMessage('📋 Copied fix code to clipboard!');
    }
  });

  // Register Show Suggestion Modal/Message Command
  const showSuggestionCmd = vscode.commands.registerCommand('ai-code-review.showSuggestion', async (issue: any) => {
    if (!issue) return;
    const msg = `💡 [${issue.category || 'AI Review'}] ${issue.message}\n\n👉 Fix Suggestion:\n${issue.suggestion || 'Follow best practices'}`;
    const choice = await vscode.window.showInformationMessage(
      msg,
      { modal: true },
      issue.fix_code ? '⚡ Apply Fix' : 'OK'
    );
    if (choice === '⚡ Apply Fix' && issue.fix_code) {
      await provider.applyFixToCode(issue.file || '', issue.line || 1, issue.fix_code);
    }
  });

  // Register "Index Workspace" Command — manual codebase indexing
  const indexCmd = vscode.commands.registerCommand('aiCodeReview.indexWorkspace', async () => {
    const config = vscode.workspace.getConfiguration('aiCodeReview');
    const backendUrl = config.get<string>('backendUrl', 'http://localhost:5000');

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '🗂️ AI Code Review: Indexing Workspace...',
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message: 'Scanning workspace files...' });

        try {
          const result = await WorkspaceIndexer.indexWorkspace(
            backendUrl,
            (prog) => {
              const pct = Math.round((prog.indexed / prog.total) * 100);
              progress.report({
                message: `${prog.indexed}/${prog.total} files (${pct}%)`,
                increment: (1 / prog.total) * 100,
              });
            }
          );

          vscode.window.showInformationMessage(
            `✅ Workspace indexed! ${result.indexedFiles} files, ${result.totalChunks} code chunks ready for context-aware review.`
          );

          // Webview-এ status update পাঠাও
          provider.notifyIndexComplete(result);
        } catch (err: any) {
          vscode.window.showErrorMessage(`❌ Indexing failed: ${err.message}`);
        }
      }
    );
  });

  context.subscriptions.push(reviewCmd, clearCmd, copyFixCmd, showSuggestionCmd, indexCmd);
}

export function deactivate() {}

