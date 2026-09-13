(() => {
  const state = { rows: [], headers: [], schema: [], issues: [], fileName: '', sql: '' };
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
      Object.keys(r).forEach(k => { const key = (String(k).trim() || 'COLUMN').replace(/\s+/g, '_').toUpperCase(); out[key] = r[k]; });
      return out;
    });
  }

  function parseDelimited(text, delimiter) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(x => x.length);
    if (!lines.length) return [];
    const parseLine = (line) => {
      const out = []; let cur = ''; let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
          else quoted = !quoted;
        } else if (ch === delimiter && !quoted) { out.push(cur); cur = ''; }
        else cur += ch;
      }
      out.push(cur); return out;
    };
    const headers = parseLine(lines[0]).map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = parseLine(line); const obj = {};
      headers.forEach((h, i) => obj[h] = values[i] ?? ''); return obj;
    });
  }

  async function readFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv' || ext === 'tsv') {
      const text = await file.text();
      return parseDelimited(text, ext === 'tsv' ? '\t' : ',');
    }
    if ((ext === 'xlsx' || ext === 'xls') && window.XLSX) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json(ws, { defval: '' });
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

  function inspect(rows, schema) {
    const issues = [];
    schema.forEach(col => {
      if (col.empty) issues.push({ level: col.empty / Math.max(1,col.count) > .25 ? 'error':'warn', title: `${col.empty} missing value${col.empty===1?'':'s'} in ${col.name}`, detail: `${Math.round(col.empty/Math.max(1,col.count)*100)}% of rows are empty in this column.` });
      const inconsistent = Object.entries(col.counts).filter(([t]) => t !== col.type).reduce((s,[,n])=>s+n,0);
      if (inconsistent) issues.push({ level:'warn', title:`${inconsistent} type mismatch${inconsistent===1?'':'es'} in ${col.name}`, detail:`Expected ${col.type} based on the dominant values.` });
      if (/email/i.test(col.name)) {
        const bad = rows.filter(r => { const v=String(r[col.name]??'').trim(); return v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }).length;
        if (bad) issues.push({ level:'error', title:`${bad} invalid email address${bad===1?'':'es'} in ${col.name}`, detail:'Values do not match a basic email format.' });
      }
    });
    const fingerprints = new Map(); let dup = 0;
    rows.forEach(r => { const k = JSON.stringify(r); if (fingerprints.has(k)) dup++; else fingerprints.set(k,true); });
    if (dup) issues.push({ level:'warn', title:`${dup} duplicate row${dup===1?'':'s'} detected`, detail:'Exact duplicate records may create duplicate imports or constraint errors.' });
    if (!issues.length) issues.push({ level:'ok', title:'No obvious issues detected', detail:'Basic checks passed. Review the inferred schema before importing.' });
    return issues;
  }

  function sqlType(type, dialect) {
    const m = {
      oracle:{string:'VARCHAR2(4000)',number:'NUMBER',boolean:'NUMBER(1)',date:'DATE'},
      sqlserver:{string:'NVARCHAR(4000)',number:'DECIMAL(38,10)',boolean:'BIT',date:'DATETIME2'},
      postgres:{string:'TEXT',number:'NUMERIC',boolean:'BOOLEAN',date:'TIMESTAMP'}
    }; return m[dialect][type] || m[dialect].string;
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

  function generateInsert() {
    const d=$('dialect').value, table=qIdent($('tableName').value || 'TARGET_TABLE',d), rows=state.rows.slice(0,1000);
    const cols=state.schema.map(c=>qIdent(c.name,d));
    const stmts=rows.map(r=>`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${state.schema.map(c=>qValue(r[c.name],c.type,d)).join(', ')});`);
    setSql(`-- Generated by RowMend MVP\n-- ${rows.length}${state.rows.length>rows.length?' of '+state.rows.length:''} rows\n\n${stmts.join('\n')}`, 'INSERT statements');
  }

  function generateMerge() {
    const d=$('dialect').value, key=$('keyColumn').value; if(!key) return;
    const table=qIdent($('tableName').value || 'TARGET_TABLE',d), rows=state.rows.slice(0,250), cols=state.schema.map(c=>c.name), nonKey=cols.filter(c=>c!==key);
    let out=[];
    rows.forEach(r=>{
      if(d==='oracle'){
        const sel=cols.map(c=>`${qValue(r[c],state.schema.find(s=>s.name===c).type,d)} AS ${qIdent(c,d)}`).join(', ');
        out.push(`MERGE INTO ${table} t USING (SELECT ${sel} FROM dual) s ON (t.${qIdent(key,d)} = s.${qIdent(key,d)})\nWHEN MATCHED THEN UPDATE SET ${nonKey.map(c=>`t.${qIdent(c,d)} = s.${qIdent(c,d)}`).join(', ')}\nWHEN NOT MATCHED THEN INSERT (${cols.map(c=>qIdent(c,d)).join(', ')}) VALUES (${cols.map(c=>`s.${qIdent(c,d)}`).join(', ')});`);
      } else if(d==='sqlserver'){
        const vals=cols.map(c=>qValue(r[c],state.schema.find(s=>s.name===c).type,d)).join(', ');
        out.push(`MERGE ${table} AS t USING (VALUES (${vals})) AS s (${cols.map(c=>qIdent(c,d)).join(', ')}) ON t.${qIdent(key,d)} = s.${qIdent(key,d)}\nWHEN MATCHED THEN UPDATE SET ${nonKey.map(c=>`t.${qIdent(c,d)} = s.${qIdent(c,d)}`).join(', ')}\nWHEN NOT MATCHED THEN INSERT (${cols.map(c=>qIdent(c,d)).join(', ')}) VALUES (${cols.map(c=>`s.${qIdent(c,d)}`).join(', ')});`);
      } else {
        const vals=cols.map(c=>qValue(r[c],state.schema.find(s=>s.name===c).type,d)).join(', ');
        out.push(`INSERT INTO ${table} (${cols.map(c=>qIdent(c,d)).join(', ')}) VALUES (${vals})\nON CONFLICT (${qIdent(key,d)}) DO UPDATE SET ${nonKey.map(c=>`${qIdent(c,d)} = EXCLUDED.${qIdent(c,d)}`).join(', ')};`);
      }
    });
    setSql(`-- Generated by RowMend MVP\n-- ${rows.length}${state.rows.length>rows.length?' of '+state.rows.length:''} rows\n\n${out.join('\n\n')}`, d==='postgres'?'UPSERT statements':'MERGE statements');
  }

  function setSql(sql,label){ state.sql=sql; $('sqlOutput').textContent=sql; $('sqlLabel').textContent=label; activateTab('sql'); }

  function score(){
    const err=state.issues.filter(i=>i.level==='error').length, warn=state.issues.filter(i=>i.level==='warn').length;
    return Math.max(0,100-err*13-warn*6);
  }

  function render() {
    $('emptyState').classList.add('hidden'); $('results').classList.remove('hidden');
    $('metrics').innerHTML=[['Rows',state.rows.length.toLocaleString()],['Columns',state.headers.length],['Quality',score()+'/100'],['Issues',state.issues.filter(i=>i.level!=='ok').length]].map(([l,v])=>`<div class="metric"><strong>${v}</strong><span>${l}</span></div>`).join('');
    $('issuesPanel').innerHTML=`<div class="issue-list">${state.issues.map(i=>`<div class="issue-item ${i.level}"><div class="icon">${i.level==='ok'?'✓':i.level==='error'?'×':'!'}</div><div><strong>${escapeHtml(i.title)}</strong><p>${escapeHtml(i.detail)}</p></div><small>${i.level}</small></div>`).join('')}</div>`;
    $('schemaPanel').innerHTML=`<table><thead><tr><th>Column</th><th>Inferred type</th><th>SQL type</th><th>Missing</th><th>Unique</th></tr></thead><tbody>${state.schema.map(c=>`<tr><td>${escapeHtml(c.name)}</td><td class="type">${c.type}</td><td class="type">${sqlType(c.type,$('dialect').value)}</td><td>${c.empty}</td><td>${c.unique}</td></tr>`).join('')}</tbody></table>`;
    const preview=state.rows.slice(0,25);
    $('previewPanel').innerHTML=`<table><thead><tr>${state.headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${preview.map(r=>`<tr>${state.headers.map(h=>`<td title="${escapeAttr(String(r[h]??''))}">${escapeHtml(String(r[h]??''))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    $('keyColumn').innerHTML=state.headers.map((h,i)=>`<option value="${escapeAttr(h)}" ${i===0?'selected':''}>${escapeHtml(h)}</option>`).join('');
    $('generateInsert').disabled=false; $('generateMerge').disabled=false;
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function escapeAttr(s){return escapeHtml(s);}
  function loadRows(rows,name='sample.csv'){
    state.rows=normalizeRows(rows); state.headers=state.rows.length?Object.keys(state.rows[0]):[]; state.fileName=name;
    state.schema=inferSchema(state.rows,state.headers); state.issues=inspect(state.rows,state.schema); state.sql=''; $('sqlOutput').textContent='Generate SQL to see it here.'; render();
  }
  async function onFile(file){ try { loadRows(await readFile(file),file.name); } catch(e){ alert(e.message); } }
  function activateTab(name){ document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name)); ['issues','schema','preview','sql'].forEach(n=>$(n+'Panel').classList.toggle('hidden',n!==name)); }

  fileInput.addEventListener('change',e=>e.target.files[0]&&onFile(e.target.files[0]));
  ['dragenter','dragover'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.add('drag')}));
  ['dragleave','drop'].forEach(ev=>dropzone.addEventListener(ev,e=>{e.preventDefault();dropzone.classList.remove('drag')}));
  dropzone.addEventListener('drop',e=>e.dataTransfer.files[0]&&onFile(e.dataTransfer.files[0]));
  $('loadDemo').addEventListener('click',()=>loadRows(sampleRows)); $('loadDemoHero').addEventListener('click',()=>{loadRows(sampleRows);location.hash='tool'});
  $('generateInsert').addEventListener('click',generateInsert); $('generateMerge').addEventListener('click',generateMerge);
  $('dialect').addEventListener('change',()=>{ if(state.rows.length) render(); });
  document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.tab)));
  $('copySql').addEventListener('click',async()=>{ if(!state.sql)return; await navigator.clipboard.writeText(state.sql); $('copySql').textContent='Copied'; setTimeout(()=>$('copySql').textContent='Copy',1200); });
  $('downloadSql').addEventListener('click',()=>{ if(!state.sql)return; const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([state.sql],{type:'text/sql'}));a.download='rowmend-generated.sql';a.click();URL.revokeObjectURL(a.href); });
  $('proInterest').addEventListener('click',()=>{ localStorage.setItem('rowmend_pro_interest','yes'); $('interestNote').textContent='Thanks — interest saved in this browser. Next MVP step: connect a real waitlist form.'; $('proInterest').textContent='Interest recorded'; $('proInterest').disabled=true; });
  if(localStorage.getItem('rowmend_pro_interest')==='yes'){ $('proInterest').textContent='Interest recorded'; $('proInterest').disabled=true; }
})();
