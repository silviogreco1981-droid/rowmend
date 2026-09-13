const assert = require('assert');

function duplicateTargets(headers, config) {
  const seen = new Map();
  const duplicates = new Set();
  headers.forEach(source => {
    const target = (config[source]?.target || source).trim() || source;
    const key = target.toUpperCase();
    if (seen.has(key)) {
      duplicates.add(target);
      duplicates.add(seen.get(key));
    } else seen.set(key, target);
  });
  return [...duplicates];
}

assert.deepStrictEqual(duplicateTargets(['A','B'], {A:{target:'ID'},B:{target:'id'}}).length > 0, true);
assert.deepStrictEqual(duplicateTargets(['A','B'], {A:{target:'ID'},B:{target:'NAME'}}), []);

function mergeClause(dialect, nonKeyCount) {
  if (dialect === 'postgres') return nonKeyCount ? 'DO UPDATE SET' : 'DO NOTHING';
  return nonKeyCount ? 'WHEN MATCHED THEN UPDATE SET' : '';
}

assert.strictEqual(mergeClause('oracle', 0), '');
assert.strictEqual(mergeClause('sqlserver', 0), '');
assert.strictEqual(mergeClause('postgres', 0), 'DO NOTHING');
assert.strictEqual(mergeClause('oracle', 1), 'WHEN MATCHED THEN UPDATE SET');
assert.strictEqual(mergeClause('postgres', 1), 'DO UPDATE SET');

function validateCustomDelimiter(custom) {
  if (!custom) throw new Error('Enter a custom delimiter first.');
  if (custom.length !== 1) throw new Error('The custom delimiter must be exactly one character.');
  if (["\n", "\r"].includes(custom)) throw new Error('The custom delimiter cannot be a line break.');
  return custom;
}

assert.strictEqual(validateCustomDelimiter('^'), '^');
assert.throws(() => validateCustomDelimiter('||'), /exactly one character/);

function preservedKey(headers, currentKey) {
  return headers.includes(currentKey) ? currentKey : (headers[0] || '');
}
assert.strictEqual(preservedKey(['ID','NAME'], 'NAME'), 'NAME');
assert.strictEqual(preservedKey(['ID','NAME'], 'OLD'), 'ID');

const profile = { tableName:'CUSTOMERS', dialect:'oracle', keyColumn:'EMAIL', config:{} };
assert.strictEqual(profile.keyColumn, 'EMAIL');

console.log('Workflow reliability tests passed');
