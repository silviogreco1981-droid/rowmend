const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'home-v2.css'), 'utf8');

assert.ok(html.includes('<body class="home-v2">'), 'Homepage V2 body class missing');
assert.ok(html.includes('/home-v2.css'), 'Homepage V2 stylesheet missing');
assert.ok(html.includes('Run recurring CSV &amp; Excel workflows'), 'Core recurring-workflow promise missing');
assert.ok(html.includes('without uploading your data'), 'Local-first promise missing');

for (const step of ['Profile', 'Clean', 'Contract', 'Validate', 'Output', 'Compare']) {
  assert.ok(html.includes(`<strong>${step}</strong>`), `Workflow step missing: ${step}`);
}

assert.ok(html.includes('Not another one-off CSV checker.'), 'Value differentiation block missing');
assert.ok(html.includes('Migration-aware'), 'Migration reconciliation value missing');
assert.ok(html.includes('RUN INSIGHTS'), 'Run Insights proof missing');
assert.ok(html.includes('id="tool"'), 'Standalone Import Checker must remain on homepage');
assert.ok(html.includes('id="fileInput"'), 'Import Checker file input missing');
assert.ok(html.includes('id="generateInsert"'), 'SQL INSERT action missing');
assert.ok(html.includes('id="generateMerge"'), 'SQL MERGE/UPSERT action missing');
assert.ok(html.includes('id="homepagePilotCta"'), 'Founding Pilot CTA missing');
assert.ok(html.includes('id="proInterest"'), 'Pro validation CTA missing');
assert.ok(html.includes('id="homepageTutorialPageLink"'), 'Tutorial CTA tracking hook missing');

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
assert.deepStrictEqual([...new Set(duplicates)], [], `Duplicate HTML ids: ${[...new Set(duplicates)].join(', ')}`);

assert.ok(css.includes('.home-v2-hero'), 'Homepage hero styles missing');
assert.ok(css.includes('.home-v2-flow'), 'Workflow styles missing');
assert.ok(css.includes('.home-v2 .tool-section'), 'Dark product surface override missing');
assert.ok(css.includes('@media(max-width:650px)'), 'Mobile V2 responsive rules missing');

console.log('Homepage V2 structure tests passed');
