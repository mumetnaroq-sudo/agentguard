const Scanner = require('../src/scanner');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('Scanner', () => {
  let tempDir;
  let scanner;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentguard-scan-'));
    scanner = new Scanner();
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('should scan empty directory', async () => {
    const results = await scanner.scan(tempDir);
    expect(results.issues).toEqual([]);
    expect(results.summary.total).toBe(0);
  });

  test('should detect eval usage', async () => {
    fs.writeFileSync(path.join(tempDir, 'test.js'), 'eval("dangerous code");');
    const results = await scanner.scan(tempDir);
    expect(results.issues.length).toBeGreaterThan(0);
    expect(results.issues.some(i => i.rule === 'eval-usage')).toBe(true);
  });

  test('should detect hardcoded secrets', async () => {
    fs.writeFileSync(path.join(tempDir, 'app.js'), `
      const apiKey = 'AKIAIOSFODNN7EXAMPLE1234';
      const password = 'supersecret123';
    `);
    const results = await scanner.scan(tempDir);
    expect(results.issues.some(i => i.category === 'secret')).toBe(true);
  });

  test('should generate SBOM', async () => {
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'test-app',
      version: '1.0.0',
      dependencies: {
        'lodash': '^4.17.21'
      }
    }));
    
    const sbom = await scanner.generateSBOM(tempDir);
    expect(sbom.specVersion).toBe('1.4');
    expect(sbom.components.length).toBeGreaterThan(0);
    expect(sbom.components[0].name).toBe('test-app');
  });

  test('should list available rules', () => {
    const rules = scanner.listRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules[0]).toHaveProperty('name');
    expect(rules[0]).toHaveProperty('severity');
    expect(rules[0]).toHaveProperty('description');
  });
});
