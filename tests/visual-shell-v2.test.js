const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const appPages = [
  'projects/index.html',
  'projects/run/index.html',
  'profile-data/index.html',
  'clean-data/index.html',
  'data-contract/index.html',
  'migration-check/index.html'
];

for (const page of appPages) {
  const html = read(page);
  assert.ok(html.includes('class="app-v2"'), `${page} must use the app V2 shell`);
  assert.ok(html.includes('/app-v2.css'), `${page} must load app-v2.css`);
}

const marketingPages = [
  'tutorial/index.html',
  'pilot/index.html',
  'guides/index.html',
  'guides/workflow-runner-quick-start/index.html',
  'guides/detect-data-drift-recurring-csv/index.html',
  'privacy.html',
  'terms.html'
];

for (const page of marketingPages) {
  const html = read(page);
  assert.ok(html.includes('class="marketing-v2"'), `${page} must use the marketing V2 shell`);
  assert.ok(html.includes('/site-v2.css'), `${page} must load site-v2.css`);
}

const home = read('index.html');
assert.ok(home.includes('home-v2-tool-intro'), 'Homepage must introduce the standalone checker in the V2 shell');
assert.ok(home.includes('Repeat this workflow often?'), 'Homepage must route recurring work toward Local Projects');

const homeCss = read('home-v2.css');
assert.ok(homeCss.includes('.home-v2 .tool-section>.shell'), 'Homepage must frame the dark checker as a product surface');

const siteCss = read('site-v2.css');
assert.ok(siteCss.includes('body.marketing-v2'), 'Marketing V2 theme missing');
const appCss = read('app-v2.css');
assert.ok(appCss.includes('body.app-v2'), 'App V2 theme missing');

console.log('Visual shell V2 tests passed');
