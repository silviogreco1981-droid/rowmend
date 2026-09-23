(() => {
  'use strict';

  const dataCore = window.RowMendData;
  const projectCore = window.RowMendProjects;
  const workflowCore = window.RowMendWorkflow;
  if (!dataCore || !projectCore || !workflowCore) return;

  const $ = id => document.getElementById(id);
  const state = {
    project: null,
    dataset: null,
    fileName: '',
    result: null
  };

  function track(eventName, properties = {}) {
    window.RowMendAnalytics?.track(eventName, properties);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  function setMessage(message, kind = '') {
    const el = $('runnerMessage');
    el.textContent = message || '';
    el.className = `runner-message ${kind}`.trim();
  }

  function selectedDelimiter(text, ext) {
    const mode = $('runnerDelimiter').value;
    if (ext === 'tsv' || mode === 'tab') return '\t';
    if (mode === 'auto') return dataCore.detectDelimiter(text);
    return mode;
  }

  async function readDataset(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    if (ext === 'csv' || ext === 'tsv') {
      const text = await file.text();
      return dataCore.parseDelimited(text, selectedDelimiter(text, ext));
    }

    if ((ext === 'xlsx' || ext === 'xls') && window.XLSX) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type:'array', cellDates:false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval:'', raw:false });
      return { headers: rows.length ? Object.keys(rows[0]) : [], rows };
    }

    if (ext === 'xlsx' || ext === 'xls') {
      throw new Error('Excel parser is still loading. Please retry in a moment.');
    }

    throw new Error('Unsupported file type. Use CSV, TSV, XLSX or XLS.');
  }

  function configuredLabel(artifact, yes, no) {
    return artifact ? yes : no;
  }

  function renderProject() {
    const project = state.project;
    if (!project) {
      $('runnerProjectSummary').innerHTML = '<strong>Project not found</strong><p>Return to Local Projects and choose a project first.</p>';
      $('runWorkflow').disabled = true;
      return;
    }

    const completion = projectCore.projectCompletion(project);
    $('runnerProjectSummary').innerHTML = `
      <div class="eyebrow">ACTIVE PROJECT</div>
      <h3>${escapeHtml(project.name)}</h3>
      <p>${completion.configured}/${completion.total} workflow artifacts configured</p>
      <div class="runner-config">
        <div class="runner-config-row"><strong>Cleanup</strong><span>${configuredLabel(project.artifacts.cleanRecipe, 'configured', 'not configured')}</span></div>
        <div class="runner-config-row"><strong>Contract</strong><span>${configuredLabel(project.artifacts.dataContract, 'configured', 'not configured')}</span></div>
        <div class="runner-config-row"><strong>Import setup</strong><span>${configuredLabel(project.artifacts.importProfile, 'configured', 'not configured')}</span></div>
      </div>`;

    $('backToProject').href = `/projects/?project=${encodeURIComponent(project.id)}`;
    renderHistory();
  }

  function renderHistory() {
    if (!state.project) return;
    const history = projectCore.listRunHistory(state.project.id);
    const wrap = $('runHistory');

    if (!history.length) {
      wrap.innerHTML = '<div class="migration-empty"><strong>No runs yet.</strong><span>Completed workflow runs will appear here without storing source data.</span></div>';
      return;
    }

    wrap.innerHTML = history.map(run => `
      <div class="runner-history-item">
        <span class="runner-history-badge ${run.status === 'PASS' ? 'pass' : 'review'}">${escapeHtml(run.status)}</span>
        <div>
          <strong>${escapeHtml(new Date(run.startedAt).toLocaleString())}</strong>
          <span>${run.inputRows.toLocaleString()} input → ${run.outputRows.toLocaleString()} output · ${run.invalidRows === null ? 'validation n/a' : `${run.invalidRows} invalid`}</span>
        </div>
        <span>${Math.max(0, Math.round(run.durationMs))} ms</span>
      </div>`).join('');
  }

  async function handleFile(file) {
    try {
      setMessage('Reading the dataset locally…');
      const dataset = await readDataset(file);
      if (!dataset.headers.length) throw new Error('No columns were found in the dataset.');

      state.dataset = dataset;
      state.fileName = file.name;
      state.result = null;

      $('runnerFileSummary').innerHTML = `<strong>${escapeHtml(file.name)}</strong><span>${dataset.rows.length.toLocaleString()} rows · ${dataset.headers.length} columns</span>`;
      $('runWorkflow').disabled = !state.project;
      $('runnerEmpty').classList.remove('hidden');
      $('runnerResults').classList.add('hidden');
      setMessage('Dataset ready. Run the project workflow.', 'success');

      track('workflow_file_loaded', {
        rows:dataset.rows.length,
        columns:dataset.headers.length,
        file_type:(file.name.split('.').pop() || '').toLowerCase()
      });
    } catch (error) {
      state.dataset = null;
      $('runWorkflow').disabled = true;
      setMessage(error.message || 'Unable to read the dataset.', 'error');
    }
  }

  function loadDemoDataset() {
    const dataset = {
      headers:['ID','NAME','EMAIL','AMOUNT'],
      rows:[
        {ID:'1001',NAME:' Acme North ',EMAIL:'SALES@ACMENORTH.EXAMPLE',AMOUNT:'1200.50'},
        {ID:'1002',NAME:'Blue River Ltd',EMAIL:'ops@blueriver.example',AMOUNT:'985'},
        {ID:'1003',NAME:' Green Field GmbH ',EMAIL:'CONTACT@GREENFIELD.EXAMPLE',AMOUNT:'2150.75'},
        {ID:'1004',NAME:'Delta Services',EMAIL:'finance@delta.example',AMOUNT:'640'}
      ]
    };

    state.dataset = dataset;
    state.fileName = 'demo-vendor.csv';
    state.result = null;

    $('runnerFileSummary').innerHTML = '<strong>Demo vendor dataset</strong><span>4 rows · 4 columns</span>';
    $('runWorkflow').disabled = !state.project;
    $('runnerEmpty').classList.remove('hidden');
    $('runnerResults').classList.add('hidden');
    setMessage(
      state.project
        ? 'Demo dataset ready. Run the project workflow.'
        : 'Demo dataset loaded. Return to Local Projects and choose or create a project first.',
      state.project ? 'success' : 'error'
    );

    track('workflow_file_loaded', {
      rows:dataset.rows.length,
      columns:dataset.headers.length,
      file_type:'demo',
      demo:true
    });
    track('workflow_demo_loaded');
  }

  function metric(label, value, cls = '') {
    return `<div class="runner-metric ${cls}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
  }

  function renderResult() {
    const result = state.result;
    if (!result) return;

    $('runnerEmpty').classList.add('hidden');
    $('runnerResults').classList.remove('hidden');

    const pass = result.status === 'PASS';
    $('runnerStatus').className = `runner-status ${pass ? 'pass' : 'review'}`;
    $('runnerStatus').innerHTML = `
      <div><strong>${pass ? 'PASS' : 'REVIEW REQUIRED'}</strong><div>${pass ? 'The configured local workflow completed without warnings or errors.' : 'At least one workflow step needs review.'}</div></div>
      <span>${result.durationMs} ms</span>`;

    const s = result.summary;
    $('runnerMetrics').innerHTML = [
      metric('Input rows', s.inputRows.toLocaleString()),
      metric('After cleanup', s.outputRows.toLocaleString()),
      metric('Rows removed', s.rowsRemoved.toLocaleString(), s.rowsRemoved ? 'warn' : ''),
      metric('Valid rows', s.validRows === null ? '—' : s.validRows.toLocaleString()),
      metric('Invalid rows', s.invalidRows === null ? '—' : s.invalidRows.toLocaleString(), s.invalidRows ? 'bad' : ''),
      metric('Contract errors', s.contractErrors.toLocaleString(), s.contractErrors ? 'bad' : '')
    ].join('');

    const labels = {
      profile:'Profile',
      clean:'Clean',
      contract:'Contract',
      validate:'Validate',
      output:'Output'
    };
    const icon = status => status === 'pass' ? '✓' : status === 'warning' ? '!' : status === 'error' ? '×' : '–';

    $('runnerSteps').innerHTML = result.steps.map(step => `
      <div class="runner-step ${step.status}">
        <div class="runner-step-icon">${icon(step.status)}</div>
        <strong>${escapeHtml(labels[step.id] || step.id)}</strong>
        <span>${escapeHtml(step.summary)}</span>
      </div>`).join('');

    $('downloadCleaned').disabled = !result.cleanedDataset;
    $('downloadErrors').disabled = !(result.importResult?.summary?.invalidRows > 0);
    $('downloadSql').disabled = !result.sqlResult?.sql;

    renderHistory();
  }

  function runWorkflow() {
    if (!state.project || !state.dataset) return;

    try {
      setMessage('Running the local workflow…');
      track('workflow_run_started', {
        has_recipe:Boolean(state.project.artifacts.cleanRecipe),
        has_contract:Boolean(state.project.artifacts.dataContract),
        has_import_profile:Boolean(state.project.artifacts.importProfile),
        rows:state.dataset.rows.length
      });

      state.result = workflowCore.runWorkflow(state.dataset, state.project, {
        stopOnContractErrors:$('stopOnContractErrors').checked,
        blockSqlOnInvalidRows:$('blockSqlOnInvalidRows').checked,
        sqlMode:$('sqlMode').value
      });

      projectCore.addRunSummary(
        state.project.id,
        workflowCore.runSummaryForHistory(state.result)
      );

      renderResult();
      setMessage(state.result.status === 'PASS' ? 'Workflow completed successfully.' : 'Workflow completed with items to review.', state.result.status === 'PASS' ? 'success' : '');

      track('workflow_run_completed', {
        status:state.result.status,
        input_rows:state.result.summary.inputRows,
        output_rows:state.result.summary.outputRows,
        invalid_rows:state.result.summary.invalidRows ?? 0,
        contract_errors:state.result.summary.contractErrors,
        contract_warnings:state.result.summary.contractWarnings,
        error_steps:state.result.summary.errorSteps,
        warning_steps:state.result.summary.warningSteps
      });
    } catch (error) {
      setMessage(error.message || 'Unable to run the workflow.', 'error');
      track('workflow_run_failed', { stage:'execution' });
    }
  }

  function download(content, fileName, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function reportForExport() {
    const r = state.result;
    return {
      rowmendVersion:'0.8.0',
      project:{
        id:state.project.id,
        name:state.project.name
      },
      status:r.status,
      startedAt:r.startedAt,
      durationMs:r.durationMs,
      settings:r.settings,
      steps:r.steps,
      summary:r.summary,
      contract:r.contractResult ? {
        status:r.contractResult.status,
        summary:r.contractResult.summary,
        issues:r.contractResult.issues
      } : null,
      importValidation:r.importResult ? {
        summary:r.importResult.summary,
        issues:r.importResult.issues
      } : null,
      sql:r.sqlResult ? {
        mode:r.sqlResult.mode,
        dialect:r.sqlResult.dialect,
        generatedRows:r.sqlResult.generatedRows,
        capped:r.sqlResult.capped,
        available:Boolean(r.sqlResult.sql)
      } : null
    };
  }

  function wireDropzone() {
    const input = $('runnerFile');
    const drop = $('runnerDrop');

    input.addEventListener('change', () => input.files[0] && handleFile(input.files[0]));
    ['dragenter','dragover'].forEach(eventName => drop.addEventListener(eventName, event => {
      event.preventDefault();
      drop.classList.add('drag');
    }));
    ['dragleave','drop'].forEach(eventName => drop.addEventListener(eventName, event => {
      event.preventDefault();
      drop.classList.remove('drag');
    }));
    drop.addEventListener('drop', event => {
      if (event.dataTransfer.files[0]) handleFile(event.dataTransfer.files[0]);
    });
  }

  function init() {
    track('workflow_runner_opened');
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');
    state.project = projectId ? projectCore.getProject(projectId) : null;

    renderProject();
    wireDropzone();

    $('runWorkflow').addEventListener('click', runWorkflow);
    $('loadRunnerDemo').addEventListener('click', loadDemoDataset);

    $('downloadCleaned').addEventListener('click', () => {
      if (!state.result?.cleanedDataset) return;
      download(dataCore.datasetToCsv(state.result.cleanedDataset), 'rowmend-workflow-cleaned.csv', 'text/csv;charset=utf-8');
      track('workflow_output_exported', { output:'cleaned_csv' });
    });

    $('downloadErrors').addEventListener('click', () => {
      if (!state.result?.importResult?.summary?.invalidRows) return;
      download(workflowCore.importErrorsToCsv(state.result.cleanedDataset, state.result.importResult), 'rowmend-workflow-errors.csv', 'text/csv;charset=utf-8');
      track('workflow_output_exported', { output:'errors_csv' });
    });

    $('downloadSql').addEventListener('click', () => {
      if (!state.result?.sqlResult?.sql) return;
      download(state.result.sqlResult.sql, 'rowmend-workflow.sql', 'text/sql;charset=utf-8');
      track('workflow_output_exported', { output:'sql' });
    });

    $('downloadRunReport').addEventListener('click', () => {
      if (!state.result) return;
      download(JSON.stringify(reportForExport(), null, 2), 'rowmend-workflow-report.json', 'application/json;charset=utf-8');
      track('workflow_output_exported', { output:'report_json' });
    });

    $('clearRunHistory').addEventListener('click', () => {
      if (!state.project) return;
      projectCore.clearRunHistory(state.project.id);
      renderHistory();
      track('workflow_history_cleared');
      setMessage('Local run history cleared.', 'success');
    });
  }

  init();
})();