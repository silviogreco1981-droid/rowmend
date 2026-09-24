'use strict';

importScripts('/data-core.js');

self.addEventListener('message', event => {
  const payload = event.data || {};
  try {
    if (payload.type !== 'profile') throw new Error('Unsupported worker operation.');
    const core = self.RowMendData;
    if (!core) throw new Error('RowMend data core is unavailable in the worker.');
    const profile = core.profileDataset(payload.rows || [], payload.headers || []);
    self.postMessage({ ok:true, profile });
  } catch (error) {
    self.postMessage({ ok:false, error:error?.message || 'Unable to profile the dataset.' });
  }
});
