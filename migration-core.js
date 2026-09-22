(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RowMendMigration = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function normalizeColumnName(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  function normalizeValue(value, options) {
    const opts = Object.assign({
      trimWhitespace: true,
      emptyEqualsNull: true,
      caseInsensitive: false
    }, options || {});

    if (value === null || value === undefined) {
      return opts.emptyEqualsNull ? '' : String(value);
    }

    let out = String(value);
    if (opts.trimWhitespace) out = out.trim();
    if (opts.emptyEqualsNull && out === '') return '';
    if (opts.caseInsensitive) out = out.toLocaleLowerCase();
    return out;
  }

  function autoMapColumns(sourceColumns, targetColumns) {
    const targetExact = new Map(targetColumns.map(column => [String(column), column]));
    const targetNormalized = new Map();

    targetColumns.forEach(column => {
      const key = normalizeColumnName(column);
      if (!targetNormalized.has(key)) targetNormalized.set(key, column);
    });

    return sourceColumns.map(sourceColumn => {
      const exact = targetExact.get(String(sourceColumn));
      const normalized = targetNormalized.get(normalizeColumnName(sourceColumn));
      return {
        sourceColumn,
        targetColumn: exact || normalized || '',
        compare: Boolean(exact || normalized),
        role: 'value'
      };
    });
  }

  function buildCompositeKey(row, columns, options) {
    return JSON.stringify(columns.map(column => normalizeValue(row[column], options)));
  }

  function indexRows(rows, keyColumns, options) {
    const index = new Map();
    const duplicates = new Map();

    rows.forEach((row, rowIndex) => {
      const key = buildCompositeKey(row, keyColumns, options);
      if (index.has(key)) {
        if (!duplicates.has(key)) duplicates.set(key, [index.get(key)]);
        duplicates.get(key).push({ row, rowIndex });
        return;
      }
      index.set(key, { row, rowIndex });
    });

    return { index, duplicates };
  }

  function compareDatasets(input) {
    const sourceRows = input?.sourceRows || [];
    const targetRows = input?.targetRows || [];
    const keyMappings = input?.keyMappings || [];
    const columnMappings = input?.columnMappings || [];
    const options = Object.assign({
      trimWhitespace: true,
      emptyEqualsNull: true,
      caseInsensitive: false
    }, input?.options || {});

    if (!keyMappings.length) {
      throw new Error('Select at least one key column.');
    }

    const invalidKey = keyMappings.find(mapping =>
      !mapping.sourceColumn || !mapping.targetColumn
    );
    if (invalidKey) {
      throw new Error('Every key column must be mapped in both source and target.');
    }

    const sourceKeyColumns = keyMappings.map(mapping => mapping.sourceColumn);
    const targetKeyColumns = keyMappings.map(mapping => mapping.targetColumn);

    const sourceIndexed = indexRows(sourceRows, sourceKeyColumns, options);
    const targetIndexed = indexRows(targetRows, targetKeyColumns, options);

    const duplicateSourceKeys = new Set(sourceIndexed.duplicates.keys());
    const duplicateTargetKeys = new Set(targetIndexed.duplicates.keys());
    const ambiguousKeys = new Set([...duplicateSourceKeys, ...duplicateTargetKeys]);

    const matched = [];
    const changed = [];
    const missing = [];
    const extra = [];

    for (const [key, sourceEntry] of sourceIndexed.index.entries()) {
      if (ambiguousKeys.has(key)) continue;

      const targetEntry = targetIndexed.index.get(key);
      if (!targetEntry) {
        missing.push({
          key,
          row: sourceEntry.row,
          rowIndex: sourceEntry.rowIndex
        });
        continue;
      }

      const differences = [];

      columnMappings
        .filter(mapping =>
          mapping.compare !== false &&
          mapping.sourceColumn &&
          mapping.targetColumn
        )
        .forEach(mapping => {
          const sourceValue = sourceEntry.row[mapping.sourceColumn];
          const targetValue = targetEntry.row[mapping.targetColumn];

          if (
            normalizeValue(sourceValue, options) !==
            normalizeValue(targetValue, options)
          ) {
            differences.push({
              sourceColumn: mapping.sourceColumn,
              targetColumn: mapping.targetColumn,
              sourceValue,
              targetValue
            });
          }
        });

      if (differences.length) {
        changed.push({
          key,
          sourceRow: sourceEntry.row,
          targetRow: targetEntry.row,
          differences
        });
      } else {
        matched.push({
          key,
          sourceRow: sourceEntry.row,
          targetRow: targetEntry.row
        });
      }
    }

    for (const [key, targetEntry] of targetIndexed.index.entries()) {
      if (ambiguousKeys.has(key)) continue;
      if (!sourceIndexed.index.has(key)) {
        extra.push({
          key,
          row: targetEntry.row,
          rowIndex: targetEntry.rowIndex
        });
      }
    }

    const sourceDuplicates = [...sourceIndexed.duplicates.entries()].map(
      ([key, entries]) => ({ key, count: entries.length, entries })
    );
    const targetDuplicates = [...targetIndexed.duplicates.entries()].map(
      ([key, entries]) => ({ key, count: entries.length, entries })
    );

    return {
      summary: {
        sourceRows: sourceRows.length,
        targetRows: targetRows.length,
        matched: matched.length,
        changed: changed.length,
        missing: missing.length,
        extra: extra.length,
        sourceDuplicates: sourceDuplicates.length,
        targetDuplicates: targetDuplicates.length,
        duplicateKeys: sourceDuplicates.length + targetDuplicates.length,
        hasIssues: Boolean(
          changed.length ||
          missing.length ||
          extra.length ||
          sourceDuplicates.length ||
          targetDuplicates.length
        )
      },
      matched,
      changed,
      missing,
      extra,
      duplicates: {
        source: sourceDuplicates,
        target: targetDuplicates
      }
    };
  }

  function issueRows(result) {
    const rows = [];

    result.changed.forEach(item => {
      item.differences.forEach(diff => {
        rows.push({
          issue_type: 'CHANGED',
          key: item.key,
          column: `${diff.sourceColumn} -> ${diff.targetColumn}`,
          source_value: diff.sourceValue ?? '',
          target_value: diff.targetValue ?? ''
        });
      });
    });

    result.missing.forEach(item => {
      rows.push({
        issue_type: 'MISSING',
        key: item.key,
        column: '',
        source_value: JSON.stringify(item.row),
        target_value: ''
      });
    });

    result.extra.forEach(item => {
      rows.push({
        issue_type: 'EXTRA',
        key: item.key,
        column: '',
        source_value: '',
        target_value: JSON.stringify(item.row)
      });
    });

    result.duplicates.source.forEach(item => {
      rows.push({
        issue_type: 'DUPLICATE_SOURCE',
        key: item.key,
        column: '',
        source_value: String(item.count),
        target_value: ''
      });
    });

    result.duplicates.target.forEach(item => {
      rows.push({
        issue_type: 'DUPLICATE_TARGET',
        key: item.key,
        column: '',
        source_value: '',
        target_value: String(item.count)
      });
    });

    return rows;
  }

  function escapeCsv(value) {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text)
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  }

  function issuesToCsv(result) {
    const rows = issueRows(result);
    const headers = [
      'issue_type',
      'key',
      'column',
      'source_value',
      'target_value'
    ];

    return [
      headers.join(','),
      ...rows.map(row => headers.map(header => escapeCsv(row[header])).join(','))
    ].join('\n');
  }

  return {
    normalizeColumnName,
    normalizeValue,
    autoMapColumns,
    buildCompositeKey,
    indexRows,
    compareDatasets,
    issueRows,
    issuesToCsv
  };
});
