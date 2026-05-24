import { DEFAULT_SHEET_TITLE_LABEL } from '../constants.js';

export function resolveExportTitle(title) {
  const trimmed = String(title ?? '').trim();
  return trimmed || DEFAULT_SHEET_TITLE_LABEL;
}

function sanitizeTitleForExport(title, { maxLength, fallback }) {
  const cleaned = String(title ?? '')
    .trim()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|[\]]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, maxLength)
    .replace(/^[._]+|[._]+$/g, '');

  return cleaned || fallback;
}

export function sanitizeExportFileName(title) {
  return sanitizeTitleForExport(resolveExportTitle(title), {
    maxLength: 80,
    fallback: DEFAULT_SHEET_TITLE_LABEL,
  });
}

export function sanitizeWorksheetName(title) {
  return sanitizeTitleForExport(resolveExportTitle(title), {
    maxLength: 31,
    fallback: DEFAULT_SHEET_TITLE_LABEL,
  });
}
