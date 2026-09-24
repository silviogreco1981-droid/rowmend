const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const pilot = read('pilot/index.html');
const homepage = read('index.html');
const tutorial = read('tutorial/index.html');
const sitemap = read('sitemap.xml');
const privacy = read('privacy.html');
const terms = read('terms.html');

assert.ok(pilot.includes('<title>RowMend Founding Workflow Pilot'), 'Pilot page title missing');
assert.ok(pilot.includes('Standard'), 'Pilot Standard scope missing');
assert.ok(pilot.includes('€59'), 'Pilot Standard price missing');
assert.ok(pilot.includes('Extended'), 'Pilot Extended scope missing');
assert.ok(pilot.includes('€119'), 'Pilot Extended price missing');
assert.ok(pilot.includes('https://tally.so/r/eq47KQ'), 'Pilot application form link missing');
assert.ok(pilot.includes('founding_pilot_apply_clicked'), 'Pilot apply analytics event missing');

const desc = pilot.match(/<meta name="description" content="([^"]+)"/)?.[1] || '';
assert.ok(desc.length >= 25 && desc.length <= 160, `Pilot meta description must be 25–160 chars, got ${desc.length}`);

assert.ok(homepage.includes('/pilot/?utm_source=rowmend'), 'Homepage must link to the pilot landing page');
assert.ok(tutorial.includes('/pilot/?utm_source=rowmend'), 'Tutorial must link to the pilot landing page');
assert.ok(sitemap.includes('https://rowmend.netlify.app/pilot/'), 'Sitemap must include pilot landing page');
assert.ok(privacy.includes('Founding Workflow Pilot'), 'Privacy notice must describe pilot form data');
assert.ok(privacy.includes('tutorial video'), 'Privacy notice must describe tutorial engagement analytics');
assert.ok(terms.includes('Founding Workflow Pilot'), 'Terms must clarify founding pilot scope');

console.log('Founding pilot page tests passed');
