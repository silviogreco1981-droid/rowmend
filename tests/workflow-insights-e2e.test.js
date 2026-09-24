const assert = require('assert');
const workflow = require('../workflow-core.js');
const insights = require('../insights-core.js');

const project = {
  id:'demo-project',
  name:'Monthly vendor import demo',
  artifacts:{
    cleanRecipe:{
      recipe:[
        {type:'trim', columns:['NAME','EMAIL']},
        {type:'lowercase', column:'EMAIL'}
      ]
    },
    dataContract:{
      contract:{
        contractVersion:1,
        name:'Monthly vendor contract',
        settings:{strictColumns:true,minRows:1,maxRows:100000,keyColumns:['ID']},
        columns:[
          {name:'ID',expectedType:'number',required:true,unique:true,maxMissingRate:0,maxMixedTypeRate:0},
          {name:'NAME',expectedType:'string',required:true,unique:false,maxMissingRate:0,maxMixedTypeRate:0},
          {name:'EMAIL',expectedType:'string',required:true,unique:false,maxMissingRate:0,maxMixedTypeRate:0},
          {name:'AMOUNT',expectedType:'number',required:true,unique:false,maxMissingRate:0,maxMixedTypeRate:0}
        ]
      }
    },
    importProfile:{
      profile:{
        tableName:'VENDOR_IMPORT',
        dialect:'postgres',
        keyColumn:'ID',
        config:{
          ID:{target:'ID',required:true,unique:true,email:false,type:'number'},
          NAME:{target:'SUPPLIER_NAME',required:true,unique:false,email:false,type:'string'},
          EMAIL:{target:'EMAIL',required:true,unique:false,email:true,type:'string'},
          AMOUNT:{target:'AMOUNT',required:true,unique:false,email:false,type:'number'}
        }
      }
    }
  }
};

const baseline = {
  headers:['ID','NAME','EMAIL','AMOUNT'],
  rows:[
    {ID:'1001',NAME:' Acme North ',EMAIL:'SALES@ACMENORTH.EXAMPLE',AMOUNT:'1200.50'},
    {ID:'1002',NAME:'Blue River Ltd',EMAIL:'ops@blueriver.example',AMOUNT:'985'},
    {ID:'1003',NAME:' Green Field GmbH ',EMAIL:'CONTACT@GREENFIELD.EXAMPLE',AMOUNT:'2150.75'},
    {ID:'1004',NAME:'Delta Services',EMAIL:'finance@delta.example',AMOUNT:'640'}
  ]
};

const drift = {
  headers:['ID','NAME','EMAIL','AMOUNT'],
  rows:[
    {ID:'1001',NAME:'Acme North',EMAIL:'sales@acmenorth.example',AMOUNT:'1200.50'},
    {ID:'1002',NAME:'Blue River Ltd',EMAIL:'',AMOUNT:'985'},
    {ID:'1002',NAME:'Blue River Ltd',EMAIL:'',AMOUNT:'985'}
  ]
};

const baselineResult = workflow.runWorkflow(baseline, project);
const driftResult = workflow.runWorkflow(drift, project);

assert.strictEqual(baselineResult.status, 'PASS');
assert.strictEqual(driftResult.status, 'REVIEW_REQUIRED');

const baselineSummary = {
  id:'baseline',
  ...workflow.runSummaryForHistory(baselineResult)
};
const driftSummary = {
  id:'drift',
  ...workflow.runSummaryForHistory(driftResult)
};

assert.strictEqual(baselineSummary.configFingerprint, driftSummary.configFingerprint);
assert.ok(baselineSummary.profileMetrics);
assert.ok(driftSummary.profileMetrics);

const comparison = insights.compareRuns(driftSummary, baselineSummary);
const signalIds = new Set(comparison.signals.map(item => item.id));

assert.ok(signalIds.has('row_count_shift'));
assert.ok(signalIds.has('completeness_drop'));
assert.ok(signalIds.has('duplicate_rows_increased'));
assert.ok(signalIds.has('contract_errors_increased'));
assert.ok(signalIds.has('missing_rate_increased:EMAIL'));
assert.ok(signalIds.has('uniqueness_dropped:ID'));
assert.strictEqual(comparison.configChanged, false);
assert.strictEqual(Math.round(comparison.metrics.inputRows.percentChange * 100), -25);

console.log('Workflow insights E2E tests passed');
