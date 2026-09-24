const assert = require('assert');
const excel = require('../excel-core.js');

const fakeEngine = {
  read(buffer, options) {
    assert.ok(buffer);
    assert.strictEqual(options.type, 'array');
    return {
      SheetNames:['January','February'],
      Sheets:{
        January:{ name:'January' },
        February:{ name:'February' }
      }
    };
  },
  utils:{
    sheet_to_json(sheet, options) {
      assert.strictEqual(options.defval, '');
      assert.strictEqual(options.raw, false);
      if (sheet.name === 'January') return [{ID:'1',AMOUNT:'10'}];
      if (sheet.name === 'February') return [{ID:'2',AMOUNT:'20'},{ID:'3',AMOUNT:'30'}];
      return [];
    }
  }
};

assert.strictEqual(excel.isExcelFile('report.xlsx'), true);
assert.strictEqual(excel.isExcelFile({name:'legacy.XLS'}), true);
assert.strictEqual(excel.isExcelFile('report.csv'), false);

const workbook = {
  SheetNames:['January','February'],
  Sheets:{January:{name:'January'},February:{name:'February'}}
};
const first = excel.selectSheet(workbook, '', fakeEngine);
assert.strictEqual(first.sheetName, 'January');
assert.deepStrictEqual(first.sheetNames, ['January','February']);
assert.deepStrictEqual(first.headers, ['ID','AMOUNT']);
assert.strictEqual(first.rows.length, 1);

const second = excel.selectSheet(workbook, 'February', fakeEngine);
assert.strictEqual(second.sheetName, 'February');
assert.strictEqual(second.rows.length, 2);

const fallback = excel.selectSheet(workbook, 'Missing', fakeEngine);
assert.strictEqual(fallback.sheetName, 'January');

(async () => {
  const file = {
    name:'monthly.xlsx',
    async arrayBuffer() { return new ArrayBuffer(8); }
  };
  const parsed = await excel.readFile(file, 'February', fakeEngine);
  assert.strictEqual(parsed.sheetName, 'February');
  assert.strictEqual(parsed.rows.length, 2);
  console.log('Excel core tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
