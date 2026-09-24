const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const pages = [
  ['index.html', 'excelSheet'],
  ['profile-data/index.html', 'profileExcelSheet'],
  ['clean-data/index.html', 'cleanExcelSheet'],
  ['data-contract/index.html', 'baselineExcelSheet'],
  ['data-contract/index.html', 'candidateExcelSheet'],
  ['projects/run/index.html', 'runnerExcelSheet']
];

for (const [file, selectorId] of pages) {
  const html = read(file);
  assert.ok(html.includes('/excel-core.js'), `${file} must load excel-core.js`);
  assert.ok(html.includes(`id="${selectorId}"`), `${file} must expose worksheet selector ${selectorId}`);
  assert.ok(html.includes(`for="${selectorId}"`), `${file} must label worksheet selector ${selectorId}`);
}

const scripts = [
  'app.js',
  'profile-data/profile-data.js',
  'clean-data/clean-data.js',
  'data-contract/data-contract.js',
  'projects/run/runner.js'
];

for (const file of scripts) {
  const js = read(file);
  assert.ok(js.includes("excel_sheet_selected"), `${file} must track worksheet selection`);
  assert.ok(js.includes('sheet_count'), `${file} must track only worksheet count/index metadata`);
  assert.ok(js.includes('sheet_index'), `${file} must track only worksheet count/index metadata`);
  const eventMatch = js.match(/track\(['"]excel_sheet_selected['"]\s*,\s*\{([\s\S]*?)\}\s*\)/);
  assert.ok(eventMatch, `${file} must expose the worksheet-selection analytics event`);
  assert.ok(!/(?:sheet_name|sheetName)\s*:/.test(eventMatch[1]),
    `${file} must not send worksheet names to analytics`);
}

const profiler = read('profile-data/profile-data.js');
const worker = read('profile-worker.js');
assert.ok(profiler.includes('WORKER_CELL_THRESHOLD'), 'Profiler must keep a large-dataset worker threshold');
assert.ok(profiler.includes("new Worker('/profile-worker.js')"), 'Profiler must offload large profiling work');
assert.ok(profiler.includes('fallback_main_thread'), 'Profiler must preserve a worker fallback');
assert.ok(worker.includes("importScripts('/data-core.js')"), 'Profile worker must reuse the tested data core');
assert.ok(worker.includes("payload.type !== 'profile'"), 'Profile worker must reject unsupported operations');

const runner = read('projects/run/runner.js');
const workflowWorker = read('workflow-worker.js');
assert.ok(runner.includes("new Worker('/workflow-worker.js')"), 'Runner must offload large workflows');
assert.ok(runner.includes('fallback_main_thread'), 'Runner must preserve a workflow worker fallback');
assert.ok(runner.includes("processing_mode:executed.processingMode"), 'Runner must measure worker/main-thread execution mode');
assert.ok(workflowWorker.includes("importScripts('/data-core.js', '/contract-core.js', '/workflow-core.js')"),
  'Workflow worker must reuse tested workflow cores');
assert.ok(workflowWorker.includes("payload.type !== 'run_workflow'"),
  'Workflow worker must reject unsupported operations');

const projectCore = read('project-core.js');
assert.ok(projectCore.includes("EXPORT_FORMAT = 'rowmend-project'"), 'Projects must use a versioned export envelope');
assert.ok(projectCore.includes('inspectProjectExport'), 'Projects must inspect import compatibility');
assert.ok(projectCore.includes('revision:'), 'Projects must expose configuration revisions');

const feedback = read('feedback.js');
const onboarding = read('onboarding.js');
assert.ok(feedback.includes("track('pro_interest', { source:'pricing' })"),
  'Pricing CTA must emit explicit commercial-intent analytics');
assert.ok(onboarding.includes("track('pro_interest', { source:'onboarding' })"),
  'Onboarding CTA must emit explicit commercial-intent analytics');
assert.ok(feedback.includes("openFeedback('pro_interest')"),
  'Pricing CTA must open the Pro feedback flow');
assert.ok(onboarding.includes("openFeedback('onboarding_pro')"),
  'Onboarding CTA must open the Pro feedback flow');

console.log('Scale & Trust wiring tests passed');
