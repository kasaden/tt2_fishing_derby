// CSV and number readers for the game data. Node and browser alike: no DOM, no Node API.
// Copied from tt2_monuments/scripts/csv.js (same author, MIT licence), where parseCsv itself comes from tt2_alchemy_lab/lib/csv.js.

/**
 * Minimal RFC-4180-ish CSV parser: handles a UTF-8 BOM, CRLF/LF line endings,
 * quoted fields with embedded commas, and doubled quotes. Empty lines are skipped.
 */
export function parseCsv(text) {
  const src = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n')
        i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (nonEmpty.length === 0)
    return [];
  const header = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((cells) => {
    const rec = {};
    header.forEach((h, idx) => {
      rec[h] = (cells[idx] ?? '').trim();
    });
    return rec;
  });
}

/** Matches a whole, decimal or scientific number, nothing else (no thousands separator, no spaces). */
const NUMBER = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;

/** Reads a number written as the game data writes it; any other text gives NaN. */
export function parseNumber(text) {
  return NUMBER.test(text) ? Number(text) : Number.NaN;
}
