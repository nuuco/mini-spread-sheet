const CONFIG = {
  defaultRows: 5,
  defaultCols: 5,
};

const STORAGE_KEY = 'mini-spreadsheet-data';
const SAVE_DEBOUNCE_MS = 300;
const DEFAULT_SHEET_TITLE_LABEL = '제목없음';

let sheetTitleEditSnapshot = '';

let spreadsheet = {
  rows: CONFIG.defaultRows,
  cols: CONFIG.defaultCols,
  data: [],
  title: '',
  anchor: { row: 0, col: 0 },
  focus: { row: 0, col: 0 },
  selectionKind: 'range',
  mode: 'select',
};

let saveTimer = null;
let editUndoRecorded = false;

const MAX_UNDO_STACK = 100;

const history = {
  undoStack: [],
  redoStack: [],
};

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

  if (selectionKind === 'sheet') {
    return {
      rowMin: 0,
      rowMax: spreadsheet.rows - 1,
      colMin: 0,
      colMax: spreadsheet.cols - 1,
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

  if (spreadsheet.selectionKind === 'sheet') {
    return { row: 0, col: 0 };
  }

  if (spreadsheet.selectionKind === 'row') {
    return { row: bounds.rowMin, col: 0 };
  }

  if (spreadsheet.selectionKind === 'column') {
    return { row: 0, col: bounds.colMin };
  }

  return { row: spreadsheet.focus.row, col: spreadsheet.focus.col };
}

const EDITING_INPUT_MIN_WIDTH = 280;
const EDITING_INPUT_MAX_WIDTH = 520;

function resetEditingInputLayout(input) {
  input.style.position = '';
  input.style.left = '';
  input.style.top = '';
  input.style.width = '';
  input.style.minWidth = '';
  input.style.minHeight = '';
  input.style.maxHeight = '';
  input.style.zIndex = '';
}

function layoutEditingInput(input, cell) {
  const cellRect = cell.getBoundingClientRect();
  const spaceToRight = window.innerWidth - cellRect.left - 24;
  const desiredWidth = Math.max(cellRect.width + 160, EDITING_INPUT_MIN_WIDTH);
  const width = Math.min(desiredWidth, EDITING_INPUT_MAX_WIDTH, spaceToRight);

  input.style.position = 'fixed';
  input.style.left = `${cellRect.left}px`;
  input.style.top = `${cellRect.top}px`;
  input.style.width = `${Math.max(width, cellRect.width)}px`;
  input.style.minHeight = `${cellRect.height}px`;
  input.style.zIndex = '200';
  input.style.maxHeight = input.classList.contains('multiline') ? '160px' : `${cellRect.height}px`;
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
      updateCellInputLayout(input);
      if (editing) {
        layoutEditingInput(input, cell);
      } else {
        resetEditingInputLayout(input);
      }
    }
  });
}

function selectEntireSheet() {
  spreadsheet.mode = 'select';
  spreadsheet.selectionKind = 'sheet';
  spreadsheet.anchor = { row: 0, col: 0 };
  spreadsheet.focus = {
    row: spreadsheet.rows - 1,
    col: spreadsheet.cols - 1,
  };
  blurActiveCellInput();
  updateSelectionUI();
}

function bindCornerHeaderEvents(cornerHeader) {
  cornerHeader.addEventListener('mousedown', (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    selectEntireSheet();
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

  editUndoRecorded = false;
  spreadsheet.mode = 'edit';
  spreadsheet.anchor = { row, col };
  spreadsheet.focus = { row, col };
  spreadsheet.selectionKind = 'range';
  updateSelectionUI();

  const input = getCellInput(row, col);
  const cell = input?.closest('.cell');
  input?.focus();
  input?.select();
  if (input && cell) {
    layoutEditingInput(input, cell);
  }
}

function startTypingInActiveCell(char) {
  const { row, col } = getActiveCell();

  pushUndoSnapshot();
  editUndoRecorded = true;

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
  if (input) {
    const cell = input.closest('.cell');
    if (cell) {
      layoutEditingInput(input, cell);
    }
  }
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

function isCopyShortcut(event) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c' && !event.shiftKey;
}

function isPasteShortcut(event) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v' && !event.shiftKey;
}

function isUndoShortcut(event) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey;
}

function isRedoShortcut(event) {
  if (!(event.metaKey || event.ctrlKey)) {
    return false;
  }

  const key = event.key.toLowerCase();
  return (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey);
}

function cloneSpreadsheetSnapshot() {
  return {
    rows: spreadsheet.rows,
    cols: spreadsheet.cols,
    data: spreadsheet.data.map((row) => [...row]),
  };
}

function snapshotsEqual(a, b) {
  if (a.rows !== b.rows || a.cols !== b.cols) {
    return false;
  }

  return a.data.every((row, rowIndex) =>
    row.every((cell, colIndex) => cell === b.data[rowIndex][colIndex]),
  );
}

function pushUndoSnapshot() {
  const snapshot = cloneSpreadsheetSnapshot();
  const top = history.undoStack[history.undoStack.length - 1];

  if (top && snapshotsEqual(top, snapshot)) {
    return;
  }

  history.undoStack.push(snapshot);
  if (history.undoStack.length > MAX_UNDO_STACK) {
    history.undoStack.shift();
  }

  history.redoStack = [];
}

function applySpreadsheetSnapshot(snapshot) {
  spreadsheet.rows = snapshot.rows;
  spreadsheet.cols = snapshot.cols;
  spreadsheet.data = snapshot.data.map((row) => [...row]);
  spreadsheet.mode = 'select';
  editUndoRecorded = false;
  clampSelection();
  renderGrid();
  saveToLocalStorage();
}

function syncActiveCellFromInput() {
  if (spreadsheet.mode !== 'edit') {
    return;
  }

  const { row, col } = getActiveCell();
  const input = getCellInput(row, col);
  if (input) {
    spreadsheet.data[row][col] = input.value;
  }
}

function ensureEditUndoSnapshot() {
  if (editUndoRecorded) {
    return;
  }

  pushUndoSnapshot();
  editUndoRecorded = true;
}

function undoSpreadsheet() {
  if (!history.undoStack.length) {
    return false;
  }

  syncActiveCellFromInput();
  blurActiveCellInput();
  history.redoStack.push(cloneSpreadsheetSnapshot());
  applySpreadsheetSnapshot(history.undoStack.pop());
  return true;
}

function redoSpreadsheet() {
  if (!history.redoStack.length) {
    return false;
  }

  syncActiveCellFromInput();
  blurActiveCellInput();
  history.undoStack.push(cloneSpreadsheetSnapshot());
  applySpreadsheetSnapshot(history.redoStack.pop());
  return true;
}

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

function parseHtmlClipboardTable(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) {
    return [];
  }

  return [...table.querySelectorAll('tr')]
    .map((row) =>
      [...row.querySelectorAll('th, td')].map((cell) => cell.textContent.replace(/\u00a0/g, ' ').trim()),
    )
    .filter((row) => row.length > 0);
}

function parseClipboardTable(text) {
  const normalized = normalizeClipboardText(text);
  if (!normalized.trim()) {
    return [];
  }

  if (looksLikeMarkdownTable(normalized)) {
    return trimTableRows(parseMarkdownClipboardTable(normalized));
  }

  return trimTableRows(parseDelimitedClipboardTable(normalized));
}

function buildTsvContent(rows) {
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

function getSelectionDataForCopy() {
  const bounds = getSelectionBounds();
  const rows = [];

  for (let row = bounds.rowMin; row <= bounds.rowMax; row += 1) {
    const rowValues = [];
    for (let col = bounds.colMin; col <= bounds.colMax; col += 1) {
      rowValues.push(spreadsheet.data[row][col] ?? '');
    }
    rows.push(rowValues);
  }

  return rows;
}

function ensureGridSize(requiredRows, requiredCols) {
  if (requiredCols > spreadsheet.cols) {
    const colsToAdd = requiredCols - spreadsheet.cols;
    spreadsheet.data.forEach((row) => {
      for (let i = 0; i < colsToAdd; i += 1) {
        row.push('');
      }
    });
    spreadsheet.cols = requiredCols;
  }

  if (requiredRows > spreadsheet.rows) {
    for (let row = spreadsheet.rows; row < requiredRows; row += 1) {
      spreadsheet.data.push(Array(spreadsheet.cols).fill(''));
    }
    spreadsheet.rows = requiredRows;
  }
}

function pasteTableAt(startRow, startCol, table) {
  if (!table.length) {
    return;
  }

  pushUndoSnapshot();

  const pasteRows = table.length;
  const pasteCols = Math.max(...table.map((row) => row.length), 0);
  const endRow = startRow + pasteRows - 1;
  const endCol = startCol + pasteCols - 1;

  ensureGridSize(endRow + 1, endCol + 1);
  blurActiveCellInput();
  spreadsheet.mode = 'select';

  for (let row = 0; row < pasteRows; row += 1) {
    for (let col = 0; col < pasteCols; col += 1) {
      spreadsheet.data[startRow + row][startCol + col] = table[row][col] ?? '';
    }
  }

  spreadsheet.anchor = { row: startRow, col: startCol };
  spreadsheet.focus = { row: endRow, col: endCol };
  spreadsheet.selectionKind = 'range';
  renderGrid();
  saveToLocalStorage();
}

async function copySelectionToClipboard() {
  const tsv = buildTsvContent(getSelectionDataForCopy());
  await navigator.clipboard.writeText(tsv);
}

async function pasteFromClipboard() {
  const { row, col } = getActiveCell();

  try {
    const clipboardItems = await navigator.clipboard.read();
    for (const item of clipboardItems) {
      if (!item.types.includes('text/html')) {
        continue;
      }

      const blob = await item.getType('text/html');
      const htmlTable = parseHtmlClipboardTable(await blob.text());
      if (htmlTable.length) {
        pasteTableAt(row, col, htmlTable);
        return;
      }
    }
  } catch {
    // HTML clipboard를 읽지 못하면 plain text로 시도
  }

  try {
    const text = await navigator.clipboard.readText();
    const table = parseClipboardTable(text);
    if (table.length) {
      pasteTableAt(row, col, table);
    }
  } catch {
    // clipboard 접근 실패
  }
}

function getArrowDelta(key) {
  if (key === 'ArrowUp') {
    return { row: -1, col: 0 };
  }
  if (key === 'ArrowDown') {
    return { row: 1, col: 0 };
  }
  if (key === 'ArrowLeft') {
    return { row: 0, col: -1 };
  }
  if (key === 'ArrowRight') {
    return { row: 0, col: 1 };
  }
  return null;
}

function moveActiveCellBy(deltaRow, deltaCol, extend = false) {
  const activeCell = getActiveCell();
  const nextRow = Math.max(0, Math.min(activeCell.row + deltaRow, spreadsheet.rows - 1));
  const nextCol = Math.max(0, Math.min(activeCell.col + deltaCol, spreadsheet.cols - 1));

  spreadsheet.mode = 'select';
  blurActiveCellInput();

  if (extend) {
    spreadsheet.focus = { row: nextRow, col: nextCol };
    spreadsheet.selectionKind = 'range';
  } else {
    spreadsheet.anchor = { row: nextRow, col: nextCol };
    spreadsheet.focus = { row: nextRow, col: nextCol };
    spreadsheet.selectionKind = 'range';
  }

  updateSelectionUI();
}

function clearSelectedCellContent() {
  pushUndoSnapshot();
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
    } else if (selectionKind === 'sheet') {
      active = true;
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
    } else if (selectionKind === 'sheet') {
      active = true;
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
  ensureEditUndoSnapshot();
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

const SHEET_TITLE_MAX_LENGTH = 80;

function getSheetTitleField() {
  return document.getElementById('sheet-title-field');
}

function readSheetTitleFromField(field) {
  return field.textContent.replace(/\r?\n/g, '').trim();
}

/** contenteditable 전체 삭제 시 브라우저가 남기는 <br> 등을 제거해 높이·placeholder 깨짐 방지 */
function clearSheetTitleFieldIfEmpty(field) {
  if (readSheetTitleFromField(field)) {
    return false;
  }

  if (field.childNodes.length === 0) {
    return true;
  }

  field.textContent = '';
  placeCaretAtEnd(field);
  return true;
}

function placeCaretAtEnd(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function selectAllSheetTitleField(field) {
  const range = document.createRange();
  range.selectNodeContents(field);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function enforceSheetTitleFieldLength(field) {
  clearSheetTitleFieldIfEmpty(field);

  const text = field.textContent.replace(/\r?\n/g, '');
  if (!text) {
    return '';
  }

  if (text.length <= SHEET_TITLE_MAX_LENGTH) {
    return text;
  }

  field.textContent = text.slice(0, SHEET_TITLE_MAX_LENGTH);
  placeCaretAtEnd(field);
  return field.textContent;
}

function updateSheetTitleDisplay() {
  const field = getSheetTitleField();
  const wrap = document.getElementById('sheet-title-wrap');
  if (!field || !wrap || wrap.classList.contains('is-editing')) {
    return;
  }

  field.textContent = spreadsheet.title ?? '';
  wrap.classList.toggle('is-empty', !String(spreadsheet.title ?? '').trim());
}

function syncSpreadsheetTitleFromField() {
  const wrap = document.getElementById('sheet-title-wrap');
  const field = getSheetTitleField();
  if (!wrap?.classList.contains('is-editing') || !field) {
    return;
  }

  spreadsheet.title = enforceSheetTitleFieldLength(field);
}

function applySpreadsheetTitleToField() {
  const field = getSheetTitleField();
  if (field) {
    field.textContent = spreadsheet.title ?? '';
  }

  updateSheetTitleDisplay();
}

function startSheetTitleEdit() {
  const wrap = document.getElementById('sheet-title-wrap');
  const field = getSheetTitleField();
  if (!wrap || !field || wrap.classList.contains('is-editing')) {
    return;
  }

  sheetTitleEditSnapshot = spreadsheet.title ?? '';
  field.textContent = spreadsheet.title ?? '';
  field.contentEditable = 'plaintext-only';
  wrap.classList.add('is-editing');
  wrap.classList.toggle('is-empty', !field.textContent.trim());
  field.focus();

  if (field.textContent.length) {
    selectAllSheetTitleField(field);
  } else {
    placeCaretAtEnd(field);
  }
}

function finishSheetTitleEdit(revert = false) {
  const wrap = document.getElementById('sheet-title-wrap');
  const field = getSheetTitleField();
  if (!wrap || !field || !wrap.classList.contains('is-editing')) {
    return;
  }

  if (revert) {
    spreadsheet.title = sheetTitleEditSnapshot;
  } else {
    spreadsheet.title = readSheetTitleFromField(field).slice(0, SHEET_TITLE_MAX_LENGTH);
  }

  field.contentEditable = 'false';
  field.textContent = spreadsheet.title ?? '';
  wrap.classList.remove('is-editing');
  updateSheetTitleDisplay();
  saveToLocalStorage();
}

function saveToLocalStorage() {
  syncSpreadsheetTitleFromField();

  const payload = {
    rows: spreadsheet.rows,
    cols: spreadsheet.cols,
    data: spreadsheet.data,
    title: spreadsheet.title,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadFromLocalStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    spreadsheet.rows = CONFIG.defaultRows;
    spreadsheet.cols = CONFIG.defaultCols;
    spreadsheet.data = createEmptyData(spreadsheet.rows, spreadsheet.cols);
    spreadsheet.title = '';
    return;
  }

  try {
    const saved = JSON.parse(raw);
    spreadsheet.rows = saved.rows ?? CONFIG.defaultRows;
    spreadsheet.cols = saved.cols ?? CONFIG.defaultCols;
    spreadsheet.data = saved.data ?? createEmptyData(spreadsheet.rows, spreadsheet.cols);
    spreadsheet.title = saved.title ?? '';
  } catch {
    spreadsheet.rows = CONFIG.defaultRows;
    spreadsheet.cols = CONFIG.defaultCols;
    spreadsheet.data = createEmptyData(spreadsheet.rows, spreadsheet.cols);
    spreadsheet.title = '';
  }
}

function updateCellInputLayout(input) {
  input.classList.toggle('multiline', input.value.includes('\n'));
}

function insertNewlineAtCursor(field) {
  const start = field.selectionStart;
  const end = field.selectionEnd;
  field.value = `${field.value.slice(0, start)}\n${field.value.slice(end)}`;
  field.selectionStart = start + 1;
  field.selectionEnd = start + 1;
  updateCellInputLayout(field);
}

function isNewlineShortcut(event) {
  return event.metaKey || event.ctrlKey;
}

function insertTextAtCursor(field, text) {
  const start = field.selectionStart;
  const end = field.selectionEnd;
  field.value = `${field.value.slice(0, start)}${text}${field.value.slice(end)}`;
  const cursor = start + text.length;
  field.selectionStart = cursor;
  field.selectionEnd = cursor;
}

function finishEditAndMoveDown(row, col) {
  const input = getCellInput(row, col);
  if (input) {
    onCellInput(row, col, input.value);
  }

  editUndoRecorded = false;
  spreadsheet.mode = 'select';
  blurActiveCellInput();

  const nextRow = Math.min(row + 1, spreadsheet.rows - 1);
  spreadsheet.anchor = { row: nextRow, col };
  spreadsheet.focus = { row: nextRow, col };
  spreadsheet.selectionKind = 'range';
  updateSelectionUI();
}

function bindCellEvents(input, cell, row, col) {
  input.addEventListener('input', (event) => {
    updateCellInputLayout(event.target);
    onCellInput(row, col, event.target.value);
    if (cell.classList.contains('editing')) {
      layoutEditingInput(event.target, cell);
    }
  });

  input.addEventListener('paste', (event) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData('text/plain').replace(/\r?\n/g, ' ');
    insertTextAtCursor(event.target, pastedText);
    updateCellInputLayout(event.target);
    onCellInput(row, col, event.target.value);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      return;
    }

    if (isNewlineShortcut(event)) {
      event.preventDefault();
      insertNewlineAtCursor(event.target);
      onCellInput(row, col, event.target.value);
      return;
    }

    event.preventDefault();
    finishEditAndMoveDown(row, col);
  });
  input.addEventListener('blur', () => {
    if (
      spreadsheet.mode === 'edit' &&
      spreadsheet.focus.row === row &&
      spreadsheet.focus.col === col
    ) {
      editUndoRecorded = false;
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

    if (!isRowInCurrentRowSelection(row)) {
      beginDragSelection('row', row, 0, event.shiftKey);
      endDragSelection();
    }

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

    if (!isColInCurrentColumnSelection(col)) {
      beginDragSelection('column', 0, col, event.shiftKey);
      endDragSelection();
    }

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
  bindCornerHeaderEvents(cornerCell);
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

      const input = document.createElement('textarea');
      input.className = 'cell-input';
      input.rows = 1;
      input.value = spreadsheet.data[row][col] ?? '';
      input.setAttribute('aria-label', formatCellAddress(row, col));
      updateCellInputLayout(input);

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

function sanitizeExportFileName(title) {
  return sanitizeTitleForExport(title, { maxLength: 80, fallback: 'spreadsheet' });
}

function sanitizeWorksheetName(title) {
  return sanitizeTitleForExport(title, { maxLength: 31, fallback: 'Sheet1' });
}

function exportSpreadsheet() {
  if (typeof XLSX === 'undefined') {
    window.alert('Excel보내기 라이브러리를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.');
    return;
  }

  finishSheetTitleEdit();
  const title = spreadsheet.title.trim();
  const data = collectSpreadsheetData();
  const sheetName = sanitizeWorksheetName(title);
  const filename = `${sanitizeExportFileName(title)}.xlsx`;
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

function insertRowAt(index) {
  insertRowsAt(index, 1);
}

function insertRowsAt(index, count) {
  pushUndoSnapshot();
  const newRows = Array.from({ length: count }, () => Array(spreadsheet.cols).fill(''));
  spreadsheet.data.splice(index, 0, ...newRows);
  spreadsheet.rows += count;
  clampSelection();
  renderGrid();
  saveToLocalStorage();
}

function insertRowsAboveSelection() {
  const bounds = getSelectionBounds();
  const count =
    spreadsheet.selectionKind === 'row' ? bounds.rowMax - bounds.rowMin + 1 : 1;
  const index =
    spreadsheet.selectionKind === 'row' ? bounds.rowMin : (contextMenuState.index ?? 0);

  insertRowsAt(index, count);
}

function insertRowsBelowSelection() {
  const bounds = getSelectionBounds();
  const count =
    spreadsheet.selectionKind === 'row' ? bounds.rowMax - bounds.rowMin + 1 : 1;
  const index =
    spreadsheet.selectionKind === 'row'
      ? bounds.rowMax + 1
      : (contextMenuState.index ?? 0) + 1;

  insertRowsAt(index, count);
}

function deleteRowAt(index) {
  if (spreadsheet.rows <= 1) {
    return;
  }

  pushUndoSnapshot();
  spreadsheet.data.splice(index, 1);
  spreadsheet.rows -= 1;
  clampSelection();
  renderGrid();
  saveToLocalStorage();
}

function deleteSelectedRows() {
  if (spreadsheet.selectionKind !== 'row') {
    deleteRowAt(contextMenuState.index ?? spreadsheet.focus.row);
    return;
  }

  pushUndoSnapshot();
  const bounds = getSelectionBounds();
  const deleteCount = bounds.rowMax - bounds.rowMin + 1;

  if (deleteCount >= spreadsheet.rows) {
    spreadsheet.data = [Array(spreadsheet.cols).fill('')];
    spreadsheet.rows = 1;
  } else {
    spreadsheet.data.splice(bounds.rowMin, deleteCount);
    spreadsheet.rows -= deleteCount;
  }

  spreadsheet.anchor = { row: 0, col: 0 };
  spreadsheet.focus = { row: 0, col: 0 };
  spreadsheet.selectionKind = 'range';
  clampSelection();
  renderGrid();
  saveToLocalStorage();
}

function insertColumnAt(index) {
  insertColumnsAt(index, 1);
}

function insertColumnsAt(index, count) {
  pushUndoSnapshot();
  spreadsheet.data.forEach((row) => {
    row.splice(index, 0, ...Array(count).fill(''));
  });
  spreadsheet.cols += count;
  clampSelection();
  renderGrid();
  saveToLocalStorage();
}

function insertColumnsLeftSelection() {
  const bounds = getSelectionBounds();
  const count =
    spreadsheet.selectionKind === 'column' ? bounds.colMax - bounds.colMin + 1 : 1;
  const index =
    spreadsheet.selectionKind === 'column' ? bounds.colMin : (contextMenuState.index ?? 0);

  insertColumnsAt(index, count);
}

function insertColumnsRightSelection() {
  const bounds = getSelectionBounds();
  const count =
    spreadsheet.selectionKind === 'column' ? bounds.colMax - bounds.colMin + 1 : 1;
  const index =
    spreadsheet.selectionKind === 'column'
      ? bounds.colMax + 1
      : (contextMenuState.index ?? 0) + 1;

  insertColumnsAt(index, count);
}

function deleteColumnAt(index) {
  if (spreadsheet.cols <= 1) {
    return;
  }

  pushUndoSnapshot();
  spreadsheet.data.forEach((row) => row.splice(index, 1));
  spreadsheet.cols -= 1;
  clampSelection();
  renderGrid();
  saveToLocalStorage();
}

function deleteSelectedColumns() {
  if (spreadsheet.selectionKind !== 'column') {
    deleteColumnAt(contextMenuState.index ?? spreadsheet.focus.col);
    return;
  }

  pushUndoSnapshot();
  const bounds = getSelectionBounds();
  const deleteCount = bounds.colMax - bounds.colMin + 1;

  if (deleteCount >= spreadsheet.cols) {
    spreadsheet.data.forEach((row) => {
      row.length = 0;
      row.push('');
    });
    spreadsheet.cols = 1;
  } else {
    spreadsheet.data.forEach((row) => row.splice(bounds.colMin, deleteCount));
    spreadsheet.cols -= deleteCount;
  }

  spreadsheet.anchor = { row: 0, col: 0 };
  spreadsheet.focus = { row: 0, col: 0 };
  spreadsheet.selectionKind = 'range';
  clampSelection();
  renderGrid();
  saveToLocalStorage();
}

function getRowContextMenuItems() {
  const bounds = getSelectionBounds();
  const count =
    spreadsheet.selectionKind === 'row' ? bounds.rowMax - bounds.rowMin + 1 : 1;
  const countLabel = count > 1 ? ` ${count}개` : '';

  return [
    { action: 'row-below', label: `아래에 행${countLabel} 추가` },
    { action: 'row-above', label: `위에 행${countLabel} 추가` },
    {
      action: 'row-delete',
      label: count > 1 ? `행 삭제 (${count}개)` : '행 삭제',
      danger: true,
    },
  ];
}

function getColContextMenuItems() {
  const bounds = getSelectionBounds();
  const count =
    spreadsheet.selectionKind === 'column' ? bounds.colMax - bounds.colMin + 1 : 1;
  const countLabel = count > 1 ? ` ${count}개` : '';

  return [
    { action: 'col-left', label: `왼쪽에 열${countLabel} 추가` },
    { action: 'col-right', label: `오른쪽에 열${countLabel} 추가` },
    {
      action: 'col-delete',
      label: count > 1 ? `열 삭제 (${count}개)` : '열 삭제',
      danger: true,
    },
  ];
}

function isRowInCurrentRowSelection(row) {
  if (spreadsheet.selectionKind !== 'row') {
    return false;
  }

  const bounds = getSelectionBounds();
  return row >= bounds.rowMin && row <= bounds.rowMax;
}

function isColInCurrentColumnSelection(col) {
  if (spreadsheet.selectionKind !== 'column') {
    return false;
  }

  const bounds = getSelectionBounds();
  return col >= bounds.colMin && col <= bounds.colMax;
}

function hideContextMenu() {
  const menu = document.getElementById('context-menu');
  menu.classList.add('hidden');
  menu.style.visibility = '';
  contextMenuState.type = null;
  contextMenuState.index = null;
}

function positionContextMenu(menu, x, y, type, index) {
  menu.classList.remove('hidden');
  menu.style.visibility = 'hidden';
  menu.style.left = '0';
  menu.style.top = '0';

  const menuWidth = menu.offsetWidth;
  const menuHeight = menu.offsetHeight;
  const padding = 8;

  let left = x;
  let top = y;

  if (type === 'column' && index === spreadsheet.cols - 1) {
    left = x - menuWidth;
  }

  if (type === 'row' && index === spreadsheet.rows - 1) {
    top = y - menuHeight;
  }

  left = Math.max(padding, Math.min(left, window.innerWidth - menuWidth - padding));
  top = Math.max(padding, Math.min(top, window.innerHeight - menuHeight - padding));

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = '';
}

function showContextMenu(type, index, x, y) {
  const menu = document.getElementById('context-menu');
  const items = type === 'row' ? getRowContextMenuItems() : getColContextMenuItems();

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

  positionContextMenu(menu, x, y, type, index);
}

function handleContextMenuAction(action) {
  const { type } = contextMenuState;
  hideContextMenu();

  if (type === 'row') {
    if (action === 'row-below') {
      insertRowsBelowSelection();
    } else if (action === 'row-above') {
      insertRowsAboveSelection();
    } else if (action === 'row-delete') {
      deleteSelectedRows();
    }
    return;
  }

  if (type === 'column') {
    if (action === 'col-right') {
      insertColumnsRightSelection();
    } else if (action === 'col-left') {
      insertColumnsLeftSelection();
    } else if (action === 'col-delete') {
      deleteSelectedColumns();
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

    if (isUndoShortcut(event)) {
      event.preventDefault();
      undoSpreadsheet();
      return;
    }

    if (isRedoShortcut(event)) {
      event.preventDefault();
      redoSpreadsheet();
      return;
    }

    if (spreadsheet.mode === 'edit') {
      return;
    }

    if (isCopyShortcut(event)) {
      event.preventDefault();
      void copySelectionToClipboard();
      return;
    }

    if (isPasteShortcut(event)) {
      event.preventDefault();
      void pasteFromClipboard();
      return;
    }

    const arrowDelta = getArrowDelta(event.key);
    if (arrowDelta) {
      event.preventDefault();
      moveActiveCellBy(arrowDelta.row, arrowDelta.col, event.shiftKey);
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

  const titleField = getSheetTitleField();
  const titleWrap = document.getElementById('sheet-title-wrap');
  if (!titleField || !titleWrap) {
    return;
  }

  titleField.addEventListener('click', () => {
    if (!titleWrap.classList.contains('is-editing')) {
      startSheetTitleEdit();
    }
  });

  titleField.addEventListener('input', () => {
    spreadsheet.title = enforceSheetTitleFieldLength(titleField);
    titleWrap.classList.toggle('is-empty', !readSheetTitleFromField(titleField));
    scheduleSaveToLocalStorage();
  });

  titleField.addEventListener('paste', (event) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData('text/plain')
      .replace(/\r?\n/g, ' ')
      .slice(0, SHEET_TITLE_MAX_LENGTH);
    document.execCommand('insertText', false, pasted);
  });

  titleField.addEventListener('blur', () => {
    finishSheetTitleEdit();
  });

  titleField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      titleField.blur();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      finishSheetTitleEdit(true);
    }
  });
}

function initSpreadsheet() {
  loadFromLocalStorage();
  applySpreadsheetTitleToField();
  renderGrid();
  bindToolbarEvents();
  bindKeyboardEvents();
  bindDragSelectionEvents();
  bindContextMenuEvents();
}

document.addEventListener('DOMContentLoaded', initSpreadsheet);
