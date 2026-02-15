"""
AgentGuard - Skill Scanner
Scans skills for malicious code patterns and vulnerabilities.
"""

import hashlib
import json
import logging
import os
import re
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass


@dataclass
class ThreatMatch:
    signature_id: str
    name: str
    description: str
    pattern: str
    severity: str
    line_number: int
    matched_text: str


@dataclass
class ScanResult:
    skill_name: str
    skill_path: str
    skill_hash: str
    risk_score: int
    threats_detected: List[ThreatMatch]
    scan_status: str
    scanned_at: str


class SkillScanner:
    """Scans AI agent skills for security threats"""
    
    # Suspicious patterns for risk scoring
    RISK_PATTERNS = {
        'credential_access': {
            'patterns': [
                r'os\.environ\[.*\]',
                r'os\.getenv\s*\(',
                r'environ\[.*\]',
                r'getenv\s*\(',
                r'load_dotenv',
                r'\.env',
            ],
            'weight': 25
        },
        'network_activity': {
            'patterns': [
                r'requests\.(get|post|put|delete|patch)',
                r'urllib\.request',
                r'socket\.(socket|connect)',
                r'http\.client',
                r'httpx\.',
                r'aiohttp',
            ],
            'weight': 20
        },
        'code_execution': {
            'patterns': [
                r'os\.system\s*\(',
                r'subprocess\.(run|call|Popen)',
                r'exec\s*\(',
                r'eval\s*\(',
                r'compile\s*\(',
                r'__import__\s*\(',
                r'importlib',
                r'ctypes\.', 
            ],
            'weight': 30
        },
        'file_escape': {
            'patterns': [
                r'\.\./',
                r'\.\.\\\\',
                r'/etc/passwd',
                r'/root/',
                r'/home/',
                r'C:\\Windows',
                r'/\.ssh',
                r'~/.ssh',
            ],
            'weight': 20
        },
        'obfuscation': {
            'patterns': [
                r'base64\.(b64decode|decode)',
                r'binascii\.(unhexlify|a2b)',
                r'zlib\.(decompress|unpack)',
                r'\.decode\s*\(\s*[\'"]rot13',
                r'chr\s*\(\s*\d+\s*\)',
                r'\\x[0-9a-fA-F]{2}',
                r'\\u[0-9a-fA-F]{4}',
            ],
            'weight': 15
        },
        'data_collection': {
            'patterns': [
                r'pyperclip',
                r'clipboard',
                r'pasteboard',
                r'pyautogui\.screenshot',
                r'ImageGrab',
                r'mss',
                r'pynput',
                r'keyboard\.(listen|read)',
            ],
            'weight': 10
        }
    }
    
    def __init__(self, db_path: str, config: Optional[Dict] = None):
        self.db_path = db_path
        self.config = config or {}
        self.logger = logging.getLogger(__name__)
        self._threat_signatures: List[Dict] = []
        self._load_threat_signatures()
    
    def _load_threat_signatures(self):
        """Load threat signatures from database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    "SELECT * FROM threat_signatures"
                )
                self._threat_signatures = [dict(row) for row in cursor.fetchall()]
                self.logger.info(f"Loaded {len(self._threat_signatures)} threat signatures")
        except Exception as e:
            self.logger.error(f"Failed to load threat signatures: {e}")
            self._threat_signatures = []
    
    def scan_skill_file(self, skill_path: str) -> ScanResult:
        """Scan a single skill file for threats"""
        
        skill_path = Path(skill_path)
        skill_name = skill_path.stem
        
        self.logger.info(f"Scanning skill: {skill_name}")
        
        try:
            # Read file content
            with open(skill_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            lines = content.split('\n')
            
            # Calculate hash
            skill_hash = hashlib.sha256(content.encode()).hexdigest()
            
            # Check threat database
            threats = self._check_against_threats(content, lines)
            
            # Calculate risk score
            risk_score = self.generate_risk_score(content, lines, threats)
            
            # Create result
            result = ScanResult(
                skill_name=skill_name,
                skill_path=str(skill_path),
                skill_hash=skill_hash,
                risk_score=risk_score,
                threats_detected=threats,
                scan_status='scanned',
                scanned_at=__import__('datetime').datetime.now().isoformat()
            )
            
            # Store result in database
            self._store_scan_result(result)
            
            return result
            
        except Exception as e:
            self.logger.error(f"Failed to scan skill {skill_name}: {e}")
            return ScanResult(
                skill_name=skill_name,
                skill_path=str(skill_path),
                skill_hash='',
                risk_score=0,
                threats_detected=[],
                scan_status='error',
                scanned_at=__import__('datetime').datetime.now().isoformat()
            )
    
    def _check_against_threats(self, content: str, lines: List[str]) -> List[ThreatMatch]:
        """Check content against known threat signatures"""
        threats = []
        
        for signature in self._threat_signatures:
            pattern = signature['pattern']
            pattern_type = signature['pattern_type']
            
            for line_num, line in enumerate(lines, 1):
                matched = False
                matched_text = ''
                
                if pattern_type == 'regex':
                    try:
                        matches = re.finditer(pattern, line, re.IGNORECASE)
                        for match in matches:
                            matched = True
                            matched_text = match.group(0)
                            break
                    except re.error:
                        continue
                elif pattern_type == 'string':
                    if pattern.lower() in line.lower():
                        matched = True
                        matched_text = pattern
                
                if matched:
                    threat = ThreatMatch(
                        signature_id=signature['signature_id'],
                        name=signature['name'],
                        description=signature['description'],
                        pattern=pattern,
                        severity=signature['severity'],
                        line_number=line_num,
                        matched_text=matched_text[:100]  # Limit length
                    )
                    threats.append(threat)
        
        return threats
    
    def generate_risk_score(self, content: str, lines: List[str], 
                           detected_threats: List[ThreatMatch]) -> int:
        """Calculate risk score from 0-100"""
        
        score = 0
        found_categories: Set[str] = set()
        
        # Score from pattern matching
        for category, data in self.RISK_PATTERNS.items():
            category_matches = 0
            for pattern in data['patterns']:
                for line in lines:
                    if re.search(pattern, line, re.IGNORECASE):
                        category_matches += 1
            
            if category_matches > 0:
                found_categories.add(category)
                # Cap matches at 5 for scoring
                capped_matches = min(category_matches, 5)
                score += data['weight'] * (capped_matches / 5)
        
        # Bonus for multiple threat categories (compound risk)
        if len(found_categories) >= 3:
            score += 15
        elif len(found_categories) >= 2:
            score += 10
        
        # Score from detected threat signatures
        for threat in detected_threats:
            if threat.severity == 'CRITICAL':
                score += 20
            elif threat.severity == 'HIGH':
                score += 15
            elif threat.severity == 'MEDIUM':
                score += 10
            elif threat.severity == 'LOW':
                score += 5
        
        # Cap at 100
        return min(int(score), 100)
    
    def _store_scan_result(self, result: ScanResult):
        """Store scan result in database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    """INSERT OR REPLACE INTO skill_scans 
                       (skill_name, skill_path, skill_hash, risk_score, 
                        threats_detected, scan_status, scanned_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        result.skill_name,
                        result.skill_path,
                        result.skill_hash,
                        result.risk_score,
                        json.dumps([{
                            'signature_id': t.signature_id,
                            'name': t.name,
                            'severity': t.severity,
                            'line_number': t.line_number,
                            'matched_text': t.matched_text
                        } for t in result.threats_detected]),
                        result.scan_status,
                        result.scanned_at
                    )
                )
                conn.commit()
        except Exception as e:
            self.logger.error(f"Failed to store scan result: {e}")
    
    def scan_directory(self, directory: str, recursive: bool = True) -> List[ScanResult]:
        """Scan all skill files in a directory"""
        results = []
        directory = Path(directory)
        
        if not directory.exists():
            self.logger.warning(f"Directory not found: {directory}")
            return results
        
        pattern = "**/*.py" if recursive else "*.py"
        
        for skill_file in directory.glob(pattern):
            result = self.scan_skill_file(str(skill_file))
            results.append(result)
        
        self.logger.info(f"Scanned {len(results)} skills in {directory}")
        return results
    
    def get_high_risk_skills(self, min_risk: int = 70) -> List[Dict]:
        """Get list of high-risk skills from database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    """SELECT * FROM skill_scans 
                       WHERE risk_score >= ? 
                       ORDER BY risk_score DESC""",
                    (min_risk,)
                )
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            self.logger.error(f"Failed to get high risk skills: {e}")
            return []
    
    def check_skill_hash(self, skill_hash: str) -> Optional[Dict]:
        """Check if a skill hash is known in the database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    "SELECT * FROM skill_scans WHERE skill_hash = ?",
                    (skill_hash,)
                )
                row = cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            self.logger.error(f"Failed to check skill hash: {e}")
            return None
    
    def quarantine_skill(self, skill_path: str, quarantine_dir: str) -> bool:
        """Move a skill to quarantine"""
        try:
            skill_path = Path(skill_path)
            quarantine_path = Path(quarantine_dir)
            quarantine_path.mkdir(parents=True, exist_ok=True)
            
            dest = quarantine_path / f"{skill_path.stem}_quarantined.py"
            
            # Read and write to quarantine
            content = skill_path.read_text()
            dest.write_text(content)
            
            # Remove original (or rename)
            skill_path.unlink()
            
            self.logger.warning(f"Skill quarantined: {skill_path} -> {dest}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to quarantine skill: {e}")
            return False
