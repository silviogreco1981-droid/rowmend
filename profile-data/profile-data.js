(() => {
  'use strict';

  const core = window.RowMendData;
  if (!core) return;

  const $ = id => document.getElementById(id);
  const state = { dataset: null, profile: null, fileName: '' };

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

  async function readFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    if (ext === 'csv' || ext === 'tsv') {
      const text = await file.text();
      const delimiter = selectedDelimiter(text, ext);
      return core.parseDelimited(text, delimiter);
    }

    if ((ext === 'xlsx' || ext === 'xls') && window.XLSX) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      if (!rawRows.length) return { headers: [], rows: [] };

      const headers = Object.keys(rawRows[0]);
      return { headers, rows: rawRows };
    }

    if (ext === 'xlsx' || ext === 'xls') {
      throw new Error('Excel parser is still loading. Please retry in a moment.');
    }

    throw new Error('Unsupported file type. Use CSV, TSV, XLSX or XLS.');
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

  function profileDataset(dataset, fileName, source) {
    state.dataset = dataset;
    state.fileName = fileName;
    state.profile = core.profileDataset(dataset.rows, dataset.headers);
    render();

    track('profile_completed', {
      source,
      rows: state.profile.summary.rows,
      columns: state.profile.summary.columns,
      duplicate_rows: state.profile.summary.duplicateRows,
      mixed_columns: state.profile.summary.mixedColumns,
      has_missing: state.profile.summary.missingCells > 0
    });
  }

  async function handleFile(file) {
    try {
      setMessage('Reading and profiling locally…');
      const dataset = await readFile(file);
      if (!dataset.headers.length) throw new Error('No columns were found in the file.');
      profileDataset(dataset, file.name, 'file');
      setMessage(`${file.name} profiled locally.`, 'success');
      track('profile_file_loaded', {
        file_type: (file.name.split('.').pop() || '').toLowerCase(),
        rows: dataset.rows.length,
        columns: dataset.headers.length
      });
    } catch (error) {
      setMessage(error.message || 'Unable to profile the file.', 'error');
    }
  }

  function loadDemo() {
    const rows = [
      { CUSTOMER_ID:'1001', NAME:'Alice Rossi', EMAIL:'alice@example.com', COUNTRY:'IT', SIGNUP_DATE:'2026-01-10', CREDIT_LIMIT:'2500' },
      { CUSTOMER_ID:'1002', NAME:'Bob Verdi', EMAIL:'bob@example.com', COUNTRY:'IT', SIGNUP_DATE:'2026-02-14', CREDIT_LIMIT:'1800' },
      { CUSTOMER_ID:'1003', NAME:'Carla Neri', EMAIL:'', COUNTRY:'FR', SIGNUP_DATE:'2026-03-04', CREDIT_LIMIT:'3200' },
      { CUSTOMER_ID:'1004', NAME:'Diego Blu', EMAIL:'diego@example.com', COUNTRY:'IT', SIGNUP_DATE:'2026-03-21', CREDIT_LIMIT:'not-set' },
      { CUSTOMER_ID:'1005', NAME:'Eva Gialli', EMAIL:'eva@example.com', COUNTRY:'DE', SIGNUP_DATE:'2026-04-11', CREDIT_LIMIT:'4100' },
      { CUSTOMER_ID:'1005', NAME:'Eva Gialli', EMAIL:'eva@example.com', COUNTRY:'DE', SIGNUP_DATE:'2026-04-11', CREDIT_LIMIT:'4100' }
    ];
    const dataset = { headers:Object.keys(rows[0]), rows };
    profileDataset(dataset, 'customers-profile-demo.csv', 'demo');
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