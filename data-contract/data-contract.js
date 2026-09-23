(() => {
  'use strict';

  const dataCore = window.RowMendData;
  const contractCore = window.RowMendContract;
  if (!dataCore || !contractCore) return;

  const STORAGE_KEY = 'rowmend_data_contracts_v060';
  const $ = id => document.getElementById(id);

  const state = {
    baseline: null,
    baselineFileName: '',
    candidate: null,
    candidateFileName: '',
    contract: null,
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

  function setMessage(target, message, kind = '') {
    const el = $(target);
    el.textContent = message || '';
    el.className = `contract-message ${kind}`.trim();
  }

  function selectedDelimiter(text, ext) {
    const mode = $('contractDelimiter').value;
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

  function fileSummaryHtml(fileName, dataset) {
    if (!dataset) return '<span>No file loaded.</span>';
    return `<strong>${escapeHtml(fileName)}</strong><span>${dataset.rows.length.toLocaleString()} rows · ${dataset.headers.length} columns</span>`;
  }

  function stem(fileName) {
    return String(fileName || 'dataset').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  }

  function formatPercent(rate) {
    return Number(rate || 0) * 100;
  }

  function getStoredContracts() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function setStoredContracts(contracts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contracts));
  }

  function refreshStoredContracts(selectedName = '') {
    const contracts = getStoredContracts();
    $('savedContracts').innerHTML = '<option value="">Saved contracts</option>' +
      Object.keys(contracts).sort((a, b) => a.localeCompare(b))
        .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    if (selectedName && contracts[selectedName]) $('savedContracts').value = selectedName;
  }

  function renderRules() {
    const tbody = $('contractRules');

    tbody.innerHTML = state.contract.columns.map((rule, index) => {
      const isKey = (state.contract.settings.keyColumns || []).includes(rule.name);
      return `<tr data-rule-index="${index}">
        <td class="contract-key-cell"><input type="checkbox" data-field="key" ${isKey ? 'checked' : ''} aria-label="Use ${escapeHtml(rule.name)} in composite key" /></td>
        <td title="${escapeHtml(rule.name)}">${escapeHtml(rule.name)}</td>
        <td><select data-field="expectedType">
          ${contractCore.TYPE_OPTIONS.map(type => `<option value="${type}" ${type === rule.expectedType ? 'selected' : ''}>${type}</option>`).join('')}
        </select></td>
        <td class="contract-key-cell"><input type="checkbox" data-field="required" ${rule.required ? 'checked' : ''} /></td>
        <td class="contract-key-cell"><input type="checkbox" data-field="unique" ${rule.unique ? 'checked' : ''} /></td>
        <td><input type="number" data-field="maxMissingRate" min="0" max="100" step="0.1" value="${formatPercent(rule.maxMissingRate).toFixed(1)}" /></td>
        <td><input type="number" data-field="maxMixedTypeRate" min="0" max="100" step="0.1" value="${formatPercent(rule.maxMixedTypeRate).toFixed(1)}" /></td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('input,select').forEach(control => {
      control.addEventListener('change', () => {
        syncContractFromForm();
        clearResult();
      });
    });
  }

  function renderContract() {
    if (!state.contract) {
      $('contractEmpty').classList.remove('hidden');
      $('contractEditor').classList.add('hidden');
      updateCheckReadiness();
      return;
    }

    $('contractEmpty').classList.add('hidden');
    $('contractEditor').classList.remove('hidden');

    $('contractName').value = state.contract.name || '';
    $('minRows').value = Number.isFinite(Number(state.contract.settings?.minRows))
      ? String(state.contract.settings.minRows)
      : '0';
    $('maxRows').value = state.contract.settings?.maxRows === null ||
      state.contract.settings?.maxRows === undefined
      ? ''
      : String(state.contract.settings.maxRows);
    $('strictColumns').checked = state.contract.settings?.strictColumns !== false;
    $('savedContractName').value = state.contract.name || '';
    renderRules();
    updateCheckReadiness();
  }

  function syncContractFromForm() {
    if (!state.contract) return null;

    state.contract.name = $('contractName').value.trim() || 'Untitled data contract';
    state.contract.updatedAt = new Date().toISOString();
    state.contract.settings.strictColumns = $('strictColumns').checked;
    state.contract.settings.minRows = Math.max(0, Number($('minRows').value || 0));

    const maxRowsText = $('maxRows').value.trim();
    state.contract.settings.maxRows = maxRowsText === '' ? null : Math.max(0, Number(maxRowsText));

    const keyColumns = [];
    $('contractRules').querySelectorAll('[data-rule-index]').forEach(row => {
      const index = Number(row.dataset.ruleIndex);
      const rule = state.contract.columns[index];
      if (!rule) return;

      row.querySelectorAll('[data-field]').forEach(control => {
        const field = control.dataset.field;

        if (field === 'key') {
          if (control.checked) keyColumns.push(rule.name);
        } else if (field === 'required' || field === 'unique') {
          rule[field] = control.checked;
        } else if (field === 'maxMissingRate' || field === 'maxMixedTypeRate') {
          const percent = Math.min(100, Math.max(0, Number(control.value || 0)));
          rule[field] = percent / 100;
        } else {
          rule[field] = control.value;
        }
      });
    });

    state.contract.settings.keyColumns = keyColumns;
    contractCore.validateContract(state.contract);
    return state.contract;
  }

  function generateContract() {
    if (!state.baseline) return;

    try {
      const profile = dataCore.profileDataset(state.baseline.rows, state.baseline.headers);
      const name = `${stem(state.baselineFileName)} contract`;
      state.contract = contractCore.createContract(profile, { name });

      state.contract.settings.keyColumns = state.contract.columns
        .filter(rule => rule.unique)
        .map(rule => rule.name)
        .slice(0, 3);

      renderContract();
      clearResult();
      setMessage('contractMessage', 'Contract generated. Review the proposed rules before saving or checking a new dataset.', 'success');

      track('contract_created', {
        columns:state.contract.columns.length,
        baseline_rows:profile.summary.rows,
        key_columns:state.contract.settings.keyColumns.length
      });
    } catch (error) {
      setMessage('contractMessage', error.message || 'Unable to generate the contract.', 'error');
    }
  }

  function updateCheckReadiness() {
    const ready = Boolean(state.contract && state.candidate);
    $('checkPrompt').classList.toggle('hidden', ready);
    $('checkAction').classList.toggle('hidden', !ready);
  }

  function clearResult() {
    state.result = null;
    $('contractResultsStage').classList.add('hidden');
  }

  async function loadBaselineFile(file) {
    try {
      setMessage('contractMessage', 'Reading baseline locally…');
      const dataset = await readDataset(file);
      if (!dataset.headers.length) throw new Error('No columns were found in the baseline.');
      state.baseline = dataset;
      state.baselineFileName = file.name;
      $('baselineSummary').innerHTML = fileSummaryHtml(file.name, dataset);
      $('generateContract').disabled = false;
      clearResult();
      setMessage('contractMessage', 'Baseline loaded. Generate a contract when ready.', 'success');
      track('contract_baseline_loaded', {
        source:'file',
        rows:dataset.rows.length,
        columns:dataset.headers.length,
        file_type:(file.name.split('.').pop() || '').toLowerCase()
      });
    } catch (error) {
      setMessage('contractMessage', error.message || 'Unable to read the baseline.', 'error');
    }
  }

  async function loadCandidateFile(file) {
    try {
      setMessage('checkMessage', 'Reading candidate locally…');
      const dataset = await readDataset(file);
      if (!dataset.headers.length) throw new Error('No columns were found in the candidate dataset.');
      state.candidate = dataset;
      state.candidateFileName = file.name;
      $('candidateSummary').innerHTML = fileSummaryHtml(file.name, dataset);
      clearResult();
      updateCheckReadiness();
      setMessage('checkMessage', state.contract ? 'Candidate ready for contract checking.' : 'Candidate loaded. Create or load a contract next.', 'success');
      track('contract_candidate_loaded', {
        source:'file',
        rows:dataset.rows.length,
        columns:dataset.headers.length,
        file_type:(file.name.split('.').pop() || '').toLowerCase()
      });
    } catch (error) {
      setMessage('checkMessage', error.message || 'Unable to read the candidate dataset.', 'error');
    }
  }

  function loadBaselineDemo() {
    const rows = [
      { CUSTOMER_ID:'1001', NAME:'Alice Rossi', EMAIL:'alice@example.com', STATUS:'ACTIVE', AMOUNT:'2500.00', CREATED_AT:'2026-01-10' },
      { CUSTOMER_ID:'1002', NAME:'Bob Verdi', EMAIL:'bob@example.com', STATUS:'ACTIVE', AMOUNT:'1800.00', CREATED_AT:'2026-02-14' },
      { CUSTOMER_ID:'1003', NAME:'Carla Neri', EMAIL:'carla@example.com', STATUS:'ACTIVE', AMOUNT:'3200.00', CREATED_AT:'2026-03-04' },
      { CUSTOMER_ID:'1004', NAME:'Diego Blu', EMAIL:'diego@example.com', STATUS:'INACTIVE', AMOUNT:'950.00', CREATED_AT:'2026-03-21' },
      { CUSTOMER_ID:'1005', NAME:'Eva Gialli', EMAIL:'eva@example.com', STATUS:'ACTIVE', AMOUNT:'4100.00', CREATED_AT:'2026-04-11' }
    ];
    state.baseline = { headers:Object.keys(rows[0]), rows };
    state.baselineFileName = 'known-good-customers.csv';
    $('baselineSummary').innerHTML = fileSummaryHtml(state.baselineFileName, state.baseline);
    $('generateContract').disabled = false;
    setMessage('contractMessage', 'Known-good demo loaded. Generate its contract.', 'success');
    track('contract_baseline_loaded', { source:'demo', rows:rows.length, columns:Object.keys(rows[0]).length });
  }

  function loadCandidateDemo() {
    const rows = [
      { CUSTOMER_ID:'1001', NAME:'Alice Rossi', STATUS:'ACTIVE', AMOUNT:'2500.00', CREATED_AT:'2026-01-10', REGION:'EU' },
      { CUSTOMER_ID:'1002', NAME:'Bob Verdi', STATUS:'ACTIVE', AMOUNT:'oops', CREATED_AT:'2026-02-14', REGION:'EU' },
      { CUSTOMER_ID:'1002', NAME:'Bob Duplicate', STATUS:'ACTIVE', AMOUNT:'1800.00', CREATED_AT:'not-a-date', REGION:'EU' },
      { CUSTOMER_ID:'1004', NAME:'', STATUS:'INACTIVE', AMOUNT:'950.00', CREATED_AT:'2026-03-21', REGION:'EU' }
    ];
    state.candidate = { headers:Object.keys(rows[0]), rows };
    state.candidateFileName = 'drifted-customers.csv';
    $('candidateSummary').innerHTML = fileSummaryHtml(state.candidateFileName, state.candidate);
    clearResult();
    updateCheckReadiness();
    setMessage('checkMessage', state.contract ? 'Drifted demo ready. Run the contract check.' : 'Drifted demo loaded. Create or load a contract next.', 'success');
    track('contract_candidate_loaded', { source:'demo', rows:rows.length, columns:Object.keys(rows[0]).length });
  }

  function metric(label, value, cls = '') {
    return `<div class="contract-metric ${cls}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
  }

  function renderResult(result) {
    $('contractResultsStage').classList.remove('hidden');

    const pass = result.status === 'PASS';
    $('contractStatus').className = `contract-status ${pass ? 'pass' : 'review'}`;
    $('contractStatus').innerHTML = pass
      ? '<strong>PASS</strong><span>The candidate satisfies the active local data contract.</span>'
      : '<strong>REVIEW REQUIRED</strong><span>Schema or data-quality drift was detected. Review the issues below before continuing the workflow.</span>';

    const s = result.summary;
    $('contractMetrics').innerHTML = [
      metric('Rows', s.rows.toLocaleString()),
      metric('Columns', s.columns.toLocaleString()),
      metric('Errors', s.errors.toLocaleString(), s.errors ? 'bad' : ''),
      metric('Warnings', s.warnings.toLocaleString(), s.warnings ? 'warn' : ''),
      metric('Schema drift', (s.missingColumns + s.unexpectedColumns + s.typeChanges).toLocaleString(), (s.missingColumns + s.unexpectedColumns + s.typeChanges) ? 'warn' : ''),
      metric('Rule violations', s.ruleViolations.toLocaleString(), s.ruleViolations ? 'bad' : '')
    ].join('');

    $('noContractIssues').classList.toggle('hidden', result.issues.length > 0);
    const tbody = $('contractIssues');
    tbody.closest('.migration-table-wrap').classList.toggle('hidden', result.issues.length === 0);

    tbody.innerHTML = result.issues.map(item => `
      <tr>
        <td><span class="issue-severity ${item.severity}">${escapeHtml(item.severity)}</span></td>
        <td class="type">${escapeHtml(item.type.replace(/_/g, ' '))}</td>
        <td>${escapeHtml(item.column || '—')}</td>
        <td>${escapeHtml(item.message)}</td>
      </tr>`).join('');

    $('exportContractIssues').disabled = result.issues.length === 0;
    $('contractResultsStage').scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function runCheck() {
    if (!state.contract || !state.candidate) return;

    try {
      syncContractFromForm();
      setMessage('checkMessage', 'Running the contract locally…');
      track('contract_check_started', {
        contract_columns:state.contract.columns.length,
        candidate_rows:state.candidate.rows.length,
        candidate_columns:state.candidate.headers.length
      });

      const profile = dataCore.profileDataset(state.candidate.rows, state.candidate.headers);
      state.result = contractCore.checkContract(state.candidate, profile, state.contract);
      renderResult(state.result);
      setMessage('checkMessage', state.result.status === 'PASS' ? 'Contract check passed.' : 'Contract check completed with issues.', state.result.status === 'PASS' ? 'success' : '');

      track('contract_check_completed', {
        status:state.result.status,
        issues:state.result.summary.issues,
        errors:state.result.summary.errors,
        warnings:state.result.summary.warnings,
        missing_columns:state.result.summary.missingColumns,
        unexpected_columns:state.result.summary.unexpectedColumns,
        type_changes:state.result.summary.typeChanges,
        rule_violations:state.result.summary.ruleViolations
      });
    } catch (error) {
      setMessage('checkMessage', error.message || 'Unable to run the contract check.', 'error');
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

  function exportContract() {
    try {
      syncContractFromForm();
      const safeName = (state.contract.name || 'data-contract').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'data-contract';
      download(JSON.stringify(state.contract, null, 2), `${safeName}.rowmend-contract.json`, 'application/json;charset=utf-8');
      track('contract_exported', { columns:state.contract.columns.length, key_columns:state.contract.settings.keyColumns.length });
    } catch (error) {
      setMessage('contractMessage', error.message || 'Unable to export the contract.', 'error');
    }
  }

  function saveContractWithName(name) {
    syncContractFromForm();
    const finalName = String(name || state.contract.name || '').trim();
    if (!finalName) throw new Error('Enter a contract name first.');

    state.contract.name = finalName;
    state.contract.updatedAt = new Date().toISOString();
    const contracts = getStoredContracts();
    contracts[finalName] = contractCore.cloneContract(state.contract);
    setStoredContracts(contracts);
    $('contractName').value = finalName;
    $('savedContractName').value = finalName;
    refreshStoredContracts(finalName);
    track('contract_saved_local', { columns:state.contract.columns.length, key_columns:state.contract.settings.keyColumns.length });
    setMessage('contractMessage', `Contract "${finalName}" saved in this browser.`, 'success');
  }

  function loadStoredContract() {
    const name = $('savedContracts').value;
    if (!name) return;
    const contracts = getStoredContracts();

    try {
      contractCore.validateContract(contracts[name]);
      state.contract = contractCore.cloneContract(contracts[name]);
      renderContract();
      clearResult();
      setMessage('contractMessage', `Contract "${name}" loaded from this browser.`, 'success');
      track('contract_loaded_local', { columns:state.contract.columns.length });
    } catch (error) {
      setMessage('contractMessage', error.message || 'Unable to load the saved contract.', 'error');
    }
  }

  function deleteStoredContract() {
    const name = $('savedContracts').value;
    if (!name) return;
    const contracts = getStoredContracts();
    delete contracts[name];
    setStoredContracts(contracts);
    refreshStoredContracts();
    track('contract_deleted_local');
    setMessage('contractMessage', `Contract "${name}" deleted from this browser.`, 'success');
  }

  async function importContractFile(file) {
    try {
      const parsed = JSON.parse(await file.text());
      contractCore.validateContract(parsed);
      state.contract = contractCore.cloneContract(parsed);
      renderContract();
      clearResult();
      setMessage('contractMessage', `Imported contract "${state.contract.name}".`, 'success');
      track('contract_imported', { columns:state.contract.columns.length, key_columns:state.contract.settings.keyColumns.length });
    } catch (error) {
      setMessage('contractMessage', `Invalid contract JSON: ${error.message}`, 'error');
    }
  }

  function wireDropzone(dropId, fileId, handler) {
    const drop = $(dropId);
    const input = $(fileId);

    input.addEventListener('change', () => input.files[0] && handler(input.files[0]));
    ['dragenter','dragover'].forEach(eventName => drop.addEventListener(eventName, event => {
      event.preventDefault();
      drop.classList.add('drag');
    }));
    ['dragleave','drop'].forEach(eventName => drop.addEventListener(eventName, event => {
      event.preventDefault();
      drop.classList.remove('drag');
    }));
    drop.addEventListener('drop', event => {
      if (event.dataTransfer.files[0]) handler(event.dataTransfer.files[0]);
    });
  }

  function wireEditorControls() {
    ['contractName','minRows','maxRows','strictColumns'].forEach(id => {
      $(id).addEventListener('change', () => {
        if (!state.contract) return;
        try { syncContractFromForm(); clearResult(); }
        catch (error) { setMessage('contractMessage', error.message, 'error'); }
      });
    });
  }

  function init() {
    track('contract_opened');
    refreshStoredContracts();
    wireDropzone('baselineDrop', 'baselineFile', loadBaselineFile);
    wireDropzone('candidateDrop', 'candidateFile', loadCandidateFile);
    wireEditorControls();

    $('loadContractDemo').addEventListener('click', loadBaselineDemo);
    $('loadCandidateDemo').addEventListener('click', loadCandidateDemo);
    $('generateContract').addEventListener('click', generateContract);
    $('runContractCheck').addEventListener('click', runCheck);
    $('exportContract').addEventListener('click', exportContract);

    $('saveContractLocal').addEventListener('click', () => {
      try { saveContractWithName($('contractName').value); }
      catch (error) { setMessage('contractMessage', error.message, 'error'); }
    });

    $('saveContractAs').addEventListener('click', () => {
      try { saveContractWithName($('savedContractName').value); }
      catch (error) { setMessage('contractMessage', error.message, 'error'); }
    });

    $('loadSavedContract').addEventListener('click', loadStoredContract);
    $('deleteSavedContract').addEventListener('click', deleteStoredContract);
    $('importContractFile').addEventListener('change', () => {
      const file = $('importContractFile').files[0];
      if (file) importContractFile(file);
      $('importContractFile').value = '';
    });

    $('exportContractIssues').addEventListener('click', () => {
      if (!state.result || !state.result.issues.length) return;
      download(contractCore.issuesToCsv(state.result), 'rowmend-contract-issues.csv', 'text/csv;charset=utf-8');
      track('contract_issues_exported', { issues:state.result.summary.issues });
    });

    $('contractProInterest').addEventListener('click', () => {
      track('pro_interest', { context:'data_contract_automation' });
      window.location.href = '/#pricing';
    });

    renderContract();
  }

  init();
})();