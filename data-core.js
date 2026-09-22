(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RowMendData = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const DEFAULT_DELIMITERS = [',', ';', '\t', '|'];

  function normalizeHeader(value, fallbackIndex = 0) {
    const raw = String(value ?? '').trim();
    return raw || `COLUMN_${fallbackIndex + 1}`;
  }

  function parseDelimited(text, delimiter) {
    const source = String(text ?? '').replace(/^\uFEFF/, '');
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
      if (record.some(value => String(value).length > 0)) records.push(record);
      record = [];
    };

    for (let index = 0; index < source.length; index += 1) {
      const char = source[index];

      if (char === '"') {
        if (quoted && source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
        continue;
      }

      if (char === delimiter && !quoted) {
        pushField();
        continue;
      }

      if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && source[index + 1] === '\n') index += 1;
        pushRecord();
        continue;
      }

      field += char;
    }

    if (quoted) throw new Error('Malformed delimited file: an opening quote is not closed.');
    if (field.length || record.length) pushRecord();
    if (!records.length) return { headers: [], rows: [] };

    const seen = new Map();
    const headers = records[0].map((value, index) => {
      const base = normalizeHeader(value, index);
      const key = base.toLowerCase();
      const count = (seen.get(key) || 0) + 1;
      seen.set(key, count);
      return count === 1 ? base : `${base}_${count}`;
    });

    const rows = records
      .slice(1)
      .filter(values => values.some(value => String(value ?? '').trim() !== ''))
      .map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));

    return { headers, rows };
  }

  function detectDelimiter(text, candidates = DEFAULT_DELIMITERS) {
    const source = String(text ?? '').replace(/^\uFEFF/, '');
    const lines = source.split(/\r?\n/).filter(Boolean).slice(0, 12);
    if (!lines.length) return ',';

    let best = ',';
    let bestScore = -Infinity;

    candidates.forEach(delimiter => {
      const counts = lines.map(line => {
        let quoted = false;
        let count = 0;
        for (let index = 0; index < line.length; index += 1) {
          const char = line[index];
          if (char === '"') {
            if (quoted && line[index + 1] === '"') index += 1;
            else quoted = !quoted;
          } else if (!quoted && char === delimiter) {
            count += 1;
          }
        }
        return count;
      });

      const nonZero = counts.filter(count => count > 0);
      if (!nonZero.length) return;

      const frequencies = new Map();
      nonZero.forEach(count => frequencies.set(count, (frequencies.get(count) || 0) + 1));
      const [mode, matches] = [...frequencies.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
      const consistency = matches / lines.length;
      const coverage = nonZero.length / lines.length;
      const score = consistency * 100 + coverage * 50 + Math.min(mode, 20);

      if (score > bestScore) {
        bestScore = score;
        best = delimiter;
      }
    });

    return best;
  }

  function primitiveType(value) {
    if (value === null || value === undefined || String(value).trim() === '') return 'empty';
    if (typeof value === 'boolean' || /^(true|false)$/i.test(String(value).trim())) return 'boolean';
    if (typeof value === 'number' || /^[-+]?\d+(?:[.,]\d+)?$/.test(String(value).trim())) return 'number';

    const text = String(value).trim();
    if (
      /^\d{4}-\d{1,2}-\d{1,2}(?:[T ][0-9:.+\-Z]*)?$/.test(text) &&
      !Number.isNaN(Date.parse(text))
    ) return 'date';

    return 'string';
  }

  function normalizeForKey(value) {
    return value === null || value === undefined ? '' : String(value);
  }

  function exactDuplicateSummary(rows, headers) {
    const seen = new Map();
    let duplicateRows = 0;

    rows.forEach(row => {
      const key = JSON.stringify(headers.map(header => normalizeForKey(row[header])));
      const count = (seen.get(key) || 0) + 1;
      seen.set(key, count);
      if (count > 1) duplicateRows += 1;
    });

    return {
      duplicateRows,
      duplicateGroups: [...seen.values()].filter(count => count > 1).length
    };
  }

  function inferColumn(values) {
    const counts = { empty: 0, boolean: 0, number: 0, date: 0, string: 0 };
    values.forEach(value => {
      counts[primitiveType(value)] += 1;
    });

    const nonEmptyCount = values.length - counts.empty;
    const dominantEntry = Object.entries(counts)
      .filter(([type]) => type !== 'empty')
      .sort((a, b) => b[1] - a[1])[0] || ['string', 0];

    return {
      counts,
      type: dominantEntry[0],
      typeConfidence: nonEmptyCount ? dominantEntry[1] / nonEmptyCount : 1
    };
  }

  function numericStats(values) {
    const numbers = values
      .map(value => {
        const text = String(value ?? '').trim().replace(',', '.');
        return text && /^[-+]?\d+(?:\.\d+)?$/.test(text) ? Number(text) : NaN;
      })
      .filter(Number.isFinite);

    if (!numbers.length) return null;
    const sum = numbers.reduce((total, value) => total + value, 0);

    return {
      min: Math.min(...numbers),
      max: Math.max(...numbers),
      mean: sum / numbers.length,
      count: numbers.length
    };
  }

  function dateStats(values) {
    let count = 0;
    let min = Infinity;
    let max = -Infinity;

    values.forEach(value => {
      if (primitiveType(value) !== 'date') return;
      const timestamp = Date.parse(String(value ?? '').trim());
      if (!Number.isFinite(timestamp)) return;
      count += 1;
      if (timestamp < min) min = timestamp;
      if (timestamp > max) max = timestamp;
    });

    if (!count) return null;

    return {
      min: new Date(min).toISOString(),
      max: new Date(max).toISOString(),
      count
    };
  }

  function stringStats(values) {
    const strings = values
      .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
      .map(value => String(value));

    if (!strings.length) return null;
    const lengths = strings.map(value => value.length);
    const totalLength = lengths.reduce((total, value) => total + value, 0);

    return {
      minLength: Math.min(...lengths),
      maxLength: Math.max(...lengths),
      averageLength: totalLength / lengths.length
    };
  }

  function topValues(values, limit = 8) {
    const counts = new Map();

    values.forEach(value => {
      const key = value === null || value === undefined || String(value) === '' ? '(empty)' : String(value);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([value, count]) => ({ value, count }));
  }

  function profileDataset(rows, headers) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const safeHeaders = Array.isArray(headers) && headers.length
      ? headers
      : (safeRows[0] ? Object.keys(safeRows[0]) : []);

    const columnProfiles = safeHeaders.map(name => {
      const values = safeRows.map(row => row[name]);
      const inference = inferColumn(values);
      const missing = inference.counts.empty;
      const nonEmptyValues = values.filter(value => primitiveType(value) !== 'empty');
      const unique = new Set(nonEmptyValues.map(value => normalizeForKey(value))).size;
      const nonEmpty = safeRows.length - missing;
      const mixedTypeCount = Object.entries(inference.counts)
        .filter(([type, count]) => type !== 'empty' && type !== inference.type && count > 0)
        .reduce((sum, [, count]) => sum + count, 0);

      return {
        name,
        type: inference.type,
        typeConfidence: inference.typeConfidence,
        mixedTypeCount,
        missing,
        missingRate: safeRows.length ? missing / safeRows.length : 0,
        nonEmpty,
        unique,
        uniqueRate: nonEmpty ? unique / nonEmpty : 0,
        numeric: inference.type === 'number' ? numericStats(values) : null,
        date: inference.type === 'date' ? dateStats(values) : null,
        string: inference.type === 'string' ? stringStats(values) : null,
        topValues: topValues(values)
      };
    });

    const duplicateSummary = exactDuplicateSummary(safeRows, safeHeaders);
    const totalCells = safeRows.length * safeHeaders.length;
    const missingCells = columnProfiles.reduce((sum, column) => sum + column.missing, 0);
    const mixedColumns = columnProfiles.filter(column => column.mixedTypeCount > 0).length;
    const allMissingColumns = columnProfiles.filter(column => column.nonEmpty === 0).length;
    const likelyKeyColumns = columnProfiles
      .filter(column => safeRows.length > 0 && column.missing === 0 && column.unique === safeRows.length)
      .map(column => column.name);

    return {
      summary: {
        rows: safeRows.length,
        columns: safeHeaders.length,
        totalCells,
        missingCells,
        completeness: totalCells ? 1 - (missingCells / totalCells) : 1,
        duplicateRows: duplicateSummary.duplicateRows,
        duplicateGroups: duplicateSummary.duplicateGroups,
        mixedColumns,
        allMissingColumns,
        likelyKeyColumns
      },
      columns: columnProfiles
    };
  }

  function normalizeOperation(operation) {
    if (!operation || typeof operation !== 'object') throw new Error('Invalid transform operation.');
    const type = String(operation.type || '').trim();
    if (!type) throw new Error('Transform operation type is required.');
    return { ...operation, type };
  }

  function selectedColumns(operation, headers) {
    if (Array.isArray(operation.columns) && operation.columns.length) {
      const missing = operation.columns.filter(column => !headers.includes(column));
      if (missing.length) {
        throw new Error(`Transform references missing column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`);
      }
      return [...operation.columns];
    }

    if (operation.column) {
      if (!headers.includes(operation.column)) {
        throw new Error(`Transform references missing column: ${operation.column}`);
      }
      return [operation.column];
    }

    return [...headers];
  }

  function applyCellOperation(rows, headers, operation, transform) {
    const columns = selectedColumns(operation, headers);
    return rows.map(row => {
      const next = { ...row };
      columns.forEach(column => {
        next[column] = transform(next[column], column);
      });
      return next;
    });
  }

  function applyOperation(dataset, rawOperation) {
    const operation = normalizeOperation(rawOperation);
    let headers = [...dataset.headers];
    let rows = dataset.rows.map(row => ({ ...row }));

    if (operation.type === 'trim') {
      rows = applyCellOperation(rows, headers, operation, value =>
        typeof value === 'string' ? value.trim() : value
      );
    } else if (operation.type === 'uppercase') {
      rows = applyCellOperation(rows, headers, operation, value =>
        value === null || value === undefined ? value : String(value).toUpperCase()
      );
    } else if (operation.type === 'lowercase') {
      rows = applyCellOperation(rows, headers, operation, value =>
        value === null || value === undefined ? value : String(value).toLowerCase()
      );
    } else if (operation.type === 'empty_to_null') {
      rows = applyCellOperation(rows, headers, operation, value =>
        value === null || value === undefined || String(value).trim() === '' ? null : value
      );
    } else if (operation.type === 'find_replace') {
      const find = String(operation.find ?? '');
      const replacement = String(operation.replacement ?? '');
      if (!find) throw new Error('Find value cannot be empty.');
      rows = applyCellOperation(rows, headers, operation, value => {
        if (value === null || value === undefined) return value;
        return String(value).split(find).join(replacement);
      });
    } else if (operation.type === 'rename') {
      const from = String(operation.column || '');
      const to = String(operation.newName || '').trim();
      if (!headers.includes(from)) throw new Error('Column to rename does not exist.');
      if (!to) throw new Error('New column name is required.');
      if (headers.some(header => header !== from && header.toLowerCase() === to.toLowerCase())) {
        throw new Error('A column with that name already exists.');
      }
      headers = headers.map(header => header === from ? to : header);
      rows = rows.map(row => {
        const next = {};
        Object.keys(row).forEach(key => {
          next[key === from ? to : key] = row[key];
        });
        return next;
      });
    } else if (operation.type === 'remove_exact_duplicates') {
      const seen = new Set();
      rows = rows.filter(row => {
        const key = JSON.stringify(headers.map(header => normalizeForKey(row[header])));
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } else if (operation.type === 'remove_key_duplicates') {
      const columns = selectedColumns(operation, headers);
      if (!columns.length) throw new Error('Select at least one key column.');
      const keep = operation.keep === 'last' ? 'last' : 'first';

      if (keep === 'first') {
        const seen = new Set();
        rows = rows.filter(row => {
          const key = JSON.stringify(columns.map(column => normalizeForKey(row[column])));
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      } else {
        const lastIndexByKey = new Map();
        rows.forEach((row, index) => {
          const key = JSON.stringify(columns.map(column => normalizeForKey(row[column])));
          lastIndexByKey.set(key, index);
        });
        rows = rows.filter((row, index) => {
          const key = JSON.stringify(columns.map(column => normalizeForKey(row[column])));
          return lastIndexByKey.get(key) === index;
        });
      }
    } else if (operation.type === 'drop_empty_rows') {
      rows = rows.filter(row => headers.some(header => String(row[header] ?? '').trim() !== ''));
    } else if (operation.type === 'filter_nonempty') {
      const column = String(operation.column || '');
      if (!headers.includes(column)) throw new Error('Filter column does not exist.');
      rows = rows.filter(row => String(row[column] ?? '').trim() !== '');
    } else {
      throw new Error(`Unsupported transform operation: ${operation.type}`);
    }

    return { headers, rows };
  }

  function applyRecipe(dataset, recipe) {
    return (recipe || []).reduce((current, operation) => applyOperation(current, operation), {
      headers: [...(dataset.headers || [])],
      rows: (dataset.rows || []).map(row => ({ ...row }))
    });
  }

  function escapeCsv(value) {
    const text = value === null ? '' : String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function datasetToCsv(dataset) {
    const headers = dataset.headers || [];
    const rows = dataset.rows || [];
    return [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => headers.map(header => escapeCsv(row[header])).join(','))
    ].join('\n');
  }

  function profileToCsv(profile) {
    const headers = ['column','type','type_confidence','missing','missing_rate','unique','unique_rate','mixed_type_count','min','max','mean_or_avg_length'];
    const rows = profile.columns.map(column => {
      const min = column.numeric?.min ?? column.date?.min ?? column.string?.minLength ?? '';
      const max = column.numeric?.max ?? column.date?.max ?? column.string?.maxLength ?? '';
      const aggregate = column.numeric?.mean ?? column.string?.averageLength ?? '';
      return [
        column.name,
        column.type,
        column.typeConfidence,
        column.missing,
        column.missingRate,
        column.unique,
        column.uniqueRate,
        column.mixedTypeCount,
        min,
        max,
        aggregate
      ];
    });

    return [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\n');
  }

  return {
    DEFAULT_DELIMITERS,
    normalizeHeader,
    parseDelimited,
    detectDelimiter,
    primitiveType,
    profileDataset,
    applyOperation,
    applyRecipe,
    datasetToCsv,
    profileToCsv,
    exactDuplicateSummary,
    topValues
  };
});
