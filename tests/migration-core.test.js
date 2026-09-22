const assert = require('assert');
const core = require('../migration-core.js');

function compare(sourceRows, targetRows, keyMappings, columnMappings, options = {}) {
  return core.compareDatasets({ sourceRows, targetRows, keyMappings, columnMappings, options });
}

const mappings = [
  { sourceColumn: 'ID', targetColumn: 'id', compare: true },
  { sourceColumn: 'NAME', targetColumn: 'name', compare: true },
  { sourceColumn: 'EMAIL', targetColumn: 'email', compare: true }
];
const keys = [{ sourceColumn: 'ID', targetColumn: 'id' }];

let result = compare(
  [{ ID: '1', NAME: 'Alice', EMAIL: 'a@x.com' }],
  [{ id: '1', name: 'Alice', email: 'a@x.com' }],
  keys, mappings
);
assert.strictEqual(result.summary.hasIssues, false);
assert.strictEqual(result.summary.matched, 1);

result = compare(
  [{ ID: '1', NAME: 'Alice', EMAIL: 'a@x.com' }, { ID: '2', NAME: 'Bob', EMAIL: 'b@x.com' }],
  [{ id: '1', name: 'Alice', email: 'new@x.com' }, { id: '3', name: 'Cara', email: 'c@x.com' }],
  keys, mappings
);
assert.strictEqual(result.summary.changed, 1);
assert.strictEqual(result.changed[0].differences.length, 1);
assert.strictEqual(result.summary.missing, 1);
assert.strictEqual(result.summary.extra, 1);

result = compare(
  [{ COMPANY: 'A', ID: '1', NAME: ' Alice ' }],
  [{ company: 'A', id: '1', name: 'Alice' }],
  [{ sourceColumn: 'COMPANY', targetColumn: 'company' }, { sourceColumn: 'ID', targetColumn: 'id' }],
  [{ sourceColumn: 'NAME', targetColumn: 'name', compare: true }],
  { trimWhitespace: true }
);
assert.strictEqual(result.summary.matched, 1);

result = compare(
  [{ ID: '1', NAME: 'ALICE' }],
  [{ id: '1', name: 'alice' }],
  keys,
  [{ sourceColumn: 'NAME', targetColumn: 'name', compare: true }],
  { caseInsensitive: true }
);
assert.strictEqual(result.summary.matched, 1);

result = compare(
  [{ ID: '1', NOTE: '' }],
  [{ id: '1', note: null }],
  keys,
  [{ sourceColumn: 'NOTE', targetColumn: 'note', compare: true }],
  { emptyEqualsNull: true }
);
assert.strictEqual(result.summary.matched, 1);

result = compare(
  [{ ID: '1', NAME: 'Alice' }, { ID: '1', NAME: 'Alice 2' }],
  [{ id: '1', name: 'Alice' }],
  keys,
  [{ sourceColumn: 'NAME', targetColumn: 'name', compare: true }]
);
assert.strictEqual(result.summary.sourceDuplicates, 1);
assert.strictEqual(result.summary.matched, 0);
assert.strictEqual(result.summary.changed, 0);

result = compare(
  [{ ID: '1', NAME: 'Alice' }],
  [{ id: '1', name: 'Alice' }, { id: '1', name: 'Alice duplicate' }],
  keys,
  [{ sourceColumn: 'NAME', targetColumn: 'name', compare: true }]
);
assert.strictEqual(result.summary.targetDuplicates, 1);
assert.strictEqual(result.summary.matched, 0);
assert.strictEqual(result.summary.changed, 0);

result = compare(
  [{ ID: '1', NAME: 'Alice', EMAIL: 'a@x.com' }],
  [{ email: 'a@x.com', name: 'Alice', id: '1' }],
  keys,
  mappings
);
assert.strictEqual(result.summary.matched, 1);

result = compare(
  [{ ID: '1', A: 'x', B: 'y' }],
  [{ id: '1', a: 'xx', b: 'yy' }],
  keys,
  [{ sourceColumn: 'A', targetColumn: 'a', compare: true }, { sourceColumn: 'B', targetColumn: 'b', compare: true }]
);
assert.strictEqual(result.summary.changed, 1);
assert.strictEqual(result.changed[0].differences.length, 2);

const auto = core.autoMapColumns(['CUSTOMER_ID', 'First Name', 'UNMAPPED'], ['customer_id', 'first_name', 'OTHER']);
assert.strictEqual(auto[0].targetColumn, 'customer_id');
assert.strictEqual(auto[1].targetColumn, 'first_name');
assert.strictEqual(auto[2].targetColumn, '');

const csv = core.issuesToCsv(result);
assert.ok(csv.includes('CHANGED'));
assert.ok(csv.includes('issue_type,key,column,source_value,target_value'));

const largeSource = Array.from({ length: 10000 }, (_, i) => ({ ID: String(i), VALUE: `v${i}` }));
const largeTarget = Array.from({ length: 10000 }, (_, i) => ({ id: String(i), value: `v${i}` }));
result = compare(largeSource, largeTarget, keys, [{ sourceColumn: 'VALUE', targetColumn: 'value', compare: true }]);
assert.strictEqual(result.summary.matched, 10000);

console.log('Migration core tests passed');
