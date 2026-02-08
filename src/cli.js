#!/usr/bin/env node

/**
 * AgentGuard CLI
 * Security scanner for AI agents
 */

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const Scanner = require('./scanner');
const packageJson = require('../package.json');

const program = new Command();

program
  .name('agentguard')
  .description('Security assessment for AI agents')
  .version(packageJson.version);

program
  .command('scan')
  .description('Scan an agent for security issues')
  .argument('<path>', 'Path to agent directory')
  .option('-r, --rules <path>', 'Custom YARA rules directory')
  .option('-o, --output <format>', 'Output format (json|html|markdown)', 'json')
  .option('-s, --severity <level>', 'Minimum severity (critical|high|medium|low)', 'low')
  .option('--sbom', 'Generate Software Bill of Materials')
  .option('--audit-deps', 'Audit dependencies for vulnerabilities')
  .action(async (scanPath, options) => {
    console.log(chalk.blue('🔒 AgentGuard Security Scanner'));
    console.log(chalk.gray(`Scanning: ${path.resolve(scanPath)}\n`));

    const scanner = new Scanner(options);
    
    try {
      const results = await scanner.scan(scanPath);
      
      // Display results
      displayResults(results, options.output);
      
      // Exit with error code if critical issues found
      const criticalCount = results.issues.filter(i => i.severity === 'critical').length;
      if (criticalCount > 0) {
        console.log(chalk.red(`\n❌ ${criticalCount} critical issues found`));
        process.exit(1);
      }
      
      console.log(chalk.green('\n✅ Scan complete'));
    } catch (error) {
      console.error(chalk.red(`\n❌ Scan failed: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('rules')
  .description('List available YARA rules')
  .action(() => {
    const scanner = new Scanner();
    const rules = scanner.listRules();
    
    console.log(chalk.blue('📋 Available YARA Rules\n'));
    rules.forEach(rule => {
      console.log(`  ${chalk.cyan(rule.name)}`);
      console.log(`    ${chalk.gray(rule.description)}`);
      console.log(`    Severity: ${chalk.yellow(rule.severity)}`);
      console.log();
    });
  });

program
  .command('sbom')
  .description('Generate Software Bill of Materials')
  .argument('<path>', 'Path to agent directory')
  .option('-o, --output <path>', 'Output file path')
  .action(async (scanPath, options) => {
    console.log(chalk.blue('📦 Generating SBOM...'));
    
    const scanner = new Scanner();
    const sbom = await scanner.generateSBOM(scanPath);
    
    if (options.output) {
      const fs = require('fs');
      fs.writeFileSync(options.output, JSON.stringify(sbom, null, 2));
      console.log(chalk.green(`✅ SBOM saved to ${options.output}`));
    } else {
      console.log(JSON.stringify(sbom, null, 2));
    }
  });

function displayResults(results, format) {
  switch (format) {
    case 'json':
      console.log(JSON.stringify(results, null, 2));
      break;
    case 'html':
      console.log('HTML output not yet implemented. Use JSON for now.');
      break;
    case 'markdown':
      displayMarkdown(results);
      break;
    default:
      displayConsole(results);
  }
}

function displayConsole(results) {
  if (results.issues.length === 0) {
    console.log(chalk.green('✅ No security issues found'));
    return;
  }

  const grouped = groupBySeverity(results.issues);
  
  if (grouped.critical) {
    console.log(chalk.red.bold('\n🔴 Critical Issues:'));
    grouped.critical.forEach(i => printIssue(i));
  }
  
  if (grouped.high) {
    console.log(chalk.red('\n🟠 High Issues:'));
    grouped.high.forEach(i => printIssue(i));
  }
  
  if (grouped.medium) {
    console.log(chalk.yellow('\n🟡 Medium Issues:'));
    grouped.medium.forEach(i => printIssue(i));
  }
  
  if (grouped.low) {
    console.log(chalk.blue('\n🔵 Low Issues:'));
    grouped.low.forEach(i => printIssue(i));
  }

  console.log(chalk.gray(`\nTotal: ${results.issues.length} issues`));
}

function printIssue(issue) {
  console.log(`  ${chalk.bold(issue.rule)}`);
  console.log(`    ${issue.description}`);
  console.log(`    File: ${chalk.underline(issue.file)}:${issue.line}`);
  console.log();
}

function groupBySeverity(issues) {
  return issues.reduce((acc, issue) => {
    (acc[issue.severity] = acc[issue.severity] || []).push(issue);
    return acc;
  }, {});
}

program.parse();
