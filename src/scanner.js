/**
 * AgentGuard Scanner
 * Core security scanning engine
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

class Scanner {
  constructor(options = {}) {
    this.options = options;
    this.rules = this.loadRules();
    this.issues = [];
  }

  async scan(scanPath) {
    const absolutePath = path.resolve(scanPath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Path does not exist: ${absolutePath}`);
    }

    // Run all scan modules
    await this.scanYARA(absolutePath);
    await this.scanDependencies(absolutePath);
    await this.scanCodeSigning(absolutePath);
    await this.scanSecrets(absolutePath);
    await this.scanPermissions(absolutePath);

    return {
      timestamp: new Date().toISOString(),
      path: absolutePath,
      issues: this.issues,
      summary: this.generateSummary()
    };
  }

  async scanYARA(scanPath) {
    // YARA pattern matching for malicious code patterns
    const yaraRules = this.loadYaraRules();
    
    const files = this.getFiles(scanPath, ['.js', '.ts', '.py', '.json']);
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      
      for (const rule of yaraRules) {
        if (rule.pattern.test(content)) {
          this.issues.push({
            rule: rule.name,
            severity: rule.severity,
            description: rule.description,
            file: path.relative(scanPath, file),
            line: this.findLineNumber(content, rule.pattern),
            category: 'yara'
          });
        }
      }
    }
  }

  async scanDependencies(scanPath) {
    // Check package.json for known vulnerabilities
    const packageJsonPath = path.join(scanPath, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Check against known vulnerable packages (simplified)
      const vulnerablePackages = this.getVulnerablePackages();
      
      for (const [name, version] of Object.entries(deps)) {
        const vuln = vulnerablePackages[name];
        if (vuln && this.isVersionAffected(version, vuln.affected)) {
          this.issues.push({
            rule: 'vulnerable-dependency',
            severity: vuln.severity,
            description: `${name}@${version} is vulnerable: ${vuln.description}`,
            file: 'package.json',
            line: 0,
            category: 'dependency',
            remediation: vuln.fix
          });
        }
      }
    }
  }

  async scanCodeSigning(scanPath) {
    // Verify code signing certificates
    const signatures = this.findSignatures(scanPath);
    
    for (const sig of signatures) {
      if (!this.verifySignature(sig)) {
        this.issues.push({
          rule: 'invalid-signature',
          severity: 'high',
          description: `Invalid or missing code signature: ${sig.file}`,
          file: sig.file,
          line: 0,
          category: 'signing'
        });
      }
    }
  }

  async scanSecrets(scanPath) {
    // Scan for hardcoded secrets
    const secretPatterns = [
      { name: 'aws-key', pattern: /AKIA[0-9A-Z]{16}/, severity: 'critical' },
      { name: 'private-key', pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/, severity: 'critical' },
      { name: 'api-key', pattern: /api[_-]?key["\']?\s*[:=]\s*["\']?[a-zA-Z0-9]{32,}/i, severity: 'high' },
      { name: 'password', pattern: /password["\']?\s*[:=]\s*["\'][^"\']{8,}/i, severity: 'high' },
      { name: 'secret', pattern: /secret["\']?\s*[:=]\s*["\'][^"\']{8,}/i, severity: 'high' },
      { name: 'token', pattern: /token["\']?\s*[:=]\s*["\'][^"\']{16,}/i, severity: 'high' }
    ];

    const files = this.getFiles(scanPath, ['.js', '.ts', '.py', '.json', '.yml', '.yaml', '.env']);
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      
      for (const pattern of secretPatterns) {
        if (pattern.pattern.test(content)) {
          // Check if it's in an example/test file
          if (!file.includes('example') && !file.includes('test')) {
            this.issues.push({
              rule: `secret-${pattern.name}`,
              severity: pattern.severity,
              description: `Potential hardcoded secret detected: ${pattern.name}`,
              file: path.relative(scanPath, file),
              line: this.findLineNumber(content, pattern.pattern),
              category: 'secret'
            });
          }
        }
      }
    }
  }

  async scanPermissions(scanPath) {
    // Check for overly permissive file permissions
    const sensitiveFiles = [
      'package.json',
      '.env',
      'config.json',
      'credentials.json'
    ];

    for (const filename of sensitiveFiles) {
      const filepath = path.join(scanPath, filename);
      if (fs.existsSync(filepath)) {
        const stats = fs.statSync(filepath);
        const mode = stats.mode;
        
        // Check if world-readable or world-writable
        if (mode & 0o044 || mode & 0o022) {
          this.issues.push({
            rule: 'weak-permissions',
            severity: 'medium',
            description: `${filename} has overly permissive permissions`,
            file: filename,
            line: 0,
            category: 'permissions',
            remediation: `chmod 600 ${filename}`
          });
        }
      }
    }
  }

  loadYaraRules() {
    // Built-in YARA-like rules for common threats
    return [
      {
        name: 'eval-usage',
        pattern: /\beval\s*\(/,
        severity: 'high',
        description: 'Dangerous eval() usage detected'
      },
      {
        name: 'exec-usage',
        pattern: /\b(exec|execSync|spawn)\s*\(/,
        severity: 'medium',
        description: 'Process execution detected - verify input sanitization'
      },
      {
        name: 'dangerous-import',
        pattern: /require\s*\(\s*['"]child_process['"]\s*\)/,
        severity: 'medium',
        description: 'child_process import detected'
      },
      {
        name: 'network-request',
        pattern: /\b(fetch|axios|request)\s*\(/,
        severity: 'low',
        description: 'Network request detected'
      },
      {
        name: 'file-system-access',
        pattern: /\b(fs\.|readFile|writeFile)\s*\(/,
        severity: 'low',
        description: 'File system access detected'
      },
      {
        name: 'dynamic-import',
        pattern: /\bimport\s*\(/,
        severity: 'medium',
        description: 'Dynamic import detected - verify source'
      },
      {
        name: 'obfuscated-code',
        pattern: /eval\s*\(\s*atob|Buffer\.from\s*\([^)]+\)\s*\.toString\s*\(\s*['"]utf8['"]\s*\)/,
        severity: 'critical',
        description: 'Potentially obfuscated code detected'
      },
      {
        name: 'hardcoded-url',
        pattern: /https?:\/\/(?!localhost|127\.0\.0\.1)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
        severity: 'low',
        description: 'Hardcoded external URL detected'
      }
    ];
  }

  loadRules() {
    // Load custom rules if specified
    if (this.options.rules) {
      const rulesPath = path.resolve(this.options.rules);
      if (fs.existsSync(rulesPath)) {
        // Load custom rules from directory
        return this.loadYaraRules(); // + custom rules
      }
    }
    return this.loadYaraRules();
  }

  listRules() {
    return this.loadYaraRules();
  }

  async generateSBOM(scanPath) {
    const absolutePath = path.resolve(scanPath);
    const sbom = {
      specVersion: '1.4',
      serialNumber: `urn:uuid:${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      components: []
    };

    // Analyze package.json
    const packageJsonPath = path.join(absolutePath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Main component
      sbom.components.push({
        type: 'application',
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        licenses: packageJson.license ? [{ license: { id: packageJson.license } }] : [],
        purl: `pkg:npm/${packageJson.name}@${packageJson.version}`
      });

      // Dependencies
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      for (const [name, version] of Object.entries(deps)) {
        sbom.components.push({
          type: 'library',
          name,
          version: version.replace(/[^0-9.]/g, ''),
          purl: `pkg:npm/${name}@${version}`
        });
      }
    }

    // Analyze Python requirements
    const requirementsPath = path.join(absolutePath, 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
      const requirements = fs.readFileSync(requirementsPath, 'utf8');
      const lines = requirements.split('\n');
      
      for (const line of lines) {
        const match = line.match(/^([a-zA-Z0-9_-]+)==?([0-9.]+)/);
        if (match) {
          sbom.components.push({
            type: 'library',
            name: match[1],
            version: match[2],
            purl: `pkg:pypi/${match[1]}@${match[2]}`
          });
        }
      }
    }

    return sbom;
  }

  getFiles(dir, extensions) {
    const files = [];
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        files.push(...this.getFiles(fullPath, extensions));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }

  findLineNumber(content, pattern) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        return i + 1;
      }
    }
    return 0;
  }

  getVulnerablePackages() {
    // Simplified vulnerability database
    return {
      'lodash': {
        affected: '<4.17.21',
        severity: 'critical',
        description: 'Prototype pollution vulnerability',
        fix: 'Update to lodash@4.17.21 or later'
      },
      'axios': {
        affected: '<0.21.1',
        severity: 'high',
        description: 'Server-side request forgery',
        fix: 'Update to axios@0.21.1 or later'
      }
    };
  }

  isVersionAffected(version, affectedRange) {
    // Simplified version comparison
    return true; // Placeholder
  }

  findSignatures(scanPath) {
    // Find code signature files
    return []; // Placeholder
  }

  verifySignature(sig) {
    // Verify code signature
    return true; // Placeholder
  }

  generateSummary() {
    const summary = {
      total: this.issues.length,
      critical: this.issues.filter(i => i.severity === 'critical').length,
      high: this.issues.filter(i => i.severity === 'high').length,
      medium: this.issues.filter(i => i.severity === 'medium').length,
      low: this.issues.filter(i => i.severity === 'low').length,
      categories: {}
    };

    for (const issue of this.issues) {
      summary.categories[issue.category] = (summary.categories[issue.category] || 0) + 1;
    }

    return summary;
  }
}

module.exports = Scanner;
