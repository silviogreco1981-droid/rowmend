const assert = require('assert');

function detectDelimiter(text) {
  const source = text.replace(/^\uFEFF/, '');
  const candidates = [',', ';', '\t', '|'];
  const countsByDelimiter = Object.fromEntries(candidates.map(d => [d, []]));
  let currentCounts = Object.fromEntries(candidates.map(d => [d, 0]));
  let quoted = false;
  let logicalRecords = 0;

  const pushRecordCounts = () => {
    candidates.forEach(d => countsByDelimiter[d].push(currentCounts[d]));
    currentCounts = Object.fromEntries(candidates.map(d => [d, 0]));
    logicalRecords++;
  };

  for (let i = 0; i < source.length && logicalRecords < 8; i++) {
    const ch = source[i];

    if (ch === '"') {
      if (quoted && source[i + 1] === '"') {
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (quoted) continue;
    if (candidates.includes(ch)) currentCounts[ch]++;

    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      pushRecordCounts();
    }
  }

  if (Object.values(currentCounts).some(n => n > 0)) pushRecordCounts();

  const scored = candidates.map(delimiter => {
    const counts = countsByDelimiter[delimiter];
    const nonZero = counts.filter(n => n > 0);
    if (!nonZero.length) return { delimiter, score: -1 };

    const frequency = new Map();
    nonZero.forEach(n => frequency.set(n, (frequency.get(n) || 0) + 1));
    const [mode, matches] = [...frequency.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    const consistency = matches / counts.length;
    const coverage = nonZero.length / counts.length;
    return { delimiter, score: consistency * 100 + coverage * 50 + Math.min(mode, 20) };
  }).sort((a, b) => b.score - a.score);

  return scored[0].score < 0 ? ',' : scored[0].delimiter;
}

assert.strictEqual(detectDelimiter('ID,NAME\n1,Alice\n2,Bob\n'), ',');
assert.strictEqual(detectDelimiter('ID;NAME;CITY\n1;Mario;Roma\n2;Luca;Milano\n'), ';');
assert.strictEqual(detectDelimiter('ID\tNAME\tCITY\n1\tMario\tRoma\n2\tLuca\tMilano\n'), '\t');
assert.strictEqual(detectDelimiter('ID|NAME|CITY\n1|Mario|Roma\n2|Luca|Milano\n'), '|');
assert.strictEqual(detectDelimiter('ID;NOTE\n1;"text, with comma and | pipe"\n2;"more, text"\n'), ';');
assert.strictEqual(detectDelimiter('ID,NOTE\n1,"line one\nline two, still quoted"\n2,"another row"\n'), ',');
assert.strictEqual(detectDelimiter('ID;NAME;CITY\n1;"Mario ""The Boss"", Rossi";Roma\n2;Luca;Milano\n'), ';');
assert.strictEqual(detectDelimiter('ID|NOTE\n1|"alpha; beta, gamma ""quoted"""\n2|"x; y, z"\n'), '|');

console.log('Delimiter detection tests passed');