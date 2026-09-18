"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = require("vscode");
const ReviewWebviewProvider_1 = require("./ReviewWebviewProvider");
const DiagnosticsManager_1 = require("./DiagnosticsManager");
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
    context.subscriptions.push(reviewCmd, clearCmd, copyFixCmd, showSuggestionCmd);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map