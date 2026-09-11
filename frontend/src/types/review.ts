export type PushReadinessStatus = 'READY' | 'MINOR_FIXES_REQUIRED' | 'DO_NOT_PUSH' | 'LIMITED_REVIEW' | 'PENDING';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
export type Severity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface GroundedIssue {
  id?: string;
  file: string;
  line: number;
  end_line?: number;
  severity: Severity;
  category: string;
  rule_id?: string;
  message: string;
  suggestion: string;
  evidence: string;
  is_blocking?: boolean;
  source_tool?: string;
}

export interface MissingTest {
  id?: string;
  scenario_type: 'happy_path' | 'negative_path' | 'edge_case' | 'regression';
  target_file: string;
  target_method?: string;
  description: string;
  suggested_test_code?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PassedCheck {
  check_name: string;
  category: string;
  description?: string;
}

export interface AcceptanceCriteriaResult {
  criterion_id: string;
  description: string;
  checkable_condition: string;
  priority: string;
  is_satisfied: boolean;
  evidence?: string;
}

export interface ReviewMetadata {
  sessionId: string;
  diffHash: string;
  model: string;
  promptVersion: string;
  standardsVersion: string;
  durationMs: number;
  timestamp: string;
}

export interface ReviewResult {
  summary: string;
  pushReadiness: PushReadinessStatus;
  riskLevel: RiskLevel;
  blockingIssues: number;
  warningIssues: number;
  passedChecksCount: number;
  missingTestsCount: number;
  issues: GroundedIssue[];
  missingTests: MissingTest[];
  passedChecks: PassedCheck[];
  acceptanceCriteriaResults: AcceptanceCriteriaResult[];
  reviewMetadata: ReviewMetadata;
  auditLogs?: any[];
}

export interface ServerConfig {
  mode: string;
  gemini_model: string;
  mistral_model: string;
  mistral_local_url: string;
  mistral_local_model: string;
  mysql_host: string;
  mysql_port: number;
  mysql_database: string;
  mysql_user: string;
  strict_gatekeeper: boolean;
  redact_secrets: boolean;
}

export interface CodingStandardRule {
  id?: string;
  rule_code: string;
  language: string;
  framework?: string;
  category: string;
  title: string;
  description: string;
  bad_example?: string;
  good_example?: string;
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' | string;
  is_blocking?: boolean;
  version?: string;
  created_at?: string;
}

