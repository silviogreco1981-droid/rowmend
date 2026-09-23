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

let invalidFailed = false;
try {
  core.setArtifact(project.id, 'cleanRecipe', {recipe:'not-an-array'});
} catch (error) {
  invalidFailed = /recipe array/i.test(error.message);
}
assert.ok(invalidFailed);

assert.strictEqual(core.deleteProject(project.id), true);
assert.strictEqual(core.getProject(project.id), null);

console.log('Project core tests passed');