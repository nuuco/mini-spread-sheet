function normalizeClipboardText(text) {
  return text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function trimTableRows(rows) {
  return rows
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell !== ''));
}

function looksLikeMarkdownTable(text) {
  const lines = text.split('\n').filter((line) => line.trim());
  if (!lines.length) {
    return false;
  }
  const pipeLines = lines.filter((line) => line.includes('|'));
  return pipeLines.length > 0 && pipeLines.length / lines.length >= 0.5;
}

function isMarkdownSeparatorRow(cells) {
  return cells.every((cell) => {
    const trimmed = cell.replace(/\s/g, '');
    return trimmed === '' || /^:?-{3,}:?$/.test(trimmed);
  });
}

function parseMarkdownTableRow(line) {
  const cells = line.split('|').map((cell) => cell.trim());
  if (cells.length && cells[0] === '') {
    cells.shift();
  }
  if (cells.length && cells[cells.length - 1] === '') {
    cells.pop();
  }
  return cells;
}

function parseMarkdownClipboardTable(text) {
  const rows = [];
  text.split('\n').forEach((line) => {
    if (!line.includes('|')) {
      return;
    }
    const cells = parseMarkdownTableRow(line);
    if (!cells.length || isMarkdownSeparatorRow(cells)) {
      return;
    }
    rows.push(cells);
  });
  return rows;
}

function parseDelimitedClipboardTable(text) {
  const lines = text.split('\n');
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }

  const hasTabs = lines.some((line) => line.includes('\t'));
  return lines
    .filter((line) => line.trim() || line.includes('\t'))
    .map((line) => {
      if (hasTabs) {
        return line.split('\t').map((cell) => cell.trim());
      }
      return [line.trim()];
    });
}

export function parseHtmlClipboardTable(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) {
    return [];
  }
  return [...table.querySelectorAll('tr')]
    .map((row) =>
      [...row.querySelectorAll('th, td')].map((cell) =>
        cell.textContent.replace(/\u00a0/g, ' ').trim(),
      ),
    )
    .filter((row) => row.length > 0);
}

export function parseClipboardTable(text) {
  const normalized = normalizeClipboardText(text);
  if (!normalized.trim()) {
    return [];
  }
  if (looksLikeMarkdownTable(normalized)) {
    return trimTableRows(parseMarkdownClipboardTable(normalized));
  }
  return trimTableRows(parseDelimitedClipboardTable(normalized));
}

export function buildTsvContent(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const value = cell ?? '';
          if (/[\t\r\n"]/.test(value)) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join('\t'),
    )
    .join('\n');
}
