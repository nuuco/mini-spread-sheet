const CONFIG = {
  defaultRows: 5,
  defaultCols: 5,
};

const STORAGE_KEY = 'mini-spreadsheet-data';
const SAVE_DEBOUNCE_MS = 300;

let spreadsheet = {
  rows: CONFIG.defaultRows,
  cols: CONFIG.defaultCols,
  data: [],
  focus: { row: 0, col: 0 },
};

let saveTimer = null;

function createEmptyData(rows, cols) {
  return Array.from({ length: rows }, () => Array(cols).fill(''));
}

function columnIndexToLabel(col) {
  let label = '';
  let index = col;

  while (index >= 0) {
    label = String.fromCharCode(65 + (index % 26)) + label;
    index = Math.floor(index / 26) - 1;
  }

  return label;
}

function formatCellAddress(row, col) {
  return `${columnIndexToLabel(col)}${row + 1}`;
}

function clampFocus() {
  spreadsheet.focus.row = Math.min(spreadsheet.focus.row, spreadsheet.rows - 1);
  spreadsheet.focus.col = Math.min(spreadsheet.focus.col, spreadsheet.cols - 1);
  spreadsheet.focus.row = Math.max(spreadsheet.focus.row, 0);
  spreadsheet.focus.col = Math.max(spreadsheet.focus.col, 0);
}

function setFocus(row, col, shouldFocusInput = false) {
  spreadsheet.focus = { row, col };
  updateCoordinateDisplay();
  updateHeaderHighlights();
  updateCellSelection();

  if (shouldFocusInput) {
    const input = document.querySelector(
      `.cell[data-row="${row}"][data-col="${col}"] .cell-input`,
    );
    input?.focus();
  }
}

function updateCoordinateDisplay() {
  const coordinateEl = document.getElementById('cell-coordinate');
  const { row, col } = spreadsheet.focus;
  coordinateEl.textContent = `Cell: ${formatCellAddress(row, col)}`;
}

function updateHeaderHighlights() {
  const { row, col } = spreadsheet.focus;

  document.querySelectorAll('.col-header').forEach((header) => {
    header.classList.toggle('active', Number(header.dataset.col) === col);
  });

  document.querySelectorAll('.row-header').forEach((header) => {
    header.classList.toggle('active', Number(header.dataset.row) === row);
  });
}

function updateCellSelection() {
  const { row, col } = spreadsheet.focus;

  document.querySelectorAll('.cell').forEach((cell) => {
    const cellRow = Number(cell.dataset.row);
    const cellCol = Number(cell.dataset.col);
    const isSelected = cellRow === row && cellCol === col;

    cell.classList.toggle('selected', isSelected);
    cell.classList.toggle('highlight-row', cellRow === row);
    cell.classList.toggle('highlight-col', cellCol === col);
  });
}

function onCellInput(row, col, value) {
  spreadsheet.data[row][col] = value;
  scheduleSaveToLocalStorage();
}

function scheduleSaveToLocalStorage() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveToLocalStorage();
    saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

function saveToLocalStorage() {
  const payload = {
    rows: spreadsheet.rows,
    cols: spreadsheet.cols,
    data: spreadsheet.data,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadFromLocalStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    spreadsheet.rows = CONFIG.defaultRows;
    spreadsheet.cols = CONFIG.defaultCols;
    spreadsheet.data = createEmptyData(spreadsheet.rows, spreadsheet.cols);
    return;
  }

  try {
    const saved = JSON.parse(raw);
    spreadsheet.rows = saved.rows ?? CONFIG.defaultRows;
    spreadsheet.cols = saved.cols ?? CONFIG.defaultCols;
    spreadsheet.data = saved.data ?? createEmptyData(spreadsheet.rows, spreadsheet.cols);
  } catch {
    spreadsheet.rows = CONFIG.defaultRows;
    spreadsheet.cols = CONFIG.defaultCols;
    spreadsheet.data = createEmptyData(spreadsheet.rows, spreadsheet.cols);
  }
}

function bindCellEvents(input, cell, row, col) {
  input.addEventListener('focus', () => setFocus(row, col));
  input.addEventListener('input', (event) => onCellInput(row, col, event.target.value));
  cell.addEventListener('click', () => setFocus(row, col, true));
}

function renderGrid() {
  const container = document.getElementById('spreadsheet');
  const table = document.createElement('table');
  table.className = 'grid-table';

  const headerRow = document.createElement('tr');
  const cornerCell = document.createElement('th');
  cornerCell.className = 'corner-header';
  headerRow.appendChild(cornerCell);

  for (let col = 0; col < spreadsheet.cols; col += 1) {
    const colHeader = document.createElement('th');
    colHeader.className = 'col-header';
    colHeader.dataset.col = String(col);
    colHeader.textContent = columnIndexToLabel(col);
    headerRow.appendChild(colHeader);
  }

  table.appendChild(headerRow);

  for (let row = 0; row < spreadsheet.rows; row += 1) {
    const tableRow = document.createElement('tr');

    const rowHeader = document.createElement('th');
    rowHeader.className = 'row-header';
    rowHeader.dataset.row = String(row);
    rowHeader.textContent = String(row + 1);
    tableRow.appendChild(rowHeader);

    for (let col = 0; col < spreadsheet.cols; col += 1) {
      const cell = document.createElement('td');
      cell.className = 'cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'cell-input';
      input.value = spreadsheet.data[row][col] ?? '';
      input.setAttribute('aria-label', formatCellAddress(row, col));

      bindCellEvents(input, cell, row, col);
      cell.appendChild(input);
      tableRow.appendChild(cell);
    }

    table.appendChild(tableRow);
  }

  container.replaceChildren(table);
  clampFocus();
  setFocus(spreadsheet.focus.row, spreadsheet.focus.col, true);
}

function collectSpreadsheetData() {
  return spreadsheet.data.map((row) => [...row]);
}

function escapeCsvField(value) {
  const text = value ?? '';
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsvContent(data) {
  const lines = data.map((row) => row.map(escapeCsvField).join(','));
  return `\uFEFF${lines.join('\r\n')}`;
}

function downloadCsv(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportSpreadsheet() {
  const data = collectSpreadsheetData();
  const csvContent = buildCsvContent(data);
  downloadCsv('spreadsheet.csv', csvContent);
}

function addRow() {
  spreadsheet.data.push(Array(spreadsheet.cols).fill(''));
  spreadsheet.rows += 1;
  renderGrid();
  saveToLocalStorage();
}

function removeRow() {
  if (spreadsheet.rows <= 1) {
    return;
  }

  spreadsheet.data.pop();
  spreadsheet.rows -= 1;
  clampFocus();
  renderGrid();
  saveToLocalStorage();
}

function addColumn() {
  spreadsheet.data.forEach((row) => row.push(''));
  spreadsheet.cols += 1;
  renderGrid();
  saveToLocalStorage();
}

function removeColumn() {
  if (spreadsheet.cols <= 1) {
    return;
  }

  spreadsheet.data.forEach((row) => row.pop());
  spreadsheet.cols -= 1;
  clampFocus();
  renderGrid();
  saveToLocalStorage();
}

function bindToolbarEvents() {
  document.getElementById('export-btn').addEventListener('click', exportSpreadsheet);
  document.getElementById('add-row-btn').addEventListener('click', addRow);
  document.getElementById('remove-row-btn').addEventListener('click', removeRow);
  document.getElementById('add-col-btn').addEventListener('click', addColumn);
  document.getElementById('remove-col-btn').addEventListener('click', removeColumn);
}

function initSpreadsheet() {
  loadFromLocalStorage();
  renderGrid();
  bindToolbarEvents();
}

document.addEventListener('DOMContentLoaded', initSpreadsheet);
