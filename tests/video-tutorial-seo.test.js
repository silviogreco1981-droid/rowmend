const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const tutorial = read('tutorial/index.html');
const homepage = read('index.html');
const sitemap = read('sitemap.xml');
const videoSitemap = read('video-sitemap.xml');
const videoFeed = read('video-feed.xml');
const robots = read('robots.txt');
const headers = read('_headers');

const videoPath = path.join(root, 'assets/rowmend-0.9-run-insights-tutorial.mp4');
const thumbPath = path.join(root, 'assets/rowmend-0.9-tutorial-thumbnail.jpg');
const captionsPath = path.join(root, 'assets/rowmend-0.9-tutorial-captions.vtt');

assert.ok(fs.existsSync(videoPath), 'Tutorial MP4 is missing');
assert.ok(fs.statSync(videoPath).size > 400000, 'Tutorial MP4 looks unexpectedly small');
assert.ok(fs.existsSync(thumbPath), 'Tutorial thumbnail is missing');
assert.ok(fs.statSync(thumbPath).size > 50000, 'Tutorial thumbnail looks unexpectedly small');
assert.ok(fs.existsSync(captionsPath), 'Tutorial captions are missing');

assert.ok(tutorial.includes('<video controls'), 'Tutorial page must expose a playable HTML5 video');
assert.ok(tutorial.includes('rowmend-0.9-run-insights-tutorial.mp4'), 'Tutorial page must reference the MP4');
assert.ok(tutorial.includes('rowmend-0.9-tutorial-thumbnail.jpg'), 'Tutorial page must expose the thumbnail');
assert.ok(tutorial.includes('rowmend-0.9-tutorial-captions.vtt'), 'Tutorial page must expose captions');
assert.ok(tutorial.includes('"@type": "VideoObject"'), 'Tutorial page must include VideoObject structured data');
assert.ok(tutorial.includes('"duration": "PT1M11S"'), 'VideoObject must expose the 71-second duration');
assert.ok(tutorial.includes('"contentUrl": "https://rowmend.netlify.app/assets/rowmend-0.9-run-insights-tutorial.mp4"'), 'VideoObject contentUrl missing');
assert.ok(tutorial.includes('<meta name="robots" content="index,follow,max-video-preview:-1,max-image-preview:large"'), 'Tutorial page must be indexable with full video preview');

const desc = tutorial.match(/<meta name="description" content="([^"]+)"/)?.[1] || '';
assert.ok(desc.length >= 25 && desc.length <= 160, `Tutorial meta description must be 25–160 chars, got ${desc.length}`);

assert.ok(homepage.includes('/assets/rowmend-0.9-run-insights-tutorial.mp4'), 'Homepage must make the video available');
assert.ok(homepage.includes('href="/tutorial/"'), 'Homepage must link to the canonical watch page');
assert.ok(sitemap.includes('https://rowmend.netlify.app/tutorial/'), 'Main sitemap must include the watch page');
assert.ok(videoSitemap.includes('<video:content_loc>https://rowmend.netlify.app/assets/rowmend-0.9-run-insights-tutorial.mp4</video:content_loc>'), 'Video sitemap content URL missing');
assert.ok(videoSitemap.includes('<video:thumbnail_loc>https://rowmend.netlify.app/assets/rowmend-0.9-tutorial-thumbnail.jpg</video:thumbnail_loc>'), 'Video sitemap thumbnail missing');
assert.ok(videoFeed.includes('<media:content url="https://rowmend.netlify.app/assets/rowmend-0.9-run-insights-tutorial.mp4"'), 'mRSS video content missing');
assert.ok(robots.includes('Sitemap: https://rowmend.netlify.app/video-sitemap.xml'), 'robots.txt must advertise the video sitemap');
assert.ok(headers.includes('/assets/rowmend-0.9-run-insights-tutorial.mp4'), 'Video caching headers missing');

console.log('Video tutorial SEO tests passed');
