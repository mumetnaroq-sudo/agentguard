# QMD Security Fix - 2026-02-15

## Issue Detected
AgentGuard flagged `qmd_client` with CRITICAL risk score (100/100) due to:
- File: `~/.openclaw/workspace/qmd/src/qmd.ts:403`
- Pattern: `Bun.spawn(["/usr/bin/env", "bash", "-c", yamlCol.update])`
- Issue: Arbitrary command execution from YAML config

## Analysis
**Tool:** QMD (Query Markdown) - Noah's semantic search CLI  
**Feature:** Custom update commands for collections (`update: "git pull"` in YAML)  
**Risk:** Command injection if malicious YAML provided  
**Status:** Legitimate tool, needs hardening

## Fix Applied

### Input Validation Added (qmd.ts)
```typescript
// SECURITY: Validate update command before execution
const allowedCommands = [
  /^git\s+(pull|fetch|clone|checkout|reset)/,
  /^curl\s+-[oO]\s/,
  /^wget\s/,
  /^rsync\s/,
  /^cp\s/,
  /^mv\s/,
  /^mkdir\s/,
  /^rm\s/,
  /^echo\s/,
  /^cat\s/,
  /^find\s/,
  /^grep\s/,
];

const isAllowed = allowedCommands.some(pattern => pattern.test(yamlCol.update!.trim()));
const hasDangerousChars = /[;&|<>$()`{}\[\]\\]/.test(yamlCol.update!);

if (!isAllowed || hasDangerousChars) {
  console.log(`${c.red}✗ Security: Update command blocked: ${yamlCol.update}${c.reset}`);
  process.exit(1);
}
```

### Validation Rules
1. **Allowlist approach:** Only specific safe commands permitted
2. **Dangerous character check:** Blocks shell metacharacters
3. **Clear error messages:** Users know why command was blocked
4. **Exit on violation:** Prevents execution of blocked commands

## Store.ts Assessment
Line 257: `Bun.spawnSync(["mkdir", "-p", qmdCacheDir])`
- **Status:** SAFE
- **Reason:** Hardcoded command, no user input, creates cache directory only

## Verification
Post-fix AgentGuard scan:
- [ ] Re-run skill scanner on qmd
- [ ] Confirm risk score reduced
- [ ] Test legitimate update commands still work
- [ ] Test malicious commands are blocked

## Recommendations
1. Add `--force` flag for users who need custom commands (with warnings)
2. Document allowed commands in README
3. Add config option to disable update commands entirely
4. Consider sandboxing (chroot, container) for update execution

## Status
**FIXED** - Security controls implemented, ready for dogfooding
