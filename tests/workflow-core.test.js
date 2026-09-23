const assert = require('assert');
const dataCore = require('../data-core.js');
const contractCore = require('../contract-core.js');
const workflowCore = require('../workflow-core.js');

const baseline = {
  headers:['ID','NAME','EMAIL','AMOUNT'],
  rows:[
    {ID:'1',NAME:'Alice',EMAIL:'alice@example.com',AMOUNT:'10'},
    {ID:'2',NAME:'Bob',EMAIL:'bob@example.com',AMOUNT:'20'}
  ]
};

const contract = contractCore.createContract(
  dataCore.profileDataset(baseline.rows, baseline.headers),
  {name:'Customer contract', createdAt:'2026-09-23T00:00:00.000Z'}
);
contract.settings.keyColumns = ['ID'];

const project = {
  artifacts:{
    cleanRecipe:{
      recipe:[
        {type:'trim', columns:['NAME','EMAIL']}
      ]
    },
    dataContract:{contract},
    importProfile:{
      profile:{
        tableName:'CUSTOMERS',
        dialect:'oracle',
        keyColumn:'ID',
        config:{
          ID:{target:'ID',required:true,unique:true,email:false,type:'number'},
          NAME:{target:'FULL_NAME',required:true,unique:false,email:false,type:'string'},
          EMAIL:{target:'EMAIL',required:true,unique:true,email:true,type:'string'},
          AMOUNT:{target:'AMOUNT',required:true,unique:false,email:false,type:'number'}
        }
      }
    }
  }
};

{
  const dataset = {
    headers:['ID','NAME','EMAIL','AMOUNT'],
    rows:[
      {ID:'1',NAME:' Alice ',EMAIL:'alice@example.com',AMOUNT:'10'},
      {ID:'2',NAME:'Bob',EMAIL:'bob@example.com',AMOUNT:'20'}
    ]
  };
  const result = workflowCore.runWorkflow(dataset, project, {sqlMode:'insert'});
  assert.strictEqual(result.status, 'PASS');
  assert.strictEqual(result.summary.outputRows, 2);
  assert.strictEqual(result.summary.invalidRows, 0);
  assert.ok(result.sqlResult.sql.includes('INSERT INTO "CUSTOMERS"'));
  assert.ok(result.sqlResult.sql.includes("'Alice'"));
}

{
  const dataset = {
    headers:['ID','NAME','EMAIL','AMOUNT'],
    rows:[
      {ID:'1',NAME:'Alice',EMAIL:'bad-email',AMOUNT:'10'},
      {ID:'2',NAME:'Bob',EMAIL:'bob@example.com',AMOUNT:'20'}
    ]
  };
  const result = workflowCore.runWorkflow(dataset, project, {
    stopOnContractErrors:false,
    blockSqlOnInvalidRows:true
  });
  assert.strictEqual(result.status, 'REVIEW_REQUIRED');
  assert.strictEqual(result.summary.invalidRows, 1);
  assert.strictEqual(result.sqlResult, null);
  assert.ok(result.steps.some(step => step.id === 'output' && step.status === 'warning'));
}

{
  const dataset = {
    headers:['ID','NAME','EMAIL','AMOUNT'],
    rows:[
      {ID:'1',NAME:'Alice',EMAIL:'bad-email',AMOUNT:'10'},
      {ID:'2',NAME:'Bob',EMAIL:'bob@example.com',AMOUNT:'20'}
    ]
  };
  const result = workflowCore.runWorkflow(dataset, project, {
    stopOnContractErrors:false,
    blockSqlOnInvalidRows:false,
    sqlMode:'merge'
  });
  assert.strictEqual(result.summary.invalidRows, 1);
  assert.ok(result.sqlResult.sql.includes('MERGE INTO "CUSTOMERS"'));
  assert.strictEqual(result.sqlResult.generatedRows, 1);
}

{
  const dataset = {
    headers:['ID','NAME','EMAIL'],
    rows:[
      {ID:'1',NAME:'Alice',EMAIL:'alice@example.com'}
    ]
  };
  const result = workflowCore.runWorkflow(dataset, project, {
    stopOnContractErrors:true
  });
  assert.strictEqual(result.status, 'REVIEW_REQUIRED');
  assert.ok(result.contractResult.summary.errors > 0);
  assert.ok(result.steps.some(step => step.id === 'validate' && step.status === 'skipped'));
}

{
  const dataset = {
    headers:['Id','Full Name','Email','Amount'],
    rows:[
      {'Id':'1','Full Name':'Alice','Email':'alice@example.com','Amount':'10'}
    ]
  };
  const profile = {
    tableName:'CUSTOMERS',
    dialect:'postgres',
    keyColumn:'ID',
    config:{
      ID:{target:'ID',required:true,unique:true,email:false,type:'number'},
      FULL_NAME:{target:'FULL_NAME',required:true,unique:false,email:false,type:'string'},
      EMAIL:{target:'EMAIL',required:true,unique:false,email:true,type:'string'},
      AMOUNT:{target:'AMOUNT',required:true,unique:false,email:false,type:'number'}
    }
  };
  const validation = workflowCore.validateImport(dataset, profile);
  assert.strictEqual(validation.summary.validRows, 1);
  assert.strictEqual(validation.summary.structuralErrors, 0);
}

{
  const validation = workflowCore.validateImport({
    headers:['ID','EMAIL'],
    rows:[
      {ID:'1',EMAIL:'bad'},
      {ID:'2',EMAIL:'ok@example.com'}
    ]
  }, {
    config:{
      ID:{target:'ID',required:true,unique:true,email:false,type:'number'},
      EMAIL:{target:'EMAIL',required:true,unique:false,email:true,type:'string'}
    }
  });
  const csv = workflowCore.importErrorsToCsv({
    headers:['ID','EMAIL'],
    rows:[
      {ID:'1',EMAIL:'bad'},
      {ID:'2',EMAIL:'ok@example.com'}
    ]
  }, validation);
  assert.ok(csv.includes('invalid email format'));
  assert.ok(csv.startsWith('ROW,ERRORS,ID,EMAIL'));
}

{
  const result = workflowCore.runWorkflow(baseline, {
    artifacts:{cleanRecipe:null,dataContract:null,importProfile:null}
  });
  assert.strictEqual(result.status, 'PASS');
  assert.ok(result.steps.filter(step => step.status === 'skipped').length >= 3);
  const summary = workflowCore.runSummaryForHistory(result);
  assert.strictEqual(summary.inputRows, 2);
  assert.ok(!('cleanedDataset' in summary));
}

console.log('Workflow core tests passed');