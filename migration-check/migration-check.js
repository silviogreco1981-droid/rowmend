(() => {
  'use strict';

  const core = window.RowMendMigration;
  if (!core) return;

  const $ = id => document.getElementById(id);
  const state = {
    source: null,
    target: null,
    mappings: [],
    keySources: new Set(),
    result: null
  };

  function track(eventName, properties = {}) {
    window.RowMendAnalytics?.track(eventName, properties);
  }

  function parseDelimited(text, delimiter) {
    const source = text.replace(/^\uFEFF/, '');
    const records = [];
    let record = [];
    let field = '';
    let quoted = false;
    const pushField = () => { record.push(field); field = ''; };
    const pushRecord = () => {
      pushField();
      if (record.some(v => String(v).length > 0)) records.push(record);
      record = [];
    };
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (ch === '"') {
        if (quoted && source[i + 1] === '"') { field += '"'; i++; }
        else quoted = !quoted;
        continue;
      }
      if (ch === delimiter && !quoted) { pushField(); continue; }
      if ((ch === '\n' || ch === '\r') && !quoted) {
        if (ch === '\r' && source[i + 1] === '\n') i++;
        pushRecord();
        continue;
      }
      field += ch;
    }
    if (quoted) throw new Error('Malformed CSV: an opening quote is not closed.');
    if (field.length || record.length) pushRecord();
    if (!records.length) return [];
    const headers = records[0].map(h => String(h).trim());
    return records.slice(1).map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
  }

  function detectDelimiter(text) {
    const sample = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).slice(0, 8);
    const candidates = [',', ';', '\t', '|'];
    let best = ',';
    let bestScore = -1;
    candidates.forEach(delimiter => {
      const counts = sample.map(line => {
        let quoted = false;
        let count = 0;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') {
            if (quoted && line[i + 1] === '"') i++;
            else quoted = !quoted;
          } else if (!quoted && line[i] === delimiter) count++;
        }
        return count;
      });
      const nonZero = counts.filter(Boolean);
      if (!nonZero.length) return;
      const mode = nonZero.sort((a, b) => a - b)[Math.floor(nonZero.length / 2)];
      const consistency = nonZero.filter(c => c === mode).length / sample.length;
      const score = consistency * 100 + nonZero.length * 2 + mode;
      if (score > bestScore) { best = delimiter; bestScore = score; }
    });
    return best;
  }

  function normalizeRows(rows) {
    return rows.filter(row => row && Object.values(row).some(v => String(v ?? '').trim() !== ''));
  }

  async function readCsv(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'tsv'].includes(ext)) throw new Error('Migration Check currently supports CSV and TSV files.');
    const text = await file.text();
    const delimiter = ext === 'tsv' ? '\t' : detectDelimiter(text);
    const rows = normalizeRows(parseDelimited(text, delimiter));
    const headers = rows.length ? Object.keys(rows[0]) : [];
    if (!headers.length) throw new Error('No columns were found in the file.');
    return { fileName: file.name, rows, headers, delimiter };
  }

  function setMessage(message, kind = '') {
    const el = $('migrationMessage');
    el.textContent = message || '';
    el.className = `migration-message ${kind}`.trim();
  }

  function renderFile(side, data) {
    const box = $(`${side}Summary`);
    if (!data) {
      box.innerHTML = '<span>No file loaded</span>';
      return;
    }
    box.innerHTML = `<strong>${escapeHtml(data.fileName)}</strong><span>${data.rows.length.toLocaleString()} rows · ${data.headers.length} columns</span>`;
  }

  function rebuildMappings() {
    if (!state.source || !state.target) return;
    state.mappings = core.autoMapColumns(state.source.headers, state.target.headers);
    state.keySources.clear();
    const likelyKey = state.mappings.find(m => /(^id$|_id$|code$|key$)/i.test(m.sourceColumn) && m.targetColumn) || state.mappings.find(m => m.targetColumn);
    if (likelyKey) state.keySources.add(likelyKey.sourceColumn);
    if (!applyProjectMigrationPreset(true)) renderMappings();
  }

  function renderMappings() {
    const wrap = $('mappingWrap');
    if (!state.source || !state.target) {
      wrap.innerHTML = '<p class="muted">Load both files to configure the comparison.</p>';
      $('compareButton').disabled = true;
      return;
    }

    const options = state.target.headers.map(h => `<option value="${escapeAttr(h)}">${escapeHtml(h)}</option>`).join('');
    wrap.innerHTML = `
      <div class="mapping-help"><strong>Choose the key and confirm column mapping.</strong><span>Use more than one key checkbox for composite keys.</span></div>
      <div class="mapping-grid migration-map-header"><span>Key</span><span>Source</span><span>Target</span><span>Compare</span></div>
      ${state.mappings.map((m, index) => `
        <div class="mapping-grid" data-map-index="${index}">
          <label class="key-toggle"><input type="checkbox" data-role="key" ${state.keySources.has(m.sourceColumn) ? 'checked' : ''} /> <span class="sr-only">Use as key</span></label>
          <strong title="${escapeAttr(m.sourceColumn)}">${escapeHtml(m.sourceColumn)}</strong>
          <select data-role="target"><option value="">Ignore / unmapped</option>${options}</select>
          <label class="key-toggle"><input type="checkbox" data-role="compare" ${m.compare ? 'checked' : ''} ${m.targetColumn ? '' : 'disabled'} /> <span class="sr-only">Compare column</span></label>
        </div>`).join('')}`;

    wrap.querySelectorAll('[data-map-index]').forEach(row => {
      const index = Number(row.dataset.mapIndex);
      const mapping = state.mappings[index];
      const target = row.querySelector('[data-role="target"]');
      target.value = mapping.targetColumn || '';
      target.addEventListener('change', () => {
        mapping.targetColumn = target.value;
        mapping.compare = Boolean(target.value) && row.querySelector('[data-role="compare"]').checked;
        row.querySelector('[data-role="compare"]').disabled = !target.value;
        validateReady();
      });
      row.querySelector('[data-role="key"]').addEventListener('change', event => {
        if (event.target.checked) state.keySources.add(mapping.sourceColumn);
        else state.keySources.delete(mapping.sourceColumn);
        validateReady();
      });
      row.querySelector('[data-role="compare"]').addEventListener('change', event => {
        mapping.compare = event.target.checked;
      });
    });

    validateReady();
  }

  function saveMigrationPresetToProject() {
    const context = window.RowMendProjectContext;
    if (!context?.project) return;
    if (!state.source || !state.target || !state.mappings.length) {
      setMessage('Load source and target datasets before saving a migration preset.', 'error');
      return;
    }

    try {
      context.saveArtifact('migrationPreset', {
        mappings: state.mappings.map(mapping => ({
          sourceColumn: mapping.sourceColumn,
          targetColumn: mapping.targetColumn || '',
          compare: mapping.compare !== false
        })),
        keySources: [...state.keySources],
        options: comparisonOptions()
      }, { label:'Source-to-target comparison preset' });
      setMessage('Current migration mapping saved to the active local project.', 'success');
      track('project_artifact_saved', { artifact:'migration_preset', mappings:state.mappings.length, keys:state.keySources.size });
    } catch (error) {
      setMessage(error.message || 'Unable to save the migration preset.', 'error');
    }
  }

  function applyProjectMigrationPreset(silent = false) {
    const context = window.RowMendProjectContext;
    const artifact = context?.getArtifact('migrationPreset');
    if (!artifact) {
      if (!silent) setMessage('The active project does not contain a migration preset yet.', 'error');
      return false;
    }
    if (!state.source || !state.target || !state.mappings.length) {
      if (!silent) setMessage('Load source and target datasets before applying the project migration preset.', 'error');
      return false;
    }

    const targetHeaders = new Set(state.target.headers);
    const savedBySource = new Map((artifact.mappings || []).map(mapping => [mapping.sourceColumn, mapping]));
    let applied = 0;

    state.mappings.forEach(mapping => {
      const saved = savedBySource.get(mapping.sourceColumn);
      if (!saved) return;
      mapping.targetColumn = saved.targetColumn && targetHeaders.has(saved.targetColumn) ? saved.targetColumn : '';
      mapping.compare = Boolean(mapping.targetColumn) && saved.compare !== false;
      applied += 1;
    });

    state.keySources.clear();
    (artifact.keySources || []).forEach(sourceColumn => {
      const mapping = state.mappings.find(item => item.sourceColumn === sourceColumn);
      if (mapping?.targetColumn) state.keySources.add(sourceColumn);
    });

    if (artifact.options) {
      $('trimWhitespace').checked = artifact.options.trimWhitespace !== false;
      $('emptyEqualsNull').checked = artifact.options.emptyEqualsNull !== false;
      $('caseInsensitive').checked = artifact.options.caseInsensitive === true;
    }

    renderMappings();
    if (!silent) {
      setMessage(`Project migration preset applied to ${applied} source column${applied === 1 ? '' : 's'}.`, 'success');
      track('project_artifact_loaded', { artifact:'migration_preset', mappings:applied });
    }
    return true;
  }

  function validateReady() {
    const keyMappings = state.mappings.filter(m => state.keySources.has(m.sourceColumn));
    const ready = Boolean(state.source && state.target && keyMappings.length && keyMappings.every(m => m.targetColumn));
    $('compareButton').disabled = !ready;
  }

  function comparisonOptions() {
    return {
      trimWhitespace: $('trimWhitespace').checked,
      emptyEqualsNull: $('emptyEqualsNull').checked,
      caseInsensitive: $('caseInsensitive').checked
    };
  }

  function runComparison() {
    setMessage('');
    try {
      const keyMappings = state.mappings.filter(m => state.keySources.has(m.sourceColumn));
      track('comparison_started');
      state.result = core.compareDatasets({
        sourceRows: state.source.rows,
        targetRows: state.target.rows,
        keyMappings,
        columnMappings: state.mappings,
        options: comparisonOptions()
      });
      renderResults();
      const s = state.result.summary;
      track('comparison_completed', {
        source_rows: s.sourceRows,
        target_rows: s.targetRows,
        has_issues: s.hasIssues,
        missing_count: s.missing,
        extra_count: s.extra,
        changed_count: s.changed,
        duplicate_count: s.duplicateKeys
      });
      $('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      setMessage(error.message || 'Comparison failed.', 'error');
    }
  }

  function metric(label, value, cls = '') {
    return `<div class="migration-metric ${cls}"><strong>${Number(value).toLocaleString()}</strong><span>${label}</span></div>`;
  }

  function renderResults() {
    const result = state.result;
    const s = result.summary;
    $('resultsSection').classList.remove('hidden');
    $('statusCard').className = `migration-status ${s.hasIssues ? 'review' : 'pass'}`;
    $('statusCard').innerHTML = s.hasIssues
      ? '<strong>REVIEW REQUIRED</strong><span>Differences were detected. Review the categories below before closing the migration.</span>'
      : '<strong>PASS</strong><span>No migration differences were detected with the selected rules.</span>';
    $('summaryMetrics').innerHTML = [
      metric('Source rows', s.sourceRows), metric('Target rows', s.targetRows), metric('Matched', s.matched, 'good'),
      metric('Changed', s.changed, s.changed ? 'warn' : ''), metric('Missing', s.missing, s.missing ? 'bad' : ''),
      metric('Extra', s.extra, s.extra ? 'warn' : ''), metric('Duplicate keys', s.duplicateKeys, s.duplicateKeys ? 'bad' : '')
    ].join('');

    const tabs = [
      ['changed', `Changed (${s.changed})`], ['missing', `Missing (${s.missing})`], ['extra', `Extra (${s.extra})`], ['duplicates', `Duplicates (${s.duplicateKeys})`]
    ];
    $('resultTabs').innerHTML = tabs.map(([id, label], i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-result-tab="${id}" type="button">${label}</button>`).join('');
    $('resultTabs').querySelectorAll('[data-result-tab]').forEach(button => button.addEventListener('click', () => {
      $('resultTabs').querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === button));
      renderResultPanel(button.dataset.resultTab);
    }));
    renderResultPanel('changed');
    $('exportIssues').disabled = !s.hasIssues;
  }

  function displayKey(key) {
    try { return JSON.parse(key).join(' · '); } catch { return key; }
  }

  function renderResultPanel(type) {
    const panel = $('resultPanel');
    const result = state.result;
    if (type === 'changed') {
      const rows = result.changed.flatMap(item => item.differences.map(diff => `
        <tr><td>${escapeHtml(displayKey(item.key))}</td><td>${escapeHtml(diff.sourceColumn)}</td><td title="${escapeAttr(diff.sourceValue)}">${escapeHtml(diff.sourceValue)}</td><td title="${escapeAttr(diff.targetValue)}">${escapeHtml(diff.targetValue)}</td></tr>`));
      panel.innerHTML = rows.length ? tableHtml(['Key', 'Column', 'Source', 'Target'], rows) : emptyResult('No changed records.');
    } else if (type === 'missing') {
      const rows = result.missing.map(item => `<tr><td>${escapeHtml(displayKey(item.key))}</td><td><code>${escapeHtml(JSON.stringify(item.row))}</code></td></tr>`);
      panel.innerHTML = rows.length ? tableHtml(['Key', 'Source row'], rows) : emptyResult('No missing records.');
    } else if (type === 'extra') {
      const rows = result.extra.map(item => `<tr><td>${escapeHtml(displayKey(item.key))}</td><td><code>${escapeHtml(JSON.stringify(item.row))}</code></td></tr>`);
      panel.innerHTML = rows.length ? tableHtml(['Key', 'Target row'], rows) : emptyResult('No extra records.');
    } else {
      const all = [
        ...result.duplicates.source.map(item => ({ side: 'Source', ...item })),
        ...result.duplicates.target.map(item => ({ side: 'Target', ...item }))
      ];
      const rows = all.map(item => `<tr><td>${item.side}</td><td>${escapeHtml(displayKey(item.key))}</td><td>${item.count}</td></tr>`);
      panel.innerHTML = rows.length ? tableHtml(['Dataset', 'Key', 'Occurrences'], rows) : emptyResult('No duplicate keys.');
    }
  }

  function tableHtml(headers, rows) {
    return `<div class="migration-table-wrap"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }

  function emptyResult(message) {
    return `<div class="migration-empty"><strong>${escapeHtml(message)}</strong><span>This category is clean for the current comparison.</span></div>`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }
  function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }

  function downloadText(content, name, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFile(side, file) {
    try {
      const data = await readCsv(file);
      state[side] = data;
      renderFile(side, data);
      track(side === 'source' ? 'source_loaded' : 'target_loaded', { rows: data.rows.length, columns: data.headers.length });
      if (state.source && state.target) rebuildMappings();
      setMessage('');
    } catch (error) {
      state[side] = null;
      renderFile(side, null);
      setMessage(error.message || 'Unable to read the file.', 'error');
      validateReady();
    }
  }

  function wireDropzone(side) {
    const input = $(`${side}File`);
    const drop = $(`${side}Drop`);
    input.addEventListener('change', () => input.files[0] && handleFile(side, input.files[0]));
    ['dragenter', 'dragover'].forEach(name => drop.addEventListener(name, event => { event.preventDefault(); drop.classList.add('dragging'); }));
    ['dragleave', 'drop'].forEach(name => drop.addEventListener(name, event => { event.preventDefault(); drop.classList.remove('dragging'); }));
    drop.addEventListener('drop', event => event.dataTransfer.files[0] && handleFile(side, event.dataTransfer.files[0]));
  }

  function loadDemo() {
    state.source = {
      fileName: 'customers-before.csv',
      headers: ['ID', 'NAME', 'EMAIL', 'STATUS'],
      rows: [
        { ID: '1001', NAME: 'Alice Rossi', EMAIL: 'alice@example.com', STATUS: 'ACTIVE' },
        { ID: '1002', NAME: 'Bob Verdi', EMAIL: 'bob@example.com', STATUS: 'ACTIVE' },
        { ID: '1003', NAME: 'Carla Neri', EMAIL: 'carla@example.com', STATUS: 'ACTIVE' },
        { ID: '1004', NAME: 'Diego Blu', EMAIL: 'diego@example.com', STATUS: 'ACTIVE' }
      ]
    };
    state.target = {
      fileName: 'customers-after.csv',
      headers: ['id', 'name', 'email', 'status'],
      rows: [
        { id: '1001', name: 'Alice Rossi', email: 'alice@example.com', status: 'ACTIVE' },
        { id: '1002', name: 'Bob Verdi', email: 'bob.new@example.com', status: 'ACTIVE' },
        { id: '1004', name: 'Diego Blu ', email: 'diego@example.com', status: 'ACTIVE' },
        { id: '1005', name: 'Eva Gialli', email: 'eva@example.com', status: 'ACTIVE' }
      ]
    };
    renderFile('source', state.source);
    renderFile('target', state.target);
    rebuildMappings();
    track('migration_demo_loaded');
    setMessage('Demo loaded. Compare to see one changed, one missing and one extra record.', 'success');
  }

  function init() {
    track('migration_check_opened');
    if (window.RowMendProjectContext?.project) {
      window.RowMendProjectContext.addAction('Save migration preset', saveMigrationPresetToProject);
      window.RowMendProjectContext.addAction('Load project preset', () => applyProjectMigrationPreset(false));
    }
    wireDropzone('source');
    wireDropzone('target');
    $('loadMigrationDemo').addEventListener('click', loadDemo);
    $('compareButton').addEventListener('click', runComparison);
    $('exportIssues').addEventListener('click', () => {
      if (!state.result) return;
      downloadText(core.issuesToCsv(state.result), 'rowmend-migration-issues.csv', 'text/csv;charset=utf-8');
      track('report_exported', { format: 'csv' });
    });
    $('migrationProInterest').addEventListener('click', () => {
      track('pro_interest', { context: 'migration_check' });
      window.location.href = '/#pricing';
    });
    renderFile('source', null);
    renderFile('target', null);
  }

  init();
})();
