const core = require('@actions/core');
const github = require('@actions/github');
const Scanner = require('../src/scanner');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    // Get inputs
    const scanPath = core.getInput('path') || './';
    const failOnCritical = core.getInput('fail-on-critical') === 'true';
    const rulesPath = core.getInput('rules-path');
    
    console.log('🔒 AgentGuard Security Scan');
    console.log(`Scanning: ${scanPath}\n`);

    // Initialize scanner
    const scanner = new Scanner({ rules: rulesPath });
    
    // Run scan
    const results = await scanner.scan(scanPath);
    
    // Display results
    displayResults(results);
    
    // Save report
    const reportPath = path.join(process.env.GITHUB_WORKSPACE || '.', 'agentguard-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    core.setOutput('report', reportPath);
    
    // Set annotations for GitHub
    for (const issue of results.issues) {
      const annotation = {
        file: issue.file,
        line: issue.line,
        message: issue.description,
        severity: issue.severity === 'critical' || issue.severity === 'high' ? 'error' : 'warning'
      };
      
      if (issue.severity === 'critical' || issue.severity === 'high') {
        core.error(issue.description, annotation);
      } else {
        core.warning(issue.description, annotation);
      }
    }
    
    // Fail if critical issues found
    const criticalCount = results.issues.filter(i => i.severity === 'critical').length;
    if (failOnCritical && criticalCount > 0) {
      core.setFailed(`${criticalCount} critical security issues found`);
    }
    
    console.log(`\n✅ Scan complete. Report saved to ${reportPath}`);
    
  } catch (error) {
    core.setFailed(`Scan failed: ${error.message}`);
  }
}

function displayResults(results) {
  console.log('\n📊 Scan Summary');
  console.log(`Total Issues: ${results.summary.total}`);
  console.log(`Critical: ${results.summary.critical}`);
  console.log(`High: ${results.summary.high}`);
  console.log(`Medium: ${results.summary.medium}`);
  console.log(`Low: ${results.summary.low}`);
  
  if (results.issues.length > 0) {
    console.log('\n🚨 Issues Found:\n');
    
    const critical = results.issues.filter(i => i.severity === 'critical');
    const high = results.issues.filter(i => i.severity === 'high');
    
    if (critical.length > 0) {
      console.log('Critical:');
      critical.forEach(i => console.log(`  ❌ ${i.rule}: ${i.description} (${i.file}:${i.line})`));
    }
    
    if (high.length > 0) {
      console.log('\nHigh:');
      high.forEach(i => console.log(`  ⚠️  ${i.rule}: ${i.description} (${i.file}:${i.line})`));
    }
  }
}

run();
