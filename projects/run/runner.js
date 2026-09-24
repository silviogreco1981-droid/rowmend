(() => {
  'use strict';

  const dataCore = window.RowMendData;
  const projectCore = window.RowMendProjects;
  const workflowCore = window.RowMendWorkflow;
  const insightsCore = window.RowMendInsights;
  if (!dataCore || !projectCore || !workflowCore || !insightsCore) return;

  const $ = id => document.getElementById(id);
  const state = {
    project: null,
    dataset: null,
    fileName: '',
    result: null,
    historyRun: null,
    baselineRunId: null,
    demoLoaded: false,
    demoVariant: 'baseline'
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
    state.baselineRunId = projectCore.getRunBaseline(project.id);
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
      state.demoLoaded = false;
      $('loadRunnerDemo').textContent = 'Use demo vendor dataset';

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

  function loadDemoDataset(variant = null) {
    const nextVariant = variant || (!state.demoLoaded || state.demoVariant === 'changed' ? 'baseline' : 'changed');
    const baseline = {
      headers:['ID','NAME','EMAIL','AMOUNT'],
      rows:[
        {ID:'1001',NAME:' Acme North ',EMAIL:'SALES@ACMENORTH.EXAMPLE',AMOUNT:'1200.50'},
        {ID:'1002',NAME:'Blue River Ltd',EMAIL:'ops@blueriver.example',AMOUNT:'985'},
        {ID:'1003',NAME:' Green Field GmbH ',EMAIL:'CONTACT@GREENFIELD.EXAMPLE',AMOUNT:'2150.75'},
        {ID:'1004',NAME:'Delta Services',EMAIL:'finance@delta.example',AMOUNT:'640'}
      ]
    };
    const changed = {
      headers:['ID','NAME','EMAIL','AMOUNT'],
      rows:[
        {ID:'1001',NAME:'Acme North',EMAIL:'sales@acmenorth.example',AMOUNT:'1200.50'},
        {ID:'1002',NAME:'Blue River Ltd',EMAIL:'',AMOUNT:'985'},
        {ID:'1002',NAME:'Blue River Ltd',EMAIL:'',AMOUNT:'985'}
      ]
    };
    const dataset = nextVariant === 'changed' ? changed : baseline;

    state.dataset = dataset;
    state.fileName = nextVariant === 'changed' ? 'demo-vendor-next.csv' : 'demo-vendor.csv';
    state.result = null;
    state.demoLoaded = true;
    state.demoVariant = nextVariant;

    $('runnerFileSummary').innerHTML = nextVariant === 'changed'
      ? '<strong>Changed demo delivery</strong><span>3 rows · 4 columns · intentional drift</span>'
      : '<strong>Demo vendor baseline</strong><span>4 rows · 4 columns</span>';
    $('loadRunnerDemo').textContent = nextVariant === 'changed'
      ? 'Reset demo baseline'
      : 'Load changed demo delivery';
    $('runWorkflow').disabled = !state.project;
    $('runnerEmpty').classList.remove('hidden');
    $('runnerResults').classList.add('hidden');
    setMessage(
      state.project
        ? (nextVariant === 'changed'
          ? 'Changed demo delivery ready. Run it to see drift against the baseline.'
          : 'Demo baseline ready. Run it once, then load the changed demo delivery.')
        : 'Demo dataset loaded. Return to Local Projects and choose or create a project first.',
      state.project ? 'success' : 'error'
    );

    track('workflow_file_loaded', {
      rows:dataset.rows.length,
      columns:dataset.headers.length,
      file_type:'demo',
      demo:true,
      demo_variant:nextVariant
    });
    track('workflow_demo_loaded', { variant:nextVariant });
  }

  function metric(label, value, cls = '') {
    return `<div class="runner-metric ${cls}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
  }

  function signed(value, suffix = '') {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    const rounded = Math.abs(n) >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
    return `${rounded > 0 ? '+' : ''}${rounded}${suffix}`;
  }

  function sparkline(values) {
    const clean = values.map(value => Number(value)).filter(Number.isFinite);
    if (!clean.length) return '<div class="runner-insights-empty">No comparable history yet.</div>';
    const min = Math.min(...clean);
    const max = Math.max(...clean);
    const range = max - min || 1;
    const width = 100;
    const height = 40;
    const points = clean.map((value, index) => {
      const x = clean.length === 1 ? width / 2 : (index / (clean.length - 1)) * width;
      const y = height - 4 - ((value - min) / range) * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="${height - 4}" x2="${width}" y2="${height - 4}"></line><polyline points="${points}"></polyline></svg>`;
  }

  function trendCard(label, values, displayValue) {
    return `<div class="runner-trend"><div class="runner-trend-head"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(displayValue)}</span></div>${sparkline(values)}</div>`;
  }

  function compatibleHistory(history, current) {
    return history.filter(run =>
      run.id !== current?.id &&
      run.profileMetrics &&
      Array.isArray(run.profileMetrics.columnMetrics)
    );
  }

  function currentComparison() {
    if (!state.project || !state.historyRun?.profileMetrics) return null;
    const history = projectCore.listRunHistory(state.project.id);
    const candidates = compatibleHistory(history, state.historyRun);
    if (!candidates.length) return null;

    const savedId = projectCore.getRunBaseline(state.project.id);
    const baseline = candidates.find(run => run.id === savedId) || candidates[0];
    return {
      history,
      candidates,
      baseline,
      comparison:insightsCore.compareRuns(state.historyRun, baseline)
    };
  }

  function renderInsights() {
    const summary = $('runnerInsightsSummary');
    const metrics = $('runnerInsightMetrics');
    const trends = $('runnerTrends');
    const signals = $('runnerSignals');
    const select = $('baselineRun');
    const downloadButton = $('downloadInsights');

    if (!state.project || !state.historyRun?.profileMetrics) {
      summary.innerHTML = '<div class="runner-insights-empty">Run insights will appear after a 0.9 workflow run.</div>';
      metrics.innerHTML = '';
      trends.innerHTML = '';
      signals.innerHTML = '';
      select.innerHTML = '<option value="">Previous compatible run</option>';
      select.disabled = true;
      downloadButton.disabled = true;
      return;
    }

    const history = projectCore.listRunHistory(state.project.id);
    const candidates = compatibleHistory(history, state.historyRun);
    const savedId = projectCore.getRunBaseline(state.project.id);

    select.innerHTML = [
      '<option value="">Previous compatible run</option>',
      ...candidates.map(run => `<option value="${escapeHtml(run.id)}">${escapeHtml(new Date(run.startedAt).toLocaleString())} · ${escapeHtml(run.status)}</option>`)
    ].join('');
    select.value = candidates.some(run => run.id === savedId) ? savedId : '';
    select.disabled = candidates.length === 0;

    if (!candidates.length) {
      const legacyCount = history.filter(run => run.id !== state.historyRun.id && !run.profileMetrics).length;
      summary.innerHTML = `<strong>Baseline needed</strong><span>Run this project again with 0.9 to compare drift.${legacyCount ? ` ${legacyCount} older run${legacyCount === 1 ? '' : 's'} do not contain the structural metrics required for comparison.` : ''}</span>`;
      metrics.innerHTML = '';
      signals.innerHTML = '';
      const series = insightsCore.historySeries(history);
      trends.innerHTML = [
        trendCard('Input rows', series.map(item => item.inputRows), state.historyRun.inputRows.toLocaleString()),
        trendCard('Run duration', series.map(item => item.durationMs), `${Math.round(state.historyRun.durationMs)} ms`)
      ].join('');
      downloadButton.disabled = true;
      return;
    }

    const baseline = candidates.find(run => run.id === savedId) || candidates[0];
    const comparison = insightsCore.compareRuns(state.historyRun, baseline);
    const warningCount = comparison.signals.filter(item => item.severity === 'warning').length;
    const infoCount = comparison.signals.filter(item => item.severity === 'info').length;

    summary.innerHTML = warningCount
      ? `<strong>${warningCount} drift signal${warningCount === 1 ? '' : 's'} need attention</strong><span>Compared with ${escapeHtml(new Date(baseline.startedAt).toLocaleString())}.${comparison.configChanged ? ' Workflow configuration also changed, so interpret data differences with that context.' : ''}</span>`
      : `<strong>No material warning-level drift detected</strong><span>Compared with ${escapeHtml(new Date(baseline.startedAt).toLocaleString())}.${infoCount ? ' Informational changes are listed below.' : ''}</span>`;

    const m = comparison.metrics;
    metrics.innerHTML = [
      `<div class="runner-insight-card ${Math.abs((m.inputRows.percentChange || 0) * 100) >= 20 ? 'warn' : ''}"><strong>${signed((m.inputRows.percentChange || 0) * 100, '%')}</strong><span>Input row change</span></div>`,
      `<div class="runner-insight-card ${m.completeness.deltaPoints <= -5 ? 'warn' : ''}"><strong>${signed(m.completeness.deltaPoints, 'pp')}</strong><span>Completeness change</span></div>`,
      `<div class="runner-insight-card ${m.duplicateRows.delta > 0 ? 'warn' : ''}"><strong>${signed(m.duplicateRows.delta)}</strong><span>Duplicate rows</span></div>`,
      `<div class="runner-insight-card ${Number(m.invalidRows.delta) > 0 ? 'bad' : ''}"><strong>${m.invalidRows.delta === null ? '—' : signed(m.invalidRows.delta)}</strong><span>Invalid rows</span></div>`
    ].join('');

    const series = insightsCore.historySeries(history);
    const profileSeries = series.filter(item => item.completeness !== null);
    trends.innerHTML = [
      trendCard('Input rows', series.map(item => item.inputRows), state.historyRun.inputRows.toLocaleString()),
      trendCard('Completeness', profileSeries.map(item => item.completeness * 100), `${Math.round(state.historyRun.profileMetrics.completeness * 1000) / 10}%`),
      trendCard('Invalid rows', series.filter(item => item.invalidRows !== null).map(item => item.invalidRows), state.historyRun.invalidRows === null ? 'n/a' : state.historyRun.invalidRows.toLocaleString()),
      trendCard('Duplicates', profileSeries.map(item => item.duplicateRows), state.historyRun.profileMetrics.duplicateRows.toLocaleString()),
      trendCard('Contract issues', series.map(item => item.contractErrors + item.contractWarnings), (state.historyRun.contractErrors + state.historyRun.contractWarnings).toLocaleString()),
      trendCard('Run duration', series.map(item => item.durationMs), `${Math.round(state.historyRun.durationMs)} ms`)
    ].join('');

    signals.innerHTML = comparison.signals.length
      ? comparison.signals.map(item => `<div class="runner-signal ${escapeHtml(item.severity)}"><strong>${escapeHtml(item.severity)}</strong><span>${escapeHtml(item.message)}</span></div>`).join('')
      : '<div class="runner-insights-empty">No row-count, completeness, duplicate, validation, contract or column-level drift crossed the current thresholds.</div>';

    downloadButton.disabled = false;
  }

  function insightsForExport() {
    const context = currentComparison();
    if (!context) return null;
    return {
      rowmendVersion:'0.9.0',
      generatedAt:new Date().toISOString(),
      project:{
        id:state.project.id,
        name:state.project.name
      },
      currentRun:state.historyRun,
      baselineRun:context.baseline,
      comparison:context.comparison,
      series:insightsCore.historySeries(context.history)
    };
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
    renderInsights();
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

      state.historyRun = projectCore.addRunSummary(
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
      rowmendVersion:'0.9.0',
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
    const demoMode = params.get('demo') === '1';
    state.project = projectId ? projectCore.getProject(projectId) : null;

    renderProject();
    wireDropzone();

    $('runWorkflow').addEventListener('click', runWorkflow);
    $('loadRunnerDemo').addEventListener('click', () => loadDemoDataset());

    $('baselineRun').addEventListener('change', event => {
      if (!state.project) return;
      projectCore.setRunBaseline(state.project.id, event.target.value || null);
      state.baselineRunId = event.target.value || null;
      renderInsights();
      track('workflow_baseline_changed', { mode:event.target.value ? 'saved' : 'previous' });
    });

    $('downloadInsights').addEventListener('click', () => {
      const report = insightsForExport();
      if (!report) return;
      download(JSON.stringify(report, null, 2), 'rowmend-run-insights.json', 'application/json;charset=utf-8');
      track('workflow_output_exported', { output:'insights_json' });
    });

    if (demoMode && state.project) {
      track('project_created', { demo:true });
      loadDemoDataset('baseline');
    }

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
      state.historyRun = null;
      state.baselineRunId = null;
      renderHistory();
      renderInsights();
      track('workflow_history_cleared');
      setMessage('Local run history cleared.', 'success');
    });
  }

  init();
})();