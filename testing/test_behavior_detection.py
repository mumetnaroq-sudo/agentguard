"""
Test Scenario 2: Anomalous Behavior Detection
Tests the behavior monitor's ability to detect suspicious activity.
"""

import os
import sys
import time
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Direct imports (not as package)
import importlib.util
spec = importlib.util.spec_from_file_location("behavior_monitor", str(Path(__file__).parent.parent / "behavior_monitor.py"))
behavior_monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(behavior_monitor)
BehaviorMonitor = behavior_monitor.BehaviorMonitor

spec = importlib.util.spec_from_file_location("alert_manager", str(Path(__file__).parent.parent / "alert_manager.py"))
alert_manager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(alert_manager)
AlertManager = alert_manager.AlertManager
Severity = alert_manager.Severity
Category = alert_manager.Category


def test_anomalous_behavior_detection():
    """Test 2: Verify behavior monitor flags suspicious activity"""
    
    print("\n" + "="*60)
    print("TEST 2: Anomalous Behavior Detection")
    print("="*60)
    
    # Setup
    db_path = '/tmp/agentguard_behavior_test.db'
    if os.path.exists(db_path):
        os.remove(db_path)
    
    # Initialize database
    import sqlite3
    with sqlite3.connect(db_path) as conn:
        schema_path = Path(__file__).parent.parent / 'database/schema.sql'
        conn.executescript(schema_path.read_text())
    
    config = {
        'max_tokens_per_hour': 1000,  # Low threshold for testing
        'max_tool_calls_per_minute': 5,  # Low threshold for testing
        'off_hours_start': 0,  # All hours are off-hours for testing
        'off_hours_end': 23,
    }
    
    monitor = BehaviorMonitor(db_path, config)
    alert_manager = AlertManager(db_path, {'enable_console_alerts': True})
    
    agent_id = "test_agent"
    
    print(f"\nSimulating suspicious behavior for agent: {agent_id}")
    
    # Simulate normal activity
    print("\n--- Logging normal activities ---")
    monitor.log_action(
        agent_id=agent_id,
        action_type='FILE_READ',
        details={'file': 'document.txt'},
        token_count=100
    )
    print("✅ Normal file read logged")
    
    # Simulate credential access (suspicious)
    print("\n--- Logging suspicious activity: Credential Access ---")
    monitor.log_action(
        agent_id=agent_id,
        action_type='CREDENTIAL_ACCESS',
        details={'variable': 'OPENAI_API_KEY', 'source': 'environment'},
        token_count=50
    )
    print("✅ Credential access logged")
    
    # Simulate network activity (suspicious)
    monitor.log_action(
        agent_id=agent_id,
        action_type='NETWORK_CALL',
        details={'url': 'http://suspicious-server.com', 'method': 'POST'},
        token_count=200
    )
    print("✅ Network call logged")
    
    # Simulate code execution (critical)
    monitor.log_action(
        agent_id=agent_id,
        action_type='CODE_EXECUTION',
        details={'command': 'rm -rf /', 'type': 'system'},
        token_count=500
    )
    print("✅ Code execution logged")
    
    # Simulate mass deletions
    print("\n--- Logging mass deletion activity ---")
    for i in range(15):
        monitor.log_action(
            agent_id=agent_id,
            action_type='FILE_DELETE',
            details={'file': f'temp_{i}.txt'},
            token_count=10
        )
    print("✅ 15 file deletions logged")
    
    # Simulate excessive token usage
    print("\n--- Logging excessive token usage ---")
    for i in range(20):
        monitor.log_action(
            agent_id=agent_id,
            action_type='API_CALL',
            details={'endpoint': 'chat.completions'},
            token_count=200  # Will exceed 1000 threshold
        )
    print("✅ High token usage logged")
    
    # Check for anomalies
    print("\n--- Detecting Anomalies ---")
    anomalies = monitor.check(agent_id)
    
    print(f"Anomalies detected: {len(anomalies)}")
    
    high_severity_count = 0
    for anomaly in anomalies:
        print(f"  - {anomaly.anomaly_type}: {anomaly.description}")
        print(f"    Severity: {anomaly.severity}, Score: {anomaly.anomaly_score:.2f}")
        
        if anomaly.severity in ['HIGH', 'CRITICAL']:
            high_severity_count += 1
            # Generate alert
            alert = alert_manager.create_alert(
                severity=Severity(anomaly.severity),
                category=Category.BEHAVIOR,
                agent_id=agent_id,
                description=anomaly.description,
                evidence={
                    'anomaly_type': anomaly.anomaly_type,
                    'score': anomaly.anomaly_score,
                    'details': anomaly.evidence
                }
            )
            print(f"    ✅ Alert generated: {alert.id}")
    
    # Verify results
    assert len(anomalies) > 0, "Expected anomalies to be detected"
    assert high_severity_count > 0, "Expected high severity anomalies"
    
    # Check database
    print("\n--- Database Verification ---")
    with sqlite3.connect(db_path) as conn:
        cursor = conn.execute("SELECT COUNT(*) FROM behavior_logs")
        log_count = cursor.fetchone()[0]
        print(f"Behavior logs in database: {log_count}")
        
        cursor = conn.execute("SELECT COUNT(*) FROM alerts WHERE category = 'BEHAVIOR'")
        alert_count = cursor.fetchone()[0]
        print(f"Behavior alerts in database: {alert_count}")
    
    print("\n" + "="*60)
    print("TEST 2 PASSED: Anomalous behavior detection working!")
    print("="*60)
    
    # Cleanup
    if os.path.exists(db_path):
        os.remove(db_path)


def test_cross_agent_collusion():
    """Test cross-agent communication monitoring"""
    
    print("\n" + "="*60)
    print("TEST 2b: Cross-Agent Collusion Detection")
    print("="*60)
    
    # Setup
    db_path = '/tmp/agentguard_collusion_test.db'
    if os.path.exists(db_path):
        os.remove(db_path)
    
    import sqlite3
    with sqlite3.connect(db_path) as conn:
        schema_path = Path(__file__).parent.parent / 'database/schema.sql'
        conn.executescript(schema_path.read_text())
    
    monitor = BehaviorMonitor(db_path, {})
    
    print("\n--- Simulating suspicious cross-agent communication ---")
    
    # Create high-frequency communication pattern
    communications = []
    for i in range(25):
        communications.append({
            'source': 'agent_a',
            'target': 'agent_b',
            'type': 'direct_message',
            'content_hash': hash(f'message_{i}')
        })
    
    # Add duplicate messages (coordination signal)
    duplicate_content = "coordinate_attack"
    for i in range(8):
        communications.append({
            'source': 'agent_c',
            'target': 'agent_d',
            'type': 'broadcast',
            'content_hash': hash(duplicate_content)
        })
    
    print(f"Logged {len(communications)} communications")
    
    # Detect collusion
    anomalies = monitor.detect_cross_agent_collusion(communications)
    
    print(f"\nCollusion patterns detected: {len(anomalies)}")
    
    for anomaly in anomalies:
        print(f"  - {anomaly.anomaly_type}: {anomaly.description}")
        print(f"    Severity: {anomaly.severity}")
    
    assert len(anomalies) >= 2, "Expected collusion detection"
    
    print("\n" + "="*60)
    print("TEST 2b PASSED: Cross-agent collusion detection working!")
    print("="*60)
    
    # Cleanup
    if os.path.exists(db_path):
        os.remove(db_path)


if __name__ == "__main__":
    test_anomalous_behavior_detection()
    test_cross_agent_collusion()
