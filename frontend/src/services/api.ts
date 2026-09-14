import { ReviewResult, ServerConfig } from '../types/review';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export async function runReview(payload: {
  git_diff: string;
  acceptance_criteria: string;
  repository_name?: string;
  branch?: string;
  language?: string;
  framework?: string;
}): Promise<ReviewResult> {
  const response = await fetch(`${API_BASE}/api/v1/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(err.error || `HTTP error ${response.status}`);
  }

  return response.json();
}

export async function fetchReviewHistory(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/api/v1/reviews?limit=10`);
  if (!response.ok) throw new Error('Failed to fetch review history');
  const data = await response.json();
  return data.sessions || [];
}

export async function fetchReviewDetails(sessionId: string): Promise<ReviewResult> {
  const response = await fetch(`${API_BASE}/api/v1/reviews/${sessionId}`);
  if (!response.ok) throw new Error('Failed to fetch review details');
  return response.json();
}

export async function fetchStandards(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/api/v1/standards`);
  if (!response.ok) throw new Error('Failed to fetch standards');
  const data = await response.json();
  return data.standards || [];
}

export async function fetchAllStandards(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/api/v1/standards/all`);
  if (!response.ok) throw new Error('Failed to fetch all standards');
  const data = await response.json();
  return data.standards || [];
}

export async function uploadStandardsBulk(rules: any[], force: boolean = false): Promise<any> {
  const response = await fetch(`${API_BASE}/api/v1/standards/bulk?force=${force}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rules)
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    if (errData.failed_rules) {
      throw errData;
    }
    throw new Error(errData.warning_message || errData.error || 'Failed to upload standards');
  }
  return response.json();
}

export async function deleteStandard(ruleCode: string): Promise<any> {
  const response = await fetch(`${API_BASE}/api/v1/standards/${ruleCode}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(`Failed to delete standard ${ruleCode}`);
  return response.json();
}

export async function fetchServerConfig(): Promise<ServerConfig> {
  const response = await fetch(`${API_BASE}/api/v1/config`);
  if (!response.ok) throw new Error('Failed to fetch config');
  return response.json();
}

export async function updateServerConfig(updates: Partial<ServerConfig>): Promise<any> {
  const response = await fetch(`${API_BASE}/api/v1/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!response.ok) throw new Error('Failed to update config');
  return response.json();
}
