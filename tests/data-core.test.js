const assert = require('assert');
const core = require('../data-core.js');

{
  const parsed = core.parseDelimited('ID,NAME\n1,Alice\n2,Bob', ',');
  assert.deepStrictEqual(parsed.headers, ['ID','NAME']);
  assert.strictEqual(parsed.rows.length, 2);
}

{
  const parsed = core.parseDelimited('ID,ID\n1,2', ',');
  assert.deepStrictEqual(parsed.headers, ['ID','ID_2']);
}

{
  const delimiter = core.detectDelimiter('ID;NAME\n1;Alice\n2;Bob');
  assert.strictEqual(delimiter, ';');
}

{
  const rows = [
    { ID:'1', NAME:'Alice', AMOUNT:'10', NOTE:'' },
    { ID:'2', NAME:'Bob', AMOUNT:'20', NOTE:'' },
    { ID:'3', NAME:'Bob', AMOUNT:'oops', NOTE:'' },
    { ID:'3', NAME:'Bob', AMOUNT:'oops', NOTE:'' }
  ];
  const profile = core.profileDataset(rows, Object.keys(rows[0]));
  assert.strictEqual(profile.summary.rows, 4);
  assert.strictEqual(profile.summary.columns, 4);
  assert.strictEqual(profile.summary.duplicateRows, 1);
  assert.strictEqual(profile.summary.mixedColumns, 1);
  assert.strictEqual(profile.summary.allMissingColumns, 1);
  assert.ok(profile.summary.likelyKeyColumns.includes('ID') === false);

  const id = profile.columns.find(c => c.name === 'ID');
  const note = profile.columns.find(c => c.name === 'NOTE');
  const amount = profile.columns.find(c => c.name === 'AMOUNT');
  assert.strictEqual(id.unique, 3);
  assert.strictEqual(note.unique, 0);
  assert.strictEqual(amount.type, 'number');
  assert.strictEqual(amount.mixedTypeCount, 2);
}

{
  const dataset = {
    headers:['ID','NAME','EMAIL'],
    rows:[
      { ID:'1', NAME:' Alice ', EMAIL:'' },
      { ID:'2', NAME:'Bob', EMAIL:'BOB@EXAMPLE.COM' },
      { ID:'2', NAME:'Bob', EMAIL:'BOB@EXAMPLE.COM' }
    ]
  };
  const recipe = [
    { type:'trim', columns:['NAME','EMAIL'] },
    { type:'lowercase', column:'EMAIL' },
    { type:'empty_to_null', column:'EMAIL' },
    { type:'remove_key_duplicates', columns:['ID'], keep:'first' },
    { type:'rename', column:'NAME', newName:'FULL_NAME' }
  ];
  const out = core.applyRecipe(dataset, recipe);
  assert.deepStrictEqual(out.headers, ['ID','FULL_NAME','EMAIL']);
  assert.strictEqual(out.rows.length, 2);
  assert.strictEqual(out.rows[0].FULL_NAME, 'Alice');
  assert.strictEqual(out.rows[0].EMAIL, null);
  assert.strictEqual(out.rows[1].EMAIL, 'bob@example.com');
}

{
  const dataset = {
    headers:['ID','TEXT'],
    rows:[
      { ID:'1', TEXT:'foo foo' },
      { ID:'2', TEXT:'bar' }
    ]
  };
  const out = core.applyOperation(dataset, { type:'find_replace', column:'TEXT', find:'foo', replacement:'x' });
  assert.strictEqual(out.rows[0].TEXT, 'x x');
}

{
  const dataset = {
    headers:['A','B'],
    rows:[
      { A:'1', B:'x' },
      { A:'1', B:'x' },
      { A:'2', B:'y' }
    ]
  };
  const out = core.applyOperation(dataset, { type:'remove_exact_duplicates' });
  assert.strictEqual(out.rows.length, 2);
}

{
  const rows = Array.from({length:100000}, (_, i) => ({
    ID:String(i),
    VALUE:String(i % 1000),
    GROUP:'G' + (i % 10)
  }));
  const profile = core.profileDataset(rows, ['ID','VALUE','GROUP']);
  assert.strictEqual(profile.summary.rows, 100000);
  assert.strictEqual(profile.columns.find(c => c.name === 'ID').unique, 100000);
}

{
  const dataset = { headers:['ID','NAME'], rows:[{ID:'1',NAME:'Alice'}] };
  let failed = false;
  try {
    core.applyOperation(dataset, { type:'trim', column:'MISSING_COLUMN' });
  } catch (error) {
    failed = /missing column/i.test(error.message);
  }
  assert.ok(failed, 'Missing recipe columns must fail instead of applying broadly');
}

{
  const csv = core.datasetToCsv({
    headers:['A','B'],
    rows:[{A:'x,y',B:'"quoted"'}]
  });
  assert.ok(csv.includes('"x,y"'));
  assert.ok(csv.includes('"""quoted"""'));
}

console.log('Data core tests passed');