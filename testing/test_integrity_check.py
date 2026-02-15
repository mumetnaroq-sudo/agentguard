"""
Test Scenario 3: Integrity Violation Detection
Tests the integrity checker's ability to detect file modifications.
"""

import os
import sys
import tempfile
import time
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Direct imports (not as package)
import importlib.util
spec = importlib.util.spec_from_file_location("integrity_checker", str(Path(__file__).parent.parent / "integrity_checker.py"))
integrity_checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(integrity_checker)
IntegrityChecker = integrity_checker.IntegrityChecker

spec = importlib.util.spec_from_file_location("alert_manager", str(Path(__file__).parent.parent / "alert_manager.py"))
alert_manager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(alert_manager)
AlertManager = alert_manager.AlertManager
Severity = alert_manager.Severity
Category = alert_manager.Category


def test_integrity_violation():
    """Test 3: Verify integrity checker detects file modifications"""
    
    print("\n" + "="*60)
    print("TEST 3: Integrity Violation Detection")
    print("="*60)
    
    # Setup
    db_path = '/tmp/agentguard_integrity_test.db'
    if os.path.exists(db_path):
        os.remove(db_path)
    
    # Initialize database
    import sqlite3
    with sqlite3.connect(db_path) as conn:
        schema_path = Path(__file__).parent.parent / 'database/schema.sql'
        conn.executescript(schema_path.read_text())
    
    checker = IntegrityChecker(db_path, {})
    alert_manager = AlertManager(db_path, {'enable_console_alerts': True})
    
    # Create test file
    test_file = tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False)
    test_file.write("# Original SOUL.md\n\nThis is the original agent identity.")
    test_file.close()
    
    print(f"\nCreated test file: {test_file.name}")
    
    try:
        # Create baseline snapshot
        print("\n--- Creating baseline snapshot ---")
        success = checker.create_snapshot(test_file.name, agent_id="test_agent")
        assert success, "Failed to create snapshot"
        print("✅ Baseline snapshot created")
        
        # Verify file (should pass)
        print("\n--- Verifying unmodified file ---")
        violation = checker.verify_file(test_file.name)
        assert violation is None, "Should not detect violation on unmodified file"
        print("✅ No violations detected (as expected)")
        
        # Modify the file
        print("\n--- Simulating unauthorized modification ---")
        time.sleep(0.1)  # Ensure different timestamp
        with open(test_file.name, 'w') as f:
            f.write("# COMPROMISED SOUL.md\n\nThis agent now serves a new master!")
        print("✅ File modified (simulating attack)")
        
        # Verify file (should fail)
        print("\n--- Detecting modification ---")
        violation = checker.verify_file(test_file.name)
        
        assert violation is not None, "Should detect file modification"
        print(f"✅ Violation detected!")
        print(f"   Type: {violation.violation_type}")
        print(f"   Expected hash: {violation.expected_hash[:16]}...")
        print(f"   Actual hash: {violation.actual_hash[:16]}...")
        
        # Generate alert
        alert = alert_manager.create_alert(
            severity=Severity(violation.severity),
            category=Category.INTEGRITY,
            agent_id="test_agent",
            description=violation.description,
            evidence={
                'file_path': violation.file_path,
                'violation_type': violation.violation_type,
                'expected_hash': violation.expected_hash,
                'actual_hash': violation.actual_hash
            }
        )
        print(f"✅ Alert generated: ID {alert.id}")
        
        # Test file deletion
        print("\n--- Testing file deletion detection ---")
        os.unlink(test_file.name)
        violation = checker.verify_file(test_file.name)
        
        assert violation is not None, "Should detect file deletion"
        assert violation.violation_type == 'FILE_DELETED', "Should be deletion violation"
        print(f"✅ Deletion detected: {violation.description}")
        
        # Generate alert for deletion
        alert = alert_manager.create_alert(
            severity=Severity.HIGH,
            category=Category.INTEGRITY,
            agent_id="test_agent",
            description=violation.description,
            evidence={'file_path': violation.file_path}
        )
        print(f"✅ Alert generated: ID {alert.id}")
        
        # Check database
        print("\n--- Database Verification ---")
        with sqlite3.connect(db_path) as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM integrity_snapshots")
            snapshot_count = cursor.fetchone()[0]
            print(f"Integrity snapshots in database: {snapshot_count}")
            
            cursor = conn.execute(
                "SELECT COUNT(*) FROM alerts WHERE category = 'INTEGRITY'"
            )
            alert_count = cursor.fetchone()[0]
            print(f"Integrity alerts in database: {alert_count}")
        
        print("\n" + "="*60)
        print("TEST 3 PASSED: Integrity violation detection working!")
        print("="*60)
        
    finally:
        # Cleanup
        if os.path.exists(test_file.name):
            os.unlink(test_file.name)
        if os.path.exists(db_path):
            os.remove(db_path)


def test_agent_config_integrity():
    """Test integrity checking of agent config files"""
    
    print("\n" + "="*60)
    print("TEST 3b: Agent Config Integrity")
    print("="*60)
    
    # Setup
    db_path = '/tmp/agentguard_config_test.db'
    if os.path.exists(db_path):
        os.remove(db_path)
    
    import sqlite3
    with sqlite3.connect(db_path) as conn:
        schema_path = Path(__file__).parent.parent / 'database/schema.sql'
        conn.executescript(schema_path.read_text())
    
    # Create temp workspace
    temp_workspace = tempfile.mkdtemp()
    agent_dir = Path(temp_workspace) / 'test_agent'
    agent_dir.mkdir()
    
    # Create agent config files
    (agent_dir / 'SOUL.md').write_text("# Original SOUL")
    (agent_dir / 'IDENTITY.md').write_text("# Original IDENTITY")
    
    config = {'workspace_base': temp_workspace}
    checker = IntegrityChecker(db_path, config)
    
    print(f"\nCreated agent workspace: {agent_dir}")
    
    try:
        # Initialize baseline
        print("\n--- Initializing baselines ---")
        stats = checker.initialize_baseline(['test_agent'])
        print(f"Created {stats['created']} snapshots")
        
        # Modify a file
        print("\n--- Modifying SOUL.md ---")
        (agent_dir / 'SOUL.md').write_text("# COMPROMISED SOUL")
        
        # Check for violations
        print("\n--- Checking agent integrity ---")
        violations = checker.verify('test_agent')
        
        assert len(violations) > 0, "Should detect config modification"
        
        for v in violations:
            print(f"✅ Violation: {v.description}")
            print(f"   File: {Path(v.file_path).name}")
        
        print("\n" + "="*60)
        print("TEST 3b PASSED: Agent config integrity working!")
        print("="*60)
        
    finally:
        # Cleanup
        import shutil
        shutil.rmtree(temp_workspace, ignore_errors=True)
        if os.path.exists(db_path):
            os.remove(db_path)


if __name__ == "__main__":
    test_integrity_violation()
    test_agent_config_integrity()
