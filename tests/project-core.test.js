const assert = require('assert');

const store = new Map();
global.localStorage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); }
};

const core = require('../project-core.js');

store.clear();

const project = core.addProject({
  name:'Monthly supplier import',
  description:'Recurring supplier file workflow'
});

assert.ok(project.id);
assert.strictEqual(project.name, 'Monthly supplier import');
assert.strictEqual(core.listProjects().length, 1);
assert.strictEqual(core.projectCompletion(project).configured, 0);

const profile = {
  summary:{
    rows:2,
    columns:2,
    totalCells:4,
    missingCells:0,
    completeness:1,
    duplicateRows:0,
    duplicateGroups:0,
    mixedColumns:0,
    allMissingColumns:0,
    likelyKeyColumns:['ID']
  },
  columns:[
    {
      name:'ID',
      type:'number',
      typeConfidence:1,
      mixedTypeCount:0,
      missing:0,
      missingRate:0,
      nonEmpty:2,
      unique:2,
      uniqueRate:1,
      numeric:{min:1,max:2,mean:1.5,count:2},
      date:null,
      string:null,
      topValues:[{value:'1',count:1},{value:'2',count:1}]
    },
    {
      name:'NAME',
      type:'string',
      typeConfidence:1,
      mixedTypeCount:0,
      missing:0,
      missingRate:0,
      nonEmpty:2,
      unique:2,
      uniqueRate:1,
      numeric:null,
      date:null,
      string:{minLength:3,maxLength:5,averageLength:4},
      topValues:[{value:'Alice',count:1},{value:'Bob',count:1}]
    }
  ]
};

const snapshot = core.profileSnapshot(profile, 'supplier.csv');
assert.strictEqual(snapshot.summary.rows, 2);
assert.strictEqual(snapshot.columns.length, 2);
assert.strictEqual(snapshot.columns[0].topValues, undefined);

let updated = core.setArtifact(project.id, 'profile', { snapshot }, { label:'supplier.csv' });
assert.strictEqual(core.projectCompletion(updated).configured, 1);

updated = core.setArtifact(project.id, 'cleanRecipe', {
  recipe:[
    {type:'trim', columns:['NAME']},
    {type:'uppercase', column:'STATUS'}
  ]
}, {label:'Supplier cleanup'});
assert.strictEqual(updated.artifacts.cleanRecipe.recipe.length, 2);

updated = core.setArtifact(project.id, 'dataContract', {
  contract:{
    contractVersion:1,
    name:'Supplier contract',
    settings:{strictColumns:true,minRows:0,maxRows:null,keyColumns:['ID']},
    columns:[{name:'ID',expectedType:'number',required:true,unique:true,maxMissingRate:0,maxMixedTypeRate:0}]
  }
}, {label:'Supplier contract'});

updated = core.setArtifact(project.id, 'importProfile', {
  profile:{
    tableName:'SUPPLIERS',
    dialect:'oracle',
    keyColumn:'ID',
    config:{ID:{target:'ID',required:true,unique:true,email:false,type:'number'}}
  }
}, {label:'Oracle supplier import'});

updated = core.setArtifact(project.id, 'migrationPreset', {
  mappings:[{sourceColumn:'ID',targetColumn:'id',compare:true}],
  keySources:['ID'],
  options:{trimWhitespace:true,emptyEqualsNull:true,caseInsensitive:false}
}, {label:'Supplier migration'});
assert.strictEqual(core.projectCompletion(updated).configured, 5);
assert.strictEqual(core.projectCompletion(updated).rate, 1);

core.setActiveProject(project.id);
assert.strictEqual(core.getActiveProject().id, project.id);

const url = core.projectUrl('/migration-check/', project.id);
assert.ok(url.includes('/migration-check/?project='));

const exported = core.exportProject(updated);
const imported = core.importProject(exported);
assert.notStrictEqual(imported.id, updated.id);
assert.strictEqual(imported.name, updated.name);
assert.strictEqual(core.projectCompletion(imported).configured, 5);
assert.strictEqual(core.listProjects().length, 2);

const duplicate = core.duplicateProject(project.id, 'Supplier copy');
assert.strictEqual(duplicate.name, 'Supplier copy');
assert.strictEqual(core.projectCompletion(duplicate).configured, 5);

const cleared = core.clearArtifact(project.id, 'migrationPreset');
assert.strictEqual(cleared.artifacts.migrationPreset, null);
assert.strictEqual(core.projectCompletion(cleared).configured, 4);

const run1 = core.addRunSummary(project.id, {
  status:'PASS',
  startedAt:'2026-09-23T08:00:00.000Z',
  durationMs:120,
  inputRows:100,
  outputRows:98,
  validRows:98,
  invalidRows:0,
  contractErrors:0,
  contractWarnings:0,
  warningSteps:0,
  errorSteps:0,
  configFingerprint:'abcd1234',
  profileMetrics:{
    rows:98,
    columns:2,
    completeness:0.97,
    duplicateRows:1,
    mixedColumns:0,
    allMissingColumns:0,
    columnMetrics:[
      {name:'ID',type:'number',missingRate:0,uniqueRate:1,mixedTypeRate:0,topValues:[{value:'secret',count:98}]},
      {name:'EMAIL',type:'string',missingRate:0.03,uniqueRate:0.95,mixedTypeRate:0}
    ]
  },
  fileName:'must-not-be-stored.csv',
  rawRows:[{secret:'x'}]
});
assert.strictEqual(run1.status, 'PASS');
assert.strictEqual(core.listRunHistory(project.id).length, 1);
assert.strictEqual(core.listRunHistory(project.id)[0].inputRows, 100);
assert.ok(!('fileName' in core.listRunHistory(project.id)[0]));
assert.ok(!('rawRows' in core.listRunHistory(project.id)[0]));
assert.strictEqual(core.listRunHistory(project.id)[0].configFingerprint, 'abcd1234');
assert.strictEqual(core.listRunHistory(project.id)[0].profileMetrics.columnMetrics.length, 2);
assert.ok(!('topValues' in core.listRunHistory(project.id)[0].profileMetrics.columnMetrics[0]));

assert.strictEqual(core.getRunBaseline(project.id), null);
assert.strictEqual(core.setRunBaseline(project.id, run1.id), run1.id);
assert.strictEqual(core.getRunBaseline(project.id), run1.id);
assert.strictEqual(core.setRunBaseline(project.id, null), null);
assert.strictEqual(core.getRunBaseline(project.id), null);
assert.strictEqual(core.setRunBaseline(project.id, run1.id), run1.id);

for (let i = 0; i < 35; i += 1) {
  core.addRunSummary(project.id, {
    status:i % 2 ? 'PASS' : 'REVIEW_REQUIRED',
    startedAt:`2026-09-23T08:${String(i % 60).padStart(2,'0')}:00.000Z`,
    durationMs:i,
    inputRows:i,
    outputRows:i
  });
}
assert.strictEqual(core.listRunHistory(project.id).length, core.MAX_RUN_HISTORY);
assert.strictEqual(core.clearRunHistory(project.id), true);
assert.strictEqual(core.listRunHistory(project.id).length, 0);
assert.strictEqual(core.getRunBaseline(project.id), null);

let invalidFailed = false;
try {
  core.setArtifact(project.id, 'cleanRecipe', {recipe:'not-an-array'});
} catch (error) {
  invalidFailed = /recipe array/i.test(error.message);
}
assert.ok(invalidFailed);

core.addRunSummary(project.id, {
  status:'PASS',
  inputRows:1,
  outputRows:1
});
assert.strictEqual(core.listRunHistory(project.id).length, 1);
assert.strictEqual(core.deleteProject(project.id), true);
assert.strictEqual(core.getProject(project.id), null);
assert.strictEqual(core.listRunHistory(project.id).length, 0);

console.log('Project core tests passed');