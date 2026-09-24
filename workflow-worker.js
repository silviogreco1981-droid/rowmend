'use strict';

importScripts('/data-core.js', '/contract-core.js', '/workflow-core.js');

self.addEventListener('message', event => {
  const payload = event.data || {};
  try {
    if (payload.type !== 'run_workflow') throw new Error('Unsupported worker operation.');
    const workflow = self.RowMendWorkflow;
    if (!workflow) throw new Error('RowMend workflow core is unavailable in the worker.');
    const result = workflow.runWorkflow(payload.dataset, payload.project, payload.settings || {});
    self.postMessage({ ok:true, result });
  } catch (error) {
    self.postMessage({ ok:false, error:error?.message || 'Unable to run the workflow.' });
  }
});
