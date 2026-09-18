"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticsManager = void 0;
const vscode = require("vscode");
//
class DiagnosticsManager {
    constructor() {
        this._findings = [];
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ai-code-review');
    }
    setFindings(findings) {
        this._findings = findings || [];
        this.diagnosticCollection.clear();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0)
            return;
        const rootPath = workspaceFolders[0].uri.fsPath;
        const fileDiagnosticsMap = new Map();
        for (const issue of this._findings) {
            const filePath = issue.file || issue.file_path;
            if (!filePath)
                continue;
            const fullUri = vscode.Uri.file(`${rootPath}/${filePath}`.replace(/\\/g, '/'));
            const lineNum = Math.max(0, (issue.line || issue.line_number || 1) - 1);
            let severity = vscode.DiagnosticSeverity.Warning;
            if (issue.severity === 'CRITICAL' || issue.severity === 'ERROR') {
                severity = vscode.DiagnosticSeverity.Error;
            }
            else if (issue.severity === 'INFO') {
                severity = vscode.DiagnosticSeverity.Information;
            }
            const range = new vscode.Range(lineNum, 0, lineNum, 200);
            let messageStr = `[${issue.category || 'AI Review'}] ${issue.message}`;
            if (issue.suggestion) {
                messageStr += `\n\n💡 Suggestion: ${issue.suggestion}`;
            }
            if (issue.fix_code) {
                messageStr += `\n\n🔧 Suggested Fix:\n${issue.fix_code}`;
            }
            const diagnostic = new vscode.Diagnostic(range, messageStr, severity);
            diagnostic.source = 'AI Code Review Agent';
            diagnostic.code = issue.rule_id || 'PRE-PUSH-CHECK';
            const existing = fileDiagnosticsMap.get(fullUri.toString()) || [];
            existing.push(diagnostic);
            fileDiagnosticsMap.set(fullUri.toString(), existing);
        }
        for (const [uriStr, diagList] of fileDiagnosticsMap.entries()) {
            this.diagnosticCollection.set(vscode.Uri.parse(uriStr), diagList);
        }
    }
    provideCodeActions(document, range, context, _token) {
        const actions = [];
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const rootPath = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : '';
        const reviewDiagnostics = context.diagnostics.filter(d => d.source === 'AI Code Review Agent');
        if (reviewDiagnostics.length === 0)
            return actions;
        for (const diag of reviewDiagnostics) {
            const line = diag.range.start.line;
            // Match finding by line and filename
            const matched = this._findings.filter(f => {
                const lineNum = Math.max(0, (f.line || f.line_number || 1) - 1);
                const fPath = (f.file || f.file_path || '').replace(/\\/g, '/').toLowerCase();
                const docPath = document.uri.fsPath.replace(/\\/g, '/').toLowerCase();
                return lineNum === line && docPath.endsWith(fPath.split('/').pop() || '');
            });
            for (const issue of matched) {
                if (issue.fix_code && !/^(ensure|make sure|you should|please|change the|it is recommended)/i.test(issue.fix_code)) {
                    const fixAction = new vscode.CodeAction(`⚡ Apply AI Fix: ${issue.suggestion ? issue.suggestion.slice(0, 45) + '...' : 'Replace with recommended code'}`, vscode.CodeActionKind.QuickFix);
                    fixAction.diagnostics = [diag];
                    fixAction.isPreferred = true;
                    const edit = new vscode.WorkspaceEdit();
                    // Clean code and preserve indentation
                    const cleanFix = issue.fix_code.replace(/^```[a-zA-Z]*\r?\n?/, '').replace(/\r?\n?```$/, '').trim();
                    const targetLine = document.lineAt(line);
                    const leadingIndentMatch = targetLine.text.match(/^(\s*)/);
                    const leadingIndent = leadingIndentMatch ? leadingIndentMatch[1] : '';
                    let finalReplacement = '';
                    if (targetLine.text.includes('0.0.0.0') && (cleanFix.includes('127.0.0.1') || cleanFix.includes('host=')) && !cleanFix.includes('uvicorn.run') && !cleanFix.includes('app.run')) {
                        finalReplacement = targetLine.text.replace(/['"]0\.0\.0\.0['"]/, '"127.0.0.1"');
                    }
                    else {
                        const indentedFixLines = cleanFix.split(/\r?\n/).map((l, i) => {
                            if (i === 0 && !l.startsWith(' ') && !l.startsWith('\t')) {
                                return leadingIndent + l;
                            }
                            return l;
                        });
                        finalReplacement = indentedFixLines.join('\n');
                    }
                    edit.replace(document.uri, targetLine.range, finalReplacement);
                    fixAction.edit = edit;
                    actions.push(fixAction);
                    const copyAction = new vscode.CodeAction(`📋 Copy AI Fix Code`, vscode.CodeActionKind.QuickFix);
                    copyAction.command = {
                        command: 'ai-code-review.copyFix',
                        title: 'Copy AI Fix',
                        arguments: [cleanFix]
                    };
                    actions.push(copyAction);
                }
                if (issue.suggestion) {
                    const suggestAction = new vscode.CodeAction(`💡 View AI Fix Suggestion Details`, vscode.CodeActionKind.QuickFix);
                    suggestAction.command = {
                        command: 'ai-code-review.showSuggestion',
                        title: 'View AI Fix Suggestion',
                        arguments: [issue]
                    };
                    actions.push(suggestAction);
                }
            }
        }
        return actions;
    }
    getFindings() {
        return this._findings;
    }
    clear() {
        this._findings = [];
        this.diagnosticCollection.clear();
    }
}
exports.DiagnosticsManager = DiagnosticsManager;
DiagnosticsManager.providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix
];
//# sourceMappingURL=DiagnosticsManager.js.map