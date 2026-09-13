(() => {
  const PROFILE_KEY = 'rowmend_profiles_v02';
  const state = { rows: [], headers: [], schema: [], issues: [], fileName: '', sql: '', config: {}, rowErrors: [] };
  const $ = (id) => document.getElementById(id);
  const fileInput = $('fileInput');
  const dropzone = $('dropzone');

  function track(eventName, properties = {}) {
    window.RowMendAnalytics?.track(eventName, properties);
  }

  const sampleRows = [
    { ID: 1001, FULL_NAME: 'Mario Rossi', EMAIL: 'mario.rossi@example.com', SIGNUP_DATE: '2026-08-13', ACTIVE: true, CREDIT_LIMIT: 3500.50 },
    { ID: 1002, FULL_NAME: 'Giulia Bianchi', EMAIL: 'giulia.bianchi@example.com', SIGNUP_DATE: '2026-08-16', ACTIVE: true, CREDIT_LIMIT: 1800 },
    { ID: 1003, FULL_NAME: 'Luca Verdi', EMAIL: 'luca.verdi.example.com', SIGNUP_DATE: '2026-08-19', ACTIVE: false, CREDIT_LIMIT: 2400 },
    { ID: 1004, FULL_NAME: 'Sara Neri', EMAIL: '', SIGNUP_DATE: '2026-08-20', ACTIVE: true, CREDIT_LIMIT: 5100 },
    { ID: 1004, FULL_NAME: 'Sara Neri', EMAIL: '', SIGNUP_DATE: 'not-a-date', ACTIVE: true, CREDIT_LIMIT: 5100 }
  ];

  function normalizeRows(rows) {
    return rows.filter(r => r && Object.values(r).some(v => String(v ?? '').trim() !== '')).map(r => {
      const out = {};
      Object.keys(r).forEach(k => {
        const key = (String(k).trim() || 'COLUMN').replace(/\s+/g, '_').toUpperCase();
        out[key] = r[k];
      });
      return out;
    });
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

    if (quoted) throw new Error('Malformed delimited file: an opening quote is not closed.');
    if (field.length || record.length) pushRecord();
    if (!records.length) return [];

    const headers = records[0].map(h => String(h).trim());
    return records.slice(1).map(values => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
      return obj;
    });
  }

  function delimiterLabel(delimiter) {
    if (delimiter === '\t') return 'Tab';
    if (delimiter === ',') return 'Comma (,)';
    if (delimiter === ';') return 'Semicolon (;)';
    if (delimiter === '|') return 'Pipe (|)';
    return `Custom (${delimiter})`;
  }

  function detectDelimiter(text) {
    const source = text.replace(/^\uFEFF/, '');
    const candidates = [',', ';', '\t', '|'];
    const countsByDelimiter = Object.fromEntries(candidates.map(d => [d, []]));
    let currentCounts = Object.fromEntries(candidates.map(d => [d, 0]));
    let quoted = false;
    let logicalRecords = 0;

    const pushRecordCounts = () => {
      candidates.forEach(d => countsByDelimiter[d].push(currentCounts[d]));
      currentCounts = Object.fromEntries(candidates.map(d => [d, 0]));
      logicalRecords++;
    };

    for (let i = 0; i < source.length && logicalRecords < 8; i++) {
      const ch = source[i];
      if (ch === '"') {
        if (quoted && source[i + 1] === '"') i++;
        else quoted = !quoted;
        continue;
      }
      if (quoted) continue;
      if (candidates.includes(ch)) currentCounts[ch]++;
      if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && source[i + 1] === '\n') i++;
        pushRecordCounts();
      }
    }

    if (Object.values(currentCounts).some(n => n > 0)) pushRecordCounts();

    const scored = candidates.map(delimiter => {
      const counts = countsByDelimiter[delimiter];
      const nonZero = counts.filter(n => n > 0);
      if (!nonZero.length) return { delimiter, score: -1 };
      const frequency = new Map();
      nonZero.forEach(n => frequency.set(n, (frequency.get(n) || 0) + 1));
      const [mode, matches] = [...frequency.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
      const consistency = matches / counts.length;
      const coverage = nonZero.length / counts.length;
      return { delimiter, score: consistency * 100 + coverage * 50 + Math.min(mode, 20) };
    }).sort((a, b) => b.score - a.score);

    return scored[0].score < 0 ? ',' : scored[0].delimiter;
  }

  function selectedDelimiter(text, ext) {
    const mode = $('delimiterMode')?.value || 'auto';
    if (mode === 'custom') {
      const custom = $('customDelimiter')?.value || '';
      if (!custom) throw new Error('Enter a custom delimiter first.');
      if (custom.length !== 1) throw new Error('The custom delimiter must be exactly one character.');
      if (["\n", "\r"].includes(custom)) throw new Error('The custom delimiter cannot be a line break.');
      return custom;
    }
    if (mode === 'comma') return ',';
    if (mode === 'semicolon') return ';';
    if (mode === 'tab') return '\t';
    if (mode === 'pipe') return '|';
    if (ext === 'tsv') return '\t';
    return detectDelimiter(text);
  }

  async function readFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv' || ext === 'tsv') {
      const text = await file.text();
      const delimiter = selectedDelimiter(text, ext);
      const label = $('detectedDelimiter');
      if (label) label.textContent = `Using: ${delimiterLabel(delimiter)}`;
      return parseDelimited(text, delimiter);
    }
    if ((ext === 'xlsx' || ext === 'xls') && window.XLSX) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const label = $('detectedDelimiter');
      if (label) label.textContent = 'Delimiter not used for Excel files';
      return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    }
    if (ext === 'xlsx' || ext === 'xls') throw new Error('Excel parser is still loading. Please retry in a moment.');
    throw new Error('Unsupported file type. Use CSV, TSV, XLSX or XLS.');
  }

  function primitiveType(value) {
    if (value === null || value === undefined || String(value).trim() === '') return 'empty';
    if (typeof value === 'boolean' || /^(true|false)$/i.test(String(value).trim())) return 'boolean';
    if (typeof value === 'number' || /^[-+]?\d+(?:[.,]\d+)?$/.test(String(value).trim())) return 'number';
    const s = String(value).trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}(?:[T ][0-9:.+-Z]*)?$/.test(s) && !Number.isNaN(Date.parse(s))) return 'date';
    return 'string';
  }

  function inferSchema(rows, headers) {
    return headers.map(name => {
      const vals = rows.map(r => r[name]);
      const nonEmpty = vals.filter(v => primitiveType(v) !== 'empty');
      const counts = nonEmpty.reduce((a, v) => { const t = primitiveType(v); a[t] = (a[t] || 0) + 1; return a; }, {});
      const type = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'string';
      return { name, type, empty: vals.length - nonEmpty.length, unique: new Set(nonEmpty.map(v => String(v))).size, count: vals.length, counts };
    });
  }

  function defaultConfig(schema) {
    const cfg = {};
    schema.forEach(c => {
      cfg[c.name] = { target: c.name, required: false, unique: false, email: /email/i.test(c.name), type: c.type === 'string' ? 'auto' : c.type };
    });
    return cfg;
  }

  function duplicateTargets() {
    const seen = new Map();
    const duplicates = new Set();
    state.headers.forEach(source => {
      const target = (state.config[source]?.target || source).trim() || source;
      const key = target.toUpperCase();
      if (seen.has(key)) {
        duplicates.add(target);
        duplicates.add(seen.get(key));
      } else seen.set(key, target);
    });
    return [...duplicates];
  }

  function validateRows() {
    const issues = [];
    const rowErrors = state.rows.map(() => []);
    const uniqueSeen = {};
    state.headers.forEach(header => { const cfg = state.config[header] || {}; if (cfg.unique) uniqueSeen[header] = new Map(); });

    const duplicateTargetNames = duplicateTargets();
    if (duplicateTargetNames.length) issues.push({ level:'error', title:'Duplicate target column names', detail:`Each source column must map to a unique target. Duplicate target: ${duplicateTargetNames.join(', ')}` });

    state.rows.forEach((row, rowIndex) => {
      state.headers.forEach(header => {
        const cfg = state.config[header] || {};
        const value = row[header];
        const s = String(value ?? '').trim();
        const target = cfg.target || header;
        if (cfg.required && !s) rowErrors[rowIndex].push(`${target}: required value is missing`);
        if (cfg.email && s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) rowErrors[rowIndex].push(`${target}: invalid email format`);
        if (cfg.type && cfg.type !== 'auto' && s) {
          const actual = primitiveType(value);
          if (actual !== cfg.type) rowErrors[rowIndex].push(`${target}: expected ${cfg.type}, found ${actual}`);
        }
        if (cfg.unique && s) {
          const map = uniqueSeen[header];
          if (map.has(s)) {
            rowErrors[rowIndex].push(`${target}: duplicate value '${s}'`);
            rowErrors[map.get(s)].push(`${target}: duplicate value '${s}'`);
          } else map.set(s, rowIndex);
        }
      });
    });

    state.schema.forEach(col => {
      if (col.empty) issues.push({ level: col.empty / Math.max(1,col.count) > .25 ? 'error':'warn', title: `${col.empty} missing value${col.empty===1?'':'s'} in ${col.name}`, detail: `${Math.round(col.empty/Math.max(1,col.count)*100)}% of rows are empty in this source column.` });
      const inconsistent = Object.entries(col.counts).filter(([t]) => t !== col.type).reduce((s,[,n])=>s+n,0);
      if (inconsistent) issues.push({ level:'warn', title:`${inconsistent} type mismatch${inconsistent===1?'':'es'} in ${col.name}`, detail:`Dominant source type is ${col.type}.` });
    });

    const exact = new Map(); let dup = 0;
    state.rows.forEach(r => { const k = JSON.stringify(r); if (exact.has(k)) dup++; else exact.set(k,true); });
    if (dup) issues.push({ level:'warn', title:`${dup} exact duplicate row${dup===1?'':'s'} detected`, detail:'Duplicate records may create import or constraint errors.' });

    const invalidRows = rowErrors.filter(e=>e.length).length;
    if (invalidRows) issues.unshift({ level:'error', title:`${invalidRows} row${invalidRows===1?'':'s'} fail configured validation rules`, detail:'Invalid rows are excluded from SQL by default. Open Mapping & Rules or export the error CSV for details.' });
    if (!issues.length) issues.push({ level:'ok', title:'No obvious issues detected', detail:'Basic and configured validation checks passed.' });
    state.rowErrors = rowErrors;
    state.issues = issues;
  }

  function mappedColumns() {
    return state.headers.map(source => ({ source, target: (state.config[source]?.target || source).trim() || source, type: state.config[source]?.type === 'auto' ? state.schema.find(s=>s.name===source)?.type || 'string' : state.config[source]?.type || 'string' }));
  }

  function transformedRows(cleanOnly = false) {
    return state.rows.map((row, i) => {
      if (cleanOnly && state.rowErrors[i]?.length) return null;
      const out = {};
      mappedColumns().forEach(c => out[c.target] = row[c.source]);
      return out;
    }).filter(Boolean);
  }

  function sqlRows() {
    const includeInvalid = $('includeInvalidSql')?.checked === true;
    return transformedRows(!includeInvalid);
  }

  function sqlType(type, dialect) {
    const m = { oracle:{string:'VARCHAR2(4000)',number:'NUMBER',boolean:'NUMBER(1)',date:'DATE'}, sqlserver:{string:'NVARCHAR(4000)',number:'DECIMAL(38,10)',boolean:'BIT',date:'DATETIME2'}, postgres:{string:'TEXT',number:'NUMERIC',boolean:'BOOLEAN',date:'TIMESTAMP'} };
    return m[dialect][type] || m[dialect].string;
  }
  function qIdent(s, d){ const safe=String(s).replace(/[^A-Za-z0-9_$#]/g,'_'); return d==='postgres'?`"${safe}"`:d==='sqlserver'?`[${safe}]`:`"${safe.toUpperCase()}"`; }
  function qValue(v, type, d){
    if (v===null || v===undefined || String(v).trim()==='') return 'NULL';
    if(type==='number') return String(v).replace(',','.');
    if(type==='boolean') { const b=typeof v==='boolean'?v:/^true$/i.test(String(v)); return d==='postgres'?(b?'TRUE':'FALSE'):(b?'1':'0'); }
    const s=String(v).replace(/'/g,"''");
    if(type==='date') {
      if(d==='oracle') {
        if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return `TO_DATE('${s}','YYYY-MM-DD')`;
        if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) return `TO_TIMESTAMP('${s}','YYYY-MM-DD"T"HH24:MI:SS')`;
        return `TO_TIMESTAMP('${s}','YYYY-MM-DD HH24:MI:SS')`;
      }
      return d==='sqlserver'?`CAST('${s}' AS DATETIME2)`:`CAST('${s}' AS TIMESTAMP)`;
    }
    return `'${s}'`;
  }

  function sqlHeader(used,total,limit){
    const invalid=state.rowErrors.filter(e=>e.length).length, include=$('includeInvalidSql')?.checked===true;
    const safeTotal=include?total:Math.max(0,total-invalid), note=include?`${invalid} invalid row(s) included by explicit option.`:`${invalid} invalid row(s) excluded by default.`;
    return `-- Generated by RowMend 0.3.1\n-- ${note}\n-- ${used} of ${safeTotal} eligible row(s) emitted${safeTotal>limit?` (capped at ${limit})`:''}.`;
  }

  function ensureUniqueTargets(){
    const duplicates=duplicateTargets();
    if(duplicates.length){alert(`Fix duplicate target column names before generating SQL: ${duplicates.join(', ')}`);return false;}
    return true;
  }

  function maybeShowFeedback(source) {
    window.RowMendFeedback?.showFeedbackPrompt(source);
  }

  function generateInsert() {
    if (!ensureUniqueTargets()) return;
    const d=$('dialect').value, table=qIdent($('tableName').value || 'TARGET_TABLE',d), allRows=sqlRows(), rows=allRows.slice(0,1000), cols=mappedColumns();
    const stmts=rows.map(r=>`INSERT INTO ${table} (${cols.map(c=>qIdent(c.target,d)).join(', ')}) VALUES (${cols.map(c=>qValue(r[c.target],c.type,d)).join(', ')});`);
    setSql(`${sqlHeader(rows.length,state.rows.length,1000)}\n\n${stmts.join('\n')}`, 'INSERT statements');
    track('generate_insert', { dialect: d });
    maybeShowFeedback('generate_insert');
  }

  function generateMerge() {
    if (!ensureUniqueTargets()) return;
    const d=$('dialect').value, keySource=$('keyColumn').value; if(!keySource) return;
    const cols=mappedColumns(), key=cols.find(c=>c.source===keySource)?.target || keySource, nonKey=cols.filter(c=>c.target!==key), table=qIdent($('tableName').value || 'TARGET_TABLE',d), allRows=sqlRows(), rows=allRows.slice(0,250);
    const out=[];
    rows.forEach(r=>{
      if(d==='oracle'){
        const sel=cols.map(c=>`${qValue(r[c.target],c.type,d)} AS ${qIdent(c.target,d)}`).join(', ');
        const matched = nonKey.length ? `\nWHEN MATCHED THEN UPDATE SET ${nonKey.map(c=>`t.${qIdent(c.target,d)} = s.${qIdent(c.target,d)}`).join(', ')}` : '';
        out.push(`MERGE INTO ${table} t USING (SELECT ${sel} FROM dual) s ON (t.${qIdent(key,d)} = s.${qIdent(key,d)})${matched}\nWHEN NOT MATCHED THEN INSERT (${cols.map(c=>qIdent(c.target,d)).join(', ')}) VALUES (${cols.map(c=>`s.${qIdent(c.target,d)}`).join(', ')});`);
      } else if(d==='sqlserver'){
        const vals=cols.map(c=>qValue(r[c.target],c.type,d)).join(', ');
        const matched = nonKey.length ? `\nWHEN MATCHED THEN UPDATE SET ${nonKey.map(c=>`t.${qIdent(c.target,d)} = s.${qIdent(c.target,d)}`).join(', ')}` : '';
        out.push(`MERGE ${table} AS t USING (VALUES (${vals})) AS s (${cols.map(c=>qIdent(c.target,d)).join(', ')}) ON t.${qIdent(key,d)} = s.${qIdent(key,d)}${matched}\nWHEN NOT MATCHED THEN INSERT (${cols.map(c=>qIdent(c.target,d)).join(', ')}) VALUES (${cols.map(c=>`s.${qIdent(c.target,d)}`).join(', ')});`);
      } else {
        const vals=cols.map(c=>qValue(r[c.target],c.type,d)).join(', ');
        const conflict = nonKey.length ? `DO UPDATE SET ${nonKey.map(c=>`${qIdent(c.target,d)} = EXCLUDED.${qIdent(c.target,d)}`).join(', ')}` : 'DO NOTHING';
        out.push(`INSERT INTO ${table} (${cols.map(c=>qIdent(c.target,d)).join(', ')}) VALUES (${vals})\nON CONFLICT (${qIdent(key,d)}) ${conflict};`);
      }
    });
    setSql(`${sqlHeader(rows.length,state.rows.length,250)}\n\n${out.join('\n\n')}`, d==='postgres'?'UPSERT statements':'MERGE statements');
    track('generate_merge', { dialect: d });
    maybeShowFeedback('generate_merge');
  }

  function setSql(sql,label){ state.sql=sql; $('sqlOutput').textContent=sql; $('sqlLabel').textContent=label; activateTab('sql'); }
  function score(){ const err=state.issues.filter(i=>i.level==='error').length, warn=state.issues.filter(i=>i.level==='warn').length; return Math.max(0,100-err*13-warn*6); }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function escapeAttr(s){return escapeHtml(s);}

  function renderMapping() {
    $('mappingTable').innerHTML=`<table class="mapping-table"><thead><tr><th>Source</th><th>Target column</th><th>Type</th><th>Rules</th></tr></thead><tbody>${state.headers.map(h=>{ const c=state.config[h]; return `<tr><td class="source-col">${escapeHtml(h)}</td><td><input class="mapping-input" data-source="${escapeAttr(h)}" value="${escapeAttr(c.target)}"></td><td><select class="rule-select type-select" data-source="${escapeAttr(h)}"><option value="auto" ${c.type==='auto'?'selected':''}>Auto</option><option value="string" ${c.type==='string'?'selected':''}>String</option><option value="number" ${c.type==='number'?'selected':''}>Number</option><option value="boolean" ${c.type==='boolean'?'selected':''}>Boolean</option><option value="date" ${c.type==='date'?'selected':''}>Date</option></select></td><td><div class="rule-set"><label class="rule-check"><input type="checkbox" class="required-check" data-source="${escapeAttr(h)}" ${c.required?'checked':''}>Required</label><label class="rule-check"><input type="checkbox" class="unique-check" data-source="${escapeAttr(h)}" ${c.unique?'checked':''}>Unique</label><label class="rule-check"><input type="checkbox" class="email-check" data-source="${escapeAttr(h)}" ${c.email?'checked':''}>Email</label></div></td></tr>`; }).join('')}</tbody></table>`;
    document.querySelectorAll('.mapping-input').forEach(el=>el.addEventListener('input',()=>{state.config[el.dataset.source].target=el.value; renderDerived();}));
    document.querySelectorAll('.type-select').forEach(el=>el.addEventListener('change',()=>{state.config[el.dataset.source].type=el.value; renderDerived();}));
    [['required-check','required'],['unique-check','unique'],['email-check','email']].forEach(([cls,key])=>document.querySelectorAll('.'+cls).forEach(el=>el.addEventListener('change',()=>{state.config[el.dataset.source][key]=el.checked; renderDerived();})));
  }

  function renderDerived(preferredKey = null) {
    const currentKey = preferredKey || $('keyColumn')?.value || state.headers[0] || '';
    validateRows();
    $('metrics').innerHTML=[['Rows',state.rows.length.toLocaleString()],['Columns',state.headers.length],['Quality',score()+'/100'],['Invalid rows',state.rowErrors.filter(e=>e.length).length]].map(([l,v])=>`<div class="metric"><strong>${v}</strong><span>${l}</span></div>`).join('');
    $('issuesPanel').innerHTML=`<div class="issue-list">${state.issues.map(i=>`<div class="issue-item ${i.level}"><div class="icon">${i.level==='ok'?'✓':i.level==='error'?'×':'!'}</div><div><strong>${escapeHtml(i.title)}</strong><p>${escapeHtml(i.detail)}</p></div><small>${i.level}</small></div>`).join('')}</div>`;
    $('schemaPanel').innerHTML=`<table><thead><tr><th>Source</th><th>Target</th><th>Inferred</th><th>Configured</th><th>SQL type</th><th>Missing</th><th>Unique</th></tr></thead><tbody>${state.schema.map(c=>{const cfg=state.config[c.name]; const t=cfg.type==='auto'?c.type:cfg.type; return `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(cfg.target)}</td><td class="type">${c.type}</td><td class="type">${t}</td><td class="type">${sqlType(t,$('dialect').value)}</td><td>${c.empty}</td><td>${c.unique}</td></tr>`}).join('')}</tbody></table>`;
    const preview=state.rows.slice(0,25), cols=mappedColumns();
    $('previewPanel').innerHTML=`<table><thead><tr>${cols.map(c=>`<th>${escapeHtml(c.target)}</th>`).join('')}</tr></thead><tbody>${preview.map((r,i)=>`<tr class="${state.rowErrors[i]?.length?'invalid-row':''}">${cols.map(c=>`<td title="${escapeAttr(String(r[c.source]??''))}">${escapeHtml(String(r[c.source]??''))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    $('keyColumn').innerHTML=state.headers.map(h=>`<option value="${escapeAttr(h)}">${escapeHtml(h)} → ${escapeHtml(state.config[h].target)}</option>`).join('');
    $('keyColumn').value = state.headers.includes(currentKey) ? currentKey : (state.headers[0] || '');
    const blocked = duplicateTargets().length > 0;
    $('generateInsert').disabled=blocked; $('generateMerge').disabled=blocked;
  }

  function render() { $('emptyState').classList.add('hidden'); $('results').classList.remove('hidden'); renderMapping(); renderDerived(); refreshProfiles(); }

  function loadRows(rows,name='sample.csv'){
    state.rows=normalizeRows(rows); state.headers=state.rows.length?Object.keys(state.rows[0]):[]; state.fileName=name;
    state.schema=inferSchema(state.rows,state.headers); state.config=defaultConfig(state.schema); state.sql=''; state.rowErrors=[];
    $('sqlOutput').textContent='Generate SQL to see it here.'; render();
  }

  async function onFile(file){
    try {
      loadRows(await readFile(file),file.name);
      const ext=(file.name.split('.').pop() || '').toLowerCase();
      track('file_loaded', { file_type: ext });
    } catch(e){ alert(e.message); }
  }
  function loadDemoTracked(){ loadRows(sampleRows); track('demo_loaded'); }
  function activateTab(name){ document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name)); ['issues','mapping','schema','preview','sql'].forEach(n=>$(n+'Panel').classList.toggle('hidden',n!==name)); }

  function csvEscape(v){const s=String(v??'');return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function downloadText(name,text,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500);}
  function exportErrors(){
    const rows=[['ROW','ERRORS',...state.headers]];
    state.rows.forEach((r,i)=>{if(state.rowErrors[i]?.length) rows.push([i+2,state.rowErrors[i].join(' | '),...state.headers.map(h=>r[h]??'')]);});
    downloadText('rowmend-errors.csv',rows.map(r=>r.map(csvEscape).join(',')).join('\n'),'text/csv');
    track('export_errors');
  }
  function exportClean(){
    const cols=mappedColumns(), rows=transformedRows(true), out=[[...cols.map(c=>c.target)],...rows.map(r=>cols.map(c=>r[c.target]??''))];
    downloadText('rowmend-clean.csv',out.map(r=>r.map(csvEscape).join(',')).join('\n'),'text/csv');
    track('export_clean');
    maybeShowFeedback('export_clean');
  }

  function getProfiles(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')}catch{return {}}}
  function setProfiles(p){localStorage.setItem(PROFILE_KEY,JSON.stringify(p));}
  function refreshProfiles(){const p=getProfiles();$('profileSelect').innerHTML='<option value="">Saved profiles</option>'+Object.keys(p).sort().map(n=>`<option value="${escapeAttr(n)}">${escapeHtml(n)}</option>`).join('');}
  function saveProfile(){const name=$('profileName').value.trim();if(!name){alert('Enter a profile name first.');return;}const p=getProfiles();p[name]={tableName:$('tableName').value,dialect:$('dialect').value,keyColumn:$('keyColumn').value,config:state.config};setProfiles(p);refreshProfiles();$('profileSelect').value=name;track('profile_saved');}
  function loadProfile(){const name=$('profileSelect').value,p=getProfiles();if(!name||!p[name])return;const saved=p[name];$('tableName').value=saved.tableName||$('tableName').value;$('dialect').value=saved.dialect||$('dialect').value;state.headers.forEach(h=>{if(saved.config?.[h])state.config[h]={...state.config[h],...saved.config[h]};});renderMapping();renderDerived(saved.keyColumn);}
  function deleteProfile(){const name=$('profileSelect').value;if(!name)return;const p=getProfiles();delete p[name];setProfiles(p);refreshProfiles();}

  fileInput.addEventListener('change',e=>e.target.files[0]&&onFile(e.target.files[0]));
  ['dragenter','dragover'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.add('drag')}));
  ['dragleave','drop'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.remove('drag')}));
  dropzone.addEventListener('drop',e=>e.dataTransfer.files[0]&&onFile(e.dataTransfer.files[0]));
  $('loadDemo').addEventListener('click',loadDemoTracked); $('loadDemoHero').addEventListener('click',()=>{loadDemoTracked();location.hash='tool'});
  $('generateInsert').addEventListener('click',generateInsert); $('generateMerge').addEventListener('click',generateMerge);
  $('dialect').addEventListener('change',()=>{if(state.rows.length)renderDerived();});
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
  $('copySql').addEventListener('click',async()=>{if(!state.sql)return;await navigator.clipboard.writeText(state.sql);$('copySql').textContent='Copied';setTimeout(()=>$('copySql').textContent='Copy',1200);});
  $('downloadSql').addEventListener('click',()=>{if(state.sql)downloadText('rowmend.sql',state.sql,'text/sql');});
  $('downloadErrors').addEventListener('click',exportErrors); $('downloadClean').addEventListener('click',exportClean);
  $('saveProfile').addEventListener('click',saveProfile); $('loadProfile').addEventListener('click',loadProfile); $('deleteProfile').addEventListener('click',deleteProfile);
  $('delimiterMode').addEventListener('change',()=>{
    $('customDelimiter').classList.toggle('hidden',$('delimiterMode').value!=='custom');
    $('detectedDelimiter').textContent=$('delimiterMode').value==='auto'?'Auto detect is used for CSV files.':'Delimiter override selected.';
  });
  refreshProfiles();
})();