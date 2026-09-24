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
  assert.ok(!/track\(['"]excel_sheet_selected['"][\s\S]{0,400}(sheet_name|sheetName)/.test(js),
    `${file} must not send worksheet names to analytics`);
}

const profiler = read('profile-data/profile-data.js');
const worker = read('profile-worker.js');
assert.ok(profiler.includes('WORKER_CELL_THRESHOLD'), 'Profiler must keep a large-dataset worker threshold');
assert.ok(profiler.includes("new Worker('/profile-worker.js')"), 'Profiler must offload large profiling work');
assert.ok(profiler.includes('fallback_main_thread'), 'Profiler must preserve a worker fallback');
assert.ok(worker.includes("importScripts('/data-core.js')"), 'Profile worker must reuse the tested data core');
assert.ok(worker.includes("payload.type !== 'profile'"), 'Profile worker must reject unsupported operations');

const projectCore = read('project-core.js');
assert.ok(projectCore.includes("EXPORT_FORMAT = 'rowmend-project'"), 'Projects must use a versioned export envelope');
assert.ok(projectCore.includes('inspectProjectExport'), 'Projects must inspect import compatibility');
assert.ok(projectCore.includes('revision:'), 'Projects must expose configuration revisions');

console.log('Scale & Trust wiring tests passed');
