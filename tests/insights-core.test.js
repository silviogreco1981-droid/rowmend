const assert = require('assert');
const insights = require('../insights-core.js');

const previous = {
  id:'run-1',
  status:'PASS',
  startedAt:'2026-09-20T08:00:00.000Z',
  durationMs:100,
  inputRows:100,
  outputRows:100,
  invalidRows:0,
  contractErrors:0,
  contractWarnings:0,
  configFingerprint:'aaaa1111',
  profileMetrics:{
    rows:100,
    columns:3,
    completeness:0.99,
    duplicateRows:0,
    mixedColumns:0,
    allMissingColumns:0,
    columnMetrics:[
      {name:'ID',type:'number',missingRate:0,uniqueRate:1,mixedTypeRate:0},
      {name:'EMAIL',type:'string',missingRate:0.01,uniqueRate:0.98,mixedTypeRate:0},
      {name:'AMOUNT',type:'number',missingRate:0,uniqueRate:0.8,mixedTypeRate:0}
    ]
  }
};

const current = {
  id:'run-2',
  status:'REVIEW_REQUIRED',
  startedAt:'2026-09-23T08:00:00.000Z',
  durationMs:160,
  inputRows:70,
  outputRows:69,
  invalidRows:3,
  contractErrors:1,
  contractWarnings:1,
  configFingerprint:'bbbb2222',
  profileMetrics:{
    rows:69,
    columns:3,
    completeness:0.90,
    duplicateRows:2,
    mixedColumns:1,
    allMissingColumns:0,
    columnMetrics:[
      {name:'ID',type:'number',missingRate:0,uniqueRate:0.97,mixedTypeRate:0},
      {name:'EMAIL',type:'string',missingRate:0.12,uniqueRate:0.80,mixedTypeRate:0},
      {name:'AMOUNT',type:'string',missingRate:0,uniqueRate:0.79,mixedTypeRate:0.15}
    ]
  }
};

{
  const comparison = insights.compareRuns(current, previous);
  assert.strictEqual(comparison.configChanged, true);
  assert.strictEqual(comparison.metrics.inputRows.delta, -30);
  assert.strictEqual(Math.round(comparison.metrics.inputRows.percentChange * 100), -30);
  assert.strictEqual(comparison.metrics.invalidRows.delta, 3);
  assert.ok(comparison.signals.some(item => item.id === 'workflow_config_changed'));
  assert.ok(comparison.signals.some(item => item.id === 'row_count_shift'));
  assert.ok(comparison.signals.some(item => item.id === 'completeness_drop'));
  assert.ok(comparison.signals.some(item => item.id === 'duplicate_rows_increased'));
  assert.ok(comparison.signals.some(item => item.id === 'type_changed:AMOUNT'));
  assert.ok(comparison.signals.some(item => item.id === 'missing_rate_increased:EMAIL'));
  assert.ok(comparison.signals.some(item => item.id === 'uniqueness_dropped:EMAIL'));
}

{
  const columns = insights.compareColumns(current, previous);
  const amount = columns.find(column => column.name === 'AMOUNT');
  assert.strictEqual(amount.typeChanged, true);
  assert.strictEqual(amount.baselineType, 'number');
  assert.strictEqual(amount.currentType, 'string');
}

{
  const series = insights.historySeries([current, previous]);
  assert.strictEqual(series.length, 2);
  assert.strictEqual(series[0].id, 'run-1');
  assert.strictEqual(series[1].id, 'run-2');
}

{
  const report = insights.buildHistoryInsights([previous, current]);
  assert.strictEqual(report.latest.id, 'run-2');
  assert.strictEqual(report.previous.id, 'run-1');
  assert.ok(report.comparison);
}

{
  const report = insights.buildHistoryInsights([current]);
  assert.strictEqual(report.latest.id, 'run-2');
  assert.strictEqual(report.previous, null);
  assert.strictEqual(report.comparison, null);
}

console.log('Insights core tests passed');
