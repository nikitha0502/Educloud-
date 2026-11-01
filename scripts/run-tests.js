const fs = require('fs');
const path = require('path');

// Setup mock browser globals
global.window = global;
const storage = {};
global.localStorage = {
  getItem: (k) => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
global.File = class {
  constructor(parts, name, opts = {}) {
    this.name = name;
    this.type = opts.type || '';
    this.size = parts.reduce((acc, p) => acc + (p.byteLength || p.length || 0), 0);
  }
};
global.document = {
  getElementById: (id) => ({
    textContent: '',
    style: {},
    classList: { add: () => {}, remove: () => {} },
    innerHTML: '',
    disabled: false
  })
};

// Load frontend source files
eval(fs.readFileSync(path.join(__dirname, '../frontend/js/config.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../frontend/js/utils.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../frontend/js/mock-db.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../frontend/js/api.js'), 'utf8'));

// Extract tests from test-runner.html
const html = fs.readFileSync(path.join(__dirname, '../frontend/pages/test-runner.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!scriptMatch) throw new Error('No script found in test-runner.html');

let script = scriptMatch[1];
const testDefs = script.substring(0, script.indexOf('// ─── Test Runner'));

// Replace const TestRunner with global.TestRunner
const modifiedDefs = testDefs.replace('const TestRunner =', 'global.TestRunner =');

eval(modifiedDefs);


(async () => {
  try {
    const results = await TestRunner.run();
    console.log(`\n========================================`);
    console.log(`EduCloud Browser Test Suite Execution`);
    console.log(`========================================`);
    console.log(`Total: ${results.total} | Passed: ${results.pass} | Failed: ${results.fail} | Time: ${results.elapsed}ms\n`);

    results.suites.forEach(suite => {
      const suitePass = suite.tests.filter(t => t.status === 'pass').length;
      const suiteFail = suite.tests.filter(t => t.status === 'fail').length;
      console.log(`${suite.name}: ${suitePass}/${suite.tests.length} passed`);
      suite.tests.filter(t => t.status === 'fail').forEach(t => {
        console.error(`  FAIL: ${t.name} -> ${t.error}`);
      });
    });

    if (results.fail === 0) {
      console.log(`\n🎉 All ${results.total} frontend tests passed perfectly!`);
      process.exit(0);
    } else {
      console.error(`\n❌ ${results.fail} test(s) failed.`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Test run failed:', err);
    process.exit(1);
  }
})();
