(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RowMendExcel = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function extension(fileOrName) {
    const name = typeof fileOrName === 'string' ? fileOrName : fileOrName?.name;
    return String(name || '').split('.').pop().toLowerCase();
  }

  function isExcelFile(fileOrName) {
    return ['xlsx', 'xls'].includes(extension(fileOrName));
  }

  function getEngine(explicitEngine) {
    const engine = explicitEngine || (typeof globalThis !== 'undefined' ? globalThis.XLSX : null);
    if (!engine?.read || !engine?.utils?.sheet_to_json) {
      throw new Error('Excel parser is still loading. Please retry in a moment.');
    }
    return engine;
  }

  function sheetNames(workbook) {
    return Array.isArray(workbook?.SheetNames)
      ? workbook.SheetNames.filter(name => String(name || '').trim())
      : [];
  }

  function selectSheet(workbook, requestedSheet = '', explicitEngine) {
    const engine = getEngine(explicitEngine);
    const names = sheetNames(workbook);
    if (!names.length) {
      return { headers: [], rows: [], sheetName: '', sheetNames: [] };
    }

    const chosen = requestedSheet && names.includes(requestedSheet) ? requestedSheet : names[0];
    const sheet = workbook.Sheets?.[chosen];
    if (!sheet) throw new Error(`Worksheet "${chosen}" is not available in this workbook.`);

    const rows = engine.utils.sheet_to_json(sheet, { defval:'', raw:false });
    return {
      headers: rows.length ? Object.keys(rows[0]) : [],
      rows,
      sheetName: chosen,
      sheetNames: names
    };
  }

  async function readWorkbook(file, explicitEngine) {
    if (!isExcelFile(file)) throw new Error('Expected an XLSX or XLS file.');
    const engine = getEngine(explicitEngine);
    const buffer = await file.arrayBuffer();
    return engine.read(buffer, { type:'array', cellDates:false });
  }

  async function readFile(file, requestedSheet = '', explicitEngine) {
    const workbook = await readWorkbook(file, explicitEngine);
    return selectSheet(workbook, requestedSheet, explicitEngine);
  }

  return {
    extension,
    isExcelFile,
    sheetNames,
    selectSheet,
    readWorkbook,
    readFile
  };
});
