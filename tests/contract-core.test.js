const assert = require('assert');
const dataCore = require('../data-core.js');
const contractCore = require('../contract-core.js');

function profile(dataset) {
  return dataCore.profileDataset(dataset.rows, dataset.headers);
}

const baseline = {
  headers:['CUSTOMER_ID','NAME','EMAIL','AMOUNT','CREATED_AT'],
  rows:[
    { CUSTOMER_ID:'1001', NAME:'Alice', EMAIL:'alice@example.com', AMOUNT:'10.5', CREATED_AT:'2026-01-01' },
    { CUSTOMER_ID:'1002', NAME:'Bob', EMAIL:'bob@example.com', AMOUNT:'20', CREATED_AT:'2026-01-02' },
    { CUSTOMER_ID:'1003', NAME:'Carla', EMAIL:'carla@example.com', AMOUNT:'30', CREATED_AT:'2026-01-03' }
  ]
};

let contract = contractCore.createContract(profile(baseline), {
  name:'Customer import contract',
  createdAt:'2026-09-23T00:00:00.000Z'
});

assert.strictEqual(contract.contractVersion, 1);
assert.strictEqual(contract.columns.length, 5);
assert.strictEqual(contract.columns.find(c => c.name === 'AMOUNT').expectedType, 'number');
assert.strictEqual(contract.columns.find(c => c.name === 'CUSTOMER_ID').unique, true);
contract.settings.keyColumns = ['CUSTOMER_ID'];

assert.strictEqual(contractCore.validateContract(contract), true);

{
  const result = contractCore.checkContract(baseline, profile(baseline), contract);
  assert.strictEqual(result.status, 'PASS');
  assert.strictEqual(result.summary.issues, 0);
}

{
  const candidate = {
    headers:['CUSTOMER_ID','NAME','AMOUNT','CREATED_AT','REGION'],
    rows:[
      { CUSTOMER_ID:'1001', NAME:'Alice', AMOUNT:'10.5', CREATED_AT:'2026-01-01', REGION:'EU' },
      { CUSTOMER_ID:'1002', NAME:'Bob', AMOUNT:'20', CREATED_AT:'2026-01-02', REGION:'EU' }
    ]
  };
  const result = contractCore.checkContract(candidate, profile(candidate), contract);
  assert.strictEqual(result.status, 'REVIEW_REQUIRED');
  assert.ok(result.issues.some(i => i.type === 'missing_column' && i.column === 'EMAIL'));
  assert.ok(result.issues.some(i => i.type === 'unexpected_column' && i.column === 'REGION'));
}

{
  const candidate = {
    headers:['CUSTOMER_ID','NAME','EMAIL','AMOUNT','CREATED_AT'],
    rows:[
      { CUSTOMER_ID:'1001', NAME:'Alice', EMAIL:'alice@example.com', AMOUNT:'ten', CREATED_AT:'2026-01-01' },
      { CUSTOMER_ID:'1002', NAME:'Bob', EMAIL:'bob@example.com', AMOUNT:'twenty', CREATED_AT:'2026-01-02' }
    ]
  };
  const result = contractCore.checkContract(candidate, profile(candidate), contract);
  assert.ok(result.issues.some(i => i.type === 'type_changed' && i.column === 'AMOUNT'));
}

{
  const candidate = {
    headers:['CUSTOMER_ID','NAME','EMAIL','AMOUNT','CREATED_AT'],
    rows:[
      { CUSTOMER_ID:'1001', NAME:'', EMAIL:'alice@example.com', AMOUNT:'10', CREATED_AT:'2026-01-01' },
      { CUSTOMER_ID:'1002', NAME:'Bob', EMAIL:'bob@example.com', AMOUNT:'20', CREATED_AT:'2026-01-02' }
    ]
  };
  const result = contractCore.checkContract(candidate, profile(candidate), contract);
  assert.ok(result.issues.some(i => i.type === 'required_value_missing' && i.column === 'NAME'));
}

{
  const candidate = {
    headers:['CUSTOMER_ID','NAME','EMAIL','AMOUNT','CREATED_AT'],
    rows:[
      { CUSTOMER_ID:'1001', NAME:'Alice', EMAIL:'alice@example.com', AMOUNT:'10', CREATED_AT:'2026-01-01' },
      { CUSTOMER_ID:'1001', NAME:'Bob', EMAIL:'bob@example.com', AMOUNT:'20', CREATED_AT:'2026-01-02' }
    ]
  };
  const result = contractCore.checkContract(candidate, profile(candidate), contract);
  assert.ok(result.issues.some(i => i.type === 'unique_violation' && i.column === 'CUSTOMER_ID'));
  assert.ok(result.issues.some(i => i.type === 'composite_key_duplicate'));
  assert.strictEqual(result.summary.duplicateKeyGroups, 1);
}

{
  const limited = contractCore.cloneContract(contract);
  limited.settings.minRows = 5;
  limited.settings.maxRows = 10;
  const result = contractCore.checkContract(baseline, profile(baseline), limited);
  assert.ok(result.issues.some(i => i.type === 'row_count_below_minimum'));
}

{
  const relaxed = contractCore.cloneContract(contract);
  relaxed.settings.strictColumns = false;
  const candidate = {
    headers:[...baseline.headers, 'REGION'],
    rows:baseline.rows.map(row => ({ ...row, REGION:'EU' }))
  };
  const result = contractCore.checkContract(candidate, profile(candidate), relaxed);
  assert.ok(!result.issues.some(i => i.type === 'unexpected_column'));
}

{
  const summary = contractCore.duplicateKeySummary(
    [{A:'1',B:'x'},{A:'1',B:'x'},{A:'2',B:'y'}],
    ['A','B']
  );
  assert.strictEqual(summary.duplicateGroups, 1);
  assert.strictEqual(summary.duplicateRows, 1);
}

{
  const invalid = contractCore.cloneContract(contract);
  invalid.settings.minRows = 10;
  invalid.settings.maxRows = 5;
  let failed = false;
  try { contractCore.validateContract(invalid); }
  catch (error) { failed = /maximum row count/i.test(error.message); }
  assert.ok(failed);
}

{
  const invalid = contractCore.cloneContract(contract);
  invalid.contractVersion = 99;
  let failed = false;
  try { contractCore.validateContract(invalid); }
  catch (error) { failed = /unsupported/i.test(error.message); }
  assert.ok(failed);
}

{
  const result = contractCore.checkContract({
    headers:['CUSTOMER_ID','NAME'],
    rows:[{CUSTOMER_ID:'1',NAME:'Alice'}]
  }, profile({
    headers:['CUSTOMER_ID','NAME'],
    rows:[{CUSTOMER_ID:'1',NAME:'Alice'}]
  }), contract);
  const csv = contractCore.issuesToCsv(result);
  assert.ok(csv.startsWith('severity,issue_type,column,message'));
  assert.ok(csv.includes('missing_column'));
}

console.log('Contract core tests passed');