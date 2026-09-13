const assert = require('assert');

function parseDelimited(text, delimiter) {
  const source = text.replace(/^\uFEFF/, '');
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;

  const pushField = () => {
    record.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    if (record.some(v => String(v).length > 0)) records.push(record);
    record = [];
  };

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === delimiter && !quoted) {
      pushField();
      continue;
    }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      pushRecord();
      continue;
    }
    field += ch;
  }

  if (quoted) throw new Error('Malformed delimited file: an opening quote is not closed.');
  if (field.length || record.length) pushRecord();
  if (!records.length) return [];

  const headers = records[0].map(h => String(h).trim());
  return records.slice(1).map(values => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
    return obj;
  });
}

assert.deepStrictEqual(
  parseDelimited('ID,NAME\n1,Alice\n2,Bob\n', ','),
  [{ ID: '1', NAME: 'Alice' }, { ID: '2', NAME: 'Bob' }]
);

assert.deepStrictEqual(
  parseDelimited('ID,NOTE\n1,"hello, world"\n', ','),
  [{ ID: '1', NOTE: 'hello, world' }]
);

assert.deepStrictEqual(
  parseDelimited('ID,NOTE\n1,"line one\nline two"\n', ','),
  [{ ID: '1', NOTE: 'line one\nline two' }]
);

assert.deepStrictEqual(
  parseDelimited('ID,NOTE\r\n1,"He said ""hello"""\r\n', ','),
  [{ ID: '1', NOTE: 'He said "hello"' }]
);

assert.deepStrictEqual(
  parseDelimited('ID\tNOTE\n1\t"alpha\tbeta"\n', '\t'),
  [{ ID: '1', NOTE: 'alpha\tbeta' }]
);

assert.throws(
  () => parseDelimited('ID,NOTE\n1,"not closed\n', ','),
  /opening quote is not closed/
);

console.log('CSV parser tests passed');
