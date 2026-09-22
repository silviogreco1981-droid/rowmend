(() => {
  'use strict';

  const core = window.RowMendData;
  if (!core) return;

  const STORAGE_KEY = 'rowmend_transform_recipes_v050';
  const $ = id => document.getElementById(id);
  const state = {
    original: null,
    transformed: null,
    recipe: [],
    fileName: ''
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
    const el = $('cleanMessage');
    el.textContent = message || '';
    el.className = `toolbox-message ${kind}`.trim();
  }

  function selectedDelimiter(text, ext) {
    const mode = $('cleanDelimiter').value;
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

  function metric(label, value, cls = '') {
    return `<div class="toolbox-metric ${cls}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
  }

  function currentProfile(dataset) {
    return core.profileDataset(dataset.rows, dataset.headers);
  }

  function renderSummary() {
    const originalProfile = currentProfile(state.original);
    const transformedProfile = currentProfile(state.transformed);
    const removedRows = originalProfile.summary.rows - transformedProfile.summary.rows;

    $('cleanSummary').innerHTML = [
      metric('Original rows', originalProfile.summary.rows.toLocaleString()),
      metric('Current rows', transformedProfile.summary.rows.toLocaleString(), removedRows ? 'warn' : ''),
      metric('Columns', transformedProfile.summary.columns.toLocaleString()),
      metric('Recipe steps', state.recipe.length.toLocaleString()),
      metric('Duplicates left', transformedProfile.summary.duplicateRows.toLocaleString(), transformedProfile.summary.duplicateRows ? 'warn' : '')
    ].join('');

    $('recipeImpact').textContent = removedRows
      ? `${removedRows.toLocaleString()} row${removedRows === 1 ? '' : 's'} removed by the current recipe`
      : 'Row count unchanged';
  }

  function renderTable(dataset, limit = 20) {
    const headers = dataset.headers;
    const rows = dataset.rows.slice(0, limit);
    if (!headers.length) return '<div class="toolbox-empty"><span>No columns available.</span></div>';

    return `<table><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${headers.map(header => `<td title="${escapeHtml(row[header])}">${escapeHtml(row[header] === null ? 'NULL' : row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function operationDescription(operation) {
    const target = operation.columns?.length
      ? operation.columns.join(' + ')
      : (operation.column || 'all columns');

    switch (operation.type) {
      case 'trim': return `Trim whitespace · ${target}`;
      case 'uppercase': return `Uppercase · ${target}`;
      case 'lowercase': return `Lowercase · ${target}`;
      case 'empty_to_null': return `Empty → NULL · ${target}`;
      case 'find_replace': return `Replace "${operation.find}" with "${operation.replacement}" · ${target}`;
      case 'rename': return `Rename ${operation.column} → ${operation.newName}`;
      case 'remove_exact_duplicates': return 'Remove exact duplicate rows';
      case 'remove_key_duplicates': return `Remove duplicates by ${target} · keep ${operation.keep || 'first'}`;
      case 'drop_empty_rows': return 'Drop completely empty rows';
      case 'filter_nonempty': return `Keep rows where ${operation.column} is not empty`;
      default: return operation.type;
    }
  }

  function renderRecipe() {
    const list = $('recipeList');

    if (!state.recipe.length) {
      list.innerHTML = '<div class="migration-empty"><strong>No transformations yet.</strong><span>Add a step above. Every step stays reversible until export.</span></div>';
      return;
    }

    list.innerHTML = state.recipe.map((operation, index) => `
      <div class="recipe-item">
        <span>${index + 1}</span>
        <div><strong>${escapeHtml(operationDescription(operation))}</strong><small>Applied in order to the original dataset</small></div>
        <button type="button" data-remove-step="${index}" title="Remove transformation">×</button>
      </div>`).join('');

    list.querySelectorAll('[data-remove-step]').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.removeStep);
        state.recipe.splice(index, 1);
        recompute();
        track('transform_step_removed', { remaining_steps: state.recipe.length });
      });
    });
  }

  function recompute() {
    try {
      state.transformed = core.applyRecipe(state.original, state.recipe);
      renderSummary();
      renderRecipe();
      renderPreviews();
      populateColumns();
      $('exportCleaned').disabled = false;
      $('resetRecipe').disabled = state.recipe.length === 0;
      setMessage(state.recipe.length ? 'Recipe applied locally. Review the preview before export.' : 'Original dataset restored.', 'success');
    } catch (error) {
      setMessage(error.message || 'Unable to apply the transformation recipe.', 'error');
    }
  }

  function renderPreviews() {
    $('originalPreview').innerHTML = renderTable(state.original);
    $('transformedPreview').innerHTML = renderTable(state.transformed);
  }

  function operationNeedsColumn(type) {
    return !['remove_exact_duplicates','drop_empty_rows'].includes(type);
  }

  function operationAllowsAll(type) {
    return ['trim','uppercase','lowercase','empty_to_null','find_replace'].includes(type);
  }

  function populateColumns() {
    if (!state.transformed) return;
    const select = $('operationColumn');
    const type = $('operationType').value;
    const headers = state.transformed.headers;
    const previous = [...select.selectedOptions].map(option => option.value);

    select.multiple = type === 'remove_key_duplicates';
    select.size = select.multiple ? Math.min(6, Math.max(3, headers.length)) : 1;

    const all = operationAllowsAll(type) ? '<option value="__all__">All columns</option>' : '';
    select.innerHTML = all + headers.map(header => `<option value="${escapeHtml(header)}">${escapeHtml(header)}</option>`).join('');

    previous.forEach(value => {
      const option = [...select.options].find(item => item.value === value);
      if (option) option.selected = true;
    });

    if (![...select.selectedOptions].length && select.options.length) select.options[0].selected = true;
  }

  function updateOperationForm() {
    const type = $('operationType').value;
    $('operationColumnGroup').classList.toggle('hidden', !operationNeedsColumn(type));
    $('findReplaceFields').classList.toggle('hidden', type !== 'find_replace');
    $('renameFields').classList.toggle('hidden', type !== 'rename');
    $('dedupeFields').classList.toggle('hidden', type !== 'remove_key_duplicates');
    populateColumns();
  }

  function buildOperation() {
    const type = $('operationType').value;
    const selected = [...$('operationColumn').selectedOptions].map(option => option.value);
    const operation = { type };

    if (operationNeedsColumn(type)) {
      if (!selected.length) throw new Error('Select a column first.');

      if (selected.includes('__all__')) {
        operation.columns = [...state.transformed.headers];
      } else if (type === 'remove_key_duplicates') {
        operation.columns = selected;
      } else {
        operation.column = selected[0];
      }
    }

    if (type === 'find_replace') {
      operation.find = $('findValue').value;
      operation.replacement = $('replaceValue').value;
      if (!operation.find) throw new Error('Enter text to find.');
    }

    if (type === 'rename') {
      operation.newName = $('renameValue').value.trim();
      if (!operation.newName) throw new Error('Enter the new column name.');
    }

    if (type === 'remove_key_duplicates') {
      operation.keep = $('dedupeKeep').value;
    }

    return operation;
  }

  function addOperation() {
    if (!state.original) return;

    try {
      const operation = buildOperation();
      core.applyOperation(state.transformed, operation);
      state.recipe.push(operation);
      recompute();

      track('transform_step_added', {
        operation: operation.type,
        recipe_steps: state.recipe.length
      });

      $('findValue').value = '';
      $('replaceValue').value = '';
      $('renameValue').value = '';
    } catch (error) {
      setMessage(error.message || 'Unable to add the transformation.', 'error');
    }
  }

  function loadDataset(dataset, fileName, source) {
    if (!dataset.headers.length) throw new Error('No columns were found in the file.');
    state.original = {
      headers:[...dataset.headers],
      rows:dataset.rows.map(row => ({ ...row }))
    };
    state.transformed = {
      headers:[...dataset.headers],
      rows:dataset.rows.map(row => ({ ...row }))
    };
    state.recipe = [];
    state.fileName = fileName;

    $('cleanEmpty').classList.add('hidden');
    $('cleanResults').classList.remove('hidden');
    $('exportCleaned').disabled = false;
    $('resetRecipe').disabled = true;
    populateColumns();
    updateOperationForm();
    renderSummary();
    renderRecipe();
    renderPreviews();

    track('clean_dataset_loaded', {
      source,
      rows:dataset.rows.length,
      columns:dataset.headers.length
    });
  }

  async function handleFile(file) {
    try {
      setMessage('Reading the file locally…');
      const dataset = await readFile(file);
      loadDataset(dataset, file.name, 'file');
      setMessage(`${file.name} ready for transformation.`, 'success');
    } catch (error) {
      setMessage(error.message || 'Unable to read the file.', 'error');
    }
  }

  function loadDemo() {
    const rows = [
      { CUSTOMER_ID:'1001', NAME:'  Alice Rossi  ', EMAIL:'ALICE@EXAMPLE.COM', COUNTRY:'it', STATUS:'active' },
      { CUSTOMER_ID:'1002', NAME:'Bob Verdi', EMAIL:'bob@example.com', COUNTRY:'IT', STATUS:'ACTIVE' },
      { CUSTOMER_ID:'1003', NAME:' Carla Neri', EMAIL:'', COUNTRY:'fr', STATUS:'active' },
      { CUSTOMER_ID:'1004', NAME:'Diego Blu ', EMAIL:'diego@example.com', COUNTRY:'IT', STATUS:'inactive' },
      { CUSTOMER_ID:'1004', NAME:'Diego Blu ', EMAIL:'diego@example.com', COUNTRY:'IT', STATUS:'inactive' }
    ];
    loadDataset({ headers:Object.keys(rows[0]), rows }, 'messy-customers-demo.csv', 'demo');
    setMessage('Messy demo dataset loaded. Try trim, case normalization and duplicate removal.', 'success');
    track('clean_demo_loaded');
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

  function getRecipes() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }

  function setRecipes(recipes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
  }

  function refreshSavedRecipes() {
    const recipes = getRecipes();
    $('savedRecipes').innerHTML = '<option value="">Saved recipes</option>' +
      Object.keys(recipes).sort().map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  }

  function saveRecipe() {
    const name = $('recipeName').value.trim();
    if (!name) {
      setMessage('Enter a recipe name first.', 'error');
      return;
    }
    const recipes = getRecipes();
    recipes[name] = state.recipe;
    setRecipes(recipes);
    refreshSavedRecipes();
    $('savedRecipes').value = name;
    track('transform_recipe_saved', { steps:state.recipe.length });
    setMessage(`Recipe "${name}" saved in this browser.`, 'success');
  }

  function loadRecipe() {
    if (!state.original) {
      setMessage('Load a dataset before applying a saved recipe.', 'error');
      return;
    }
    const name = $('savedRecipes').value;
    const recipes = getRecipes();
    if (!name || !recipes[name]) return;

    try {
      core.applyRecipe(state.original, recipes[name]);
      state.recipe = recipes[name].map(operation => ({ ...operation, columns:operation.columns ? [...operation.columns] : undefined }));
      recompute();
      track('transform_recipe_loaded', { steps:state.recipe.length });
      setMessage(`Recipe "${name}" loaded.`, 'success');
    } catch (error) {
      setMessage(`Saved recipe is not compatible with this dataset: ${error.message}`, 'error');
    }
  }

  function deleteRecipe() {
    const name = $('savedRecipes').value;
    if (!name) return;
    const recipes = getRecipes();
    delete recipes[name];
    setRecipes(recipes);
    refreshSavedRecipes();
    track('transform_recipe_deleted');
    setMessage(`Recipe "${name}" deleted from this browser.`, 'success');
  }

  function wireDropzone() {
    const input = $('cleanFile');
    const drop = $('cleanDrop');

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
    track('clean_opened');
    refreshSavedRecipes();
    wireDropzone();

    $('loadCleanDemo').addEventListener('click', loadDemo);
    $('operationType').addEventListener('change', updateOperationForm);
    $('addOperation').addEventListener('click', addOperation);

    $('resetRecipe').addEventListener('click', () => {
      state.recipe = [];
      recompute();
      track('transform_recipe_reset');
    });

    $('exportCleaned').addEventListener('click', () => {
      if (!state.transformed) return;
      download(core.datasetToCsv(state.transformed), 'rowmend-cleaned.csv', 'text/csv;charset=utf-8');
      track('clean_exported', {
        rows:state.transformed.rows.length,
        columns:state.transformed.headers.length,
        recipe_steps:state.recipe.length
      });
    });

    $('saveRecipe').addEventListener('click', saveRecipe);
    $('loadRecipe').addEventListener('click', loadRecipe);
    $('deleteRecipe').addEventListener('click', deleteRecipe);
    updateOperationForm();
  }

  init();
})();