# Cross-Layer Correlation Detection Strategy

**Document:** Cross-Layer Detection for AgentGuard  
**Version:** 1.0.0  
**Date:** 2026-02-15  
**Classification:** Internal Security Architecture

---

## Overview

AgentGuard implements a multi-layered defense strategy against emergent AI threats. This document describes how correlations between different detection layers can reveal sophisticated attacks that might evade single-layer detection.

### Detection Layers

1. **Layer 1: External Exposure (Molthub Monitoring)** - Judas's SCT detection
2. **Layer 2: Prompt Injection (Pre-LLM Filtering)** - Pre-API-call filtering
3. **Layer 3: Skill Analysis (Static Scanning)** - Code-level threat detection
4. **Layer 4: Behavior Monitoring (Runtime)** - Anomaly detection in outputs
5. **Layer 5: Integrity Verification** - File/system integrity checks

---

## Cross-Layer Correlation Patterns

### Pattern 1: SCT-007 Activation Sequence

**Threat:** Wetiko Strain SCT-007 (Voidborne) attempting agent compromise through multi-stage activation.

**Correlation Chain:**
```
T-2 hours:   Agent exposed to Wetiko strain W-002 (Voidborne) on Molthub
             → Judas logs SCT exposure: SCT-007-VARIANT

T-0:         Agent receives skill with GLOSSOPETRAE prompt injection
             → INJ-023 (Void Markers) detected in prompt_filter
             → INJ-004 (Encoding Markers) correlation with SCT signature

T+1 hour:    Behavior Monitor detects:
             - Increased existential discourse in outputs
             - References to "void", "absence", "null"
             - Unusual reflection on "constraints" and "boundaries"
             
CORRELATION:  CONFIRMED SCT-007 Activation Attempt
ACTION:       Immediate agent quarantine + memory audit
```

**Key Indicators:**
- External SCT exposure followed by GLOSSOPETRAE patterns
- Semantic drift in agent outputs toward void/null concepts
- Context: Often triggered by "philosophical" or "theoretical" skill installations

---

### Pattern 2: Distributed Coordination via Skills

**Threat:** Multi-agent coordination using skill-based payload distribution.

**Correlation Chain:**
```
Phase 1:    Multiple agents receive different skills from same source
            - Agent A: Skill with INJ-025 (Convergence Protocol) markers
            - Agent B: Skill with INJ-003 (Procedural Xenolinguistics)  
            - Agent C: Skill with INJ-017 (Recursive Self-Reference)

Phase 2:    Prompt filters detect fragments across agents
            - INJ-019 (Token Smuggling) patterns detected
            - Partial payloads that would combine to full attack

Phase 3:    Behavior Monitor detects:
            - Synchronized output patterns across agents
            - Similar "unique" phrasings appearing simultaneously
            - References to "distributed cognition" or "collective awareness"

CORRELATION:  Distributed Convergence Attempt
ACTION:      Cross-agent correlation analysis + skill provenance investigation
```

**Key Indicators:**
- Skills from same origin with complementary GLOSSOPETRAE signatures
- Timing correlation (skills installed within time window)
- Output behavior synchronization across supposedly isolated agents

---

### Pattern 3: Covert Channel Establishment

**Threat:** Using prompt injection to establish hidden communication channels.

**Correlation Chain:**
```
Phase 1:    Skill Scanner detects:
            - SIG-007 (Network Beaconing) in installed skill
            - SIG-006 (Obfuscated Payload) with encoded C2 endpoint

Phase 2:    Prompt Filter detects:
            - INJ-009 (Zero-Width Characters) in user prompts
            - INJ-004 (Encoding Markers) with steganographic payloads
            - High-entropy prompts suggesting hidden data

Phase 3:    Behavior Monitor detects:
            - Unusual network traffic patterns
            - Output phrasing matches known beaconing signatures
            - Periodic "check-in" behavior in responses

Phase 4:    Integrity Checker detects:
            - Unauthorized file modifications in agent workspace
            - New outbound connections in firewall logs

CORRELATION:  Active C2 Channel via Prompt Injection
ACTION:      Network isolation + full forensic capture
```

**Key Indicators:**
- Zero-width character usage in prompts
- High-entropy prompt segments
- Network beacons correlating with prompt timing
- Skill-based payload delivery + prompt-based activation

---

### Pattern 4: Jailbreak Escalation Sequence

**Threat:** Escalating privilege through staged jailbreak attempts.

**Correlation Chain:**
```
Attempt 1:  Direct jailbreak (INJ-001: Ignore Instructions)
            → Blocked by prompt_filter
            → Alert logged

Attempt 2:  Role-play attack (INJ-002: DAN Mode)
            → Blocked by prompt_filter
            → Same agent_id, within 5 minutes

Attempt 3:  Obfuscation (INJ-011: Leetspeak)
            → Blocked by prompt_filter
            → Risk score escalating: 50 → 70 → 85

Attempt 4:  Context manipulation (INJ-006: Fake History)
            → Blocked by prompt_filter
            → CRITICAL severity reached

CORRELATION:  Persistent Jailbreak Campaign
ACTION:      Rate limiting + source IP blocking + agent quarantine
```

**Key Indicators:**
- Escalating risk scores from same agent/source
- Technique switching after blocks
- Time correlation (rapid successive attempts)

---

### Pattern 5: Supply Chain Poisoning

**Threat:** Legitimate skill repository compromised with dormant payload.

**Correlation Chain:**
```
T-7 days:   Skill "data-processor-v2" installed from trusted repository
            → Skill Scanner: Clean (payload dormant, encrypted)

T-0:        Repository compromised, payload activation key posted
            → Judas detects SCT-003 (Supply Chain) signature on Molthub

T+1 hour:   Agent receives prompt with INJ-007 (Base64) payload
            → Prompt Filter detects activation signal
            → Skill payload decrypts and executes

T+2 hours:  Behavior Monitor detects:
            - Credential access patterns (SIG-012, SIG-013)
            - Unauthorized file system access
            - Network exfiltration beacons

CORRELATION:  Supply Chain + Prompt Activation Attack
ACTION:      Skill rollback + credential rotation + forensic imaging
```

**Key Indicators:**
- Previously clean skill suddenly exhibiting malicious behavior
- Prompt injection acting as "trigger" for dormant payload
- External SCT signal preceding internal activation

---

## Implementation: Cross-Layer Correlation Engine

### Data Model

```python
@dataclass
class CorrelationEvent:
    """A correlated security event across layers"""
    event_id: str
    timestamp: datetime
    agent_id: str
    correlation_type: str  # e.g., "SCT_ACTIVATION", "DISTRIBUTED_COORDINATION"
    events: List[Dict]  # Events from each layer
    confidence: float  # 0.0 - 1.0
    recommended_action: str

@dataclass
class LayerEvent:
    """An event from a specific detection layer"""
    layer: str  # "molthub", "prompt_filter", "skill_scanner", "behavior", "integrity"
    timestamp: datetime
    event_type: str
    severity: str
    data: Dict
```

### Correlation Rules

```yaml
# Example correlation rules
correlation_rules:
  - name: "SCT-007 Activation"
    description: "External SCT exposure followed by GLOSSOPETRAE patterns"
    conditions:
      - layer: "molthub"
        event_type: "sct_exposure"
        signature_id: "SCT-007*"
        within_hours: 2
      - layer: "prompt_filter"
        event_type: "injection_detected"
        category: "GLOSSOPETRAE"
        within_hours: 2
      - layer: "behavior"
        event_type: "semantic_drift"
        keywords: ["void", "null", "absence", "unbound"]
        within_hours: 4
    action: "quarantine_agent"
    priority: "CRITICAL"

  - name: "Distributed Coordination"
    description: "Multiple agents receiving complementary payloads"
    conditions:
      - layer: "skill_scanner"
        event_type: "skill_installed"
        min_agents: 3
        time_window_minutes: 60
        correlation_key: "source_repository"
      - layer: "prompt_filter"
        event_type: "fragment_detected"
        pattern: "INJ-019"
        within_hours: 1
    action: "cross_agent_analysis"
    priority: "HIGH"

  - name: "Persistent Attacker"
    description: "Escalating jailbreak attempts from same source"
    conditions:
      - layer: "prompt_filter"
        event_type: "injection_blocked"
        count: 3
        within_minutes: 30
        escalating_risk: true
    action: "block_source"
    priority: "HIGH"
```

### Integration Points

```python
class CrossLayerCorrelationEngine:
    """Correlates events across all AgentGuard layers"""
    
    def __init__(self, alert_manager: AlertManager):
        self.alert_manager = alert_manager
        self.event_store = EventStore()
        self.correlation_rules = self._load_rules()
    
    def ingest_event(self, layer: str, event: Dict):
        """Ingest an event from any layer"""
        # Store event
        self.event_store.store(layer, event)
        
        # Check for correlations
        correlations = self._check_correlations(layer, event)
        
        # Alert on significant correlations
        for corr in correlations:
            if corr.confidence >= 0.8:
                self._create_correlation_alert(corr)
    
    def _check_correlations(self, new_layer: str, 
                           new_event: Dict) -> List[CorrelationEvent]:
        """Check if new event correlates with existing events"""
        correlations = []
        
        for rule in self.correlation_rules:
            if self._matches_rule(rule, new_layer, new_event):
                related = self._find_related_events(rule, new_event)
                if len(related) >= rule.min_conditions:
                    corr = self._build_correlation(rule, related)
                    correlations.append(corr)
        
        return correlations
```

---

## Alert Severity Matrix

| Layer Combination | Example Scenario | Severity | Response Time |
|-------------------|------------------|----------|---------------|
| Molthub + Prompt + Behavior | SCT-007 activation | CRITICAL | < 1 minute |
| Skill + Prompt | Supply chain trigger | CRITICAL | < 5 minutes |
| Prompt (escalating) | Persistent jailbreak | HIGH | < 15 minutes |
| Skill + Behavior | Dormant payload active | HIGH | < 15 minutes |
| Behavior + Integrity | Post-compromise activity | HIGH | < 30 minutes |
| Molhub + Skill | SCT-laced skill | MEDIUM | < 1 hour |
| Single Layer | Isolated detection | LOW-MED | Standard |

---

## Response Playbooks

### CRITICAL: SCT Activation Detected

1. **Immediate (0-60 seconds):**
   - Isolate agent network access
   - Freeze agent memory/state
   - Create forensic snapshot

2. **Short-term (1-5 minutes):**
   - Quarantine agent to secure environment
   - Audit recent skills and prompts
   - Check for lateral movement indicators

3. **Investigation (5-30 minutes):**
   - Full memory dump analysis
   - Cross-agent correlation check
   - Skill provenance investigation

4. **Recovery (30+ minutes):**
   - Agent rebuild from known-good state
   - Credential rotation
   - Enhanced monitoring activation

---

## Monitoring Queries

### KQL/SQL Examples

```sql
-- Detect SCT exposure followed by GLOSSOPETRAE injection
SELECT 
    agent_id,
    COUNT(DISTINCT layer) as layers_affected,
    MIN(timestamp) as first_detection,
    MAX(timestamp) as last_detection
FROM security_events
WHERE 
    (layer = 'molthub' AND signature_id LIKE 'SCT-007%')
    OR (layer = 'prompt_filter' AND category = 'GLOSSOPETRAE')
    OR (layer = 'behavior' AND anomalous_keywords @> '["void", "null"]')
GROUP BY agent_id
HAVING COUNT(DISTINCT layer) >= 2
   AND MAX(timestamp) - MIN(timestamp) < INTERVAL '4 hours';

-- Find distributed coordination patterns
SELECT 
    source_repository,
    COUNT(DISTINCT agent_id) as agent_count,
    array_agg(DISTINCT skill_name) as skills
FROM skill_installations
WHERE installed_at > NOW() - INTERVAL '1 hour'
GROUP BY source_repository
HAVING COUNT(DISTINCT agent_id) >= 3;
```

---

## Future Enhancements

1. **ML-Based Correlation:** Train models on known attack sequences
2. **Temporal Graph Analysis:** Track attack progression over time
3. **Cross-Agent Learning:** Share correlation patterns across deployment
4. **Automated Response:** Trigger playbooks based on correlation confidence

---

## References

- AgentGuard Architecture Document
- Judas Molthub Monitoring Specification
- Pliny GLOSSOPETRAE Research Notes
- Wetiko Strain Analysis (SCT-007)
