import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  UploadCloud,
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  Search,
  Trash2,
  Plus,
  BookOpen,
  Code2,
  Sparkles,
  Check,
  Copy,
  RefreshCw,
  FileJson,
  X,
  Database
} from 'lucide-react';
import { CodingStandardRule } from '../types/review';
import { fetchAllStandards, uploadStandardsBulk, deleteStandard } from '../services/api';

interface RulesManagerProps {
  onNotify?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const RulesManager: React.FC<RulesManagerProps> = ({ onNotify }) => {
  // Pure dynamic standards state from Database
  const [standards, setStandards] = useState<CodingStandardRule[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  
  // Filtering states
  const [selectedLanguage, setSelectedLanguage] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');

  // Drag & drop / File staging states
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [stagedFile, setStagedFile] = useState<{
    file: File;
    name: string;
    size: number;
    parsedRules: CodingStandardRule[];
  } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<any[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual rule modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
  const [showFormatGuide, setShowFormatGuide] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Manual form state
  const [manualRule, setManualRule] = useState<CodingStandardRule>({
    rule_code: '',
    language: 'java',
    framework: 'general',
    category: 'quality',
    title: '',
    description: '',
    bad_example: '',
    good_example: '',
    severity: 'WARNING',
    is_blocking: false,
    version: '1.0.0'
  });

  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (onNotify) {
      onNotify(msg, type);
    } else {
      alert(msg);
    }
  };

  // Purely dynamic loader from backend database API
  const loadAllStandards = async () => {
    try {
      setIsLoading(true);
      const data = await fetchAllStandards();
      if (Array.isArray(data)) {
        setStandards(data);
      } else {
        setStandards([]);
      }
    } catch (err: any) {
      console.error("Failed to load standards from database:", err);
      setStandards([]);
      notify('Unable to connect to database. Please ensure backend server is running.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllStandards();
  }, []);

  // Parse uploaded file
  const processFile = async (file: File) => {
    setFileError(null);
    if (!file.name.endsWith('.json') && !file.name.endsWith('.yaml') && !file.name.endsWith('.yml')) {
      setFileError('Please upload a valid .json or .yaml configuration file.');
      return;
    }

    try {
      const text = await file.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (jsonErr) {
        setFileError('Invalid JSON format. Please check syntax.');
        return;
      }

      const rulesArray: any[] = Array.isArray(parsed) ? parsed : (parsed.standards || parsed.rules || [parsed]);
      
      if (!rulesArray.length || !rulesArray[0].rule_code || !rulesArray[0].title) {
        setFileError('File does not contain valid rules. Each rule requires "rule_code", "title", and "description".');
        return;
      }

      const formattedRules: CodingStandardRule[] = rulesArray.map((r, i) => ({
        rule_code: String(r.rule_code || `RULE-${i + 1}`).trim(),
        language: String(r.language || 'general').toLowerCase().trim(),
        framework: String(r.framework || 'all').toLowerCase().trim(),
        category: String(r.category || 'quality').toLowerCase().trim(),
        title: String(r.title || 'Untitled Standard').trim(),
        description: String(r.description || '').trim(),
        bad_example: r.bad_example || '',
        good_example: r.good_example || '',
        severity: (r.severity || 'WARNING').toUpperCase(),
        is_blocking: Boolean(r.is_blocking),
        version: r.version || '1.0.0'
      }));

      setStagedFile({
        file,
        name: file.name,
        size: file.size,
        parsedRules: formattedRules
      });
      setUploadError(null);
      setValidationErrors(null);
    } catch (err: any) {
      setFileError(`Error reading file: ${err.message}`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleConfirmUpload = async (force: boolean = false) => {
    if (!stagedFile) return;

    try {
      setIsUploading(true);
      await uploadStandardsBulk(stagedFile.parsedRules, force);
      notify(`Successfully saved ${stagedFile.parsedRules.length} rules to database!`, 'success');
      setStagedFile(null);
      setUploadError(null);
      setValidationErrors(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadAllStandards();
    } catch (err: any) {
      if (err.failed_rules) {
        setValidationErrors(err.failed_rules);
        setUploadError(`Validation failed for ${err.failed_count} rule(s).`);
      } else {
        setUploadError(err.message || String(err));
        notify(`Failed to upload to database: ${err.message || err}`, 'error');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteRule = async (ruleCode: string) => {
    if (!window.confirm(`Are you sure you want to delete rule [${ruleCode}] from database?`)) return;

    try {
      await deleteStandard(ruleCode);
      notify(`Rule ${ruleCode} deleted from database.`, 'info');
      await loadAllStandards();
    } catch (err: any) {
      notify(`Failed to delete rule: ${err.message || err}`, 'error');
    }
  };

  const handleCreateManualRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRule.rule_code.trim() || !manualRule.title.trim() || !manualRule.description.trim()) {
      alert("Rule code, title, and description are required.");
      return;
    }

    try {
      setIsUploading(true);
      await uploadStandardsBulk([manualRule]);
      await loadAllStandards();
      setIsManualModalOpen(false);
      notify(`Rule [${manualRule.rule_code}] saved to database!`, 'success');
      setManualRule({
        rule_code: '',
        language: 'java',
        framework: 'general',
        category: 'quality',
        title: '',
        description: '',
        bad_example: '',
        good_example: '',
        severity: 'WARNING',
        is_blocking: false,
        version: '1.0.0'
      });
    } catch (err: any) {
      notify(`Failed to save rule: ${err.message || err}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Compute distinct languages and counts purely from dynamic standards state
  const languageStats = useMemo(() => {
    const counts: Record<string, number> = { ALL: standards.length };
    standards.forEach(std => {
      const lang = (std.language || 'general').toLowerCase();
      counts[lang] = (counts[lang] || 0) + 1;
    });
    return counts;
  }, [standards]);

  // Available languages: purely dynamic from database records
  const availableLanguages = useMemo(() => {
    const dynamicLangs = Array.from(new Set(standards.map(s => (s.language || 'general').toLowerCase())));
    return ['ALL', ...dynamicLangs];
  }, [standards]);

  // Distinct categories: purely dynamic from database records
  const availableCategories = useMemo(() => {
    const cats = Array.from(new Set(standards.map(s => (s.category || 'quality').toLowerCase())));
    return ['ALL', ...cats];
  }, [standards]);

  // Filtered standards list
  const filteredStandards = useMemo(() => {
    return standards.filter(std => {
      const lang = (std.language || 'general').toLowerCase();
      const matchesLanguage = selectedLanguage === 'ALL' || lang === selectedLanguage.toLowerCase();
      
      const cat = (std.category || '').toLowerCase();
      const matchesCategory = selectedCategory === 'ALL' || cat === selectedCategory.toLowerCase();

      const sev = (std.severity || '').toUpperCase();
      const matchesSeverity = selectedSeverity === 'ALL' || sev === selectedSeverity.toUpperCase();

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        (std.rule_code || '').toLowerCase().includes(q) ||
        (std.title || '').toLowerCase().includes(q) ||
        (std.description || '').toLowerCase().includes(q) ||
        (std.framework || '').toLowerCase().includes(q);

      return matchesLanguage && matchesCategory && matchesSeverity && matchesSearch;
    });
  }, [standards, selectedLanguage, selectedCategory, selectedSeverity, searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Top File Upload Dropzone Hero Card */}
      <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div className="flex-row items-center justify-between gap-3" style={{ marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div className="flex-row items-center gap-2">
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.25))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(99, 102, 241, 0.4)'
            }}>
              <UploadCloud size={20} color="#a5b4fc" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
                Coding Standards & Rules Ingestion
              </h2>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0 }}>
                Upload JSON/YAML configuration files to save & enforce quality standards dynamically from Database.
              </p>
            </div>
          </div>

          <div className="flex-row items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFormatGuide(!showFormatGuide)}
              className="btn-ghost"
              style={{ fontSize: '0.74rem', padding: '0.45rem 0.85rem' }}
            >
              <FileJson size={14} />
              <span>JSON Format</span>
            </button>

            <button
              type="button"
              onClick={loadAllStandards}
              disabled={isLoading}
              className="btn-ghost"
              style={{ fontSize: '0.74rem', padding: '0.45rem 0.85rem' }}
              title="Refresh standards directly from database"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
              <span>Sync DB</span>
            </button>

            <button
              type="button"
              onClick={() => setIsManualModalOpen(true)}
              className="btn-prime"
              style={{ fontSize: '0.74rem', padding: '0.45rem 0.95rem' }}
            >
              <Plus size={14} />
              <span>Add Custom Rule</span>
            </button>
          </div>
        </div>

        {/* Expandable JSON Format Guide */}
        {showFormatGuide && (
          <div style={{
            marginBottom: '1rem',
            padding: '1rem',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            fontSize: '0.75rem'
          }}>
            <div className="flex-row items-center justify-between" style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700, color: '#c7d2fe' }}>Expected Rules JSON Schema (Array of objects):</span>
              <button
                type="button"
                onClick={() => handleCopyCode(`[
  {
    "rule_code": "STD-SEC-01",
    "language": "java",
    "framework": "spring-boot",
    "category": "security",
    "title": "Strict Input Validation with @Valid",
    "description": "All incoming HTTP request DTOs in Spring Boot controllers must be annotated with @Valid.",
    "bad_example": "public ResponseEntity<User> createUser(@RequestBody UserDto dto) { ... }",
    "good_example": "public ResponseEntity<User> createUser(@Valid @RequestBody UserDto dto) { ... }",
    "severity": "CRITICAL",
    "is_blocking": true
  }
]`, 'sample-schema')}
                className="btn-ghost"
                style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
              >
                {copiedCode === 'sample-schema' ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                <span>{copiedCode === 'sample-schema' ? 'Copied' : 'Copy Template'}</span>
              </button>
            </div>
            <pre style={{
              background: '#090d16',
              padding: '0.75rem',
              borderRadius: '8px',
              overflowX: 'auto',
              color: '#94a3b8',
              fontFamily: 'var(--font-mono)',
              maxHeight: '160px',
              fontSize: '0.72rem'
            }}>
{`[
  {
    "rule_code": "STD-SEC-01",
    "language": "java",
    "framework": "spring-boot",
    "category": "security",
    "title": "Strict Input Validation with @Valid",
    "description": "All incoming HTTP request DTOs in Spring Boot controllers must be annotated with @Valid.",
    "bad_example": "public ResponseEntity<User> createUser(@RequestBody UserDto dto) { ... }",
    "good_example": "public ResponseEntity<User> createUser(@Valid @RequestBody UserDto dto) { ... }",
    "severity": "CRITICAL",
    "is_blocking": true
  }
]`}
            </pre>
          </div>
        )}

        {/* Drag & Drop Zone */}
        {!stagedFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: isDragOver ? '2px dashed #818cf8' : '2px dashed rgba(255, 255, 255, 0.15)',
              background: isDragOver ? 'rgba(99, 102, 241, 0.12)' : 'rgba(0, 0, 0, 0.25)',
              borderRadius: '14px',
              padding: '2rem 1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.65rem'
            }}
          >
            <input
              type="file"
              accept=".json,.yaml,.yml"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />

            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}>
              <UploadCloud size={24} color="#818cf8" />
            </div>

            <div>
              <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.25rem 0' }}>
                Drag and drop your rules file here, or <span style={{ color: '#818cf8', textDecoration: 'underline' }}>Browse files</span>
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                Upload JSON/YAML files to ingest coding standards directly into the database
              </p>
            </div>

            {fileError && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <AlertTriangle size={14} />
                <span>{fileError}</span>
              </div>
            )}
          </div>
        ) : (
          /* Staged File Confirmation Card */
          <div style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            borderRadius: '14px',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.9rem'
          }}>
            <div className="flex-row items-center justify-between gap-3" style={{ flexWrap: 'wrap' }}>
              <div className="flex-row items-center gap-3">
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  <FileCode2 size={22} color="#34d399" />
                </div>
                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                    {stagedFile.name}
                  </h4>
                  <div className="flex-row items-center gap-2" style={{ marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {(stagedFile.size / 1024).toFixed(1)} KB
                    </span>
                    <span style={{ color: 'var(--border-subtle)' }}>•</span>
                    <span style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 600 }}>
                      ✓ Validated {stagedFile.parsedRules.length} Rules
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-row items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStagedFile(null)}
                  disabled={isUploading}
                  className="btn-ghost"
                  style={{ fontSize: '0.75rem', padding: '0.45rem 0.85rem' }}
                >
                  <X size={14} />
                  <span>Cancel</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmUpload}
                  disabled={isUploading}
                  className="btn-prime"
                  style={{ fontSize: '0.78rem', padding: '0.5rem 1.15rem' }}
                >
                  {isUploading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Saving to Database...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Save & Ingest {stagedFile.parsedRules.length} Rules</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Preview Chips of Languages within File */}
            <div className="flex-row items-center gap-2" style={{ flexWrap: 'wrap', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Languages included in file:</span>
              {Array.from(new Set(stagedFile.parsedRules.map(r => r.language))).map(l => (
                <span
                  key={l}
                  style={{
                    fontSize: '0.68rem',
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-mono)',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#a5b4fc',
                    border: '1px solid rgba(99, 102, 241, 0.25)'
                  }}
                >
                  {l}
                </span>
              ))}
            </div>

            {uploadError && (
              <div style={{
                marginTop: '0.25rem',
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>{uploadError}</span>
                  
                  {validationErrors && (
                    <button
                      type="button"
                      onClick={() => handleConfirmUpload(true)}
                      disabled={isUploading}
                      style={{
                        marginLeft: 'auto',
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.7rem',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      {isUploading ? 'Uploading...' : 'Upload Anyway'}
                    </button>
                  )}
                </div>
                
                {validationErrors && validationErrors.length > 0 && (
                  <div style={{ 
                    marginTop: '0.25rem', 
                    maxHeight: '120px', 
                    overflowY: 'auto', 
                    padding: '0.5rem', 
                    background: 'rgba(0,0,0,0.2)', 
                    borderRadius: '4px' 
                  }}>
                    {validationErrors.map((err, i) => (
                      <div key={i} style={{ marginBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.4rem' }}>
                        <strong style={{ color: '#fca5a5' }}>[{err.rule_code}]</strong> {err.warning}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Language-Wise Rules Hub ("lunges waise dhka jaba") */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Hub Header & Metrics */}
        <div className="flex-row items-center justify-between gap-3" style={{ flexWrap: 'wrap' }}>
          <div>
            <div className="flex-row items-center gap-2">
              <Database size={20} color="#818cf8" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                Enterprise Rules Catalog (Dynamic Database)
              </h3>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
              All standards dynamically retrieved from database and vectorized for live analysis.
            </p>
          </div>

          <div className="flex-row items-center gap-2">
            <div className="status-pill" style={{ background: 'rgba(99, 102, 241, 0.12)', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
              <span style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 700 }}>
                Total in DB: {standards.length} Rules
              </span>
            </div>
            <div className="status-pill" style={{ background: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 700 }}>
                {standards.filter(s => s.is_blocking || s.severity === 'CRITICAL').length} Blocking Gates
              </span>
            </div>
          </div>
        </div>

        {/* Primary Language-Wise Navigation Bar (100% Dynamic from Database) */}
        {availableLanguages.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            overflowX: 'auto',
            paddingBottom: '0.35rem',
            borderBottom: '1px solid var(--border-subtle)'
          }}>
            {availableLanguages.map((lang) => {
              const count = languageStats[lang.toLowerCase()] || (lang === 'ALL' ? standards.length : 0);
              const isActive = selectedLanguage.toLowerCase() === lang.toLowerCase();
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedLanguage(lang)}
                  className={`tab-nav-btn ${isActive ? 'active' : ''}`}
                  style={{
                    padding: '0.55rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                    borderRadius: '10px'
                  }}
                >
                  <Code2 size={14} color={isActive ? '#818cf8' : 'var(--text-muted)'} />
                  <span>{lang}</span>
                  <span
                    className="tab-counter-badge"
                    style={{
                      background: isActive ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                      color: isActive ? '#ffffff' : 'var(--text-secondary)'
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Search & Sub-Filters Toolbar */}
        <div className="flex-row items-center justify-between gap-3" style={{ flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div
            className="flex-row items-center gap-2"
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '0.45rem 0.85rem',
              flex: 1,
              minWidth: '240px'
            }}
          >
            <Search size={15} color="var(--text-muted)" />
            <input
              type="text"
              placeholder={`Search in ${selectedLanguage === 'ALL' ? 'all languages' : selectedLanguage}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '0.78rem',
                color: '#ffffff',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex-row items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-select"
              style={{ fontSize: '0.74rem', padding: '0.35rem 0.75rem' }}
            >
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.toUpperCase()}
                </option>
              ))}
            </select>

            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Severity:</span>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="input-select"
              style={{ fontSize: '0.74rem', padding: '0.35rem 0.75rem' }}
            >
              <option value="ALL">ALL SEVERITIES</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="WARNING">WARNING</option>
              <option value="INFO">INFO</option>
            </select>
          </div>
        </div>

        {/* Filtered Rules Cards List */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
            <p style={{ fontSize: '0.85rem' }}>Loading standards from database...</p>
          </div>
        ) : filteredStandards.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1.5rem',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '12px',
            border: '1px dashed var(--border-subtle)'
          }}>
            <Database size={32} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem auto' }} />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', marginBottom: '0.25rem' }}>
              {standards.length === 0 ? "Database is Currently Empty" : "No Matching Rules Found"}
            </h4>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 1rem auto' }}>
              {standards.length === 0
                ? "No coding standards have been added to the database yet. Upload a JSON/YAML rules file above or click 'Add Custom Rule' to insert standards into the database."
                : `No rules match your selected language (${selectedLanguage}) or search filters.`}
            </p>
            {standards.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedLanguage('ALL');
                  setSelectedCategory('ALL');
                  setSelectedSeverity('ALL');
                  setSearchQuery('');
                }}
                className="btn-ghost"
                style={{ fontSize: '0.75rem' }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredStandards.map((rule, idx) => {
              const isBlocking = rule.is_blocking || rule.severity === 'CRITICAL';
              const sev = (rule.severity || 'WARNING').toUpperCase();

              return (
                <div
                  key={rule.rule_code || idx}
                  className="issue-card"
                  style={{
                    padding: '1.25rem',
                    position: 'relative',
                    background: 'rgba(15, 23, 42, 0.55)',
                    border: isBlocking ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-subtle)'
                  }}
                >
                  {/* Top Row: Rule Code, Title, Tags, Actions */}
                  <div className="flex-row items-center justify-between gap-2" style={{ flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                    <div className="flex-row items-center gap-2" style={{ flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          background: 'rgba(99, 102, 241, 0.18)',
                          color: '#a5b4fc',
                          border: '1px solid rgba(99, 102, 241, 0.35)'
                        }}
                      >
                        {rule.rule_code}
                      </span>

                      <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                        {rule.title}
                      </h4>
                    </div>

                    <div className="flex-row items-center gap-2">
                      {/* Language & Framework Pill */}
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-mono)',
                          textTransform: 'uppercase',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          background: 'rgba(255, 255, 255, 0.07)',
                          color: '#e2e8f0',
                          fontWeight: 600
                        }}
                      >
                        {rule.language} {rule.framework && rule.framework !== 'all' ? `• ${rule.framework}` : ''}
                      </span>

                      {/* Severity Pill */}
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          background: sev === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                          color: sev === 'CRITICAL' ? '#f87171' : '#fbbf24',
                          border: `1px solid ${sev === 'CRITICAL' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`
                        }}
                      >
                        {sev}
                      </span>

                      {/* Blocking Gate Status */}
                      {isBlocking && (
                        <span
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#fda4af',
                            border: '1px solid rgba(239, 68, 68, 0.3)'
                          }}
                        >
                          ⛔ BLOCKING
                        </span>
                      )}

                      {/* Delete Rule Action */}
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.rule_code)}
                        className="btn-icon"
                        style={{ width: '28px', height: '28px', color: 'var(--text-muted)' }}
                        title="Delete rule from database"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: '0 0 0.85rem 0' }}>
                    {rule.description}
                  </p>

                  {/* Side-by-Side Good vs Bad Code Examples */}
                  {(rule.bad_example || rule.good_example) && (
                    <div className="grid-2" style={{ gap: '0.75rem', marginTop: '0.5rem' }}>
                      {rule.bad_example && (
                        <div
                          style={{
                            padding: '0.85rem',
                            borderRadius: '10px',
                            background: 'rgba(244, 63, 94, 0.06)',
                            border: '1px solid rgba(244, 63, 94, 0.25)',
                            position: 'relative'
                          }}
                        >
                          <div className="flex-row items-center justify-between" style={{ marginBottom: '0.35rem' }}>
                            <span style={{ color: '#fb7185', fontWeight: 700, fontSize: '0.72rem' }}>
                              ❌ Non-Compliant Pattern
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(rule.bad_example || '', `bad-${rule.rule_code}`)}
                              className="btn-ghost"
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}
                            >
                              {copiedCode === `bad-${rule.rule_code}` ? <Check size={10} color="#34d399" /> : <Copy size={10} />}
                              <span>{copiedCode === `bad-${rule.rule_code}` ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <pre style={{
                            margin: 0,
                            overflowX: 'auto',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.7rem',
                            color: '#fda4af',
                            background: 'rgba(0, 0, 0, 0.3)',
                            padding: '0.5rem',
                            borderRadius: '6px'
                          }}>
                            {rule.bad_example}
                          </pre>
                        </div>
                      )}

                      {rule.good_example && (
                        <div
                          style={{
                            padding: '0.85rem',
                            borderRadius: '10px',
                            background: 'rgba(16, 185, 129, 0.06)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            position: 'relative'
                          }}
                        >
                          <div className="flex-row items-center justify-between" style={{ marginBottom: '0.35rem' }}>
                            <span style={{ color: '#34d399', fontWeight: 700, fontSize: '0.72rem' }}>
                              ✅ Approved Standard Pattern
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(rule.good_example || '', `good-${rule.rule_code}`)}
                              className="btn-ghost"
                              style={{ padding: '0.15rem 0.4rem', fontSize: '0.65rem' }}
                            >
                              {copiedCode === `good-${rule.rule_code}` ? <Check size={10} color="#34d399" /> : <Copy size={10} />}
                              <span>{copiedCode === `good-${rule.rule_code}` ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <pre style={{
                            margin: 0,
                            overflowX: 'auto',
                            whiteSpace: 'pre-wrap',
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.7rem',
                            color: '#6ee7b7',
                            background: 'rgba(0, 0, 0, 0.3)',
                            padding: '0.5rem',
                            borderRadius: '6px'
                          }}>
                            {rule.good_example}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card Metadata Footer */}
                  <div className="flex-row items-center justify-between" style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div className="flex-row items-center gap-2">
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Category:</span>
                      <span style={{ fontSize: '0.68rem', color: '#c7d2fe', textTransform: 'capitalize', fontWeight: 600 }}>
                        {rule.category}
                      </span>
                    </div>

                    <div className="flex-row items-center gap-3">
                      {rule.version && (
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          v{rule.version}
                        </span>
                      )}
                      {rule.created_at && (
                        <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                          {new Date(rule.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manual Rule Modal Dialog */}
      {isManualModalOpen && (
        <div className="modal-overlay" onClick={() => setIsManualModalOpen(false)}>
          <div className="modal-window" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="flex-row items-center gap-2">
                <Plus size={18} color="#818cf8" />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff', margin: 0 }}>
                  Add Custom Coding Standard to Database
                </h3>
              </div>
              <button type="button" onClick={() => setIsManualModalOpen(false)} className="btn-icon">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateManualRule}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="grid-2">
                  <div>
                    <label className="form-label">Rule Code (e.g. STD-SEC-03)</label>
                    <input
                      type="text"
                      required
                      placeholder="STD-SEC-03"
                      value={manualRule.rule_code}
                      onChange={(e) => setManualRule({ ...manualRule, rule_code: e.target.value.toUpperCase() })}
                      className="input-text"
                    />
                  </div>
                  <div>
                    <label className="form-label">Target Language</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. java, python, go, rust, csharp"
                      value={manualRule.language}
                      onChange={(e) => setManualRule({ ...manualRule, language: e.target.value.toLowerCase().trim() })}
                      className="input-text"
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div>
                    <label className="form-label">Framework</label>
                    <input
                      type="text"
                      placeholder="e.g. spring-boot, flask, react, gin, all"
                      value={manualRule.framework}
                      onChange={(e) => setManualRule({ ...manualRule, framework: e.target.value })}
                      className="input-text"
                    />
                  </div>
                  <div>
                    <label className="form-label">Category</label>
                    <input
                      type="text"
                      placeholder="e.g. security, quality, architecture, testing"
                      value={manualRule.category}
                      onChange={(e) => setManualRule({ ...manualRule, category: e.target.value.toLowerCase().trim() })}
                      className="input-text"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Standard Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Prevention of XSS via Output Sanitization"
                    value={manualRule.title}
                    onChange={(e) => setManualRule({ ...manualRule, title: e.target.value })}
                    className="input-text"
                  />
                </div>

                <div>
                  <label className="form-label">Rule Description & Rationale</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide full description and why this standard must be enforced..."
                    value={manualRule.description}
                    onChange={(e) => setManualRule({ ...manualRule, description: e.target.value })}
                    className="code-textarea"
                  />
                </div>

                <div className="grid-2">
                  <div>
                    <label className="form-label">❌ Non-Compliant Code (Bad Example)</label>
                    <textarea
                      rows={3}
                      placeholder="// Bad practice code..."
                      value={manualRule.bad_example}
                      onChange={(e) => setManualRule({ ...manualRule, bad_example: e.target.value })}
                      className="code-textarea"
                    />
                  </div>
                  <div>
                    <label className="form-label">✅ Approved Code (Good Example)</label>
                    <textarea
                      rows={3}
                      placeholder="// Compliant practice code..."
                      value={manualRule.good_example}
                      onChange={(e) => setManualRule({ ...manualRule, good_example: e.target.value })}
                      className="code-textarea"
                    />
                  </div>
                </div>

                <div className="flex-row items-center justify-between" style={{ paddingTop: '0.5rem' }}>
                  <div className="flex-row items-center gap-2">
                    <label className="form-label" style={{ margin: 0 }}>Severity:</label>
                    <select
                      value={manualRule.severity}
                      onChange={(e) => setManualRule({ ...manualRule, severity: e.target.value })}
                      className="input-select"
                    >
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="WARNING">WARNING</option>
                      <option value="INFO">INFO</option>
                    </select>
                  </div>

                  <label className="flex-row items-center gap-2" style={{ cursor: 'pointer', fontSize: '0.78rem', color: '#ffffff' }}>
                    <input
                      type="checkbox"
                      checked={manualRule.is_blocking}
                      onChange={(e) => setManualRule({ ...manualRule, is_blocking: e.target.checked })}
                    />
                    <span>Is Blocking Push Gate (Strict)</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setIsManualModalOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isUploading} className="btn-prime">
                  {isUploading ? 'Saving to DB...' : 'Save to Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
