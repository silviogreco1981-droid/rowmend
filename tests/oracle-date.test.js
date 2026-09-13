const assert = require('assert');

function qValue(v, type, d) {
  if (v === null || v === undefined || String(v).trim() === '') return 'NULL';
  if (type === 'number') return String(v).replace(',', '.');
  if (type === 'boolean') {
    const b = typeof v === 'boolean' ? v : /^true$/i.test(String(v));
    return d === 'postgres' ? (b ? 'TRUE' : 'FALSE') : (b ? '1' : '0');
  }
  const s = String(v).replace(/'/g, "''");
  if (type === 'date') {
    if (d === 'oracle') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `TO_DATE('${s}','YYYY-MM-DD')`;
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) return `TO_TIMESTAMP('${s}','YYYY-MM-DD"T"HH24:MI:SS')`;
      return `TO_TIMESTAMP('${s}','YYYY-MM-DD HH24:MI:SS')`;
    }
    return d === 'sqlserver' ? `CAST('${s}' AS DATETIME2)` : `CAST('${s}' AS TIMESTAMP)`;
  }
  return `'${s}'`;
}

assert.strictEqual(qValue('2026-09-13', 'date', 'oracle'), "TO_DATE('2026-09-13','YYYY-MM-DD')");
assert.strictEqual(qValue('2026-09-13 14:30:45', 'date', 'oracle'), "TO_TIMESTAMP('2026-09-13 14:30:45','YYYY-MM-DD HH24:MI:SS')");
assert.strictEqual(qValue('2026-09-13T14:30:45', 'date', 'oracle'), "TO_TIMESTAMP('2026-09-13T14:30:45','YYYY-MM-DD\"T\"HH24:MI:SS')");
assert.strictEqual(qValue('2026-09-13', 'date', 'sqlserver'), "CAST('2026-09-13' AS DATETIME2)");
assert.strictEqual(qValue('2026-09-13', 'date', 'postgres'), "CAST('2026-09-13' AS TIMESTAMP)");

console.log('Oracle date SQL tests passed');
