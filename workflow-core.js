(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./data-core.js'), require('./contract-core.js'));
  } else {
    root.RowMendWorkflow = factory(root.RowMendData, root.RowMendContract);
  }
})(typeof window !== 'undefined' ? window : globalThis, function (dataCore, contractCore) {
  'use strict';

  if (!dataCore) throw new Error('RowMendData is required.');
  if (!contractCore) throw new Error('RowMendContract is required.');

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function normalizeImportHeader(value) {
    return (String(value ?? '').trim() || 'COLUMN').replace(/\s+/g, '_').toUpperCase();
  }

  function resolveImportColumns(dataset, importProfile) {
    const profile = importProfile?.profile || importProfile;
    const config = profile?.config || {};
    const normalized = new Map();
    const collisions = new Set();

    (dataset.headers || []).forEach(header => {
      const key = normalizeImportHeader(header);
      if (normalized.has(key) && normalized.get(key) !== header) collisions.add(key);
      else normalized.set(key, header);
    });

    const columns = [];
    const missingSources = [];

    Object.keys(config).forEach(sourceKey => {
      const actualHeader = dataset.headers.includes(sourceKey)
        ? sourceKey
        : normalized.get(normalizeImportHeader(sourceKey));

      if (!actualHeader || collisions.has(normalizeImportHeader(sourceKey))) {
        missingSources.push(sourceKey);
        return;
      }

      const rule = config[sourceKey] || {};
      columns.push({
        sourceKey,
        actualHeader,
        target: String(rule.target || sourceKey).trim() || sourceKey,
        required: Boolean(rule.required),
        unique: Boolean(rule.unique),
        email: Boolean(rule.email),
        type: rule.type || 'auto'
      });
    });

    return {
      columns,
      missingSources,
      normalizedCollisions: [...collisions]
    };
  }

  function duplicateTargets(columns) {
    const seen = new Map();
    const duplicates = new Set();

    columns.forEach(column => {
      const key = column.target.toUpperCase();
      if (seen.has(key)) {
        duplicates.add(column.target);
        duplicates.add(seen.get(key));
      } else {
        seen.set(key, column.target);
      }
    });

    return [...duplicates];
  }

  function validateImport(dataset, importProfile) {
    const profile = importProfile?.profile || importProfile;
    if (!profile || typeof profile !== 'object') {
      throw new Error('A valid import profile is required.');
    }

    const resolution = resolveImportColumns(dataset, profile);
    const issues = [];
    const rowErrors = (dataset.rows || []).map(() => []);
    const uniqueSeen = {};

    if (resolution.normalizedCollisions.length) {
      issues.push({
        level:'error',
        type:'normalized_header_collision',
        message:`Multiple source columns normalize to the same import name: ${resolution.normalizedCollisions.join(', ')}`
      });
    }

    if (resolution.missingSources.length) {
      issues.push({
        level:'error',
        type:'missing_source_columns',
        message:`Import profile references missing source columns: ${resolution.missingSources.join(', ')}`
      });
    }

    const duplicateTargetNames = duplicateTargets(resolution.columns);
    if (duplicateTargetNames.length) {
      issues.push({
        level:'error',
        type:'duplicate_target_columns',
        message:`Duplicate target column names: ${duplicateTargetNames.join(', ')}`
      });
    }

    resolution.columns.forEach(column => {
      if (column.unique) uniqueSeen[column.sourceKey] = new Map();
    });

    (dataset.rows || []).forEach((row, rowIndex) => {
      resolution.columns.forEach(column => {
        const value = row[column.actualHeader];
        const text = String(value ?? '').trim();

        if (column.required && !text) {
          rowErrors[rowIndex].push(`${column.target}: required value is missing`);
        }

        if (column.email && text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
          rowErrors[rowIndex].push(`${column.target}: invalid email format`);
        }

        if (column.type && column.type !== 'auto' && text) {
          const actualType = dataCore.primitiveType(value);
          if (actualType !== column.type) {
            rowErrors[rowIndex].push(`${column.target}: expected ${column.type}, found ${actualType}`);
          }
        }

        if (column.unique && text) {
          const seen = uniqueSeen[column.sourceKey];
          if (seen.has(text)) {
            const firstIndex = seen.get(text);
            const error = `${column.target}: duplicate value '${text}'`;
            rowErrors[rowIndex].push(error);
            if (!rowErrors[firstIndex].includes(error)) rowErrors[firstIndex].push(error);
          } else {
            seen.set(text, rowIndex);
          }
        }
      });
    });

    const mappedRows = (dataset.rows || []).map(row => {
      const output = {};
      resolution.columns.forEach(column => {
        output[column.target] = row[column.actualHeader];
      });
      return output;
    });

    const validRows = mappedRows.filter((row, index) => rowErrors[index].length === 0);
    const invalidRows = mappedRows.length - validRows.length;

    if (invalidRows) {
      issues.unshift({
        level:'error',
        type:'invalid_rows',
        message:`${invalidRows} row${invalidRows === 1 ? '' : 's'} fail configured import validation rules.`
      });
    }

    if (!issues.length) {
      issues.push({
        level:'ok',
        type:'validation_passed',
        message:'Configured import validation rules passed.'
      });
    }

    return {
      summary: {
        rows: mappedRows.length,
        mappedColumns: resolution.columns.length,
        validRows: validRows.length,
        invalidRows,
        structuralErrors: issues.filter(item => item.level === 'error' && item.type !== 'invalid_rows').length
      },
      columns: resolution.columns,
      rowErrors,
      mappedRows,
      validRows,
      issues
    };
  }

  function qIdent(value, dialect) {
    const safe = String(value || '').replace(/[^A-Za-z0-9_$#]/g, '_');
    if (dialect === 'postgres') return `"${safe}"`;
    if (dialect === 'sqlserver') return `[${safe}]`;
    return `"${safe.toUpperCase()}"`;
  }

  function qValue(value, type, dialect) {
    if (value === null || value === undefined || String(value).trim() === '') return 'NULL';

    if (type === 'number') return String(value).replace(',', '.');

    if (type === 'boolean') {
      const bool = typeof value === 'boolean' ? value : /^true$/i.test(String(value));
      return dialect === 'postgres' ? (bool ? 'TRUE' : 'FALSE') : (bool ? '1' : '0');
    }

    const text = String(value).replace(/'/g, "''");

    if (type === 'date') {
      if (dialect === 'oracle') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `TO_DATE('${text}','YYYY-MM-DD')`;
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(text)) {
          return `TO_TIMESTAMP('${text}','YYYY-MM-DD"T"HH24:MI:SS')`;
        }
        return `TO_TIMESTAMP('${text}','YYYY-MM-DD HH24:MI:SS')`;
      }
      return dialect === 'sqlserver'
        ? `CAST('${text}' AS DATETIME2)`
        : `CAST('${text}' AS TIMESTAMP)`;
    }

    return `'${text}'`;
  }

  function sqlColumns(validation, importProfile) {
    const profile = importProfile?.profile || importProfile;
    return validation.columns.map(column => ({
      ...column,
      resolvedType: column.type === 'auto' ? 'string' : column.type
    })).map(column => {
      if (column.type !== 'auto') return column;
      return {
        ...column,
        resolvedType: 'string'
      };
    });
  }

  function inferResolvedTypes(dataset, validation) {
    const profiles = dataCore.profileDataset(dataset.rows, dataset.headers);
    const byName = new Map(profiles.columns.map(column => [column.name, column.type]));

    return validation.columns.map(column => ({
      ...column,
      resolvedType: column.type === 'auto'
        ? (byName.get(column.actualHeader) || 'string')
        : column.type
    }));
  }

  function generateSql(dataset, validation, importProfile, mode = 'insert') {
    const profile = importProfile?.profile || importProfile;
    const dialect = profile?.dialect || 'oracle';
    const tableName = profile?.tableName || 'TARGET_TABLE';
    const columns = inferResolvedTypes(dataset, validation);
    const validRows = validation.validRows || [];

    if (!columns.length) {
      return { sql:'', generatedRows:0, capped:false, mode, dialect, reason:'No mapped columns.' };
    }

    const cap = mode === 'insert' ? 1000 : 250;
    const rows = validRows.slice(0, cap);
    const table = qIdent(tableName, dialect);

    if (mode === 'insert') {
      const statements = rows.map(row =>
        `INSERT INTO ${table} (${columns.map(column => qIdent(column.target, dialect)).join(', ')}) VALUES (${columns.map(column => qValue(row[column.target], column.resolvedType, dialect)).join(', ')});`
      );

      const header = [
        '-- Generated by RowMend Workflow Runner 0.8.0',
        `-- ${rows.length} SQL row${rows.length === 1 ? '' : 's'} generated`,
        `-- ${validation.summary.invalidRows} invalid row${validation.summary.invalidRows === 1 ? '' : 's'} excluded`,
        rows.length < validRows.length ? `-- Output capped at ${cap} rows` : ''
      ].filter(Boolean).join('\n');

      return {
        sql:`${header}\n\n${statements.join('\n')}`,
        generatedRows:rows.length,
        capped:rows.length < validRows.length,
        mode,
        dialect
      };
    }

    const keySource = profile?.keyColumn;
    const keyColumn = columns.find(column => column.sourceKey === keySource) ||
      columns.find(column => normalizeImportHeader(column.sourceKey) === normalizeImportHeader(keySource || ''));

    if (!keyColumn) {
      return {
        sql:'',
        generatedRows:0,
        capped:false,
        mode,
        dialect,
        reason:'The saved import profile does not define a usable merge key.'
      };
    }

    const nonKey = columns.filter(column => column.target !== keyColumn.target);
    const statements = [];

    rows.forEach(row => {
      if (dialect === 'oracle') {
        const select = columns.map(column =>
          `${qValue(row[column.target], column.resolvedType, dialect)} AS ${qIdent(column.target, dialect)}`
        ).join(', ');
        const matched = nonKey.length
          ? `\nWHEN MATCHED THEN UPDATE SET ${nonKey.map(column => `t.${qIdent(column.target, dialect)} = s.${qIdent(column.target, dialect)}`).join(', ')}`
          : '';
        statements.push(
          `MERGE INTO ${table} t USING (SELECT ${select} FROM dual) s ON (t.${qIdent(keyColumn.target, dialect)} = s.${qIdent(keyColumn.target, dialect)})${matched}\nWHEN NOT MATCHED THEN INSERT (${columns.map(column => qIdent(column.target, dialect)).join(', ')}) VALUES (${columns.map(column => `s.${qIdent(column.target, dialect)}`).join(', ')});`
        );
      } else if (dialect === 'sqlserver') {
        const values = columns.map(column => qValue(row[column.target], column.resolvedType, dialect)).join(', ');
        const matched = nonKey.length
          ? `\nWHEN MATCHED THEN UPDATE SET ${nonKey.map(column => `t.${qIdent(column.target, dialect)} = s.${qIdent(column.target, dialect)}`).join(', ')}`
          : '';
        statements.push(
          `MERGE ${table} AS t USING (VALUES (${values})) AS s (${columns.map(column => qIdent(column.target, dialect)).join(', ')}) ON t.${qIdent(keyColumn.target, dialect)} = s.${qIdent(keyColumn.target, dialect)}${matched}\nWHEN NOT MATCHED THEN INSERT (${columns.map(column => qIdent(column.target, dialect)).join(', ')}) VALUES (${columns.map(column => `s.${qIdent(column.target, dialect)}`).join(', ')});`
        );
      } else {
        const values = columns.map(column => qValue(row[column.target], column.resolvedType, dialect)).join(', ');
        const conflict = nonKey.length
          ? `DO UPDATE SET ${nonKey.map(column => `${qIdent(column.target, dialect)} = EXCLUDED.${qIdent(column.target, dialect)}`).join(', ')}`
          : 'DO NOTHING';
        statements.push(
          `INSERT INTO ${table} (${columns.map(column => qIdent(column.target, dialect)).join(', ')}) VALUES (${values})\nON CONFLICT (${qIdent(keyColumn.target, dialect)}) ${conflict};`
        );
      }
    });

    const header = [
      '-- Generated by RowMend Workflow Runner 0.8.0',
      `-- ${rows.length} SQL row${rows.length === 1 ? '' : 's'} generated`,
      `-- ${validation.summary.invalidRows} invalid row${validation.summary.invalidRows === 1 ? '' : 's'} excluded`,
      rows.length < validRows.length ? `-- Output capped at ${cap} rows` : ''
    ].filter(Boolean).join('\n');

    return {
      sql:`${header}\n\n${statements.join('\n\n')}`,
      generatedRows:rows.length,
      capped:rows.length < validRows.length,
      mode,
      dialect
    };
  }

  function importErrorsToCsv(dataset, validation) {
    const headers = ['ROW', 'ERRORS', ...(dataset.headers || [])];
    const rows = [];

    (dataset.rows || []).forEach((row, index) => {
      if (!validation.rowErrors[index]?.length) return;
      rows.push([
        index + 2,
        validation.rowErrors[index].join(' | '),
        ...dataset.headers.map(header => row[header] ?? '')
      ]);
    });

    const escape = value => {
      const text = String(value ?? '');
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };

    return [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
  }

  function runWorkflow(dataset, project, options = {}) {
    if (!dataset || !Array.isArray(dataset.headers) || !Array.isArray(dataset.rows)) {
      throw new Error('A valid input dataset is required.');
    }
    if (!project || typeof project !== 'object' || !project.artifacts) {
      throw new Error('A valid RowMend project is required.');
    }

    const settings = {
      stopOnContractErrors: options.stopOnContractErrors !== false,
      blockSqlOnInvalidRows: options.blockSqlOnInvalidRows !== false,
      sqlMode: options.sqlMode === 'merge' ? 'merge' : 'insert'
    };

    const started = Date.now();
    const steps = [];
    const originalDataset = {
      headers:[...dataset.headers],
      rows:dataset.rows.map(row => ({ ...row }))
    };

    const profile = dataCore.profileDataset(originalDataset.rows, originalDataset.headers);
    steps.push({
      id:'profile',
      status:'pass',
      summary:`${profile.summary.rows} rows · ${profile.summary.columns} columns · ${Math.round(profile.summary.completeness * 100)}% complete`
    });

    let working = originalDataset;
    const recipe = project.artifacts.cleanRecipe?.recipe;

    if (Array.isArray(recipe) && recipe.length) {
      working = dataCore.applyRecipe(working, recipe);
      steps.push({
        id:'clean',
        status:'pass',
        summary:`${recipe.length} transformation step${recipe.length === 1 ? '' : 's'} applied · ${working.rows.length} rows remain`
      });
    } else {
      steps.push({ id:'clean', status:'skipped', summary:'No cleanup recipe configured.' });
    }

    let contractResult = null;
    let stoppedByContract = false;
    const contract = project.artifacts.dataContract?.contract;

    if (contract) {
      const postCleanProfile = dataCore.profileDataset(working.rows, working.headers);
      contractResult = contractCore.checkContract(working, postCleanProfile, contract);
      const status = contractResult.summary.errors
        ? 'error'
        : contractResult.summary.warnings
          ? 'warning'
          : 'pass';

      steps.push({
        id:'contract',
        status,
        summary:contractResult.status === 'PASS'
          ? 'Data contract passed.'
          : `${contractResult.summary.errors} error${contractResult.summary.errors === 1 ? '' : 's'} · ${contractResult.summary.warnings} warning${contractResult.summary.warnings === 1 ? '' : 's'}`
      });

      stoppedByContract = settings.stopOnContractErrors && contractResult.summary.errors > 0;
    } else {
      steps.push({ id:'contract', status:'skipped', summary:'No data contract configured.' });
    }

    let importResult = null;
    let sqlResult = null;
    const importProfile = project.artifacts.importProfile?.profile;

    if (stoppedByContract) {
      steps.push({
        id:'validate',
        status:'skipped',
        summary:'Stopped by the contract-error quality gate.'
      });
      steps.push({
        id:'output',
        status:'skipped',
        summary:'SQL generation skipped by the contract-error quality gate.'
      });
    } else if (importProfile) {
      importResult = validateImport(working, importProfile);
      const validationStatus = importResult.summary.structuralErrors || importResult.summary.invalidRows
        ? 'error'
        : 'pass';

      steps.push({
        id:'validate',
        status:validationStatus,
        summary:`${importResult.summary.validRows} valid · ${importResult.summary.invalidRows} invalid rows`
      });

      if (settings.blockSqlOnInvalidRows && importResult.summary.invalidRows > 0) {
        steps.push({
          id:'output',
          status:'warning',
          summary:'SQL blocked because the project gate requires all rows to be valid.'
        });
      } else if (importResult.summary.structuralErrors > 0) {
        steps.push({
          id:'output',
          status:'error',
          summary:'SQL blocked because the import mapping has structural errors.'
        });
      } else {
        sqlResult = generateSql(working, importResult, importProfile, settings.sqlMode);
        steps.push({
          id:'output',
          status:sqlResult.sql ? 'pass' : 'warning',
          summary:sqlResult.sql
            ? `${sqlResult.generatedRows} ${settings.sqlMode === 'merge' ? 'MERGE/UPSERT' : 'INSERT'} row${sqlResult.generatedRows === 1 ? '' : 's'} ready`
            : (sqlResult.reason || 'No SQL output generated.')
        });
      }
    } else {
      steps.push({ id:'validate', status:'skipped', summary:'No import profile configured.' });
      steps.push({ id:'output', status:'skipped', summary:'No import profile configured for SQL output.' });
    }

    const hasError = steps.some(step => step.status === 'error');
    const hasWarning = steps.some(step => step.status === 'warning');
    const status = hasError || hasWarning ? 'REVIEW_REQUIRED' : 'PASS';

    return {
      status,
      startedAt:new Date(started).toISOString(),
      durationMs:Date.now() - started,
      settings,
      steps,
      originalProfile:profile,
      cleanedDataset:working,
      contractResult,
      importResult,
      sqlResult,
      summary:{
        inputRows:originalDataset.rows.length,
        outputRows:working.rows.length,
        rowsRemoved:originalDataset.rows.length - working.rows.length,
        validRows:importResult?.summary?.validRows ?? null,
        invalidRows:importResult?.summary?.invalidRows ?? null,
        contractErrors:contractResult?.summary?.errors ?? 0,
        contractWarnings:contractResult?.summary?.warnings ?? 0,
        configuredSteps:steps.filter(step => step.status !== 'skipped').length,
        warningSteps:steps.filter(step => step.status === 'warning').length,
        errorSteps:steps.filter(step => step.status === 'error').length
      }
    };
  }

  function runSummaryForHistory(result) {
    return {
      status:result.status,
      startedAt:result.startedAt,
      durationMs:result.durationMs,
      inputRows:result.summary.inputRows,
      outputRows:result.summary.outputRows,
      validRows:result.summary.validRows,
      invalidRows:result.summary.invalidRows,
      contractErrors:result.summary.contractErrors,
      contractWarnings:result.summary.contractWarnings,
      warningSteps:result.summary.warningSteps,
      errorSteps:result.summary.errorSteps
    };
  }

  return {
    normalizeImportHeader,
    resolveImportColumns,
    validateImport,
    generateSql,
    importErrorsToCsv,
    runWorkflow,
    runSummaryForHistory
  };
});
