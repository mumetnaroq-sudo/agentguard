"""
AgentGuard - Integrity Checker
Verifies file integrity and detects unauthorized modifications.
"""

import hashlib
import json
import logging
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class IntegrityViolation:
    file_path: str
    expected_hash: str
    actual_hash: str
    violation_type: str
    agent_id: Optional[str]
    severity: str
    description: str


class IntegrityChecker:
    """Checks file integrity for protected assets"""
    
    def __init__(self, db_path: str, config: Optional[Dict] = None):
        self.db_path = db_path
        self.config = config or {}
        self.logger = logging.getLogger(__name__)
        
        self.protected_paths = config.get('protected_paths', [])
        self.workspace_base = Path.home() / '.openclaw/workspace/agents'
        
        if 'workspace_base' in config:
            self.workspace_base = Path(config['workspace_base']).expanduser()
    
    def _compute_hash(self, file_path: str) -> str:
        """Compute SHA-256 hash of a file"""
        try:
            with open(file_path, 'rb') as f:
                return hashlib.sha256(f.read()).hexdigest()
        except Exception as e:
            self.logger.error(f"Failed to hash {file_path}: {e}")
            return ""
    
    def create_snapshot(self, file_path: str, agent_id: Optional[str] = None) -> bool:
        """Create integrity snapshot for a file"""
        
        file_path = Path(file_path).expanduser().resolve()
        
        if not file_path.exists():
            self.logger.warning(f"File not found: {file_path}")
            return False
        
        try:
            file_hash = self._compute_hash(str(file_path))
            file_size = file_path.stat().st_size
            last_modified = datetime.fromtimestamp(file_path.stat().st_mtime)
            
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """INSERT OR REPLACE INTO integrity_snapshots 
                       (file_path, file_hash, file_size, last_modified, agent_id, snapshot_at)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (
                        str(file_path),
                        file_hash,
                        file_size,
                        last_modified.isoformat(),
                        agent_id,
                        datetime.now().isoformat()
                    )
                )
                conn.commit()
            
            self.logger.debug(f"Snapshot created for {file_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to create snapshot for {file_path}: {e}")
            return False
    
    def verify_file(self, file_path: str) -> Optional[IntegrityViolation]:
        """Verify a file against its stored snapshot"""
        
        file_path = Path(file_path).expanduser().resolve()
        
        if not file_path.exists():
            # Check if we have a snapshot (file was deleted)
            try:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.execute(
                        "SELECT file_hash FROM integrity_snapshots WHERE file_path = ?",
                        (str(file_path),)
                    )
                    if cursor.fetchone():
                        return IntegrityViolation(
                            file_path=str(file_path),
                            expected_hash='EXISTS',
                            actual_hash='DELETED',
                            violation_type='FILE_DELETED',
                            agent_id=None,
                            severity='HIGH',
                            description=f'Protected file was deleted: {file_path.name}'
                        )
            except Exception as e:
                self.logger.error(f"Database error: {e}")
            
            return None
        
        # Get current hash
        current_hash = self._compute_hash(str(file_path))
        
        # Get stored hash
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "SELECT file_hash, agent_id FROM integrity_snapshots WHERE file_path = ?",
                    (str(file_path),)
                )
                row = cursor.fetchone()
                
                if not row:
                    # No snapshot exists, create one
                    self.create_snapshot(str(file_path))
                    return None
                
                stored_hash, agent_id = row
                
                if stored_hash != current_hash:
                    return IntegrityViolation(
                        file_path=str(file_path),
                        expected_hash=stored_hash,
                        actual_hash=current_hash,
                        violation_type='FILE_MODIFIED',
                        agent_id=agent_id,
                        severity='HIGH',
                        description=f'Protected file was modified: {file_path.name}'
                    )
                
        except Exception as e:
            self.logger.error(f"Failed to verify file {file_path}: {e}")
        
        return None
    
    def verify_agent_configs(self, agent_id: str) -> List[IntegrityViolation]:
        """Verify critical config files for an agent"""
        
        violations = []
        
        # Files to check for each agent
        critical_files = [
            'SOUL.md',
            'IDENTITY.md',
            'BOOTSTRAP.md',
            'USER.md',
            'AGENTS.md',
            '.env'
        ]
        
        agent_dir = self.workspace_base / agent_id
        
        if not agent_dir.exists():
            self.logger.warning(f"Agent directory not found: {agent_dir}")
            return violations
        
        for filename in critical_files:
            file_path = agent_dir / filename
            if file_path.exists():
                violation = self.verify_file(str(file_path))
                if violation:
                    violations.append(violation)
        
        return violations
    
    def check_credential_access_logs(self) -> List[IntegrityViolation]:
        """Check for unauthorized credential access attempts"""
        
        violations = []
        
        # Check access to credential files
        credential_files = [
            Path.home() / '.openclaw/.env',
            Path.home() / '.openclaw/config.yaml',
            Path.home() / '.ssh/id_rsa',
            Path.home() / '.ssh/id_ed25519',
        ]
        
        for cred_file in credential_files:
            if cred_file.exists():
                violation = self.verify_file(str(cred_file))
                if violation:
                    violations.append(violation)
        
        return violations
    
    def hash_verification(self, file_path: str, expected_hash: str) -> Tuple[bool, str]:
        """Verify a file against an expected hash"""
        
        file_path = Path(file_path).expanduser()
        
        if not file_path.exists():
            return False, "File not found"
        
        actual_hash = self._compute_hash(str(file_path))
        
        if actual_hash == expected_hash:
            return True, actual_hash
        else:
            return False, actual_hash
    
    def verify(self, agent_id: str) -> List[IntegrityViolation]:
        """Run all integrity checks for an agent"""
        
        violations = []
        
        # Verify agent config files
        violations.extend(self.verify_agent_configs(agent_id))
        
        return violations
    
    def initialize_baseline(self, agent_ids: List[str]) -> Dict[str, int]:
        """Create baseline snapshots for all protected files"""
        
        stats = {'created': 0, 'failed': 0}
        
        for agent_id in agent_ids:
            agent_dir = self.workspace_base / agent_id
            
            if not agent_dir.exists():
                continue
            
            # Critical files
            critical_files = ['SOUL.md', 'IDENTITY.md', 'BOOTSTRAP.md', 'USER.md', 'AGENTS.md']
            
            for filename in critical_files:
                file_path = agent_dir / filename
                if file_path.exists():
                    if self.create_snapshot(str(file_path), agent_id):
                        stats['created'] += 1
                    else:
                        stats['failed'] += 1
        
        # Global protected files
        global_files = [
            Path.home() / '.openclaw/.env',
            Path.home() / '.openclaw/config.yaml',
        ]
        
        for file_path in global_files:
            if file_path.exists():
                if self.create_snapshot(str(file_path)):
                    stats['created'] += 1
                else:
                    stats['failed'] += 1
        
        self.logger.info(f"Baseline initialized: {stats['created']} snapshots created")
        return stats
    
    def get_violation_history(self, hours: int = 24) -> List[Dict]:
        """Get recent integrity violations from alerts"""
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    """SELECT * FROM alerts 
                       WHERE category = 'INTEGRITY'
                       AND timestamp > datetime('now', '-{} hours')
                       ORDER BY timestamp DESC""".format(hours)
                )
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            self.logger.error(f"Failed to get violation history: {e}")
            return []
