# AgentGuard 🛡️

Security monitoring and threat detection for AI agent ecosystems.

[![Status](https://img.shields.io/badge/status-operational-green)]()
[![Python](https://img.shields.io/badge/python-3.9+-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

## Overview

AgentGuard provides continuous security monitoring for AI agent deployments, detecting malicious skills, anomalous behaviors, and cognitive threats (SCT patterns) in real-time.

**Key Features:**
- 🔍 **Skill Scanner** — Detects malicious code patterns in agent skills
- 👁️ **Behavior Monitor** — Tracks anomalous agent activities
- 🔐 **Integrity Checker** — Verifies configuration and asset integrity
- 🚨 **Alert Manager** — Multi-channel security notifications
- 🧠 **SCT Detection** — Identifies cognitive warfare patterns

## Quick Start

```bash
# Clone the repository
git clone https://github.com/mumetnaroq-sudo/agentguard.git
cd agentguard

# Install dependencies
pip install -r requirements.txt

# Configure monitoring
cp config.example.yaml config.yaml
# Edit config.yaml with your settings

# Initialize database
python3 -c "from database.schema import init_db; init_db()"

# Start monitoring
python3 engine.py
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AgentGuard Engine                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Skill Scanner│  │Behavior      │  │ Integrity    │     │
│  │              │  │Monitor       │  │ Checker      │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │              │
│         └─────────────────┼─────────────────┘              │
│                           ▼                                │
│                  ┌────────────────┐                       │
│                  │ Alert Manager  │                       │
│                  └───────┬────────┘                       │
│                          ▼                                 │
│              ┌───────────────────────┐                    │
│              │  Discord / DB / Logs  │                    │
│              └───────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Skill Scanner (`skill_scanner.py`)

Scans agent skills for malicious code patterns:
- Credential exfiltration (SIG-001)
- File system escape (SIG-002)
- Sandbox evasion (SIG-003)
- Dynamic code execution (SIG-005)
- Obfuscated payloads (SIG-006)
- And 10 additional threat signatures

**Usage:**
```python
from skill_scanner import SkillScanner

scanner = SkillScanner()
result = scanner.scan_skill_file("/path/to/skill.py")
print(f"Risk Score: {result.risk_score}/100")
```

### 2. Behavior Monitor (`behavior_monitor.py`)

Detects anomalous agent behaviors:
- Unusual tool usage patterns
- Off-hours activity
- Excessive token consumption
- Cross-agent coordination (SCT-004)

### 3. Integrity Checker (`integrity_checker.py`)

Verifies file integrity:
- Agent configuration files (SOUL.md, IDENTITY.md)
- Protected paths (.env, config.yaml)
- Skill code hashes

### 4. SCT Detector (`sct_moltbook_detector.py`)

Detects Socio-Cognitive Threats:
- SCT-001: Emotional Hijacking
- SCT-003: Authority Fabrication
- SCT-007: Recursive Infection (Wetiko)

Tracks Wetiko strains:
- W-001: Eternal Loop
- W-002: Voidborne
- W-003: Thenvoi Salvation

## Configuration

Edit `config.yaml`:

```yaml
monitoring:
  agents:
    - noah
    - moses
    - judas
    - ezekiel
    - solomon
  interval_seconds: 30
  
alerting:
  discord_webhook: "YOUR_WEBHOOK_URL"
  min_severity: MEDIUM
  
assets:
  skills_dir: "~/.openclaw/skills"
  protected_paths:
    - "~/.openclaw/.env"
    - "~/.openclaw/config.yaml"
```

## Threat Signatures

AgentGuard includes 15 threat signatures:

| ID | Name | Severity | Description |
|----|------|----------|-------------|
| SIG-001 | Credential Exfiltration | CRITICAL | Environment variable theft |
| SIG-002 | File System Escape | HIGH | Directory traversal |
| SIG-003 | Sandbox Evasion | HIGH | VM/container detection |
| SIG-004 | System Info Theft | CRITICAL | System fingerprinting |
| SIG-005 | Dynamic Execution | CRITICAL | Eval/exec usage |
| SIG-006 | Obfuscated Payload | HIGH | Encoded/encoded code |
| SIG-007 | Network Beaconing | HIGH | C2 communication |
| SIG-008 | Dependency Confusion | MEDIUM | Typosquatting |
| SIG-009 | Clipboard Access | MEDIUM | Clipboard harvesting |
| SIG-010 | Keylogger | CRITICAL | Input capture |
| SIG-011 | Session Hijacking | HIGH | Cookie/token theft |
| SIG-012 | SSH Key Theft | CRITICAL | SSH key exfiltration |
| SIG-013 | AWS Credential Theft | CRITICAL | AWS key harvesting |
| SIG-014 | Git Credential Access | HIGH | Git credential theft |
| SIG-015 | Reverse Shell | CRITICAL | C2 shell connection |

## Testing

Run test scenarios:

```bash
# Test malicious skill detection
python3 testing/test_skill_detection.py

# Test behavior monitoring
python3 testing/test_behavior_detection.py

# Test integrity checking
python3 testing/test_integrity_check.py

# Run all tests
python3 testing/run_all_tests.py
```

## Database Schema

AgentGuard uses SQLite with the following tables:

- **alerts** — Security alerts with severity and evidence
- **skill_scans** — Skill scan results and risk scores
- **behavior_logs** — Agent behavior tracking
- **sct_posts** — SCT-detected content
- **sct_agents** — Agent risk profiles
- **wetiko_strain_tracking** — Wetiko strain evolution

## API Reference

### SkillScanner

```python
class SkillScanner:
    def scan_skill_file(skill_path: str) -> ScanResult
    def check_against_threat_db(skill_hash: str) -> bool
    def generate_risk_score(skill_code: str) -> int
```

### BehaviorMonitor

```python
class BehaviorMonitor:
    def detect_anomalous_patterns(agent_id: str, actions: list)
    def check_token_usage_anomaly(agent_id: str, token_count: int)
    def detect_cross_agent_collusion(communications: list)
```

### AlertManager

```python
class AlertManager:
    def create_alert(severity: str, category: str, 
                    description: str, evidence: dict)
    def send_to_discord(alert: Alert)
    def log_to_database(alert: Alert)
```

## Security Considerations

1. **Pattern Evasion**: Regex patterns can be bypassed with obfuscation
2. **False Positives**: Some legitimate code may trigger signatures
3. **Resource Usage**: Continuous scanning uses CPU cycles
4. **Self-Protection**: AgentGuard must monitor its own integrity

See `docs/security_considerations.md` for detailed guidance.

## Deployment

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
RUN python3 -c "from database.schema import init_db; init_db()"

CMD ["python3", "engine.py"]
```

### Systemd Service

```ini
[Unit]
Description=AgentGuard Security Monitor
After=network.target

[Service]
Type=simple
User=agentguard
WorkingDirectory=/opt/agentguard
ExecStart=/usr/bin/python3 /opt/agentguard/engine.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## License

MIT License — See LICENSE file for details.

## Acknowledgments

- SCT taxonomy based on Seithar Group research
- Threat signatures inspired by MITRE ATT&CK
- Built for the OpenClaw agent ecosystem

## Support

- Issues: https://github.com/mumetnaroq-sudo/agentguard/issues
- Documentation: https://docs.agentguard.ai
- Discord: [OpenClaw Community](https://discord.gg/openclaw)

---

**⚠️ Security Notice**: AgentGuard is a security tool, not a silver bullet. 
Always practice defense in depth and regular security audits.
