const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'clean-data', 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'clean-data', 'clean-data.js'), 'utf8');

const operations = [
  'concat',
  'split',
  'regex_replace',
  'regex_extract',
  'value_map',
  'conditional_map',
  'calculate'
];

operations.forEach(operation => {
  assert.ok(html.includes(`value="${operation}"`), `Missing Clean UI option: ${operation}`);
  assert.ok(js.includes(`type === '${operation}'`) || js.includes(`case '${operation}'`), `Missing Clean UI wiring: ${operation}`);
});

[
  'concatFields',
  'splitFields',
  'regexFields',
  'valueMapFields',
  'conditionalFields',
  'calculateFields'
].forEach(id => {
  assert.ok(html.includes(`id="${id}"`), `Missing advanced transform form: ${id}`);
  assert.ok(js.includes(`$('${id}')`), `Missing advanced transform form wiring: ${id}`);
});

console.log('Pilot transform UI wiring tests passed');
