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
  anchor: { row: 0, col: 0 },
  focus: { row: 0, col: 0 },
  selectionKind: 'range',
  mode: 'select',
};

let saveTimer = null;

const dragSelection = {
  active: false,
  moved: false,
  kind: null,
  pointerDownOn: { row: 0, col: 0 },
  wasActiveBeforeDown: false,
};

const contextMenuState = {
  type: null,
  index: null,
};

const ROW_CONTEXT_MENU = [
  { action: 'row-below', label: '아래에 행 추가' },
  { action: 'row-above', label: '위에 행 추가' },
  { action: 'row-delete', label: '행 삭제', danger: true },
];

const COL_CONTEXT_MENU = [
  { action: 'col-below', label: '아래에 열 추가' },
  { action: 'col-above', label: '위에 열 추가' },
  { action: 'col-delete', label: '열 삭제', danger: true },
];

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

function clampSelection() {
  const clamp = (point) => ({
    row: Math.max(0, Math.min(point.row, spreadsheet.rows - 1)),
    col: Math.max(0, Math.min(point.col, spreadsheet.cols - 1)),
  });

  spreadsheet.anchor = clamp(spreadsheet.anchor);
  spreadsheet.focus = clamp(spreadsheet.focus);
}

function getSelectionBounds() {
  const { anchor, focus, selectionKind } = spreadsheet;

  if (selectionKind === 'row') {
    return {
      rowMin: Math.min(anchor.row, focus.row),
      rowMax: Math.max(anchor.row, focus.row),
      colMin: 0,
      colMax: spreadsheet.cols - 1,
    };
  }

  if (selectionKind === 'column') {
    return {
      rowMin: 0,
      rowMax: spreadsheet.rows - 1,
      colMin: Math.min(anchor.col, focus.col),
      colMax: Math.max(anchor.col, focus.col),
    };
  }

  return {
    rowMin: Math.min(anchor.row, focus.row),
    rowMax: Math.max(anchor.row, focus.row),
    colMin: Math.min(anchor.col, focus.col),
    colMax: Math.max(anchor.col, focus.col),
  };
}

function isCellInSelection(row, col) {
  const bounds = getSelectionBounds();
  return (
    row >= bounds.rowMin &&
    row <= bounds.rowMax &&
    col >= bounds.colMin &&
    col <= bounds.colMax
  );
}

function isSingleCellSelection() {
  const bounds = getSelectionBounds();
  return bounds.rowMin === bounds.rowMax && bounds.colMin === bounds.colMax;
}

function getActiveCell() {
  const bounds = getSelectionBounds();

  if (spreadsheet.selectionKind === 'row') {
    return { row: bounds.rowMin, col: 0 };
  }

  if (spreadsheet.selectionKind === 'column') {
    return { row: 0, col: bounds.colMin };
  }

  return { row: spreadsheet.focus.row, col: spreadsheet.focus.col };
}

function getCellInput(row, col) {
  return document.querySelector(
    `.cell[data-row="${row}"][data-col="${col}"] .cell-input`,
  );
}

function updateSelectionUI() {
  updateCoordinateDisplay();
  updateHeaderHighlights();
  updateCellSelection();
  syncInputEditState();
  updateGridSizeLabel();
}

function updateGridSizeLabel() {
  const label = document.getElementById('grid-size-label');
  if (label) {
    label.textContent = `${spreadsheet.rows}행 × ${spreadsheet.cols}열`;
  }
}

function syncInputEditState() {
  const { row, col } = getActiveCell();
  const isEditing = spreadsheet.mode === 'edit' && isSingleCellSelection();

  document.querySelectorAll('.cell').forEach((cell) => {
    const cellRow = Number(cell.dataset.row);
    const cellCol = Number(cell.dataset.col);
    const editing =
      isEditing && cellRow === row && cellCol === col && isCellInSelection(cellRow, cellCol);

    cell.classList.toggle('editing', editing);
    const input = cell.querySelector('.cell-input');
    if (input) {
      input.readOnly = !editing;
    }
  });
}

function beginDragSelection(kind, row, col, extend = false) {
  if (kind === 'cell') {
    const activeCell = getActiveCell();
    dragSelection.wasActiveBeforeDown =
      spreadsheet.mode === 'select' &&
      isSingleCellSelection() &&
      spreadsheet.selectionKind === 'range' &&
      activeCell.row === row &&
      activeCell.col === col &&
      spreadsheet.anchor.row === row &&
      spreadsheet.anchor.col === col;
  } else {
    dragSelection.wasActiveBeforeDown = false;
  }

  spreadsheet.mode = 'select';
  blurActiveCellInput();

  if (kind === 'cell') {
    if (extend) {
      spreadsheet.focus = { row, col };
      spreadsheet.selectionKind = 'range';
    } else {
      spreadsheet.anchor = { row, col };
      spreadsheet.focus = { row, col };
      spreadsheet.selectionKind = 'range';
    }
  } else if (kind === 'row') {
    if (extend) {
      spreadsheet.focus = { row, col: 0 };
    } else {
      spreadsheet.anchor = { row, col: 0 };
      spreadsheet.focus = { row, col: 0 };
    }
    spreadsheet.selectionKind = 'row';
  } else if (kind === 'column') {
    if (extend) {
      spreadsheet.focus = { row: 0, col };
    } else {
      spreadsheet.anchor = { row: 0, col };
      spreadsheet.focus = { row: 0, col };
    }
    spreadsheet.selectionKind = 'column';
  }

  dragSelection.active = true;
  dragSelection.moved = false;
  dragSelection.kind = kind;
  dragSelection.pointerDownOn = { row, col };
  document.body.classList.add('is-dragging');
  updateSelectionUI();
}

function updateDragSelection(row, col) {
  if (!dragSelection.active) {
    return;
  }

  const nextRow = Math.max(0, Math.min(row, spreadsheet.rows - 1));
  const nextCol = Math.max(0, Math.min(col, spreadsheet.cols - 1));

  if (dragSelection.kind === 'cell') {
    if (spreadsheet.focus.row === nextRow && spreadsheet.focus.col === nextCol) {
      return;
    }
    dragSelection.moved = true;
    spreadsheet.focus = { row: nextRow, col: nextCol };
    spreadsheet.selectionKind = 'range';
  } else if (dragSelection.kind === 'row') {
    if (spreadsheet.focus.row === nextRow) {
      return;
    }
    dragSelection.moved = true;
    spreadsheet.focus = { row: nextRow, col: 0 };
    spreadsheet.selectionKind = 'row';
  } else if (dragSelection.kind === 'column') {
    if (spreadsheet.focus.col === nextCol) {
      return;
    }
    dragSelection.moved = true;
    spreadsheet.focus = { row: 0, col: nextCol };
    spreadsheet.selectionKind = 'column';
  }

  updateSelectionUI();
}

function endDragSelection() {
  if (!dragSelection.active) {
    return;
  }

  const { moved, kind, wasActiveBeforeDown, pointerDownOn } = dragSelection;

  if (!moved && kind === 'cell' && wasActiveBeforeDown) {
    enterEditMode(pointerDownOn.row, pointerDownOn.col);
  }

  dragSelection.active = false;
  dragSelection.moved = false;
  dragSelection.kind = null;
  document.body.classList.remove('is-dragging');
}

function handleDocumentMouseMove(event) {
  if (!dragSelection.active) {
    return;
  }

  const target = document.elementFromPoint(event.clientX, event.clientY);
  if (!target) {
    return;
  }

  const cell = target.closest('.cell');
  const rowHeader = target.closest('.row-header');
  const colHeader = target.closest('.col-header');

  if (dragSelection.kind === 'cell' && cell) {
    updateDragSelection(Number(cell.dataset.row), Number(cell.dataset.col));
  } else if (dragSelection.kind === 'row' && rowHeader) {
    updateDragSelection(Number(rowHeader.dataset.row), 0);
  } else if (dragSelection.kind === 'column' && colHeader) {
    updateDragSelection(0, Number(colHeader.dataset.col));
  }
}

function bindDragSelectionEvents() {
  document.addEventListener('mousemove', handleDocumentMouseMove);
  document.addEventListener('mouseup', endDragSelection);
}

function blurActiveCellInput() {
  if (document.activeElement?.classList.contains('cell-input')) {
    document.activeElement.blur();
  }
}

function enterEditMode(row, col) {
  if (!isCellInSelection(row, col) || !isSingleCellSelection()) {
    return;
  }

  spreadsheet.mode = 'edit';
  spreadsheet.anchor = { row, col };
  spreadsheet.focus = { row, col };
  spreadsheet.selectionKind = 'range';
  updateSelectionUI();

  const input = getCellInput(row, col);
  input?.focus();
  input?.select();
}

function startTypingInActiveCell(char) {
  const { row, col } = getActiveCell();

  spreadsheet.anchor = { row, col };
  spreadsheet.focus = { row, col };
  spreadsheet.selectionKind = 'range';
  spreadsheet.data[row][col] = char;

  const input = getCellInput(row, col);
  if (input) {
    input.value = char;
  }

  spreadsheet.mode = 'edit';
  updateSelectionUI();
  input?.focus();
  input?.setSelectionRange(char.length, char.length);
  scheduleSaveToLocalStorage();
}

function isTypingKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  return event.key.length === 1;
}

function isGridKeyboardTarget(event) {
  return !event.target.closest('.controls') && !event.target.closest('.toolbar');
}

function clearSelectedCellContent() {
  const bounds = getSelectionBounds();

  for (let row = bounds.rowMin; row <= bounds.rowMax; row += 1) {
    for (let col = bounds.colMin; col <= bounds.colMax; col += 1) {
      spreadsheet.data[row][col] = '';
      const input = getCellInput(row, col);
      if (input) {
        input.value = '';
      }
    }
  }

  saveToLocalStorage();
}

function updateCoordinateDisplay() {
  const coordinateEl = document.getElementById('cell-coordinate');
  const bounds = getSelectionBounds();

  if (bounds.rowMin === bounds.rowMax && bounds.colMin === bounds.colMax) {
    coordinateEl.textContent = `Cell: ${formatCellAddress(bounds.rowMin, bounds.colMin)}`;
    return;
  }

  const start = formatCellAddress(bounds.rowMin, bounds.colMin);
  const end = formatCellAddress(bounds.rowMax, bounds.colMax);
  coordinateEl.textContent = `Selection: ${start}:${end}`;
}

function updateHeaderHighlights() {
  const bounds = getSelectionBounds();
  const { selectionKind } = spreadsheet;
  const singleCell = isSingleCellSelection();
  const activeCell = getActiveCell();

  document.querySelectorAll('.col-header').forEach((header) => {
    const col = Number(header.dataset.col);
    let active = false;

    if (selectionKind === 'column') {
      active = col >= bounds.colMin && col <= bounds.colMax;
    } else if (selectionKind !== 'row' && singleCell) {
      active = col === activeCell.col;
    } else if (selectionKind === 'range' && !singleCell) {
      active = col >= bounds.colMin && col <= bounds.colMax;
    }

    header.classList.toggle('active', active);
  });

  document.querySelectorAll('.row-header').forEach((header) => {
    const row = Number(header.dataset.row);
    let active = false;

    if (selectionKind === 'row') {
      active = row >= bounds.rowMin && row <= bounds.rowMax;
    } else if (selectionKind !== 'column' && singleCell) {
      active = row === activeCell.row;
    } else if (selectionKind === 'range' && !singleCell) {
      active = row >= bounds.rowMin && row <= bounds.rowMax;
    }

    header.classList.toggle('active', active);
  });
}

function updateCellSelection() {
  const { row: focusRow, col: focusCol } = getActiveCell();
  const showRowColGuide =
    isSingleCellSelection() && spreadsheet.selectionKind === 'range';

  document.querySelectorAll('.cell').forEach((cell) => {
    const cellRow = Number(cell.dataset.row);
    const cellCol = Number(cell.dataset.col);
    const inSelection = isCellInSelection(cellRow, cellCol);
    const isActive = inSelection && cellRow === focusRow && cellCol === focusCol;

    cell.classList.toggle('in-selection', inSelection);
    cell.classList.toggle('active-cell', isActive);
    cell.classList.toggle('highlight-row', showRowColGuide && cellRow === focusRow);
    cell.classList.toggle('highlight-col', showRowColGuide && cellCol === focusCol);
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
  input.addEventListener('input', (event) => onCellInput(row, col, event.target.value));
  input.addEventListener('blur', () => {
    if (
      spreadsheet.mode === 'edit' &&
      spreadsheet.focus.row === row &&
      spreadsheet.focus.col === col
    ) {
      spreadsheet.mode = 'select';
      syncInputEditState();
    }
  });

  cell.addEventListener('mousedown', (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    beginDragSelection('cell', row, col, event.shiftKey);
  });
}

function bindRowHeaderEvents(rowHeader, row) {
  rowHeader.addEventListener('mousedown', (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    beginDragSelection('row', row, 0, event.shiftKey);
  });

  rowHeader.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    beginDragSelection('row', row, 0, false);
    endDragSelection();
    showContextMenu('row', row, event.clientX, event.clientY);
  });
}

function bindColHeaderEvents(colHeader, col) {
  colHeader.addEventListener('mousedown', (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    beginDragSelection('column', 0, col, event.shiftKey);
  });

  colHeader.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    beginDragSelection('column', 0, col, false);
    endDragSelection();
    showContextMenu('column', col, event.clientX, event.clientY);
  });
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
    bindColHeaderEvents(colHeader, col);
    headerRow.appendChild(colHeader);
  }

  table.appendChild(headerRow);

  for (let row = 0; row < spreadsheet.rows; row += 1) {
    const tableRow = document.createElement('tr');

    const rowHeader = document.createElement('th');
    rowHeader.className = 'row-header';
    rowHeader.dataset.row = String(row);
    rowHeader.textContent = String(row + 1);
    bindRowHeaderEvents(rowHeader, row);
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
  clampSelection();
  updateSelectionUI();
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

function insertRowAt(index) {
  spreadsheet.data.splice(index, 0, Array(spreadsheet.cols).fill(''));
  spreadsheet.rows += 1;
  clampSelection();
  renderGrid();
  saveToLocalStorage();
}

function deleteRowAt(index) {
  if (spreadsheet.rows <= 1) {
    return;
  }

  spreadsheet.data.splice(index, 1);
  spreadsheet.rows -= 1;
  clampSelection();
  renderGrid();
  saveToLocalStorage();
}

function insertColumnAt(index) {
  spreadsheet.data.forEach((row) => row.splice(index, 0, ''));
  spreadsheet.cols += 1;
  clampSelection();
  renderGrid();
  saveToLocalStorage();
}

function deleteColumnAt(index) {
  if (spreadsheet.cols <= 1) {
    return;
  }

  spreadsheet.data.forEach((row) => row.splice(index, 1));
  spreadsheet.cols -= 1;
  clampSelection();
  renderGrid();
  saveToLocalStorage();
}

function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  menu.classList.add('hidden');
  contextMenuState.type = null;
  contextMenuState.index = null;
}

function showContextMenu(type, index, x, y) {
  const menu = document.getElementById('context-menu');
  const items = type === 'row' ? ROW_CONTEXT_MENU : COL_CONTEXT_MENU;

  menu.replaceChildren(
    ...items.map((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label;
      button.dataset.action = item.action;
      if (item.danger) {
        button.classList.add('danger');
      }
      return button;
    }),
  );

  contextMenuState.type = type;
  contextMenuState.index = index;

  menu.classList.remove('hidden');
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
}

function handleContextMenuAction(action) {
  const { type, index } = contextMenuState;
  hideContextMenu();

  if (type === 'row') {
    if (action === 'row-below') {
      insertRowAt(index + 1);
    } else if (action === 'row-above') {
      insertRowAt(index);
    } else if (action === 'row-delete') {
      deleteRowAt(index);
    }
    return;
  }

  if (type === 'column') {
    if (action === 'col-below') {
      insertColumnAt(index + 1);
    } else if (action === 'col-above') {
      insertColumnAt(index);
    } else if (action === 'col-delete') {
      deleteColumnAt(index);
    }
  }
}

function bindContextMenuEvents() {
  const menu = document.getElementById('context-menu');

  menu.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    handleContextMenuAction(button.dataset.action);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('#context-menu')) {
      hideContextMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideContextMenu();
    }
  });

  window.addEventListener('scroll', hideContextMenu, true);
  window.addEventListener('resize', hideContextMenu);
}

function bindKeyboardEvents() {
  document.addEventListener('keydown', (event) => {
    if (!isGridKeyboardTarget(event)) {
      return;
    }

    if (spreadsheet.mode === 'edit') {
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      clearSelectedCellContent();
      return;
    }

    if (!isTypingKey(event)) {
      return;
    }

    event.preventDefault();
    startTypingInActiveCell(event.key);
  });
}

function bindToolbarEvents() {
  document.getElementById('export-btn').addEventListener('click', exportSpreadsheet);
}

function initSpreadsheet() {
  loadFromLocalStorage();
  renderGrid();
  bindToolbarEvents();
  bindKeyboardEvents();
  bindDragSelectionEvents();
  bindContextMenuEvents();
}

document.addEventListener('DOMContentLoaded', initSpreadsheet);
