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
  return sanitizeTitleForExport(title, { maxLength: 80, fallback: 'spreadsheet' });
}

export function sanitizeWorksheetName(title) {
  return sanitizeTitleForExport(title, { maxLength: 31, fallback: 'Sheet1' });
}
