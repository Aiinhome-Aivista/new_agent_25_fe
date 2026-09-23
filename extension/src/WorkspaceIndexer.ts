import * as vscode from "vscode";
import * as path from "path";

export interface IndexProgress {
  total: number;
  indexed: number;
  currentFile: string;
}

export interface IndexResult {
  indexedFiles: number;
  totalChunks: number;
  skippedFiles: number;
  errors: Array<{ file: string; error: string }>;
}

export interface CodebaseStatus {
  indexed_chunks: number;
  indexed_files: number;
  available: boolean;
}

export class WorkspaceIndexer {
  // Backend batch size per request
  private static readonly BATCH_SIZE = 10;

  // File extensions to index
  private static readonly SUPPORTED_EXTENSIONS = new Set([
    ".py", ".ts", ".tsx", ".js", ".jsx",
    ".java", ".go", ".cs", ".php", ".rb",
    ".cpp", ".c", ".h", ".hpp", ".kt",
    ".swift", ".rs",
  ]);

  // Glob patterns to exclude
  private static readonly EXCLUDE_GLOBS = [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**",
    "**/venv/**",
    "**/.venv/**",
    "**/__pycache__/**",
    "**/coverage/**",
    "**/.next/**",
    "**/.nuxt/**",
    "**/target/**",
    "**/.gradle/**",
    "**/out/**",
    "**/bin/**",
    "**/obj/**",
    "**/*.min.js",
    "**/*.min.css",
    "**/*.lock",
    "**/.env",
    "**/.env.*",
    "**/*.class",
    "**/*.jar",
    "**/*.war",
    "**/*.pyc",
  ];

  /**
   * Workspace-এর সব supported code files খুঁজে বের করে।
   */
  public static async findWorkspaceFiles(): Promise<vscode.Uri[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return [];
    }

    // Supported extensions glob pattern
    const extPattern = `**/*.{${[...this.SUPPORTED_EXTENSIONS]
      .map((e) => e.slice(1))
      .join(",")}}`;

    // Exclude pattern string
    const excludePattern = `{${this.EXCLUDE_GLOBS.join(",")}}`;

    const files = await vscode.workspace.findFiles(extPattern, excludePattern);
    return files;
  }

  /**
   * Language detect করে file extension থেকে।
   */
  private static detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      ".py": "python",
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".java": "java",
      ".go": "go",
      ".cs": "csharp",
      ".php": "php",
      ".rb": "ruby",
      ".cpp": "cpp",
      ".c": "c",
      ".h": "c",
      ".hpp": "cpp",
      ".kt": "kotlin",
      ".swift": "swift",
      ".rs": "rust",
    };
    return langMap[ext] || "general";
  }

  /**
   * পুরো workspace index করে — manual button click-এ call হয়।
   * onProgress callback দিয়ে progress update পাঠায়।
   */
  public static async indexWorkspace(
    backendUrl: string,
    onProgress?: (progress: IndexProgress) => void
  ): Promise<IndexResult> {
    const result: IndexResult = {
      indexedFiles: 0,
      totalChunks: 0,
      skippedFiles: 0,
      errors: [],
    };

    // 1. পুরানো index clear করো (full re-index)
    try {
      await fetch(`${backendUrl}/api/v1/codebase/clear`, { method: "DELETE" });
    } catch (e) {
      console.warn("Could not clear codebase index:", e);
    }

    // 2. সব workspace files খুঁজো
    const files = await this.findWorkspaceFiles();
    const total = files.length;

    if (total === 0) {
      return result;
    }

    // 3. Batch করে backend-এ পাঠাও
    for (let i = 0; i < files.length; i += this.BATCH_SIZE) {
      const batch = files.slice(i, i + this.BATCH_SIZE);
      const fileInfos: Array<{ path: string; content: string; language: string }> = [];

      for (const fileUri of batch) {
        try {
          const relativePath = vscode.workspace.asRelativePath(fileUri, false);
          const contentBytes = await vscode.workspace.fs.readFile(fileUri);
          const content = new TextDecoder("utf-8").decode(contentBytes);

          // খুব বড় files skip (>200KB)
          if (contentBytes.byteLength > 200 * 1024) {
            result.skippedFiles++;
            continue;
          }

          fileInfos.push({
            path: relativePath,
            content: content,
            language: this.detectLanguage(fileUri.fsPath),
          });
        } catch (e: any) {
          result.skippedFiles++;
          console.warn(`Could not read file: ${fileUri.fsPath}`, e);
        }
      }

      if (fileInfos.length === 0) continue;

      // Progress update
      if (onProgress) {
        onProgress({
          total,
          indexed: Math.min(i + this.BATCH_SIZE, total),
          currentFile: fileInfos[fileInfos.length - 1]?.path || "",
        });
      }

      // Backend-এ পাঠাও
      try {
        const response = await fetch(`${backendUrl}/api/v1/codebase/index`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: fileInfos }),
        });

        if (response.ok) {
          const data = await response.json() as {
            indexed_files?: number;
            total_chunks?: number;
            skipped_files?: number;
            errors?: Array<{ file: string; error: string }>;
          };
          result.indexedFiles += data.indexed_files || 0;
          result.totalChunks += data.total_chunks || 0;
          result.skippedFiles += data.skipped_files || 0;
          if (data.errors) {
            result.errors.push(...data.errors);
          }
        }
      } catch (e: any) {
        console.error("Batch index failed:", e);
      }
    }

    return result;
  }

  /**
   * Backend থেকে current index status আনে।
   */
  public static async getStatus(backendUrl: string): Promise<CodebaseStatus> {
    try {
      const response = await fetch(`${backendUrl}/api/v1/codebase/status`);
      if (response.ok) {
        return await response.json() as CodebaseStatus;
      }
    } catch (e) {
      console.warn("Could not fetch codebase status:", e);
    }
    return { indexed_chunks: 0, indexed_files: 0, available: false };
  }
}
