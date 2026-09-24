const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'projects/run/index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'projects/run/runner.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'projects/run/runner.css'), 'utf8');
const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');

assert.ok(html.includes('/insights-core.js'), 'Runner must load insights-core.js');
assert.ok(html.includes('WORKFLOW RUNNER · V0.10.0 DEV'), 'Runner must show 0.10.0 development version');
['runnerInsights','baselineRun','downloadInsights','runnerInsightsSummary','runnerInsightMetrics','runnerTrends','runnerSignals']
  .forEach(id => assert.ok(html.includes(`id="${id}"`), `Missing runner insights element: ${id}`));

assert.ok(js.includes('window.RowMendInsights'), 'Runner must wire the insights API');
assert.ok(js.includes('projectCore.setRunBaseline'), 'Runner must persist explicit baselines');
assert.ok(js.includes('insightsCore.compareRuns'), 'Runner must compare runs');
assert.ok(js.includes('rowmend-run-insights.json'), 'Runner must export an insights report');
assert.ok(js.includes("rowmendVersion:'0.10.0-dev'"), 'Runner reports must identify 0.10.0 development version');
assert.ok(js.includes('configuration r${project.revision || 1}'), 'Runner must expose the active project revision');
assert.ok(js.includes('pinned baseline'), 'Runner history must identify a pinned baseline');

assert.ok(css.includes('.runner-insights'), 'Runner insights styles missing');
assert.ok(css.includes('.runner-side>a.btn.full'), 'Runner button-overlap fix missing');

assert.ok(/structural metrics used for local drift analysis/i.test(privacy), 'Privacy notice must disclose local structural metrics');
assert.ok(/does not store source rows, cell values, file names, SQL text/i.test(privacy), 'Privacy notice must preserve raw-data exclusions');

console.log('Runner wiring tests passed');
