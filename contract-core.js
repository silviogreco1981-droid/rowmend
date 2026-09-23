(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RowMendContract = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const CONTRACT_VERSION = 1;
  const TYPE_OPTIONS = ['string', 'number', 'date', 'boolean'];

  function clampRate(value, fallback = 0) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(1, Math.max(0, number));
  }

  function identifierLike(name) {
    return /(^|[_\s-])(id|key|code|uuid|guid)([_\s-]|$)/i.test(String(name || '')) ||
      /(?:id|key|code|uuid|guid)$/i.test(String(name || ''));
  }

  function createContract(profile, options = {}) {
    if (!profile || !profile.summary || !Array.isArray(profile.columns)) {
      throw new Error('A valid data profile is required to create a contract.');
    }

    const now = options.createdAt || new Date().toISOString();
    const likelyKeys = new Set(profile.summary.likelyKeyColumns || []);

    return {
      contractVersion: CONTRACT_VERSION,
      name: String(options.name || 'Untitled data contract'),
      createdAt: now,
      updatedAt: now,
      baseline: {
        rows: profile.summary.rows,
        columns: profile.summary.columns
      },
      settings: {
        strictColumns: options.strictColumns !== false,
        minRows: Number.isFinite(Number(options.minRows)) ? Number(options.minRows) : 0,
        maxRows: Number.isFinite(Number(options.maxRows)) ? Number(options.maxRows) : null,
        keyColumns: Array.isArray(options.keyColumns) ? [...options.keyColumns] : []
      },
      columns: profile.columns.map(column => ({
        name: column.name,
        expectedType: TYPE_OPTIONS.includes(column.type) ? column.type : 'string',
        required: column.missing === 0,
        unique: likelyKeys.has(column.name) && identifierLike(column.name),
        maxMissingRate: clampRate(column.missingRate, 0),
        maxMixedTypeRate: column.nonEmpty ? clampRate(column.mixedTypeCount / column.nonEmpty, 0) : 0
      }))
    };
  }

  function validateContract(contract) {
    if (!contract || typeof contract !== 'object') throw new Error('Invalid data contract.');
    if (Number(contract.contractVersion) !== CONTRACT_VERSION) {
      throw new Error('Unsupported data contract version.');
    }
    if (!contract.settings || typeof contract.settings !== 'object') {
      throw new Error('The data contract is missing settings.');
    }
    if (!Array.isArray(contract.settings.keyColumns)) {
      throw new Error('The data contract keyColumns setting must be an array.');
    }
    const minRows = Number(contract.settings.minRows ?? 0);
    const maxRowsRaw = contract.settings.maxRows;
    const maxRows = maxRowsRaw === null || maxRowsRaw === '' || maxRowsRaw === undefined ? null : Number(maxRowsRaw);
    if (!Number.isFinite(minRows) || minRows < 0) throw new Error('Invalid minimum row count.');
    if (maxRows !== null && (!Number.isFinite(maxRows) || maxRows < 0)) throw new Error('Invalid maximum row count.');
    if (maxRows !== null && maxRows < minRows) throw new Error('Maximum row count cannot be lower than minimum row count.');

    if (!Array.isArray(contract.columns) || !contract.columns.length) {
      throw new Error('The data contract does not define any columns.');
    }

    const names = new Set();
    contract.columns.forEach(rule => {
      const name = String(rule.name || '').trim();
      if (!name) throw new Error('Every contract column needs a name.');
      const key = name.toLowerCase();
      if (names.has(key)) throw new Error(`Duplicate contract column: ${name}`);
      names.add(key);

      if (!TYPE_OPTIONS.includes(rule.expectedType)) {
        throw new Error(`Unsupported expected type for ${name}: ${rule.expectedType}`);
      }

      const missingRate = Number(rule.maxMissingRate);
      const mixedRate = Number(rule.maxMixedTypeRate);
      if (!Number.isFinite(missingRate) || missingRate < 0 || missingRate > 1) {
        throw new Error(`Invalid missing-rate threshold for ${name}`);
      }
      if (!Number.isFinite(mixedRate) || mixedRate < 0 || mixedRate > 1) {
        throw new Error(`Invalid mixed-type threshold for ${name}`);
      }
    });

    const keyColumns = contract.settings?.keyColumns || [];
    keyColumns.forEach(name => {
      if (!contract.columns.some(rule => rule.name === name)) {
        throw new Error(`Composite key references unknown contract column: ${name}`);
      }
    });

    return true;
  }

  function duplicateKeySummary(rows, columns) {
    if (!Array.isArray(columns) || !columns.length) {
      return { duplicateRows: 0, duplicateGroups: 0, examples: [] };
    }

    const counts = new Map();
    rows.forEach(row => {
      const key = JSON.stringify(columns.map(column => {
        const value = row[column];
        return value === null || value === undefined ? '' : String(value);
      }));
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    let duplicateRows = 0;
    let duplicateGroups = 0;
    const examples = [];

    for (const [key, count] of counts.entries()) {
      if (count <= 1) continue;
      duplicateGroups += 1;
      duplicateRows += count - 1;
      if (examples.length < 20) {
        let values;
        try { values = JSON.parse(key); }
        catch { values = [key]; }
        examples.push({ values, count });
      }
    }

    return { duplicateRows, duplicateGroups, examples };
  }

  function issue(type, severity, column, message, details = {}) {
    return { type, severity, column: column || '', message, details };
  }

  function checkContract(dataset, profile, contract) {
    validateContract(contract);

    if (!dataset || !Array.isArray(dataset.headers) || !Array.isArray(dataset.rows)) {
      throw new Error('A valid dataset is required for contract checking.');
    }
    if (!profile || !Array.isArray(profile.columns)) {
      throw new Error('A valid data profile is required for contract checking.');
    }

    const issues = [];
    const actualColumns = new Map(profile.columns.map(column => [column.name, column]));
    const expectedNames = new Set(contract.columns.map(rule => rule.name));

    contract.columns.forEach(rule => {
      const actual = actualColumns.get(rule.name);

      if (!actual) {
        issues.push(issue(
          'missing_column',
          rule.required ? 'error' : 'warning',
          rule.name,
          `Expected column "${rule.name}" is missing.`,
          { required: Boolean(rule.required) }
        ));
        return;
      }

      if (actual.nonEmpty > 0 && actual.type !== rule.expectedType) {
        issues.push(issue(
          'type_changed',
          'error',
          rule.name,
          `Expected ${rule.expectedType}, observed ${actual.type}.`,
          { expectedType: rule.expectedType, actualType: actual.type, confidence: actual.typeConfidence }
        ));
      }

      const maxMissingRate = clampRate(rule.maxMissingRate, 0);
      if (!rule.required && actual.missingRate > maxMissingRate + 1e-12) {
        issues.push(issue(
          'missing_rate_exceeded',
          'warning',
          rule.name,
          `Missing rate ${(actual.missingRate * 100).toFixed(1)}% exceeds the allowed ${(maxMissingRate * 100).toFixed(1)}%.`,
          { actualRate: actual.missingRate, maxRate: maxMissingRate, missing: actual.missing }
        ));
      }

      const actualMixedRate = actual.nonEmpty ? actual.mixedTypeCount / actual.nonEmpty : 0;
      const maxMixedTypeRate = clampRate(rule.maxMixedTypeRate, 0);
      if (actualMixedRate > maxMixedTypeRate + 1e-12) {
        issues.push(issue(
          'mixed_type_rate_exceeded',
          'warning',
          rule.name,
          `Mixed-type rate ${(actualMixedRate * 100).toFixed(1)}% exceeds the allowed ${(maxMixedTypeRate * 100).toFixed(1)}%.`,
          { actualRate: actualMixedRate, maxRate: maxMixedTypeRate, mixedValues: actual.mixedTypeCount }
        ));
      }

      if (rule.unique && actual.unique < actual.nonEmpty) {
        issues.push(issue(
          'unique_violation',
          'error',
          rule.name,
          `Column "${rule.name}" is expected to be unique but duplicate non-empty values were found.`,
          { unique: actual.unique, nonEmpty: actual.nonEmpty }
        ));
      }

      if (rule.required && actual.missing > 0) {
        issues.push(issue(
          'required_value_missing',
          'error',
          rule.name,
          `Required column "${rule.name}" contains ${actual.missing} empty value${actual.missing === 1 ? '' : 's'}.`,
          { missing: actual.missing }
        ));
      }
    });

    if (contract.settings?.strictColumns !== false) {
      dataset.headers.forEach(name => {
        if (!expectedNames.has(name)) {
          issues.push(issue(
            'unexpected_column',
            'warning',
            name,
            `Unexpected column "${name}" is not defined by the contract.`
          ));
        }
      });
    }

    const minRows = Number(contract.settings?.minRows);
    const maxRowsRaw = contract.settings?.maxRows;
    const maxRows = maxRowsRaw === null || maxRowsRaw === '' || maxRowsRaw === undefined
      ? null
      : Number(maxRowsRaw);

    if (Number.isFinite(minRows) && dataset.rows.length < minRows) {
      issues.push(issue(
        'row_count_below_minimum',
        'warning',
        '',
        `Dataset has ${dataset.rows.length} rows, below the minimum ${minRows}.`,
        { actualRows: dataset.rows.length, minRows }
      ));
    }

    if (Number.isFinite(maxRows) && dataset.rows.length > maxRows) {
      issues.push(issue(
        'row_count_above_maximum',
        'warning',
        '',
        `Dataset has ${dataset.rows.length} rows, above the maximum ${maxRows}.`,
        { actualRows: dataset.rows.length, maxRows }
      ));
    }

    const keyColumns = contract.settings?.keyColumns || [];
    let keySummary = { duplicateRows: 0, duplicateGroups: 0, examples: [] };

    if (keyColumns.length) {
      const missingKeyColumns = keyColumns.filter(name => !dataset.headers.includes(name));
      if (!missingKeyColumns.length) {
        keySummary = duplicateKeySummary(dataset.rows, keyColumns);
        if (keySummary.duplicateGroups > 0) {
          issues.push(issue(
            'composite_key_duplicate',
            'error',
            keyColumns.join(' + '),
            `${keySummary.duplicateGroups} duplicate composite-key group${keySummary.duplicateGroups === 1 ? '' : 's'} found.`,
            keySummary
          ));
        }
      }
    }

    const errorCount = issues.filter(item => item.severity === 'error').length;
    const warningCount = issues.filter(item => item.severity === 'warning').length;

    return {
      status: issues.length ? 'REVIEW_REQUIRED' : 'PASS',
      summary: {
        rows: dataset.rows.length,
        columns: dataset.headers.length,
        issues: issues.length,
        errors: errorCount,
        warnings: warningCount,
        missingColumns: issues.filter(item => item.type === 'missing_column').length,
        unexpectedColumns: issues.filter(item => item.type === 'unexpected_column').length,
        typeChanges: issues.filter(item => item.type === 'type_changed').length,
        ruleViolations: issues.filter(item => !['missing_column','unexpected_column','type_changed'].includes(item.type)).length,
        duplicateKeyGroups: keySummary.duplicateGroups
      },
      issues
    };
  }

  function escapeCsv(value) {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function issuesToCsv(result) {
    const headers = ['severity','issue_type','column','message'];
    return [
      headers.join(','),
      ...(result?.issues || []).map(item => [
        item.severity,
        item.type,
        item.column,
        item.message
      ].map(escapeCsv).join(','))
    ].join('\n');
  }

  function cloneContract(contract) {
    validateContract(contract);
    return JSON.parse(JSON.stringify(contract));
  }

  return {
    CONTRACT_VERSION,
    TYPE_OPTIONS,
    createContract,
    validateContract,
    duplicateKeySummary,
    checkContract,
    issuesToCsv,
    cloneContract
  };
});
