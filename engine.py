"""
AgentGuard - Main Engine
Continuous security monitoring engine for AI agents.
"""

import json
import logging
import os
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import yaml

# Import AgentGuard components
from alert_manager import AlertManager, Severity, Category
from behavior_monitor import BehaviorMonitor
from skill_scanner import SkillScanner
from integrity_checker import IntegrityChecker


class AgentGuardEngine:
    """Main security monitoring engine"""
    
    def __init__(self, config_path: str = "config.yaml"):
        self.config_path = Path(config_path)
        self.config = self._load_config()
        self.logger = self._setup_logging()
        
        # Initialize database
        self.db_path = self._get_db_path()
        self._init_database()
        
        # Initialize components
        self.alert_manager = AlertManager(self.db_path, self.config.get('alerting', {}))
        self.behavior_monitor = BehaviorMonitor(self.db_path, self.config.get('behavior', {}))
        self.skill_scanner = SkillScanner(self.db_path, self.config.get('skill_scanning', {}))
        self.integrity_checker = IntegrityChecker(self.db_path, self.config.get('integrity', {}))
        
        self.running = False
        self.cycle_count = 0
        
        self.logger.info("AgentGuard Engine initialized")
    
    def _load_config(self) -> Dict:
        """Load configuration from YAML file"""
        if not self.config_path.exists():
            self.config_path = Path(__file__).parent / 'config.yaml'
        
        try:
            with open(self.config_path, 'r') as f:
                return yaml.safe_load(f)
        except Exception as e:
            print(f"Failed to load config: {e}")
            return {}
    
    def _get_db_path(self) -> str:
        """Get database path from config"""
        db_config = self.config.get('database', {})
        db_path = db_config.get('path', '~/.openclaw/agentguard.db')
        return str(Path(db_path).expanduser())
    
    def _init_database(self):
        """Initialize database schema"""
        schema_path = Path(__file__).parent / 'database/schema.sql'
        
        # Ensure directory exists
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        
        with sqlite3.connect(self.db_path) as conn:
            if schema_path.exists():
                conn.executescript(schema_path.read_text())
    
    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration"""
        log_config = self.config.get('logging', {})
        log_level = getattr(logging, log_config.get('level', 'INFO'))
        log_file = log_config.get('file', '~/.openclaw/logs/agentguard.log')
        log_file = Path(log_file).expanduser()
        log_file.parent.mkdir(parents=True, exist_ok=True)
        
        logging.basicConfig(
            level=log_level,
            format=log_config.get('format', '%(asctime)s - %(name)s - %(levelname)s - %(message)s'),
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler(sys.stdout)
            ]
        )
        
        return logging.getLogger(__name__)
    
    def get_installed_skills(self) -> List[str]:
        """Get list of installed skills to scan"""
        skills = []
        scan_paths = self.config.get('skill_scanning', {}).get('scan_paths', [])
        
        for path_template in scan_paths:
            path = Path(path_template).expanduser()
            
            # Handle wildcards
            if '*' in str(path):
                import glob
                for matched_path in glob.glob(str(path), recursive=True):
                    matched_path = Path(matched_path)
                    if matched_path.is_dir():
                        for skill_file in matched_path.glob('**/*.py'):
                            skills.append(str(skill_file))
            else:
                if path.exists():
                    if path.is_dir():
                        for skill_file in path.glob('**/*.py'):
                            skills.append(str(skill_file))
                    elif path.suffix == '.py':
                        skills.append(str(path))
        
        return list(set(skills))  # Remove duplicates
    
    def check_agent(self, agent_id: str):
        """Run all security checks for a single agent"""
        
        self.logger.debug(f"Checking agent: {agent_id}")
        
        # Behavior monitoring
        if self.config.get('monitoring', {}).get('enable_behavior_monitoring', True):
            anomalies = self.behavior_monitor.check(agent_id)
            for anomaly in anomalies:
                self.alert_manager.create_alert(
                    severity=Severity(anomaly.severity),
                    category=Category.BEHAVIOR,
                    agent_id=agent_id,
                    description=anomaly.description,
                    evidence={
                        'anomaly_type': anomaly.anomaly_type,
                        'anomaly_score': anomaly.anomaly_score,
                        'details': anomaly.evidence
                    }
                )
        
        # Integrity checking
        if self.config.get('monitoring', {}).get('enable_integrity_checking', True):
            violations = self.integrity_checker.verify(agent_id)
            for violation in violations:
                self.alert_manager.create_alert(
                    severity=Severity(violation.severity),
                    category=Category.INTEGRITY,
                    agent_id=agent_id,
                    description=violation.description,
                    evidence={
                        'file_path': violation.file_path,
                        'violation_type': violation.violation_type,
                        'expected_hash': violation.expected_hash,
                        'actual_hash': violation.actual_hash
                    }
                )
    
    def scan_skills(self):
        """Scan all installed skills"""
        
        if not self.config.get('monitoring', {}).get('enable_skill_scanning', True):
            return
        
        skills = self.get_installed_skills()
        self.logger.info(f"Scanning {len(skills)} skills")
        
        for skill_path in skills:
            result = self.skill_scanner.scan_skill_file(skill_path)
            
            # Alert on high-risk skills
            if result.risk_score >= 70:
                severity = Severity.CRITICAL if result.risk_score >= 90 else Severity.HIGH
                
                self.alert_manager.create_alert(
                    severity=severity,
                    category=Category.SKILL,
                    agent_id=None,
                    description=f"High-risk skill detected: {result.skill_name} (Risk Score: {result.risk_score})",
                    evidence={
                        'skill_name': result.skill_name,
                        'skill_path': result.skill_path,
                        'risk_score': result.risk_score,
                        'threats': [
                            {
                                'name': t.name,
                                'severity': t.severity,
                                'line': t.line_number
                            } for t in result.threats_detected
                        ]
                    }
                )
    
    def run_cycle(self):
        """Run one monitoring cycle"""
        
        self.cycle_count += 1
        self.logger.info(f"=== Monitoring Cycle #{self.cycle_count} ===")
        
        agents = self.config.get('monitoring', {}).get('agents', [])
        
        # Check each agent
        for agent_id in agents:
            try:
                self.check_agent(agent_id)
            except Exception as e:
                self.logger.error(f"Error checking agent {agent_id}: {e}")
        
        # Scan skills
        try:
            self.scan_skills()
        except Exception as e:
            self.logger.error(f"Error scanning skills: {e}")
        
        # Log stats
        stats = self.alert_manager.get_alert_stats(hours=1)
        self.logger.info(f"Cycle complete. Alerts in last hour: {stats['total']}")
    
    def start_monitoring(self):
        """Main monitoring loop"""
        
        self.running = True
        interval = self.config.get('monitoring', {}).get('interval_seconds', 30)
        
        self.logger.info("=" * 60)
        self.logger.info("AgentGuard Security Monitoring Started")
        self.logger.info("=" * 60)
        self.logger.info(f"Monitoring agents: {self.config.get('monitoring', {}).get('agents', [])}")
        self.logger.info(f"Check interval: {interval} seconds")
        self.logger.info("=" * 60)
        
        # Initialize integrity baselines
        self.logger.info("Initializing integrity baselines...")
        stats = self.integrity_checker.initialize_baseline(
            self.config.get('monitoring', {}).get('agents', [])
        )
        self.logger.info(f"Created {stats['created']} baseline snapshots")
        
        try:
            while self.running:
                self.run_cycle()
                
                # Sleep with interrupt handling
                for _ in range(interval):
                    if not self.running:
                        break
                    time.sleep(1)
                    
        except KeyboardInterrupt:
            self.logger.info("Monitoring stopped by user")
        finally:
            self.stop()
    
    def stop(self):
        """Stop the monitoring engine"""
        self.running = False
        self.logger.info("AgentGuard Engine stopped")
    
    def run_once(self):
        """Run a single monitoring cycle"""
        self.run_cycle()


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='AgentGuard Security Monitoring')
    parser.add_argument('--config', '-c', default='config.yaml', help='Config file path')
    parser.add_argument('--once', '-o', action='store_true', help='Run once and exit')
    parser.add_argument('--init-baseline', '-i', action='store_true', help='Initialize integrity baselines')
    
    args = parser.parse_args()
    
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    engine = AgentGuardEngine(args.config)
    
    if args.init_baseline:
        stats = engine.integrity_checker.initialize_baseline(
            engine.config.get('monitoring', {}).get('agents', [])
        )
        print(f"Baseline initialization complete: {stats}")
    elif args.once:
        engine.run_once()
    else:
        engine.start_monitoring()


if __name__ == "__main__":
    main()
