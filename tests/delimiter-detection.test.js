const assert = require('assert');

function detectDelimiter(text) {
  const source = text.replace(/^\uFEFF/, '');
  const candidates = [',', ';', '\t', '|'];
  const stats = candidates.map(delimiter => ({ delimiter, counts: [], current: 0, quoted: false, records: 0 }));

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    stats.forEach(s => {
      if (ch === '"') {
        if (s.quoted && source[i + 1] === '"') return;
        s.quoted = !s.quoted;
        return;
      }
      if (ch === s.delimiter && !s.quoted) s.current++;
      if ((ch === '\n' || ch === '\r') && !s.quoted) {
        if (ch === '\r' && source[i + 1] === '\n') return;
        if (s.current > 0 || s.counts.length > 0) s.counts.push(s.current);
        s.current = 0;
        s.records++;
      }
    });
    if (stats[0].records >= 8) break;
  }

  stats.forEach(s => {
    if (s.current > 0) s.counts.push(s.current);
  });

  const scored = stats.map(s => {
    const nonZero = s.counts.filter(n => n > 0);
    if (!nonZero.length) return { delimiter: s.delimiter, score: -1 };
    const frequency = new Map();
    nonZero.forEach(n => frequency.set(n, (frequency.get(n) || 0) + 1));
    const [mode, matches] = [...frequency.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
    const consistency = matches / nonZero.length;
    return { delimiter: s.delimiter, score: consistency * 100 + Math.min(mode, 20) + nonZero.length };
  }).sort((a, b) => b.score - a.score);

  return scored[0].score < 0 ? ',' : scored[0].delimiter;
}

assert.strictEqual(detectDelimiter('ID,NAME\n1,Alice\n2,Bob\n'), ',');
assert.strictEqual(detectDelimiter('ID;NAME;CITY\n1;Mario;Roma\n2;Luca;Milano\n'), ';');
assert.strictEqual(detectDelimiter('ID\tNAME\tCITY\n1\tMario\tRoma\n2\tLuca\tMilano\n'), '\t');
assert.strictEqual(detectDelimiter('ID|NAME|CITY\n1|Mario|Roma\n2|Luca|Milano\n'), '|');
assert.strictEqual(detectDelimiter('ID;NOTE\n1;"text, with comma and | pipe"\n2;"more, text"\n'), ';');
assert.strictEqual(detectDelimiter('ID,NOTE\n1,"line one\nline two, still quoted"\n2,"another row"\n'), ',');

console.log('Delimiter detection tests passed');