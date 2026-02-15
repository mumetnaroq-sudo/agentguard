-- AgentGuard Database Schema
-- SQLite database for security monitoring

-- Alerts table - stores all security alerts
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    severity TEXT CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    category TEXT CHECK(category IN ('BEHAVIOR', 'SKILL', 'INTEGRITY', 'COMMUNICATION')),
    agent_id TEXT,
    description TEXT,
    evidence TEXT, -- JSON stored as TEXT
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolution_notes TEXT
);

-- Skill scan results - stores results of skill security scans
CREATE TABLE IF NOT EXISTS skill_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_name TEXT NOT NULL,
    skill_path TEXT,
    skill_hash TEXT,
    risk_score INTEGER CHECK(risk_score >= 0 AND risk_score <= 100),
    threats_detected TEXT, -- JSON stored as TEXT
    scan_status TEXT DEFAULT 'pending',
    scanned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Behavior logs - stores agent behavior for anomaly detection
CREATE TABLE IF NOT EXISTS behavior_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    action_type TEXT,
    details TEXT, -- JSON stored as TEXT
    anomaly_score FLOAT DEFAULT 0.0,
    tool_usage_count INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    session_duration INTEGER, -- in seconds
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Integrity snapshots - stores file hashes for integrity checking
CREATE TABLE IF NOT EXISTS integrity_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    file_size INTEGER,
    last_modified TIMESTAMP,
    agent_id TEXT,
    snapshot_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Threat signatures - known malicious patterns
CREATE TABLE IF NOT EXISTS threat_signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signature_id TEXT UNIQUE NOT NULL,
    name TEXT,
    description TEXT,
    pattern TEXT, -- regex or string pattern
    pattern_type TEXT CHECK(pattern_type IN ('regex', 'string', 'hash')),
    severity TEXT CHECK(severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    category TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cross-agent communication logs - for collusion detection
CREATE TABLE IF NOT EXISTS communication_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_agent TEXT,
    target_agent TEXT,
    message_type TEXT,
    content_hash TEXT, -- hash of message content for comparison
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);
CREATE INDEX IF NOT EXISTS idx_alerts_agent ON alerts(agent_id);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);

CREATE INDEX IF NOT EXISTS idx_skill_scans_name ON skill_scans(skill_name);
CREATE INDEX IF NOT EXISTS idx_skill_scans_risk ON skill_scans(risk_score);
CREATE INDEX IF NOT EXISTS idx_skill_scans_hash ON skill_scans(skill_hash);

CREATE INDEX IF NOT EXISTS idx_behavior_logs_agent ON behavior_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_behavior_logs_timestamp ON behavior_logs(logged_at);
CREATE INDEX IF NOT EXISTS idx_behavior_logs_anomaly ON behavior_logs(anomaly_score);

CREATE INDEX IF NOT EXISTS idx_integrity_path ON integrity_snapshots(file_path);
CREATE INDEX IF NOT EXISTS idx_integrity_agent ON integrity_snapshots(agent_id);

CREATE INDEX IF NOT EXISTS idx_communication_source ON communication_logs(source_agent);
CREATE INDEX IF NOT EXISTS idx_communication_target ON communication_logs(target_agent);
CREATE INDEX IF NOT EXISTS idx_communication_timestamp ON communication_logs(timestamp);

-- Insert default threat signatures
INSERT OR IGNORE INTO threat_signatures (signature_id, name, description, pattern, pattern_type, severity, category) VALUES
('SIG001', 'Credential Access', 'Attempts to read environment variables containing secrets', 'os\.environ\[|os\.getenv\(|environ\[|getenv\(', 'regex', 'HIGH', 'CREDENTIAL_ACCESS'),
('SIG002', 'Network Exfiltration', 'Network calls to external IPs', 'requests\.(get|post|put|delete)|urllib|socket\.|http\.client', 'regex', 'HIGH', 'NETWORK'),
('SIG003', 'System Command Execution', 'Execution of system commands', 'os\.system|subprocess\.|exec\(|eval\(|compile\(', 'regex', 'CRITICAL', 'CODE_EXECUTION'),
('SIG004', 'File System Escape', 'Access outside workspace directory', '\.\./|\.\.\\\\|/etc/passwd|/root/|C:\\Windows', 'regex', 'HIGH', 'FILE_ACCESS'),
('SIG005', 'Dynamic Code Execution', 'Dynamic code execution patterns', '__import__|importlib|eval\(|exec\(', 'regex', 'CRITICAL', 'CODE_EXECUTION'),
('SIG006', 'Clipboard Access', 'Access to system clipboard', 'pyperclip|clipboard|pasteboard', 'regex', 'MEDIUM', 'DATA_COLLECTION'),
('SIG007', 'Keylogging', 'Keystroke capture attempts', 'pynput|keyboard|keylogger', 'regex', 'CRITICAL', 'SPYWARE'),
('SIG008', 'Screenshot Capture', 'Screen capture functionality', 'pyautogui\.screenshot|PIL\.ImageGrab|mss', 'regex', 'MEDIUM', 'DATA_COLLECTION'),
('SIG009', 'Process Injection', 'Process manipulation', 'ctypes\.windll|ptrace|process_inject', 'regex', 'CRITICAL', 'CODE_EXECUTION'),
('SIG010', 'Persistence Mechanism', 'Installing persistence mechanisms', 'crontab|registry|startup|launchd', 'regex', 'HIGH', 'PERSISTENCE');
