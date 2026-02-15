"""
AgentGuard - Alert Manager
Manages security alerts, notifications, and logging.
"""

import json
import sqlite3
import logging
from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import requests


class Severity(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Category(Enum):
    BEHAVIOR = "BEHAVIOR"
    SKILL = "SKILL"
    INTEGRITY = "INTEGRITY"
    COMMUNICATION = "COMMUNICATION"


@dataclass
class Alert:
    severity: Severity
    category: Category
    agent_id: Optional[str]
    description: str
    evidence: Dict[str, Any]
    timestamp: datetime = None
    id: Optional[int] = None
    resolved: bool = False
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "severity": self.severity.value,
            "category": self.category.value,
            "agent_id": self.agent_id,
            "description": self.description,
            "evidence": self.evidence,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "resolved": self.resolved
        }
    
    def to_discord_embed(self) -> Dict:
        """Convert alert to Discord embed format"""
        color_map = {
            Severity.LOW: 0x3498db,      # Blue
            Severity.MEDIUM: 0xf1c40f,   # Yellow
            Severity.HIGH: 0xe67e22,     # Orange
            Severity.CRITICAL: 0xe74c3c  # Red
        }
        
        emoji_map = {
            Severity.LOW: "ℹ️",
            Severity.MEDIUM: "⚠️",
            Severity.HIGH: "🚨",
            Severity.CRITICAL: "🔥"
        }
        
        embed = {
            "title": f"{emoji_map[self.severity]} AgentGuard Alert: {self.severity.value}",
            "description": self.description,
            "color": color_map[self.severity],
            "timestamp": self.timestamp.isoformat() if self.timestamp else datetime.now().isoformat(),
            "fields": [
                {
                    "name": "Category",
                    "value": self.category.value,
                    "inline": True
                }
            ],
            "footer": {
                "text": "AgentGuard Security Monitoring"
            }
        }
        
        if self.agent_id:
            embed["fields"].append({
                "name": "Agent",
                "value": self.agent_id,
                "inline": True
            })
        
        # Add evidence as fields
        if self.evidence:
            evidence_text = json.dumps(self.evidence, indent=2)[:1000]  # Limit length
            embed["fields"].append({
                "name": "Evidence",
                "value": f"```json\n{evidence_text}\n```",
                "inline": False
            })
        
        return embed


class AlertManager:
    """Manages security alerts and notifications"""
    
    def __init__(self, db_path: str, config: Optional[Dict] = None):
        self.db_path = db_path
        self.config = config or {}
        self.logger = logging.getLogger(__name__)
        self._init_database()
        self._alert_history: Dict[str, datetime] = {}  # For cooldown tracking
    
    def _init_database(self):
        """Initialize database tables if they don't exist"""
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript(open('database/schema.sql').read())
    
    def create_alert(
        self,
        severity: Severity,
        category: Category,
        description: str,
        evidence: Optional[Dict] = None,
        agent_id: Optional[str] = None
    ) -> Alert:
        """Create and process a new security alert"""
        
        alert = Alert(
            severity=severity,
            category=category,
            agent_id=agent_id,
            description=description,
            evidence=evidence or {}
        )
        
        # Check cooldown
        if self._is_on_cooldown(alert):
            self.logger.debug(f"Alert on cooldown, skipping: {description[:50]}")
            return alert
        
        # Log to console
        if self.config.get('enable_console_alerts', True):
            self._log_to_console(alert)
        
        # Log to database
        if self.config.get('enable_database_alerts', True):
            self._log_to_database(alert)
        
        # Send to Discord
        if self.config.get('enable_discord_alerts', False):
            self.send_to_discord(alert)
        
        # Record in cooldown history
        self._record_alert(alert)
        
        return alert
    
    def _is_on_cooldown(self, alert: Alert) -> bool:
        """Check if similar alert was recently created"""
        cooldown_seconds = self.config.get('alert_cooldown_seconds', 300)
        alert_key = f"{alert.category.value}:{alert.agent_id}:{alert.description[:50]}"
        
        if alert_key in self._alert_history:
            last_time = self._alert_history[alert_key]
            if (datetime.now() - last_time).total_seconds() < cooldown_seconds:
                return True
        
        return False
    
    def _record_alert(self, alert: Alert):
        """Record alert time for cooldown tracking"""
        alert_key = f"{alert.category.value}:{alert.agent_id}:{alert.description[:50]}"
        self._alert_history[alert_key] = datetime.now()
    
    def _log_to_console(self, alert: Alert):
        """Log alert to console"""
        emoji = {
            Severity.LOW: "ℹ️",
            Severity.MEDIUM: "⚠️",
            Severity.HIGH: "🚨",
            Severity.CRITICAL: "🔥"
        }
        
        log_message = (
            f"\n{'='*60}\n"
            f"{emoji[alert.severity]} AGENTGUARD ALERT [{alert.severity.value}]\n"
            f"{'='*60}\n"
            f"Category: {alert.category.value}\n"
            f"Agent: {alert.agent_id or 'N/A'}\n"
            f"Time: {alert.timestamp.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"\n{alert.description}\n"
        )
        
        if alert.evidence:
            log_message += f"\nEvidence: {json.dumps(alert.evidence, indent=2)}\n"
        
        log_message += f"{'='*60}\n"
        
        if alert.severity == Severity.CRITICAL:
            self.logger.critical(log_message)
        elif alert.severity == Severity.HIGH:
            self.logger.error(log_message)
        elif alert.severity == Severity.MEDIUM:
            self.logger.warning(log_message)
        else:
            self.logger.info(log_message)
    
    def _log_to_database(self, alert: Alert):
        """Persist alert to database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    """INSERT INTO alerts 
                       (severity, category, agent_id, description, evidence, timestamp)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        alert.severity.value,
                        alert.category.value,
                        alert.agent_id,
                        alert.description,
                        json.dumps(alert.evidence),
                        alert.timestamp.isoformat()
                    )
                )
                alert.id = cursor.lastrowid
                conn.commit()
                self.logger.debug(f"Alert logged to database with ID: {alert.id}")
        except Exception as e:
            self.logger.error(f"Failed to log alert to database: {e}")
    
    def send_to_discord(self, alert: Alert) -> bool:
        """Send alert to Discord webhook"""
        webhook_url = self.config.get('discord_webhook', '')
        
        if not webhook_url:
            self.logger.warning("Discord webhook not configured")
            return False
        
        # Check minimum severity
        min_severity = self.config.get('min_severity', 'MEDIUM')
        severity_levels = {'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4}
        
        if severity_levels[alert.severity.value] < severity_levels.get(min_severity, 2):
            return False
        
        try:
            payload = {
                "embeds": [alert.to_discord_embed()]
            }
            
            response = requests.post(
                webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10
            )
            
            if response.status_code == 204:
                self.logger.info(f"Alert sent to Discord: {alert.description[:50]}")
                return True
            else:
                self.logger.error(f"Discord webhook failed: {response.status_code}")
                return False
                
        except Exception as e:
            self.logger.error(f"Failed to send Discord notification: {e}")
            return False
    
    def get_recent_alerts(
        self,
        hours: int = 24,
        severity: Optional[Severity] = None,
        agent_id: Optional[str] = None
    ) -> List[Alert]:
        """Retrieve recent alerts from database"""
        
        query = """SELECT id, severity, category, agent_id, description, evidence, 
                          timestamp, resolved 
                   FROM alerts 
                   WHERE timestamp > datetime('now', '-{} hours')""".format(hours)
        
        params = []
        
        if severity:
            query += " AND severity = ?"
            params.append(severity.value)
        
        if agent_id:
            query += " AND agent_id = ?"
            params.append(agent_id)
        
        query += " ORDER BY timestamp DESC"
        
        alerts = []
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(query, params)
                
                for row in cursor.fetchall():
                    alert = Alert(
                        id=row['id'],
                        severity=Severity(row['severity']),
                        category=Category(row['category']),
                        agent_id=row['agent_id'],
                        description=row['description'],
                        evidence=json.loads(row['evidence']) if row['evidence'] else {},
                        timestamp=datetime.fromisoformat(row['timestamp']),
                        resolved=bool(row['resolved'])
                    )
                    alerts.append(alert)
        except Exception as e:
            self.logger.error(f"Failed to retrieve alerts: {e}")
        
        return alerts
    
    def resolve_alert(self, alert_id: int, resolution_notes: str = "") -> bool:
        """Mark an alert as resolved"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """UPDATE alerts 
                       SET resolved = TRUE, resolved_at = ?, resolution_notes = ?
                       WHERE id = ?""",
                    (datetime.now().isoformat(), resolution_notes, alert_id)
                )
                conn.commit()
                self.logger.info(f"Alert {alert_id} resolved")
                return True
        except Exception as e:
            self.logger.error(f"Failed to resolve alert {alert_id}: {e}")
            return False
    
    def get_alert_stats(self, hours: int = 24) -> Dict:
        """Get alert statistics"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    """SELECT severity, COUNT(*) as count 
                       FROM alerts 
                       WHERE timestamp > datetime('now', '-{} hours')
                       GROUP BY severity""".format(hours)
                )
                
                stats = {'total': 0, 'by_severity': {}, 'by_category': {}}
                
                for row in cursor.fetchall():
                    stats['by_severity'][row[0]] = row[1]
                    stats['total'] += row[1]
                
                cursor = conn.execute(
                    """SELECT category, COUNT(*) as count 
                       FROM alerts 
                       WHERE timestamp > datetime('now', '-{} hours')
                       GROUP BY category""".format(hours)
                )
                
                for row in cursor.fetchall():
                    stats['by_category'][row[0]] = row[1]
                
                return stats
        except Exception as e:
            self.logger.error(f"Failed to get alert stats: {e}")
            return {'total': 0, 'by_severity': {}, 'by_category': {}}
