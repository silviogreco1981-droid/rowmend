(() => {
  'use strict';

  const core = window.RowMendData;
  const excelCore = window.RowMendExcel;
  if (!core || !excelCore) return;

  const $ = id => document.getElementById(id);
  const WORKER_CELL_THRESHOLD = 75000;
  const state = { dataset: null, profile: null, fileName: '', currentFile: null };

  function track(eventName, properties = {}) {
    window.RowMendAnalytics?.track(eventName, properties);
  }

  function setMessage(message, kind = '') {
    const el = $('profileMessage');
    el.textContent = message || '';
    el.className = `toolbox-message ${kind}`.trim();
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  function selectedDelimiter(text, ext) {
    const mode = $('profileDelimiter').value;
    if (ext === 'tsv' || mode === 'tab') return '\t';
    if (mode === 'auto') return core.detectDelimiter(text);
    return mode;
  }

  async function readFile(file, sheetName = '') {
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    if (ext === 'csv' || ext === 'tsv') {
      const text = await file.text();
      const delimiter = selectedDelimiter(text, ext);
      return { ...core.parseDelimited(text, delimiter), sheetName:'', sheetNames:[] };
    }

    if (ext === 'xlsx' || ext === 'xls') {
      return excelCore.readFile(file, sheetName);
    }

    throw new Error('Unsupported file type. Use CSV, TSV, XLSX or XLS.');
  }

  function syncExcelSheetSelector(file, dataset) {
    state.currentFile = file;
    const group = $('profileExcelSheetGroup');
    const select = $('profileExcelSheet');
    const names = Array.isArray(dataset.sheetNames) ? dataset.sheetNames : [];
    select.replaceChildren(...names.map(name => new Option(name, name)));
    if (dataset.sheetName) select.value = dataset.sheetName;
    group.classList.toggle('hidden', names.length <= 1);
  }

  function formatPercent(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
  }

  function formatNumber(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });
  }

  function metric(label, value, cls = '') {
    return `<div class="toolbox-metric ${cls}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
  }

  function signalFor(column) {
    if (column.nonEmpty === 0) return ['Empty', 'bad'];
    if (column.mixedTypeCount > 0) return ['Mixed types', 'warn'];
    if (column.missingRate >= 0.25) return ['Sparse', 'warn'];
    if (state.profile.summary.rows && column.unique === state.profile.summary.rows && column.missing === 0) return ['Candidate key', 'good'];
    if (column.unique <= 1 && column.nonEmpty > 0) return ['Constant', 'warn'];
    return ['Looks consistent', 'good'];
  }

  function renderSummary() {
    const s = state.profile.summary;
    $('profileSummary').innerHTML = [
      metric('Rows', s.rows.toLocaleString()),
      metric('Columns', s.columns.toLocaleString()),
      metric('Completeness', formatPercent(s.completeness), s.completeness < .9 ? 'warn' : ''),
      metric('Exact duplicate rows', s.duplicateRows.toLocaleString(), s.duplicateRows ? 'warn' : ''),
      metric('Mixed-type columns', s.mixedColumns.toLocaleString(), s.mixedColumns ? 'warn' : '')
    ].join('');
  }

  function renderColumns() {
    $('profileColumns').innerHTML = state.profile.columns.map(column => {
      const [signal, cls] = signalFor(column);
      return `<tr>
        <td><button type="button" data-column="${escapeHtml(column.name)}">${escapeHtml(column.name)}</button></td>
        <td class="type">${escapeHtml(column.type)}</td>
        <td>${column.missing.toLocaleString()} · ${formatPercent(column.missingRate)}</td>
        <td>${column.unique.toLocaleString()} · ${formatPercent(column.uniqueRate)}</td>
        <td>${formatPercent(column.typeConfidence)}</td>
        <td><span class="quality-chip ${cls}">${signal}</span></td>
      </tr>`;
    }).join('');

    $('profileColumns').querySelectorAll('[data-column]').forEach(button => {
      button.addEventListener('click', () => renderDetail(button.dataset.column));
    });
  }

  function detailStat(label, value) {
    return `<div class="detail-stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
  }

  function renderDetail(name) {
    const column = state.profile.columns.find(item => item.name === name);
    if (!column) return;

    const detail = $('profileDetail');
    const stats = [
      detailStat('Inferred type', column.type),
      detailStat('Missing', `${column.missing} · ${formatPercent(column.missingRate)}`),
      detailStat('Unique', `${column.unique} · ${formatPercent(column.uniqueRate)}`),
      detailStat('Type confidence', formatPercent(column.typeConfidence))
    ];

    if (column.numeric) {
      stats.push(detailStat('Minimum', formatNumber(column.numeric.min)));
      stats.push(detailStat('Maximum', formatNumber(column.numeric.max)));
      stats.push(detailStat('Mean', formatNumber(column.numeric.mean)));
    } else if (column.date) {
      stats.push(detailStat('Earliest', column.date.min.slice(0, 10)));
      stats.push(detailStat('Latest', column.date.max.slice(0, 10)));
    } else if (column.string) {
      stats.push(detailStat('Min length', column.string.minLength));
      stats.push(detailStat('Max length', column.string.maxLength));
      stats.push(detailStat('Avg length', formatNumber(column.string.averageLength)));
    }

    const maxCount = Math.max(1, ...column.topValues.map(item => item.count));
    const top = column.topValues.map(item => `
      <div class="top-value">
        <span class="top-value-label" title="${escapeHtml(item.value)}">${escapeHtml(item.value)}</span>
        <span class="top-value-bar"><i style="width:${Math.max(4, Math.round(item.count / maxCount * 100))}%"></i></span>
        <span class="top-value-count">${item.count}</span>
      </div>`).join('');

    detail.innerHTML = `
      <div class="eyebrow">COLUMN DETAIL</div>
      <h3>${escapeHtml(column.name)}</h3>
      <p class="muted">Descriptive profile of the current column. Original file values are never changed.</p>
      <div class="profile-detail-grid">${stats.join('')}</div>
      <strong>Most common values</strong>
      <div class="top-values">${top || '<span class="muted">No values available.</span>'}</div>`;
    detail.classList.remove('hidden');

    track('profile_column_opened', { type: column.type });
  }

  function render() {
    $('profileEmpty').classList.add('hidden');
    $('profileResults').classList.remove('hidden');
    $('exportProfileCsv').disabled = false;
    $('exportProfileJson').disabled = false;
    renderSummary();
    renderColumns();

    const first = state.profile.columns[0];
    if (first) renderDetail(first.name);
  }

  async function computeProfile(dataset) {
    const cellCount = dataset.rows.length * dataset.headers.length;
    if (typeof Worker === 'undefined' || cellCount < WORKER_CELL_THRESHOLD) {
      return { profile:core.profileDataset(dataset.rows, dataset.headers), processingMode:'main_thread' };
    }

    try {
      const profile = await new Promise((resolve, reject) => {
        const worker = new Worker('/profile-worker.js');
        const cleanup = () => worker.terminate();
        worker.addEventListener('message', event => {
          cleanup();
          if (event.data?.ok) resolve(event.data.profile);
          else reject(new Error(event.data?.error || 'Profiling worker failed.'));
        }, { once:true });
        worker.addEventListener('error', event => {
          cleanup();
          reject(new Error(event.message || 'Profiling worker failed.'));
        }, { once:true });
        worker.postMessage({ type:'profile', rows:dataset.rows, headers:dataset.headers });
      });
      return { profile, processingMode:'worker' };
    } catch {
      return { profile:core.profileDataset(dataset.rows, dataset.headers), processingMode:'fallback_main_thread' };
    }
  }

  async function profileDataset(dataset, fileName, source) {
    state.dataset = dataset;
    state.fileName = fileName;
    const startedAt = performance.now();
    const computed = await computeProfile(dataset);
    state.profile = computed.profile;
    render();

    track('profile_completed', {
      source,
      rows: state.profile.summary.rows,
      columns: state.profile.summary.columns,
      duplicate_rows: state.profile.summary.duplicateRows,
      mixed_columns: state.profile.summary.mixedColumns,
      has_missing: state.profile.summary.missingCells > 0,
      processing_mode:computed.processingMode,
      duration_ms:Math.round(performance.now() - startedAt)
    });
  }

  function saveProfileToProject() {
    const context = window.RowMendProjectContext;
    const projects = window.RowMendProjects;
    if (!context?.project) return;
    if (!state.profile) {
      setMessage('Load and profile a dataset before saving it to the project.', 'error');
      return;
    }

    try {
      const snapshot = projects.profileSnapshot(state.profile, state.fileName);
      context.saveArtifact('profile', { snapshot }, { label: state.fileName || 'Data profile' });
      setMessage('Structural profile snapshot saved to the active local project.', 'success');
      track('project_artifact_saved', { artifact:'profile' });
    } catch (error) {
      setMessage(error.message || 'Unable to save the profile to the project.', 'error');
    }
  }

  async function handleFile(file, sheetName = '', sheetChange = false) {
    try {
      setMessage('Reading and profiling locally…');
      $('profileWorkspace').setAttribute('aria-busy', 'true');
      const dataset = await readFile(file, sheetName);
      if (!dataset.headers.length) throw new Error('No columns were found in the file.');
      syncExcelSheetSelector(file, dataset);
      const largeDataset = dataset.rows.length * dataset.headers.length >= WORKER_CELL_THRESHOLD;
      if (largeDataset) setMessage('Large dataset detected. Profiling in the background…');
      await profileDataset(dataset, file.name, 'file');
      setMessage(`${file.name}${dataset.sheetName ? ` · ${dataset.sheetName}` : ''} profiled locally.`, 'success');
      if (sheetChange) {
        track('excel_sheet_selected', {
          tool:'profiler',
          sheet_count:dataset.sheetNames.length,
          sheet_index:Math.max(0, dataset.sheetNames.indexOf(dataset.sheetName))
        });
      } else {
        track('profile_file_loaded', {
          file_type: (file.name.split('.').pop() || '').toLowerCase(),
          rows: dataset.rows.length,
          columns: dataset.headers.length,
          sheet_count:dataset.sheetNames.length || undefined
        });
      }
    } catch (error) {
      setMessage(error.message || 'Unable to profile the file.', 'error');
    } finally {
      $('profileWorkspace').setAttribute('aria-busy', 'false');
    }
  }

  async function loadDemo() {
    state.currentFile = null;
    $('profileExcelSheetGroup').classList.add('hidden');
    const rows = [
      { CUSTOMER_ID:'1001', NAME:'Alice Rossi', EMAIL:'alice@example.com', COUNTRY:'IT', SIGNUP_DATE:'2026-01-10', CREDIT_LIMIT:'2500' },
      { CUSTOMER_ID:'1002', NAME:'Bob Verdi', EMAIL:'bob@example.com', COUNTRY:'IT', SIGNUP_DATE:'2026-02-14', CREDIT_LIMIT:'1800' },
      { CUSTOMER_ID:'1003', NAME:'Carla Neri', EMAIL:'', COUNTRY:'FR', SIGNUP_DATE:'2026-03-04', CREDIT_LIMIT:'3200' },
      { CUSTOMER_ID:'1004', NAME:'Diego Blu', EMAIL:'diego@example.com', COUNTRY:'IT', SIGNUP_DATE:'2026-03-21', CREDIT_LIMIT:'not-set' },
      { CUSTOMER_ID:'1005', NAME:'Eva Gialli', EMAIL:'eva@example.com', COUNTRY:'DE', SIGNUP_DATE:'2026-04-11', CREDIT_LIMIT:'4100' },
      { CUSTOMER_ID:'1005', NAME:'Eva Gialli', EMAIL:'eva@example.com', COUNTRY:'DE', SIGNUP_DATE:'2026-04-11', CREDIT_LIMIT:'4100' }
    ];
    const dataset = { headers:Object.keys(rows[0]), rows };
    await profileDataset(dataset, 'customers-profile-demo.csv', 'demo');
    setMessage('Demo dataset loaded.', 'success');
    track('profile_demo_loaded');
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

  function wireDropzone() {
    const input = $('profileFile');
    const drop = $('profileDrop');

    input.addEventListener('change', () => input.files[0] && handleFile(input.files[0]));
    $('profileExcelSheet').addEventListener('change', () => {
      if (state.currentFile) handleFile(state.currentFile, $('profileExcelSheet').value, true);
    });
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
    track('profile_opened');
    if (window.RowMendProjectContext?.project) {
      window.RowMendProjectContext.addAction('Save current profile', saveProfileToProject);
    }
    wireDropzone();
    $('loadProfileDemo').addEventListener('click', loadDemo);

    $('exportProfileCsv').addEventListener('click', () => {
      if (!state.profile) return;
      download(core.profileToCsv(state.profile), 'rowmend-data-profile.csv', 'text/csv;charset=utf-8');
      track('profile_exported', { format:'csv' });
    });

    $('exportProfileJson').addEventListener('click', () => {
      if (!state.profile) return;
      download(JSON.stringify(state.profile, null, 2), 'rowmend-data-profile.json', 'application/json;charset=utf-8');
      track('profile_exported', { format:'json' });
    });
  }

  init();
})();