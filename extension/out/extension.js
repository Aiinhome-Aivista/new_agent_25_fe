"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const ReviewWebviewProvider_1 = require("./ReviewWebviewProvider");
const DiagnosticsManager_1 = require("./DiagnosticsManager");
const WorkspaceIndexer_1 = require("./WorkspaceIndexer");
function activate(context) {
    console.log('AI Code Review Agent extension activated.');
    const diagnosticsManager = new DiagnosticsManager_1.DiagnosticsManager();
    const provider = new ReviewWebviewProvider_1.ReviewWebviewProvider(context.extensionUri, diagnosticsManager);
    // Register Webview Provider
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(ReviewWebviewProvider_1.ReviewWebviewProvider.viewType, provider));
    // Register Code Action Provider for QuickFix & Suggestions in Code Editor
    context.subscriptions.push(vscode.languages.registerCodeActionsProvider({ scheme: 'file' }, diagnosticsManager, { providedCodeActionKinds: DiagnosticsManager_1.DiagnosticsManager.providedCodeActionKinds }));
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
    const copyFixCmd = vscode.commands.registerCommand('ai-code-review.copyFix', async (fixCode) => {
        if (fixCode) {
            await vscode.env.clipboard.writeText(fixCode);
            vscode.window.showInformationMessage('📋 Copied fix code to clipboard!');
        }
    });
    // Register Show Suggestion Modal/Message Command
    const showSuggestionCmd = vscode.commands.registerCommand('ai-code-review.showSuggestion', async (issue) => {
        if (!issue)
            return;
        const msg = `💡 [${issue.category || 'AI Review'}] ${issue.message}\n\n👉 Fix Suggestion:\n${issue.suggestion || 'Follow best practices'}`;
        const choice = await vscode.window.showInformationMessage(msg, { modal: true }, issue.fix_code ? '⚡ Apply Fix' : 'OK');
        if (choice === '⚡ Apply Fix' && issue.fix_code) {
            await provider.applyFixToCode(issue.file || '', issue.line || 1, issue.fix_code);
        }
    });
    // Register "Index Workspace" Command — manual codebase indexing
    const indexCmd = vscode.commands.registerCommand('aiCodeReview.indexWorkspace', async () => {
        const config = vscode.workspace.getConfiguration('aiCodeReview');
        const backendUrl = config.get('backendUrl', 'http://localhost:5000');
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '🗂️ AI Code Review: Indexing Workspace...',
            cancellable: false,
        }, async (progress) => {
            progress.report({ message: 'Scanning workspace files...' });
            try {
                const result = await WorkspaceIndexer_1.WorkspaceIndexer.indexWorkspace(backendUrl, (prog) => {
                    const pct = Math.round((prog.indexed / prog.total) * 100);
                    progress.report({
                        message: `${prog.indexed}/${prog.total} files (${pct}%)`,
                        increment: (1 / prog.total) * 100,
                    });
                });
                vscode.window.showInformationMessage(`✅ Workspace indexed! ${result.indexedFiles} files, ${result.totalChunks} code chunks ready for context-aware review.`);
                // Webview-এ status update পাঠাও
                provider.notifyIndexComplete(result);
            }
            catch (err) {
                vscode.window.showErrorMessage(`❌ Indexing failed: ${err.message}`);
            }
        });
    });
    context.subscriptions.push(reviewCmd, clearCmd, copyFixCmd, showSuggestionCmd, indexCmd);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map