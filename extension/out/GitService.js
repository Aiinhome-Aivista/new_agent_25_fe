"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const vscode = require("vscode");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class GitService {
    static async getWorkingDiff() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return '';
        }
        const cwd = workspaceFolders[0].uri.fsPath;
        try {
            let diff = '';
            // 1. Try git diff HEAD (staged + unstaged)
            try {
                const { stdout } = await execAsync('git diff HEAD', { cwd, timeout: 5000 });
                if (stdout && stdout.trim()) {
                    diff = stdout;
                }
            } catch {}
            // 2. Try git diff
            if (!diff.trim()) {
                try {
                    const { stdout: diffStdout } = await execAsync('git diff', { cwd, timeout: 5000 });
                    if (diffStdout && diffStdout.trim()) {
                        diff = diffStdout;
                    }
                } catch {}
            }
            // 3. Include untracked new files
            try {
                const { stdout: untrackedFiles } = await execAsync('git ls-files --others --exclude-standard', { cwd, timeout: 5000 });
                if (untrackedFiles && untrackedFiles.trim()) {
                    const files = untrackedFiles.trim().split(/\r?\n/);
                    for (const file of files) {
                        const trimmed = file.trim();
                        if (trimmed) {
                            try {
                                const { stdout: fileDiff } = await execAsync(`git diff --no-index -- /dev/null "${trimmed}"`, { cwd, timeout: 5000 });
                                if (fileDiff && fileDiff.trim()) {
                                    diff += (diff ? '\n' : '') + fileDiff;
                                }
                            } catch (e) {
                                if (e.stdout && e.stdout.trim()) {
                                    diff += (diff ? '\n' : '') + e.stdout;
                                }
                            }
                        }
                    }
                }
            } catch {}
            return diff.trim();
        }
        catch (err) {
            console.warn('Could not extract git diff automatically:', err);
            return '';
        }
    }
    static async getCurrentBranch() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0)
            return 'main';
        try {
            const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
                cwd: workspaceFolders[0].uri.fsPath,
                timeout: 3000
            });
            return stdout.trim() || 'main';
        }
        catch {
            return 'main';
        }
    }
}
exports.GitService = GitService;
//# sourceMappingURL=GitService.js.map