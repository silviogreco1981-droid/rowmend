(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RowMendInsights = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function number(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function percentChange(current, baseline) {
    const a = number(current, 0);
    const b = number(baseline, 0);
    if (b === 0) return a === 0 ? 0 : null;
    return (a - b) / Math.abs(b);
  }

  function points(current, baseline) {
    return (number(current, 0) - number(baseline, 0)) * 100;
  }

  function columnsByName(run) {
    const columns = run?.profileMetrics?.columnMetrics;
    if (!Array.isArray(columns)) return new Map();
    return new Map(columns.map(column => [column.name, column]));
  }

  function signal(id, severity, message, details = {}) {
    return { id, severity, message, details };
  }

  function compareColumns(current, baseline) {
    const currentMap = columnsByName(current);
    const baselineMap = columnsByName(baseline);
    const names = [...new Set([...currentMap.keys(), ...baselineMap.keys()])].sort();

    return names.map(name => {
      const now = currentMap.get(name) || null;
      const before = baselineMap.get(name) || null;
      return {
        name,
        added:!before && Boolean(now),
        removed:Boolean(before) && !now,
        typeChanged:Boolean(now && before && now.type !== before.type),
        currentType:now?.type || null,
        baselineType:before?.type || null,
        missingRate:now ? number(now.missingRate, 0) : null,
        baselineMissingRate:before ? number(before.missingRate, 0) : null,
        missingRateDeltaPoints:now && before ? points(now.missingRate, before.missingRate) : null,
        uniqueRate:now ? number(now.uniqueRate, 0) : null,
        baselineUniqueRate:before ? number(before.uniqueRate, 0) : null,
        uniqueRateDeltaPoints:now && before ? points(now.uniqueRate, before.uniqueRate) : null,
        mixedTypeRate:now ? number(now.mixedTypeRate, 0) : null,
        baselineMixedTypeRate:before ? number(before.mixedTypeRate, 0) : null,
        mixedTypeRateDeltaPoints:now && before ? points(now.mixedTypeRate, before.mixedTypeRate) : null
      };
    });
  }

  function compareRuns(current, baseline, options = {}) {
    if (!current || !baseline) throw new Error('Two run summaries are required.');

    const thresholds = {
      rowCountWarning: Number.isFinite(Number(options.rowCountWarning))
        ? Math.max(0, Number(options.rowCountWarning))
        : 0.20,
      completenessDropPoints: Number.isFinite(Number(options.completenessDropPoints))
        ? Math.max(0, Number(options.completenessDropPoints))
        : 5,
      missingRateIncreasePoints: Number.isFinite(Number(options.missingRateIncreasePoints))
        ? Math.max(0, Number(options.missingRateIncreasePoints))
        : 5,
      uniquenessDropPoints: Number.isFinite(Number(options.uniquenessDropPoints))
        ? Math.max(0, Number(options.uniquenessDropPoints))
        : 5,
      mixedTypeIncreasePoints: Number.isFinite(Number(options.mixedTypeIncreasePoints))
        ? Math.max(0, Number(options.mixedTypeIncreasePoints))
        : 5
    };

    const currentProfile = current.profileMetrics || {};
    const baselineProfile = baseline.profileMetrics || {};
    const columns = compareColumns(current, baseline);
    const signals = [];

    const rowDelta = number(current.inputRows, 0) - number(baseline.inputRows, 0);
    const rowPct = percentChange(current.inputRows, baseline.inputRows);
    const completenessDelta = points(currentProfile.completeness, baselineProfile.completeness);

    if (current.configFingerprint && baseline.configFingerprint && current.configFingerprint !== baseline.configFingerprint) {
      signals.push(signal(
        'workflow_config_changed',
        'info',
        'Workflow configuration changed between these runs.'
      ));
    }

    if (rowPct !== null && Math.abs(rowPct) >= thresholds.rowCountWarning) {
      signals.push(signal(
        'row_count_shift',
        'warning',
        `Input row count changed by ${Math.round(rowPct * 100)}%.`,
        { current:number(current.inputRows), baseline:number(baseline.inputRows), delta:rowDelta, percent:rowPct }
      ));
    }

    if (completenessDelta <= -thresholds.completenessDropPoints) {
      signals.push(signal(
        'completeness_drop',
        'warning',
        `Dataset completeness dropped by ${Math.abs(completenessDelta).toFixed(1)} percentage points.`,
        { deltaPoints:completenessDelta }
      ));
    }

    if (number(currentProfile.duplicateRows, 0) > number(baselineProfile.duplicateRows, 0)) {
      signals.push(signal(
        'duplicate_rows_increased',
        'warning',
        'Duplicate-row count increased.',
        {
          current:number(currentProfile.duplicateRows, 0),
          baseline:number(baselineProfile.duplicateRows, 0)
        }
      ));
    }

    if (number(current.invalidRows, 0) > number(baseline.invalidRows, 0)) {
      signals.push(signal(
        'invalid_rows_increased',
        'warning',
        'Import-invalid rows increased.',
        {
          current:number(current.invalidRows, 0),
          baseline:number(baseline.invalidRows, 0)
        }
      ));
    }

    if (number(current.contractErrors, 0) > number(baseline.contractErrors, 0)) {
      signals.push(signal(
        'contract_errors_increased',
        'warning',
        'Data-contract errors increased.',
        {
          current:number(current.contractErrors, 0),
          baseline:number(baseline.contractErrors, 0)
        }
      ));
    }

    if (number(current.contractWarnings, 0) > number(baseline.contractWarnings, 0)) {
      signals.push(signal(
        'contract_warnings_increased',
        'warning',
        'Data-contract warnings increased.',
        {
          current:number(current.contractWarnings, 0),
          baseline:number(baseline.contractWarnings, 0)
        }
      ));
    }

    if (number(currentProfile.allMissingColumns, 0) > number(baselineProfile.allMissingColumns, 0)) {
      signals.push(signal(
        'all_missing_columns_increased',
        'warning',
        'The number of completely empty columns increased.',
        {
          current:number(currentProfile.allMissingColumns, 0),
          baseline:number(baselineProfile.allMissingColumns, 0)
        }
      ));
    }

    columns.forEach(column => {
      if (column.added) {
        signals.push(signal(
          `column_added:${column.name}`,
          'info',
          `Column "${column.name}" appeared in the current run.`,
          { column:column.name }
        ));
        return;
      }
      if (column.removed) {
        signals.push(signal(
          `column_removed:${column.name}`,
          'warning',
          `Column "${column.name}" is missing from the current run.`,
          { column:column.name }
        ));
        return;
      }
      if (column.typeChanged) {
        signals.push(signal(
          `type_changed:${column.name}`,
          'warning',
          `Column "${column.name}" changed type from ${column.baselineType} to ${column.currentType}.`,
          { column:column.name, from:column.baselineType, to:column.currentType }
        ));
      }
      if (column.missingRateDeltaPoints !== null &&
          column.missingRateDeltaPoints >= thresholds.missingRateIncreasePoints) {
        signals.push(signal(
          `missing_rate_increased:${column.name}`,
          'warning',
          `Missing values increased by ${column.missingRateDeltaPoints.toFixed(1)} percentage points in "${column.name}".`,
          { column:column.name, deltaPoints:column.missingRateDeltaPoints }
        ));
      }
      if (column.uniqueRateDeltaPoints !== null &&
          column.uniqueRateDeltaPoints <= -thresholds.uniquenessDropPoints) {
        signals.push(signal(
          `uniqueness_dropped:${column.name}`,
          'warning',
          `Uniqueness dropped by ${Math.abs(column.uniqueRateDeltaPoints).toFixed(1)} percentage points in "${column.name}".`,
          { column:column.name, deltaPoints:column.uniqueRateDeltaPoints }
        ));
      }
      if (column.mixedTypeRateDeltaPoints !== null &&
          column.mixedTypeRateDeltaPoints >= thresholds.mixedTypeIncreasePoints) {
        signals.push(signal(
          `mixed_type_rate_increased:${column.name}`,
          'warning',
          `Mixed-type values increased by ${column.mixedTypeRateDeltaPoints.toFixed(1)} percentage points in "${column.name}".`,
          { column:column.name, deltaPoints:column.mixedTypeRateDeltaPoints }
        ));
      }
    });

    return {
      currentRunId:current.id || null,
      baselineRunId:baseline.id || null,
      configChanged:Boolean(
        current.configFingerprint &&
        baseline.configFingerprint &&
        current.configFingerprint !== baseline.configFingerprint
      ),
      metrics:{
        inputRows:{
          current:number(current.inputRows, 0),
          baseline:number(baseline.inputRows, 0),
          delta:rowDelta,
          percentChange:rowPct
        },
        outputRows:{
          current:number(current.outputRows, 0),
          baseline:number(baseline.outputRows, 0),
          delta:number(current.outputRows, 0) - number(baseline.outputRows, 0),
          percentChange:percentChange(current.outputRows, baseline.outputRows)
        },
        completeness:{
          current:number(currentProfile.completeness, 0),
          baseline:number(baselineProfile.completeness, 0),
          deltaPoints:completenessDelta
        },
        duplicateRows:{
          current:number(currentProfile.duplicateRows, 0),
          baseline:number(baselineProfile.duplicateRows, 0),
          delta:number(currentProfile.duplicateRows, 0) - number(baselineProfile.duplicateRows, 0)
        },
        invalidRows:{
          current:current.invalidRows === null ? null : number(current.invalidRows, 0),
          baseline:baseline.invalidRows === null ? null : number(baseline.invalidRows, 0),
          delta:current.invalidRows === null || baseline.invalidRows === null
            ? null
            : number(current.invalidRows, 0) - number(baseline.invalidRows, 0)
        },
        contractErrors:{
          current:number(current.contractErrors, 0),
          baseline:number(baseline.contractErrors, 0),
          delta:number(current.contractErrors, 0) - number(baseline.contractErrors, 0)
        },
        contractWarnings:{
          current:number(current.contractWarnings, 0),
          baseline:number(baseline.contractWarnings, 0),
          delta:number(current.contractWarnings, 0) - number(baseline.contractWarnings, 0)
        },
        durationMs:{
          current:number(current.durationMs, 0),
          baseline:number(baseline.durationMs, 0),
          delta:number(current.durationMs, 0) - number(baseline.durationMs, 0)
        }
      },
      columns,
      signals
    };
  }

  function historySeries(history) {
    const runs = Array.isArray(history) ? [...history] : [];
    runs.sort((a, b) => String(a.startedAt || '').localeCompare(String(b.startedAt || '')));

    return runs.map(run => ({
      id:run.id || null,
      startedAt:run.startedAt || null,
      status:run.status || 'REVIEW_REQUIRED',
      inputRows:number(run.inputRows, 0),
      outputRows:number(run.outputRows, 0),
      completeness:run.profileMetrics ? number(run.profileMetrics.completeness, 0) : null,
      duplicateRows:run.profileMetrics ? number(run.profileMetrics.duplicateRows, 0) : null,
      invalidRows:run.invalidRows === null || run.invalidRows === undefined ? null : number(run.invalidRows, 0),
      contractErrors:number(run.contractErrors, 0),
      contractWarnings:number(run.contractWarnings, 0),
      durationMs:number(run.durationMs, 0),
      configFingerprint:run.configFingerprint || null
    }));
  }

  function buildHistoryInsights(history, options = {}) {
    const runs = Array.isArray(history) ? history : [];
    if (!runs.length) {
      return {
        series:[],
        latest:null,
        previous:null,
        comparison:null
      };
    }

    const sorted = [...runs].sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
    const latest = sorted[0] || null;
    const previous = sorted[1] || null;

    return {
      series:historySeries(sorted),
      latest,
      previous,
      comparison:latest && previous ? compareRuns(latest, previous, options) : null
    };
  }

  return {
    percentChange,
    compareColumns,
    compareRuns,
    historySeries,
    buildHistoryInsights
  };
});
