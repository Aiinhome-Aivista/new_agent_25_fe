import React, { useState } from 'react';
import { Play, Sparkles, FileCode, CheckSquare, RefreshCw, Terminal, Layers, Trash2, Clipboard } from 'lucide-react';

interface ReviewControlsProps {
  onRunReview: (criteria: string, diff: string, language: string, framework: string) => void;
  isLoading: boolean;
}

const PRESET_SCENARIOS = [
  {
    id: 'clean-spring',
    name: '1. Clean Feature',
    tag: 'Spring Boot',
    criteria: '1. Customer email must contain @ symbol and be non-null.\n2. Service must return boolean valid status.',
    diff: `diff --git a/src/main/java/com/example/CustomerService.java b/src/main/java/com/example/CustomerService.java
new file mode 100644
--- /dev/null
+++ b/src/main/java/com/example/CustomerService.java
@@ -0,0 +1,10 @@
+package com.example;
+import org.springframework.stereotype.Service;
+
+@Service
+public class CustomerService {
+    public boolean isValidCustomer(String email) {
+        return email != null && email.contains("@");
+    }
+}`,
    language: 'java',
    framework: 'spring-boot'
  },
  {
    id: 'sqli-java',
    name: '2. SQL Injection Hazard',
    tag: 'DO NOT PUSH',
    criteria: '1. Customer lookup by email.\n2. Query database and return customer entity.',
    diff: `diff --git a/src/main/java/com/example/CustomerRepository.java b/src/main/java/com/example/CustomerRepository.java
--- a/src/main/java/com/example/CustomerRepository.java
+++ b/src/main/java/com/example/CustomerRepository.java
@@ -10,4 +10,6 @@
+    public User findByEmailRaw(String email) {
+        return entityManager.createQuery("SELECT u FROM User u WHERE u.email = '" + email + "'").getSingleResult();
+    }
+}`,
    language: 'java',
    framework: 'spring-boot'
  },
  {
    id: 'secret-leak',
    name: '3. Hardcoded Secret Leak',
    tag: 'CRITICAL',
    criteria: '1. Configure S3 client properties.\n2. Set AWS authentication credentials.',
    diff: `diff --git a/src/main/resources/application.properties b/src/main/resources/application.properties
--- a/src/main/resources/application.properties
+++ b/src/main/resources/application.properties
@@ -1,2 +1,3 @@
+aws.access.key=AKIA1234567890EXAMPLE
+aws.region=us-east-1`,
    language: 'java',
    framework: 'spring-boot'
  },
  {
    id: 'missing-validation',
    name: '4. Missing Controller Validation',
    tag: 'Quality Gate',
    criteria: '1. Create customer endpoint.\n2. Reject invalid customer requests.',
    diff: `diff --git a/src/main/java/com/example/CustomerController.java b/src/main/java/com/example/CustomerController.java
--- a/src/main/java/com/example/CustomerController.java
+++ b/src/main/java/com/example/CustomerController.java
@@ -12,4 +12,6 @@
+    @PostMapping("/customers")
+    public ResponseEntity<User> createCustomer(@RequestBody CustomerDto dto) {
+        return ResponseEntity.ok(customerService.save(dto));
+    }
+}`,
    language: 'java',
    framework: 'spring-boot'
  },
  {
    id: 'flask-sqli',
    name: '5. Python Flask SQLi',
    tag: 'Python',
    criteria: '1. Endpoint to query user by username.\n2. Return user profile dictionary.',
    diff: `diff --git a/app/routes/users.py b/app/routes/users.py
new file mode 100644
--- /dev/null
+++ b/app/routes/users.py
@@ -0,0 +1,9 @@
+from flask import Blueprint, request, jsonify
+from app.database import db
+
+user_bp = Blueprint('users', __name__)
+
+@user_bp.route('/api/user', methods=['GET'])
+def get_user():
+    username = request.args.get('username')
+    user = db.session.execute(f"SELECT * FROM users WHERE username = '{username}'")
+    return jsonify({"user": user.fetchone()})`,
    language: 'python',
    framework: 'flask'
  },
  {
    id: 'python-clean',
    name: '6. Python Clean Service',
    tag: 'Pydantic',
    criteria: '1. Validate customer registration email.\n2. Return sanitized customer payload.',
    diff: `diff --git a/app/services/customer.py b/app/services/customer.py
new file mode 100644
--- /dev/null
+++ b/app/services/customer.py
@@ -0,0 +1,11 @@
+import re
+from pydantic import BaseModel, EmailStr
+
+class CustomerRegisterDTO(BaseModel):
+    email: EmailStr
+    full_name: str
+
+def register_customer(payload: CustomerRegisterDTO) -> dict:
+    return {"email": payload.email.lower(), "name": payload.full_name.strip()}
+`,
    language: 'python',
    framework: 'flask'
  }
];

export const ReviewControls: React.FC<ReviewControlsProps> = ({ onRunReview, isLoading }) => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>(PRESET_SCENARIOS[0].id);
  const [criteria, setCriteria] = useState(PRESET_SCENARIOS[0].criteria);
  const [diff, setDiff] = useState(PRESET_SCENARIOS[0].diff);
  const [language, setLanguage] = useState(PRESET_SCENARIOS[0].language);
  const [framework, setFramework] = useState(PRESET_SCENARIOS[0].framework);

  const handleSelectPreset = (scenario: typeof PRESET_SCENARIOS[0]) => {
    setActiveScenarioId(scenario.id);
    setCriteria(scenario.criteria);
    setDiff(scenario.diff);
    setLanguage(scenario.language);
    setFramework(scenario.framework);
  };

  const handlePasteDiff = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setDiff(text);
        setActiveScenarioId('');
      }
    } catch {
      // Fallback if clipboard API unavailable
    }
  };

  const handleClearAll = () => {
    setCriteria('');
    setDiff('');
    setActiveScenarioId('');
  };

  return (
    <div className="glass-panel" style={{ padding: '1.35rem' }}>
      {/* Top Header & Scenario Chips */}
      <div className="controls-header">
        <div className="flex-row items-center gap-2">
          <Sparkles size={18} color="var(--primary)" />
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--foreground)' }}>
            Review Scope & Inputs
          </h2>
        </div>

        <div className="scenario-chips-wrapper">
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Golden Scenarios:
          </span>
          {PRESET_SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelectPreset(s)}
              className={`scenario-chip ${activeScenarioId === s.id ? 'active' : ''}`}
            >
              <span>{s.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dual Column Inputs */}
      <div className="grid-2" style={{ marginTop: '1rem' }}>
        {/* Acceptance Criteria Box */}
        <div>
          <div className="editor-label">
            <span className="flex-row items-center gap-1">
              <CheckSquare size={14} color="var(--primary)" />
              Acceptance Criteria (User Story / Jira Task)
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {criteria.split('\n').filter(Boolean).length} conditions
            </span>
          </div>
          <textarea
            value={criteria}
            onChange={(e) => {
              setCriteria(e.target.value);
              setActiveScenarioId('');
            }}
            rows={7}
            placeholder="Enter acceptance criteria or user story conditions (e.g. 1. Email format required...)"
            className="code-textarea"
          />
        </div>

        {/* Git Diff Box */}
        <div>
          <div className="editor-label">
            <span className="flex-row items-center gap-1">
              <FileCode size={14} color="var(--primary)" />
              Local Git Diff (Staged Changes / Working Tree)
            </span>
            <div className="flex-row items-center gap-2">
              <button
                type="button"
                onClick={handlePasteDiff}
                className="btn-ghost"
                title="Paste from clipboard"
              >
                <Clipboard size={12} />
                <span>Paste</span>
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="btn-ghost"
                title="Clear inputs"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            </div>
          </div>
          <textarea
            value={diff}
            onChange={(e) => {
              setDiff(e.target.value);
              setActiveScenarioId('');
            }}
            rows={7}
            placeholder="Paste unified git diff (or diff --git a/... b/...)..."
            className="code-textarea"
          />
        </div>
      </div>

      {/* Language, Framework & Action Bar */}
      <div
        className="flex-row items-center justify-between gap-3"
        style={{ marginTop: '1rem', flexWrap: 'wrap' }}
      >
        <div className="flex-row items-center gap-3" style={{ flexWrap: 'wrap' }}>
          <div className="flex-row items-center gap-2">
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Language:
            </span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="input-select"
            >
              <option value="java">Java</option>
              <option value="python">Python</option>
              <option value="typescript">TypeScript / JavaScript</option>
              <option value="go">Go</option>
            </select>
          </div>

          <div className="flex-row items-center gap-2">
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Framework:
            </span>
            <select
              value={framework}
              onChange={(e) => setFramework(e.target.value)}
              className="input-select"
            >
              <option value="spring-boot">Spring Boot</option>
              <option value="flask">Flask</option>
              <option value="react">React</option>
              <option value="fastapi">FastAPI</option>
              <option value="general">General / Standard</option>
            </select>
          </div>
        </div>

        {/* Run Button */}
        <button
          onClick={() => onRunReview(criteria, diff, language, framework)}
          disabled={isLoading || !diff.trim()}
          className="btn-prime bg-gradient-to-br from-primary to-[var(--hover-orange)] text-white border-white/15"
        >
          {isLoading ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              <span>Analyzing Quality Gates...</span>
            </>
          ) : (
            <>
              <Play size={16} fill="currentColor" />
              <span>RUN PRE-PUSH REVIEW</span>
            </>
          )}
        </button>
      </div>

      {/* Live Pipeline Stepper when Loading */}
      {isLoading && (
        <div className="progress-stepper">
          <div className="step-item active">
            <Terminal size={14} />
            <span>1. Parsing Unified AST</span>
          </div>
          <span style={{ color: 'var(--border-strong)' }}>→</span>
          <div className="step-item active">
            <Layers size={14} />
            <span>2. Deterministic Guardrails</span>
          </div>
          <span style={{ color: 'var(--border-strong)' }}>→</span>
          <div className="step-item active">
            <Sparkles size={14} />
            <span>3. RAG Knowledge Retrieval</span>
          </div>
          <span style={{ color: 'var(--border-strong)' }}>→</span>
          <div className="step-item active">
            <Play size={14} />
            <span>4. LLM Gatekeeper Verdict</span>
          </div>
        </div>
      )}
    </div>
  );
};
