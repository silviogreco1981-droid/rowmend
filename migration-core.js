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
    const opts = Object.assign({ trimWhitespace: true, emptyEqualsNull: true, caseInsensitive: false }, options || {});
    if (value === null || value === undefined) return opts.emptyEqualsNull ? '' : String(value);
    let out = String(value);
    if (opts.trimWhitespace) out = out.trim();
    if (opts.emptyEqualsNull && out === '') return '';
    if (opts.caseInsensitive) out = out.toLocaleLowerCase();
    return out;
  }

  function autoMapColumns(sourceColumns, targetColumns) {
    const targetExact = new Map(targetColumns.map(c => [String(c), c]));
    const targetNormalized = new Map();
    targetColumns.forEach(c => {
      const key = normalizeColumnName(c);
      if (!targetNormalized.has(key)) targetNormalized.set(key, c);
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
    const options = Object.assign({ trimWhitespace: true, emptyEqualsNull: true, caseInsensitive: false }, input?.options || {});

    if (!keyMappings.length) throw new Error('Select at least one key column.');
    const invalidKey = keyMappings.find(m => !m.sourceColumn || !m.targetColumn);
    if (invalidKey) throw new Error('Every key column must be mapped in both source and target.');

    const sourceKeyColumns = keyMappings.map(m => m.sourceColumn);
    const targetKeyColumns = keyMappings.map(m => m.targetColumn);
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
        missing.push({ key, row: sourceEntry.row, rowIndex: sourceEntry.rowIndex });
        continue;
      }

     ÛÛÝY\[Ù\ÈH×NÂÛÛ[[X\[ÜÂ[\HOKÛÛ\\HOOH[ÙH	KÛÝ\ÙPÛÛ[[	K\Ù]ÛÛ[[BÜXXÚ
X\[ÈOÂÛÛÝÛÝ\ÙU[YHHÛÝ\ÙQ[KÝÖÛX\[ËÛÝ\ÙPÛÛ[[NÂÛÛÝ\Ù][YHH\Ù][KÝÖÛX\[Ë\Ù]ÛÛ[[NÂY
ÜX[^U[YJÛÝ\ÙU[YKÜ[ÛÊHOOHÜX[^U[YJ\Ù][YKÜ[ÛÊJHÂY\[Ù\Ë\Ú
ÂÛÝ\ÙPÛÛ[[X\[ËÛÝ\ÙPÛÛ[[\Ù]ÛÛ[[X\[Ë\Ù]ÛÛ[[ÛÝ\ÙU[YK\Ù][YBJNÂBJNÂY
Y\[Ù\Ë[Ý
HÂÚ[ÙY\Ú
ÈÙ^KÛÝ\ÙTÝÎÛÝ\ÙQ[KÝË\Ù]ÝÎ\Ù][KÝËY\[Ù\ÈJNÂH[ÙHÂX]ÚY\Ú
ÈÙ^KÛÝ\ÙTÝÎÛÝ\ÙQ[KÝË\Ù]ÝÎ\Ù][KÝÈJNÂBBÜ
ÛÛÝÚÙ^K\Ù][WHÙ\Ù][^Y[^[Y\Ê
JHÂY
[XYÝ[Ý\ÒÙ^\Ë\ÊÙ^JJHÛÛ[YNÂY
\ÛÝ\ÙR[^Y[^\ÊÙ^JJHÂ^K\Ú
ÈÙ^KÝÎ\Ù][KÝËÝÒ[^\Ù][KÝÒ[^JNÂBBÛÛÝÛÝ\ÙQ\XØ]\ÈHËÛÝ\ÙR[^Y\XØ]\Ë[Y\Ê
WKX\

ÚÙ^K[Y\×JHO
ÈÙ^KÛÝ[[Y\Ë[Ý[Y\ÈJJNÂÛÛÝ\Ù]\XØ]\ÈHË\Ù][^Y\XØ]\Ë[Y\Ê
WKX\

ÚÙ^K[Y\×JHO
ÈÙ^KÛÝ[[Y\Ë[Ý[Y\ÈJJNÂ]\ÂÝ[[X\NÂÛÝ\ÙTÝÜÎÛÝ\ÙTÝÜË[Ý\Ù]ÝÜÎ\Ù]ÝÜË[ÝX]ÚYX]ÚY[ÝÚ[ÙYÚ[ÙY[ÝZ\ÜÚ[ÎZ\ÜÚ[Ë[Ý^N^K[ÝÛÝ\ÙQ\XØ]\ÎÛÝ\ÙQ\XØ]\Ë[Ý\Ù]\XØ]\Î\Ù]\XØ]\Ë[Ý\XØ]RÙ^\ÎÛÝ\ÙQ\XØ]\Ë[Ý
È\Ù]\XØ]\Ë[Ý\Ò\ÜÝY\ÎÛÛX[Ú[ÙY[ÝZ\ÜÚ[Ë[Ý^K[ÝÛÝ\ÙQ\XØ]\Ë[Ý\Ù]\XØ]\Ë[Ý
BKX]ÚYÚ[ÙYZ\ÜÚ[Ë^K\XØ]\ÎÈÛÝ\ÙNÛÝ\ÙQ\XØ]\Ë\Ù]\Ù]\XØ]\ÈBNÂB[Ý[Û\ÜÝYTÝÜÊ\Ý[
HÂÛÛÝÝÜÈH×NÂ\Ý[Ú[ÙYÜXXÚ
][HO][KY\[Ù\ËÜXXÚ
YOÝÜË\Ú
Â\ÜÝYWÝ\N	ÐÒSÑQ	ËÙ^N][KÙ^KÛÛ[[	ÙYÛÝ\ÙPÛÛ[[HO	ÙY\Ù]ÛÛ[[XÛÝ\ÙWÝ[YNYÛÝ\ÙU[YHÏÈ	ÉË\Ù]Ý[YNY\Ù][YHÏÈ	ÉÂJJJNÂ\Ý[Z\ÜÚ[ËÜXXÚ
][HOÝÜË\Ú
È\ÜÝYWÝ\N	ÓRTÔÒSÉËÙ^N][KÙ^KÛÛ[[	ÉËÛÝ\ÙWÝ[YNÓÓÝ[ÚYJ][KÝÊK\Ù]Ý[YN	ÉÈJJNÂ\Ý[^KÜXXÚ
][HOÝÜË\Ú
È\ÜÝYWÝ\N	ÑVIËÙ^N][KÙ^KÛÛ[[	ÉËÛÝ\ÙWÝ[YN	ÉË\Ù]Ý[YNÓÓÝ[ÚYJ][KÝÊHJJNÂ\Ý[\XØ]\ËÛÝ\ÙKÜXXÚ
][HOÝÜË\Ú
È\ÜÝYWÝ\N	ÑTPÐUWÔÓÕTÑIËÙ^N][KÙ^KÛÛ[[	ÉËÛÝ\ÙWÝ[YNÝ[Ê][KÛÝ[
K\Ù]Ý[YN	ÉÈJJNÂ\Ý[\XØ]\Ë\Ù]ÜXXÚ
][HOÝÜË\Ú
È\ÜÝYWÝ\N	ÑTPÐUWÕTÑU	ËÙ^N][KÙ^KÛÛ[[	ÉËÛÝ\ÙWÝ[YN	ÉË\Ù]Ý[YNÝ[Ê][KÛÝ[
HJJNÂ]\ÝÜÎÂB[Ý[Û\ØØ\PÜÝ[YJHÂÛÛÝ^HÝ[Ê[YHÏÈ	ÉÊNÂ]\ÖÈKË\Ý
^
HÈÝ^\XÙJÈÙË	ÈÊ_H^ÂB[Ý[Û\ÜÝY\ÕÐÜÝ\Ý[
HÂÛÛÝÝÜÈH\ÜÝYTÝÜÊ\Ý[
NÂÛÛÝXY\ÈHÉÚ\ÜÝYWÝ\IË	ÚÙ^IË	ØÛÛ[[Ë	ÜÛÝ\ÙWÝ[YIË	Ý\Ù]Ý[YI×NÂ]\ÚXY\ËÚ[	Ë	ÊKÝÜËX\
ÝÈOXY\ËX\
O\ØØ\PÜÝÝÖÚJJKÚ[	Ë	ÊJWKÚ[	×ÊNÂB]\ÂÜX[^PÛÛ[[[YKÜX[^U[YK]]ÓX\ÛÛ[[ËZ[ÛÛ\ÜÚ]RÙ^K[^ÝÜËÛÛ\\Q]\Ù]Ë\ÜÝYTÝÜË\ÜÝY\ÕÐÜÝNÂJNÂ