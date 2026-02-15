"""
AgentGuard - AI Agent Security Monitoring System

A comprehensive security monitoring system for AI agents that detects:
- Malicious skills and code
- Anomalous behavior patterns
- File integrity violations
- Cross-agent collusion attempts

Components:
- alert_manager: Manages security alerts and notifications
- behavior_monitor: Monitors agent behavior for anomalies
- skill_scanner: Scans skills for malicious code patterns
- integrity_checker: Verifies file integrity
- engine: Main monitoring engine

Usage:
    from agentguard import AgentGuardEngine
    
    engine = AgentGuardEngine()
    engine.start_monitoring()
"""

__version__ = "1.0.0"
__author__ = "AgentGuard Security Team"

from .alert_manager import AlertManager, Severity, Category, Alert
from .behavior_monitor import BehaviorMonitor, BehaviorEvent, AnomalyReport
from .skill_scanner import SkillScanner, ScanResult, ThreatMatch
from .integrity_checker import IntegrityChecker, IntegrityViolation
from .engine import AgentGuardEngine

__all__ = [
    'AgentGuardEngine',
    'AlertManager',
    'Severity',
    'Category', 
    'Alert',
    'BehaviorMonitor',
    'BehaviorEvent',
    'AnomalyReport',
    'SkillScanner',
    'ScanResult',
    'ThreatMatch',
    'IntegrityChecker',
    'IntegrityViolation',
]
