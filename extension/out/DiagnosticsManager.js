"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticsManager = void 0;
const vscode = require("vscode");
class DiagnosticsManager {
    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('ai-code-review');
    }
    setFindings(findings) {
        this.diagnosticCollection.clear();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0)
            return;
        const rootPath = workspaceFolders[0].uri.fsPath;
        const fileDiagnosticsMap = new Map();
        for (const issue of findings) {
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
            let messageStr = `[${issue.category || 'AI Review'}] ${issue.message}\n💡 Suggestion: ${issue.suggestion}`;
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
    clear() {
        this.diagnosticCollection.clear();
    }
}
exports.DiagnosticsManager = DiagnosticsManager;
//# sourceMappingURL=DiagnosticsManager.js.map