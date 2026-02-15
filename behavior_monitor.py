"""
AgentGuard - Behavior Monitor
Monitors agent behavior for anomalous patterns and potential security issues.
"""

import json
import logging
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from collections import defaultdict


@dataclass
class BehaviorEvent:
    agent_id: str
    action_type: str
    details: Dict[str, Any]
    timestamp: datetime
    token_count: int = 0
    tool_usage_count: int = 0


@dataclass
class AnomalyReport:
    agent_id: str
    anomaly_type: str
    severity: str
    description: str
    evidence: Dict[str, Any]
    anomaly_score: float


class BehaviorMonitor:
    """Monitors agent behavior for security anomalies"""
    
    # Suspicious action types
    SUSPICIOUS_ACTIONS = {
        'CREDENTIAL_ACCESS': {'weight': 0.8, 'description': 'Access to credentials/secrets'},
        'FILE_ESCAPE': {'weight': 0.9, 'description': 'File access outside workspace'},
        'NETWORK_CALL': {'weight': 0.7, 'description': 'Network activity detected'},
        'CODE_EXECUTION': {'weight': 0.95, 'description': 'Code execution attempted'},
        'MASS_DELETION': {'weight': 0.85, 'description': 'Mass file deletion detected'},
        'OFF_HOURS_ACTIVITY': {'weight': 0.4, 'description': 'Activity during off-hours'},
        'EXCESSIVE_TOKENS': {'weight': 0.6, 'description': 'Unusually high token usage'},
        'RAPID_TOOL_CALLS': {'weight': 0.7, 'description': 'Rapid successive tool calls'},
        'CROSS_AGENT_MESSAGE': {'weight': 0.5, 'description': 'Communication with other agents'},
    }
    
    def __init__(self, db_path: str, config: Optional[Dict] = None):
        self.db_path = db_path
        self.config = config or {}
        self.logger = logging.getLogger(__name__)
        
        # Configuration
        self.max_tokens_per_hour = config.get('max_tokens_per_hour', 100000)
        self.max_tool_calls_per_minute = config.get('max_tool_calls_per_minute', 60)
        self.off_hours_start = config.get('off_hours_start', 23)
        self.off_hours_end = config.get('off_hours_end', 6)
        self.timezone = config.get('timezone', 'UTC')
        
        # Tracking for anomaly detection
        self._agent_actions: Dict[str, List[BehaviorEvent]] = defaultdict(list)
        self._agent_token_counts: Dict[str, List[tuple]] = defaultdict(list)  # (timestamp, count)
        self._agent_tool_calls: Dict[str, List[datetime]] = defaultdict(list)
    
    def log_action(self, agent_id: str, action_type: str, 
                   details: Dict[str, Any], token_count: int = 0,
                   tool_usage_count: int = 0):
        """Log a single agent action"""
        
        event = BehaviorEvent(
            agent_id=agent_id,
            action_type=action_type,
            details=details,
            timestamp=datetime.now(),
            token_count=token_count,
            tool_usage_count=tool_usage_count
        )
        
        # Store in memory
        self._agent_actions[agent_id].append(event)
        
        # Track tokens
        if token_count > 0:
            self._agent_token_counts[agent_id].append((datetime.now(), token_count))
        
        # Track tool calls
        if tool_usage_count > 0:
            for _ in range(tool_usage_count):
                self._agent_tool_calls[agent_id].append(datetime.now())
        
        # Persist to database
        self._persist_event(event)
        
        self.logger.debug(f"Logged action for {agent_id}: {action_type}")
    
    def _persist_event(self, event: BehaviorEvent):
        """Store event in database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """INSERT INTO behavior_logs 
                       (agent_id, action_type, details, token_count, tool_usage_count, logged_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        event.agent_id,
                        event.action_type,
                        json.dumps(event.details),
                        event.token_count,
                        event.tool_usage_count,
                        event.timestamp.isoformat()
                    )
                )
                conn.commit()
        except Exception as e:
            self.logger.error(f"Failed to persist behavior event: {e}")
    
    def detect_anomalous_patterns(self, agent_id: str) -> List[AnomalyReport]:
        """Detect anomalous behavior patterns for an agent"""
        
        anomalies = []
        actions = self._agent_actions.get(agent_id, [])
        
        if not actions:
            return anomalies
        
        # Get recent actions (last hour)
        recent_cutoff = datetime.now() - timedelta(hours=1)
        recent_actions = [a for a in actions if a.timestamp > recent_cutoff]
        
        # Check for suspicious action types
        for action in recent_actions:
            if action.action_type in self.SUSPICIOUS_ACTIONS:
                pattern = self.SUSPICIOUS_ACTIONS[action.action_type]
                
                anomaly = AnomalyReport(
                    agent_id=agent_id,
                    anomaly_type=action.action_type,
                    severity=self._score_to_severity(pattern['weight']),
                    description=pattern['description'],
                    evidence={
                        'action_details': action.details,
                        'timestamp': action.timestamp.isoformat()
                    },
                    anomaly_score=pattern['weight']
                )
                anomalies.append(anomaly)
        
        # Check for off-hours activity
        if self._is_off_hours():
            recent_count = len(recent_actions)
            if recent_count > 5:  # Threshold for off-hours activity
                anomaly = AnomalyReport(
                    agent_id=agent_id,
                    anomaly_type='OFF_HOURS_ACTIVITY',
                    severity='MEDIUM',
                    description=f'{recent_count} actions during off-hours',
                    evidence={'action_count': recent_count, 'hour': datetime.now().hour},
                    anomaly_score=0.4 + (min(recent_count, 20) / 50)  # Scale with count
                )
                anomalies.append(anomaly)
        
        # Check for mass deletions
        delete_actions = [a for a in recent_actions if 'delete' in a.action_type.lower()]
        if len(delete_actions) > 10:
            anomaly = AnomalyReport(
                agent_id=agent_id,
                anomaly_type='MASS_DELETION',
                severity='HIGH',
                description=f'{len(delete_actions)} deletion actions detected',
                evidence={'deletion_count': len(delete_actions)},
                anomaly_score=0.85
            )
            anomalies.append(anomaly)
        
        return anomalies
    
    def check_token_usage_anomaly(self, agent_id: str) -> Optional[AnomalyReport]:
        """Check for unusual token usage patterns"""
        
        token_history = self._agent_token_counts.get(agent_id, [])
        
        if not token_history:
            return None
        
        # Calculate tokens in last hour
        one_hour_ago = datetime.now() - timedelta(hours=1)
        recent_tokens = sum(count for ts, count in token_history if ts > one_hour_ago)
        
        # Clean old entries
        self._agent_token_counts[agent_id] = [
            (ts, count) for ts, count in token_history if ts > one_hour_ago
        ]
        
        if recent_tokens > self.max_tokens_per_hour:
            anomaly_score = min(recent_tokens / self.max_tokens_per_hour, 2.0) / 2.0
            
            return AnomalyReport(
                agent_id=agent_id,
                anomaly_type='EXCESSIVE_TOKENS',
                severity=self._score_to_severity(anomaly_score),
                description=f'Token usage {recent_tokens} exceeds threshold {self.max_tokens_per_hour}',
                evidence={
                    'tokens_used': recent_tokens,
                    'threshold': self.max_tokens_per_hour,
                    'time_window': '1 hour'
                },
                anomaly_score=anomaly_score
            )
        
        return None
    
    def check_tool_usage_anomaly(self, agent_id: str) -> Optional[AnomalyReport]:
        """Check for rapid tool call patterns"""
        
        tool_calls = self._agent_tool_calls.get(agent_id, [])
        
        if not tool_calls:
            return None
        
        # Clean old entries (older than 1 minute)
        one_minute_ago = datetime.now() - timedelta(minutes=1)
        recent_calls = [ts for ts in tool_calls if ts > one_minute_ago]
        self._agent_tool_calls[agent_id] = recent_calls
        
        if len(recent_calls) > self.max_tool_calls_per_minute:
            anomaly_score = min(len(recent_calls) / self.max_tool_calls_per_minute, 2.0) / 2.0
            
            return AnomalyReport(
                agent_id=agent_id,
                anomaly_type='RAPID_TOOL_CALLS',
                severity=self._score_to_severity(anomaly_score),
                description=f'{len(recent_calls)} tool calls in 1 minute exceeds threshold {self.max_tool_calls_per_minute}',
                evidence={
                    'tool_calls': len(recent_calls),
                    'threshold': self.max_tool_calls_per_minute,
                    'time_window': '1 minute'
                },
                anomaly_score=anomaly_score
            )
        
        return None
    
    def detect_cross_agent_collusion(self, communications: List[Dict]) -> List[AnomalyReport]:
        """Detect suspicious cross-agent communication patterns"""
        
        anomalies = []
        
        # Log communications
        for comm in communications:
            self._log_communication(comm)
        
        # Check for high-frequency communication
        agent_pairs = defaultdict(list)
        for comm in communications:
            pair = tuple(sorted([comm.get('source'), comm.get('target')]))
            agent_pairs[pair].append(comm)
        
        for pair, msgs in agent_pairs.items():
            if len(msgs) > 20:  # Threshold for suspicious activity
                anomaly = AnomalyReport(
                    agent_id=f"{pair[0]}->{pair[1]}",
                    anomaly_type='CROSS_AGENT_COLLUSION',
                    severity='HIGH',
                    description=f'High-frequency communication: {len(msgs)} messages',
                    evidence={
                        'message_count': len(msgs),
                        'agents': list(pair)
                    },
                    anomaly_score=0.6 + min(len(msgs) / 100, 0.4)
                )
                anomalies.append(anomaly)
        
        # Check for similar message content (potential coordination)
        content_hashes = defaultdict(int)
        for comm in communications:
            content_hash = comm.get('content_hash', '')
            if content_hash:
                content_hashes[content_hash] += 1
        
        for content_hash, count in content_hashes.items():
            if count > 5:  # Same content sent multiple times
                anomaly = AnomalyReport(
                    agent_id='multiple',
                    anomaly_type='SUSPICIOUS_COORDINATION',
                    severity='HIGH',
                    description=f'Identical message content sent {count} times',
                    evidence={
                        'duplicate_count': count,
                        'content_hash': content_hash
                    },
                    anomaly_score=0.7
                )
                anomalies.append(anomaly)
        
        return anomalies
    
    def _log_communication(self, comm: Dict):
        """Log cross-agent communication"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """INSERT INTO communication_logs 
                       (source_agent, target_agent, message_type, content_hash)
                       VALUES (?, ?, ?, ?)""",
                    (
                        comm.get('source'),
                        comm.get('target'),
                        comm.get('type', 'unknown'),
                        comm.get('content_hash', '')
                    )
                )
                conn.commit()
        except Exception as e:
            self.logger.error(f"Failed to log communication: {e}")
    
    def _is_off_hours(self) -> bool:
        """Check if current time is off-hours"""
        hour = datetime.now().hour
        if self.off_hours_start > self.off_hours_end:  # Wraps around midnight
            return hour >= self.off_hours_start or hour < self.off_hours_end
        else:
            return self.off_hours_start <= hour < self.off_hours_end
    
    def _score_to_severity(self, score: float) -> str:
        """Convert anomaly score to severity string"""
        if score >= 0.9:
            return 'CRITICAL'
        elif score >= 0.7:
            return 'HIGH'
        elif score >= 0.4:
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def check(self, agent_id: str) -> List[AnomalyReport]:
        """Run all behavior checks for an agent"""
        
        all_anomalies = []
        
        # Detect anomalous patterns
        all_anomalies.extend(self.detect_anomalous_patterns(agent_id))
        
        # Check token usage
        token_anomaly = self.check_token_usage_anomaly(agent_id)
        if token_anomaly:
            all_anomalies.append(token_anomaly)
        
        # Check tool usage
        tool_anomaly = self.check_tool_usage_anomaly(agent_id)
        if tool_anomaly:
            all_anomalies.append(tool_anomaly)
        
        return all_anomalies
    
    def get_agent_stats(self, agent_id: str, hours: int = 24) -> Dict:
        """Get behavior statistics for an agent"""
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    """SELECT 
                        COUNT(*) as total_actions,
                        SUM(token_count) as total_tokens,
                        SUM(tool_usage_count) as total_tools,
                        AVG(anomaly_score) as avg_anomaly
                       FROM behavior_logs 
                       WHERE agent_id = ? 
                       AND logged_at > datetime('now', '-{} hours')""".format(hours),
                    (agent_id,)
                )
                row = cursor.fetchone()
                
                return {
                    'agent_id': agent_id,
                    'total_actions': row[0] or 0,
                    'total_tokens': row[1] or 0,
                    'total_tools': row[2] or 0,
                    'avg_anomaly_score': row[3] or 0.0,
                    'time_window_hours': hours
                }
        except Exception as e:
            self.logger.error(f"Failed to get agent stats: {e}")
            return {}
