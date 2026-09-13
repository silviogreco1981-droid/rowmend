(() => {
  const PROFILE_KEY = 'rowmend_profiles_v02';
  const state = { rows: [], headers: [], schema: [], issues: [], fileName: '', sql: '', config: {}, rowErrors: [] };
  const $ = (id) => document.getElementById(id);
  const fileInput = $('fileInput');
  const dropzone = $('dropzone');

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

    const pushField = () => {
      record.push(field);
      field = '';
    };
    const pushRecord = () => {
      pushField();
      if (record.some(v => String(v).length > 0)) records.push(record);
      record = [];
    };

    for (let i = 0; i < source.length; i++) {
      const ch = source[i];

      if (ch === '"') {
        if (quoted && source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = !quoted;
        }
        continue;
      }

      if (ch === delimiter && !quoted) {
        pushField();
        continue;
      }

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

  async function readFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv' || ext === 'tsv') return parseDelimited(await file.text(), ext === 'tsv' ? '\t' : ',');
    if ((ext === 'xlsx' || ext === 'xls') && window.XLSX) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
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

  function validateRows() {
    const issues = [];
    const rowErrors = state.rows.map(() => []);
    const uniqueSeen = {};
    state.headers.forEach(header => { const cfg = state.config[header] || {}; if (cfg.unique) uniqueSeen[header] = new Map(); });

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

    const invalidRows = rowErrors.filter(e => e.length).length;
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
    if(type==='date') return d==='oracle'?`TO_TIMESTAMP('${s}','YYYY-MM-DD HH24:MI:SS')`:d==='sqlserver'?`CAST('${s}' AS DATETIME2)`:`CAST('${s}' AS TIMESTAMP)`;
    return `'${s}'`;
  }

  function sqlHeader(generated, total, cap) {
    const invalid = state.rowErrors.filter(e=>e.length).length;
    const excluded = $('includeInvalidSql')?.checked ? 0 : invalid;
    const capped = generated < Math.max(0,total-excluded) ? `\n-- Output capped at ${cap} rows for browser responsiveness` : '';
    return `-- Generated by RowMend MVP 0.2.1\n-- ${generated} SQL row${generated===1?'':'s'} generated\n-- ${excluded} invalid row${excluded===1?'':'s'} excluded by default${capped}`;
  }

  function generateInsert() {
    const d=$('dialect').value, table=qIdent($('tableName').value || 'TARGET_TABLE',d), allRows=sqlRows(), rows=allRows.slice(0,1000), cols=mappedColumns();
    const stmts=rows.map(r=>`INSERT INTO ${table} (${cols.map(c=>qIdent(c.target,d)).join(', ')}) VALUES (${cols.map(c=>qValue(r[c.target],c.type,d)).join(', ')});`);
    setSql(`${sqlHeader(rows.length,state.rows.length,1000)}\n\n${stmts.join('\n')}`, 'INSERT statements');
  }

  function generateMerge() {
    const d=$('dialect').value, keySource=$('keyColumn').value; if(!keySource) return;
    const cols=mappedColumns(), key=cols.find(c=>c.source===keySource)?.target || keySource, nonKey=cols.filter(c=>c.target!==key), table=qIdent($('tableName').value || 'TARGET_TABLE',d), allRows=sqlRows(), rows=allRows.slice(0,250);
    const out=[];
    rows.forEach(r=>{
      if(d==='oracle'){
        const sel=cols.map(c=>`${qValue(r[c.target],c.type,d)} AS ${qIdent(c.target,d)}`).join(', ');
        out.push(`MERGE INTO ${table} t USING (SELECT ${sel} FROM dual) s ON (t.${qIdent(key,d)} = s.${qIdent(key,d)})\nWHEN MATCHED THEN UPDATE SET ${nonKey.map(c=>`t.${qIdent(c.target,d)} = s.${qIdent(c.target,d)}`).join(', ')}\nWHEN NOT MATCHED THEN INSERT (${cols.map(c=>qIdent(c.target,d)).join(', ')}) VALUES (${cols.map(c=>`s.${qIdent(c.target,d)}`).join(', ')});`);
      } else if(d==='sqlserver'){
        const vals=cols.map(c=>qValue(r[c.target],c.type,d)).join(', ');
        out.push(`MERGE ${table} AS t USING (VALUES (${vals})) AS s (${cols.map(c=>qIdent(c.target,d)).join(', ')}) ON t.${qIdent(key,d)} = s.${qIdent(key,d)}\nWHEN MATCHED THEN UPDATE SET ${nonKey.map(c=>`t.${qIdent(c.target,d)} = s.${qIdent(c.target,d)}`).join(', ')}\nWHEN NOT MATCHED THEN INSERT (${cols.map(c=>qIdent(c.target,d)).join(', ')}) VALUES (${cols.map(c=>`s.${qIdent(c.target,d)}`).join(', ')});`);
      } else {
        const vals=cols.map(c=>qValue(r[c.target],c.type,d)).join(', ');
        out.push(`INSERT INTO ${table} (${cols.map(c=>qIdent(c.target,d)).join(', ')}) VALUES (${vals})\nON CONFLICT (${qIdent(key,d)}) DO UPDATE SET ${nonKey.map(c=>`${qIdent(c.target,d)} = EXCLUDED.${qIdent(c.target,d)}`).join(', ')};`);
      }
    });
    setSql(`${sqlHeader(rows.length,state.rows.length,250)}\n\n${out.join('\n\n')}`, d==='postgres'?'UPSERT statements':'MERGE statements');
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

  function renderDerived() {
    validateRows();
    $('metrics').innerHTML=[['Rows',state.rows.length.toLocaleString()],['Columns',state.headers.length],['Quality',score()+'/100'],['Invalid rows',state.rowErrors.filter(e=>e.length).length]].map(([l,v])=>`<div class="metric"><strong>${v}</strong><span>${l}</span></div>`).join('');
    $('issuesPanel').innerHTML=`<div class="issue-list">${state.issues.map(i=>`<div class="issue-item ${i.level}"><div class="icon">${i.level==='ok'?'✓':i.level==='error'?'×':'!'}</div><div><strong>${escapeHtml(i.title)}</strong><p>${escapeHtml(i.detail)}</p></div><small>${i.level}</small></div>`).join('')}</div>`;
    $('schemaPanel').innerHTML=`<table><thead><tr><th>Source</th><th>Target</th><th>Inferred</th><th>Configured</th><th>SQL type</th><th>Missing</th><th>Unique</th></tr></thead><tbody>${state.schema.map(c=>{const cfg=state.config[c.name]; const t=cfg.type==='auto'?c.type:cfg.type; return `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(cfg.target)}</td><td class="type">${c.type}</td><td class="type">${t}</td><td class="type">${sqlType(t,$('dialect').value)}</td><td>${c.empty}</td><td>${c.unique}</td></tr>`}).join('')}</tbody></table>`;
    const preview=state.rows.slice(0,25), cols=mappedColumns();
    $('previewPanel').innerHTML=`<table><thead><tr>${cols.map(c=>`<th>${escapeHtml(c.target)}</th>`).join('')}</tr></thead><tbody>${preview.map((r,i)=>`<tr class="${state.rowErrors[i]?.length?'invalid-row':''}">${cols.map(c=>`<td title="${escapeAttr(String(r[c.source]??''))}">${escapeHtml(String(r[c.source]??''))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    $('keyColumn').innerHTML=state.headers.map((h,i)=>`<option value="${escapeAttr(h)}" ${i===0?'selected':''}>${escapeHtml(h)} → ${escapeHtml(state.config[h].target)}</option>`).join('');
    $('generateInsert').disabled=false; $('generateMerge').disabled=false;
  }

  function render() { $('emptyState').classList.add('hidden'); $('results').classList.remove('hidden'); renderMapping(); renderDerived(); refreshProfiles(); }

  function loadRows(rows,name='sample.csv'){
    state.rows=normalizeRows(rows); state.headers=state.rows.length?Object.keys(state.rows[0]):[]; state.fileName=name;
    state.schema=inferSchema(state.rows,state.headers); state.config=defaultConfig(state.schema); state.sql=''; state.rowErrors=[];
    $('sqlOutput').textContent='Generate SQL to see it here.'; render();
  }

  async function onFile(file){ try { loadRows(await readFile(file),file.name); } catch(e){ alert(e.message); } }
  function activateTab(name){ document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name)); ['issues','mapping','schema','preview','sql'].forEach(n=>$(n+'Panel').classList.toggle('hidden',n!==name)); }

  function csvEscape(v){const s=String(v??'');return /[",\n\r]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
  function downloadText(name,text,type='text/plain'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500);}
  function exportErrors(){ const rows=[['ROW','ERRORS',...state.headers]]; state.rows.forEach((r,i)=>{if(state.rowErrors[i]?.length) rows.push([i+2,state.rowErrors[i].join(' | '),...state.headers.map(h=>r[h]??'')]);}); downloadText('rowmend-errors.csv',rows.map(r=>r.map(csvEscape).join(',')).join('\n'),'text/csv'); }
  function exportClean(){ const cols=mappedColumns(), rows=transformedRows(true), out=[[...cols.map(c=>c.target)],...rows.map(r=>cols.map(c=>r[c.target]??''))]; downloadText('rowmend-clean.csv',out.map(r=>r.map(csvEscape).join(',')).join('\n'),'text/csv'); }

  function getProfiles(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')}catch{return {}}}
  function setProfiles(p){localStorage.setItem(PROFILE_KEY,JSON.stringify(p));}
  function refreshProfiles(){const p=getProfiles();$('profileSelect').innerHTML='<option value="">Saved profiles</option>'+Object.keys(p).sort().map(n=>`<option value="${escapeAttr(n)}">${escapeHtml(n)}</option>`).join('');}
  function saveProfile(){const name=$('profileName').value.trim();if(!name){alert('Enter a profile name first.');return;}const p=getProfiles();p[name]={tableName:$('tableName').value,dialect:$('dialect').value,config:state.config};setProfiles(p);refreshProfiles();$('profileSelect').value=name;}
  function loadProfile(){const name=$('profileSelect').value,p=getProfiles();if(!name||!p[name])return;const saved=p[name];$('tableName').value=saved.tableName||$('tableName').value;$('dialect').value=saved.dialect||$('dialect').value;state.headers.forEach(h=>{if(saved.config?.[h])state.config[h]={...state.config[h],...saved.config[h]};});renderMapping();renderDerived();}
  function deleteProfile(){const name=$('profileSelect').value;if(!name)return;const p=getProfiles();delete p[name];setProfiles(p);refreshProfiles();}

  fileInput.addEventListener('change',e=>e.target.files[0]&&onFile(e.target.files[0]));
  ['dragenter','dragover'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.add('drag')}));
  ['dragleave','drop'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.remove('drag')}));
  dropzone.addEventListener('drop',e=>e.dataTransfer.files[0]&&onFile(e.dataTransfer.files[0]));
  $('loadDemo').addEventListener('click',()=>loadRows(sampleRows)); $('loadDemoHero').addEventListener('click',()=>{loadRows(sampleRows);location.hash='tool'});
  $('generateInsert').addEventListener('click',generateInsert); $('generateMerge').addEventListener('click',generateMerge);
  $('dialect').addEventListener('change',()=>{if(state.rows.length)renderDerived();});
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
  $('copySql').addEventListener('click',async()=>{if(!state.sql)return;await navigator.clipboard.writeText(state.sql);$('copySql').textContent='Copied';setTimeout(()=>$('copySql').textContent='Copy',1200);});
  $('downloadSql').addEventListener('click',()=>{if(state.sql)downloadText('rowmend.sql',state.sql,'text/sql');});
  $('downloadErrors').addEventListener('click',exportErrors); $('downloadClean').addEventListener('click',exportClean);
  $('saveProfile').addEventListener('click',saveProfile); $('loadProfile').addEventListener('click',loadProfile); $('deleteProfile').addEventListener('click',deleteProfile);
  $('proInterest').addEventListener('click',()=>{localStorage.setItem('rowmend_pro_interest','yes');$('interestNote').textContent='Thanks — interest saved in this browser only.';});
  refreshProfiles();
})();
