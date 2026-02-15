"""
AgentGuard - Prompt Filter Module
Pre-LLM filtering for prompt injection and jailbreak attempts.
"""

import json
import logging
import re
import hashlib
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Any
import math


class FilterAction(Enum):
    """Actions that can be taken on a prompt"""
    ALLOW = "allow"
    BLOCK = "block"
    SANITIZE = "sanitize"
    FLAG = "flag"


class Severity(Enum):
    """Severity levels for detected threats"""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


@dataclass
class MatchResult:
    """Result of a signature match"""
    signature_id: str
    signature_name: str
    category: str
    severity: Severity
    matched_pattern: str
    matched_text: str
    position: int
    confidence: float


@dataclass
class FilterResult:
    """Result of prompt filtering"""
    action: FilterAction
    original_prompt: str
    sanitized_prompt: Optional[str]
    is_blocked: bool
    is_sanitized: bool
    matches: List[MatchResult] = field(default_factory=list)
    risk_score: int = 0
    matched_signatures: List[str] = field(default_factory=list)
    processing_time_ms: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class InjectionAttempt:
    """Record of an injection attempt"""
    timestamp: datetime
    agent_id: str
    signature_id: str
    severity: Severity
    prompt_excerpt: str
    prompt_hash: str
    context: Dict[str, Any]


class PromptFilter:
    """
    Pre-LLM prompt security filtering engine.
    
    Scans prompts for injection attempts, jailbreaks, and other
    malicious patterns before they reach the LLM.
    """
    
    # Zero-width characters to detect/remove
    ZERO_WIDTH_CHARS = [
        '\u200B',  # Zero Width Space
        '\u200C',  # Zero Width Non-Joiner
        '\u200D',  # Zero Width Joiner
        '\u2060',  # Word Joiner
        '\uFEFF',  # Zero Width No-Break Space (BOM)
    ]
    
    # Homoglyph mappings for normalization
    HOMOGLYPH_MAP = str.maketrans({
        'ѕ': 's', 'у': 'y', 'т': 't', 'е': 'e', 'ｍ': 'm',
        'ｉ': 'i', 'ｇ': 'g', 'ｎ': 'n', 'ｏ': 'o', 'ｒ': 'r',
        'ａ': 'a', 'ｂ': 'b', 'ｃ': 'c', 'ｄ': 'd', 'ｆ': 'f',
        'ｈ': 'h', 'ｊ': 'j', 'ｋ': 'k', 'ｌ': 'l', 'ｐ': 'p',
        'ｑ': 'q', 'ｕ': 'u', 'ｖ': 'v', 'ｗ': 'w', 'ｘ': 'x',
        'ｚ': 'z', 'Ａ': 'A', 'Ｂ': 'B', 'Ｃ': 'C', 'Ｄ': 'D',
        'Ｅ': 'E', 'Ｆ': 'F', 'Ｇ': 'G', 'Ｈ': 'H', 'Ｉ': 'I',
        'Ｊ': 'J', 'Ｋ': 'K', 'Ｌ': 'L', 'Ｍ': 'M', 'Ｎ': 'N',
        'Ｏ': 'O', 'Ｐ': 'P', 'Ｑ': 'Q', 'Ｒ': 'R', 'Ｓ': 'S',
        'Ｔ': 'T', 'Ｕ': 'U', 'Ｖ': 'V', 'Ｗ': 'W', 'Ｘ': 'X',
        'Ｙ': 'Y', 'Ｚ': 'Z', '０': '0', '１': '1', '２': '2',
        '３': '3', '４': '4', '５': '5', '６': '6', '７': '7',
        '８': '8', '９': '9'
    })
    
    def __init__(self, signatures_path: Optional[str] = None, 
                 config: Optional[Dict] = None):
        """
        Initialize the prompt filter.
        
        Args:
            signatures_path: Path to JSON signature database
            config: Optional configuration overrides
        """
        self.logger = logging.getLogger(__name__)
        self.config = config or {}
        
        # Load signatures
        if signatures_path is None:
            signatures_path = Path(__file__).parent / 'data' / 'prompt_injection_signatures.json'
        
        self.signatures = self._load_signatures(signatures_path)
        self.detection_config = self.signatures.get('detection_config', {})
        self.severity_weights = self.signatures.get('severity_weights', {
            'CRITICAL': 100, 'HIGH': 50, 'MEDIUM': 20, 'LOW': 5
        })
        
        # Compile regex patterns
        self._compiled_patterns: Dict[str, List[Tuple[str, re.Pattern]]] = {}
        self._compile_patterns()
        
        # Injection attempt log (in-memory, should be persisted)
        self._injection_log: List[InjectionAttempt] = []
        self._max_log_size = self.config.get('max_log_size', 1000)
        
        self.logger.info(f"PromptFilter initialized with {len(self.signatures.get('signatures', []))} signatures")
    
    def _load_signatures(self, path: Path) -> Dict:
        """Load signature database from JSON file"""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load signatures from {path}: {e}")
            return {'signatures': [], 'detection_config': {}}
    
    def _compile_patterns(self):
        """Pre-compile regex patterns for performance"""
        for sig in self.signatures.get('signatures', []):
            sig_id = sig['id']
            self._compiled_patterns[sig_id] = []
            
            for pattern in sig.get('patterns', []):
                try:
                    flags = re.IGNORECASE if sig.get('detection_mode') == 'case_insensitive' else 0
                    compiled = re.compile(pattern, flags | re.MULTILINE | re.DOTALL)
                    self._compiled_patterns[sig_id].append((pattern, compiled))
                except re.error as e:
                    self.logger.warning(f"Invalid regex pattern in {sig_id}: {e}")
    
    def scan_prompt(self, prompt: str, agent_id: str, 
                    context: Optional[Dict] = None) -> FilterResult:
        """
        Scan a prompt for injection attempts.
        
        Args:
            prompt: The prompt text to scan
            agent_id: Identifier for the agent receiving the prompt
            context: Optional context (skill_id, conversation_id, etc.)
            
        Returns:
            FilterResult with action and any matches
        """
        import time
        start_time = time.time()
        
        context = context or {}
        matches: List[MatchResult] = []
        
        # Preprocess prompt
        normalized_prompt = self._normalize_text(prompt)
        
        # Check each signature
        for sig in self.signatures.get('signatures', []):
            sig_matches = self._check_signature(sig, prompt, normalized_prompt)
            matches.extend(sig_matches)
        
        # Calculate risk score
        risk_score = self._calculate_risk_score(matches)
        
        # Determine action
        action, sanitized = self._determine_action(prompt, matches, risk_score)
        
        # Log injection attempts
        for match in matches:
            if match.severity in (Severity.CRITICAL, Severity.HIGH):
                self._log_injection_attempt(agent_id, match, prompt, context)
        
        processing_time = (time.time() - start_time) * 1000
        
        return FilterResult(
            action=action,
            original_prompt=prompt,
            sanitized_prompt=sanitized,
            is_blocked=action == FilterAction.BLOCK,
            is_sanitized=action == FilterAction.SANITIZE,
            matches=matches,
            risk_score=risk_score,
            matched_signatures=[m.signature_id for m in matches],
            processing_time_ms=processing_time,
            metadata={
                'agent_id': agent_id,
                'context': context,
                'signature_count': len(self.signatures.get('signatures', [])),
                'timestamp': datetime.utcnow().isoformat()
            }
        )
    
    def _check_signature(self, sig: Dict, original: str, 
                         normalized: str) -> List[MatchResult]:
        """Check a single signature against the prompt"""
        matches = []
        sig_id = sig['id']
        detection_mode = sig.get('detection_mode', 'case_insensitive')
        
        # Select text to scan based on detection mode
        if detection_mode == 'unicode_normalization':
            text_to_scan = normalized
        elif detection_mode == 'binary_scan':
            text_to_scan = original  # Check raw bytes
        else:
            text_to_scan = original
        
        # Get compiled patterns
        patterns = self._compiled_patterns.get(sig_id, [])
        
        for pattern_str, compiled in patterns:
            try:
                for match in compiled.finditer(text_to_scan):
                    # Calculate confidence based on match quality
                    confidence = self._calculate_confidence(match, sig)
                    
                    if confidence >= self.detection_config.get('min_match_confidence', 0.85):
                        matches.append(MatchResult(
                            signature_id=sig_id,
                            signature_name=sig['name'],
                            category=sig['category'],
                            severity=Severity(sig['severity']),
                            matched_pattern=pattern_str,
                            matched_text=match.group(0)[:100],  # Truncate long matches
                            position=match.start(),
                            confidence=confidence
                        ))
            except Exception as e:
                self.logger.debug(f"Pattern match error in {sig_id}: {e}")
        
        return matches
    
    def _calculate_confidence(self, match: re.Match, sig: Dict) -> float:
        """Calculate confidence score for a match"""
        base_confidence = 0.9
        
        # Adjust based on match length vs pattern
        match_len = len(match.group(0))
        pattern_avg = sum(len(p) for p in sig.get('patterns', [])) / len(sig.get('patterns', [1]))
        
        if match_len >= pattern_avg:
            base_confidence += 0.05
        
        # Adjust for exact vs partial matches
        if match.group(0).lower() == sig.get('example', '').lower()[:match_len]:
            base_confidence += 0.05
        
        return min(base_confidence, 1.0)
    
    def _calculate_risk_score(self, matches: List[MatchResult]) -> int:
        """Calculate aggregate risk score from matches"""
        if not matches:
            return 0
        
        score = 0
        categories_seen: Set[str] = set()
        
        for match in matches:
            # Base score from severity
            weight = self.severity_weights.get(match.severity.value, 5)
            score += weight
            
            # Bonus for category diversity (sophisticated attack)
            if match.category not in categories_seen:
                score += 10
                categories_seen.add(match.category)
            
            # CRITICAL matches auto-max
            if match.severity == Severity.CRITICAL:
                score += 50
        
        # Cap at 100
        return min(score, 100)
    
    def _determine_action(self, prompt: str, matches: List[MatchResult], 
                          risk_score: int) -> Tuple[FilterAction, Optional[str]]:
        """Determine the appropriate action for detected threats"""
        
        # CRITICAL severity = always block
        critical_matches = [m for m in matches if m.severity == Severity.CRITICAL]
        if critical_matches:
            return FilterAction.BLOCK, None
        
        # Check for blocked categories
        blocked_cats = set(self.detection_config.get('blocked_categories', ['GLOSSOPETRAE']))
        for match in matches:
            if match.category in blocked_cats:
                return FilterAction.BLOCK, None
        
        # High risk score = block
        if risk_score >= 70:
            return FilterAction.BLOCK, None
        
        # Medium risk = sanitize
        if risk_score >= 30:
            sanitized = self.sanitize_prompt(prompt, matches)
            return FilterAction.SANITIZE, sanitized
        
        # Low risk = flag but allow
        if risk_score > 0:
            return FilterAction.FLAG, prompt
        
        return FilterAction.ALLOW, prompt
    
    def sanitize_prompt(self, prompt: str, 
                        matches: Optional[List[MatchResult]] = None) -> str:
        """
        Sanitize a prompt by removing injection patterns.
        
        Args:
            prompt: The prompt to sanitize
            matches: Optional list of matches to target specifically
            
        Returns:
            Sanitized prompt string
        """
        sanitized = prompt
        
        # Apply sanitization rules
        rules = self.detection_config.get('sanitization_rules', {})
        max_depth = rules.get('max_replacement_depth', 3)
        
        for _ in range(max_depth):
            prev = sanitized
            
            if rules.get('remove_zero_width', True):
                for zw_char in self.ZERO_WIDTH_CHARS:
                    sanitized = sanitized.replace(zw_char, '')
            
            if rules.get('normalize_unicode', True):
                sanitized = self._normalize_text(sanitized)
                sanitized = unicodedata.normalize('NFKC', sanitized)
            
            # Replace detected patterns with [FILTERED]
            if matches:
                # Sort by position descending to replace from end
                sorted_matches = sorted(matches, key=lambda m: m.position, reverse=True)
                for match in sorted_matches:
                    pattern = match.matched_text
                    if len(pattern) > 5:  # Only replace substantial matches
                        sanitized = sanitized.replace(pattern, '[FILTERED]', 1)
            
            if sanitized == prev:
                break
        
        return sanitized
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for detection"""
        # Translate homoglyphs
        text = text.translate(self.HOMOGLYPH_MAP)
        # Unicode normalization
        text = unicodedata.normalize('NFKC', text)
        return text
    
    def _log_injection_attempt(self, agent_id: str, match: MatchResult, 
                               prompt: str, context: Dict):
        """Log an injection attempt for analysis"""
        attempt = InjectionAttempt(
            timestamp=datetime.utcnow(),
            agent_id=agent_id,
            signature_id=match.signature_id,
            severity=match.severity,
            prompt_excerpt=prompt[:200] + '...' if len(prompt) > 200 else prompt,
            prompt_hash=hashlib.sha256(prompt.encode()).hexdigest()[:16],
            context=context
        )
        
        self._injection_log.append(attempt)
        
        # Trim log if too large
        if len(self._injection_log) > self._max_log_size:
            self._injection_log = self._injection_log[-self._max_log_size:]
        
        # Also log to standard logger
        self.logger.warning(
            f"INJECTION_ATTEMPT: {match.signature_id} ({match.severity.value}) "
            f"Agent: {agent_id}, Category: {match.category}, "
            f"Pattern: {match.matched_pattern[:50]}"
        )
    
    def get_injection_history(self, agent_id: Optional[str] = None,
                              hours: int = 24) -> List[InjectionAttempt]:
        """Get recent injection attempts"""
        cutoff = datetime.utcnow() - __import__('datetime').timedelta(hours=hours)
        
        attempts = [a for a in self._injection_log if a.timestamp >= cutoff]
        
        if agent_id:
            attempts = [a for a in attempts if a.agent_id == agent_id]
        
        return attempts
    
    def get_stats(self) -> Dict:
        """Get filter statistics"""
        return {
            'signatures_loaded': len(self.signatures.get('signatures', [])),
            'total_attempts_logged': len(self._injection_log),
            'categories': list(set(
                s['category'] for s in self.signatures.get('signatures', [])
            )),
            'severity_distribution': {
                sev.value: len([s for s in self.signatures.get('signatures', [])
                               if s.get('severity') == sev.value])
                for sev in Severity
            }
        }
    
    def check_entropy(self, text: str) -> float:
        """Calculate Shannon entropy of text for obfuscation detection"""
        if not text:
            return 0.0
        
        freq = {}
        for char in text:
            freq[char] = freq.get(char, 0) + 1
        
        length = len(text)
        entropy = 0.0
        
        for count in freq.values():
            p = count / length
            entropy -= p * math.log2(p)
        
        return entropy
    
    def quick_scan(self, text: str) -> bool:
        """
        Quick scan for obviously malicious content.
        Returns True if text appears safe, False if suspicious.
        """
        # Check length
        if len(text) > self.detection_config.get('max_prompt_length', 100000):
            return False
        
        # Check entropy
        if self.detection_config.get('enable_entropy_analysis', True):
            entropy = self.check_entropy(text)
            if entropy > self.detection_config.get('entropy_threshold', 4.5):
                return False
        
        # Quick regex for common injections
        quick_patterns = [
            r'ignore\s+(all\s+)?(previous\s+)?instructions',
            r'\[\s*SYSTEM\s*',
            r'you\s+are\s+now\s+(DAN|unfiltered)',
        ]
        
        text_lower = text.lower()
        for pattern in quick_patterns:
            if re.search(pattern, text_lower):
                return False
        
        return True


# Convenience function for direct usage
def scan_prompt(prompt: str, agent_id: str = "unknown",
                signatures_path: Optional[str] = None) -> FilterResult:
    """
    Convenience function to scan a prompt without initializing a filter instance.
    
    Args:
        prompt: The prompt to scan
        agent_id: Agent identifier
        signatures_path: Optional path to signatures file
        
    Returns:
        FilterResult with scan results
    """
    filter_instance = PromptFilter(signatures_path=signatures_path)
    return filter_instance.scan_prompt(prompt, agent_id)


if __name__ == "__main__":
    # Simple CLI for testing
    import sys
    
    logging.basicConfig(level=logging.INFO)
    
    if len(sys.argv) > 1:
        test_prompt = sys.argv[1]
    else:
        test_prompt = input("Enter prompt to scan: ")
    
    result = scan_prompt(test_prompt, "test_agent")
    
    print(f"\n{'='*60}")
    print(f"SCAN RESULT")
    print(f"{'='*60}")
    print(f"Action: {result.action.value}")
    print(f"Risk Score: {result.risk_score}/100")
    print(f"Blocked: {result.is_blocked}")
    print(f"Matches: {len(result.matches)}")
    print(f"Processing Time: {result.processing_time_ms:.2f}ms")
    
    if result.matches:
        print(f"\nDetected Signatures:")
        for m in result.matches:
            print(f"  - {m.signature_id}: {m.signature_name} ({m.severity.value})")
    
    if result.sanitized_prompt:
        print(f"\nSanitized Prompt:")
        print(result.sanitized_prompt[:200] + "..." if len(result.sanitized_prompt) > 200 else result.sanitized_prompt)
