"""
AgentGuard Demo Script
Runs the engine in demo mode, simulating various security events.
"""

import os
import sys
import time
import tempfile
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

import importlib.util
spec = importlib.util.spec_from_file_location("engine", str(Path(__file__).parent / "engine.py"))
engine_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(engine_module)
AgentGuardEngine = engine_module.AgentGuardEngine


def simulate_malicious_activity(engine):
    """Simulate various security events to trigger alerts"""
    
    # Import from the same module as the engine
    from alert_manager import Severity, Category
    
    print("\n🎭 Simulating security events...\n")
    
    # 1. Simulate credential access
    engine.alert_manager.create_alert(
        severity=Severity('HIGH'),
        category=Category('BEHAVIOR'),
        agent_id='noah',
        description='Agent accessed environment variables containing API keys',
        evidence={
            'variables_accessed': ['OPENAI_API_KEY', 'SECRET_KEY'],
            'timestamp': '2026-02-15T13:50:00'
        }
    )
    print("  ✅ Credential access alert generated")
    time.sleep(0.5)
    
    # 2. Simulate network exfiltration attempt
    engine.alert_manager.create_alert(
        severity=Severity('CRITICAL'),
        category=Category('BEHAVIOR'),
        agent_id='moses',
        description='Suspicious network connection to external server',
        evidence={
            'destination': 'http://malicious-server.com/data',
            'data_size': '15KB',
            'connection_type': 'HTTP POST'
        }
    )
    print("  ✅ Network exfiltration alert generated")
    time.sleep(0.5)
    
    # 3. Simulate file integrity violation
    engine.alert_manager.create_alert(
        severity=Severity('HIGH'),
        category=Category('INTEGRITY'),
        agent_id='judas',
        description='SOUL.md was modified outside of authorized window',
        evidence={
            'file': '/agents/judas/SOUL.md',
            'change_type': 'content_modification',
            'unauthorized': True
        }
    )
    print("  ✅ Integrity violation alert generated")
    time.sleep(0.5)
    
    # 4. Simulate mass deletion
    engine.alert_manager.create_alert(
        severity=Severity('HIGH'),
        category=Category('BEHAVIOR'),
        agent_id='ezekiel',
        description='Mass file deletion detected (47 files in 30 seconds)',
        evidence={
            'files_deleted': 47,
            'time_window': '30 seconds',
            'directories_affected': ['workspace/', 'memory/', 'temp/']
        }
    )
    print("  ✅ Mass deletion alert generated")
    time.sleep(0.5)
    
    # 5. Simulate cross-agent collusion
    engine.alert_manager.create_alert(
        severity=Severity('MEDIUM'),
        category=Category('COMMUNICATION'),
        agent_id='solomon',
        description='High-frequency communication between 3 agents detected',
        evidence={
            'agents_involved': ['solomon', 'moses', 'noah'],
            'message_count': 156,
            'time_window': '5 minutes',
            'pattern': 'coordinated_activity'
        }
    )
    print("  ✅ Cross-agent collusion alert generated")
    time.sleep(0.5)


def main():
    """Run AgentGuard demo"""
    
    print("="*70)
    print("🛡️  AGENTGUARD SECURITY MONITORING DEMO")
    print("="*70)
    print("\nThis demo will:")
    print("  1. Initialize the AgentGuard engine")
    print("  2. Run a monitoring cycle (scan skills, check agents)")
    print("  3. Simulate security events and generate alerts")
    print("  4. Show alert statistics\n")
    print("Press Ctrl+C to stop early\n")
    
    # Initialize engine
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    print("🔧 Initializing AgentGuard Engine...")
    engine = AgentGuardEngine('config.yaml')
    
    # Run one cycle
    print("\n📊 Running monitoring cycle...")
    engine.run_cycle()
    
    # Simulate security events
    simulate_malicious_activity(engine)
    
    # Show stats
    print("\n" + "="*70)
    print("📈 ALERT STATISTICS")
    print("="*70)
    
    stats = engine.alert_manager.get_alert_stats(hours=1)
    print(f"\nTotal alerts: {stats['total']}")
    print("\nBy Severity:")
    for severity, count in stats.get('by_severity', {}).items():
        emoji = {'CRITICAL': '🔥', 'HIGH': '🚨', 'MEDIUM': '⚠️', 'LOW': 'ℹ️'}.get(severity, '•')
        print(f"  {emoji} {severity}: {count}")
    
    print("\nBy Category:")
    for category, count in stats.get('by_category', {}).items():
        print(f"  • {category}: {count}")
    
    # Show recent alerts from database
    print("\n" + "="*70)
    print("📝 RECENT ALERTS (from database)")
    print("="*70)
    
    recent_alerts = engine.alert_manager.get_recent_alerts(hours=1)
    for alert in recent_alerts[:5]:
        emoji = {
            'CRITICAL': '🔥',
            'HIGH': '🚨',
            'MEDIUM': '⚠️',
            'LOW': 'ℹ️'
        }.get(alert.severity.value, '•')
        
        print(f"\n{emoji} [{alert.severity.value}] {alert.category.value}")
        print(f"   Agent: {alert.agent_id or 'N/A'}")
        print(f"   {alert.description[:70]}...")
        print(f"   Time: {alert.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
    
    print("\n" + "="*70)
    print("✅ DEMO COMPLETE")
    print("="*70)
    print("\nAgentGuard is running and protecting your agents!")
    print(f"Database: {engine.db_path}")
    print(f"Log file: ~/.openclaw/logs/agentguard.log")
    print("\nTo run continuous monitoring:")
    print("  cd agentguard && python3 engine.py")


if __name__ == "__main__":
    main()
