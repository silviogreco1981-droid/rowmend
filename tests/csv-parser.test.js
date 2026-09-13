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

assert.deepStrictEqual(
  parseDelimited('\uFEFFID,NAME,CITY\n1,Giovanni D’Angelo,Città di Castello\n2,José Álvarez,São Paulo\n', ','),
  [
    { ID: '1', NAME: 'Giovanni D’Angelo', CITY: 'Città di Castello' },
    { ID: '2', NAME: 'José Álvarez', CITY: 'São Paulo' }
  ]
);

assert.deepStrictEqual(
  parseDelimited('ID,NOTE\n1,"Prezzo: 12,50 € — sconto 20%"\n2,"Simboli: @ # & / \\ ( ) [ ] { } + = _"\n', ','),
  [
    { ID: '1', NOTE: 'Prezzo: 12,50 € — sconto 20%' },
    { ID: '2', NOTE: 'Simboli: @ # & / \\ ( ) [ ] { } + = _' }
  ]
);

assert.deepStrictEqual(
  parseDelimited('ID,TEXT\n1,"Emoji 🚀 ✅ ❤️"\n2,"中文测试 — العربية — кириллица"\n', ','),
  [
    { ID: '1', TEXT: 'Emoji 🚀 ✅ ❤️' },
    { ID: '2', TEXT: '中文测试 — العربية — кириллица' }
  ]
);

assert.deepStrictEqual(
  parseDelimited('ID,NOTE\n1,"Riga con apostrofo: l\'utente O\'Connor"\n', ','),
  [{ ID: '1', NOTE: "Riga con apostrofo: l'utente O'Connor" }]
);

assert.throws(
  () => parseDelimited('ID,NOTE\n1,"not closed\n', ','),
  /opening quote is not closed/
);

console.log('CSV parser tests passed');
