import { columnIndexToLabel, formatCellAddress } from '../utils/cellAddress.js';
import {
  isCellInsertBeforeInput,
  isComposingInput,
  isNewlineShortcut,
  shouldRouteToImeInput,
} from '../utils/keyboard.js';
import {
  EDITING_INPUT_EXPAND_PADDING,
  EDITING_INPUT_MAX_HEIGHT,
  EDITING_INPUT_MAX_WIDTH,
} from '../constants.js';

export class GridRenderer {
  constructor(app) {
    this.app = app;
    this.container = document.getElementById('spreadsheet');
    this.table = null;
    this.renderedRows = 0;
    this.renderedCols = 0;
  }

  getTable() {
    if (this.table?.isConnected) {
      return this.table;
    }
    this.table = this.container?.querySelector('.grid-table') ?? null;
    return this.table;
  }

  getCellInput(row, col) {
    return document.querySelector(
      `.cell[data-row="${row}"][data-col="${col}"] .cell-input`,
    );
  }

  static updateCellInputLayout(input) {
    input.classList.toggle('multiline', input.value.includes('\n'));
  }

  static resetEditingInputLayout(input) {
    input.style.position = '';
    input.style.left = '';
    input.style.top = '';
    input.style.width = '';
    input.style.height = '';
    input.style.minWidth = '';
    input.style.minHeight = '';
    input.style.maxHeight = '';
    input.style.visibility = '';
    input.style.zIndex = '';
  }

  /** 긴 텍스트·줄바꿈일 때만 fixed 편집 오버레이 필요 */
  static needsEditingOverlay(input, cell) {
    const value = input.value ?? '';
    if (value.includes('\n')) {
      return true;
    }
    const cellRect = cell.getBoundingClientRect();
    const contentWidth = GridRenderer.longestLineWidth(input, value);
    return contentWidth + EDITING_INPUT_EXPAND_PADDING > cellRect.width;
  }

  static collapseInputSelection(input) {
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }

  static isInputComposing(input, event) {
    return input.dataset.imeComposing === 'true' || event?.isComposing === true;
  }

  static measureTextWidth(input, text) {
    const style = window.getComputedStyle(input);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      return text.length * 8;
    }
    context.font = `${style.fontStyle} ${style.fontVariant} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return context.measureText(text).width;
  }

  static longestLineWidth(input, value) {
    if (!value) {
      return 0;
    }
    return value
      .split('\n')
      .reduce((max, line) => Math.max(max, GridRenderer.measureTextWidth(input, line)), 0);
  }

  static measureMultilineHeight(input, width, minHeight) {
    const previous = {
      position: input.style.position,
      visibility: input.style.visibility,
      width: input.style.width,
      height: input.style.height,
      minHeight: input.style.minHeight,
      maxHeight: input.style.maxHeight,
    };

    input.style.position = 'absolute';
    input.style.visibility = 'hidden';
    input.style.width = `${width}px`;
    input.style.height = 'auto';
    input.style.minHeight = '0';
    input.style.maxHeight = `${EDITING_INPUT_MAX_HEIGHT}px`;

    const height = Math.min(
      Math.max(input.scrollHeight, minHeight),
      EDITING_INPUT_MAX_HEIGHT,
    );

    input.style.position = previous.position;
    input.style.visibility = previous.visibility;
    input.style.width = previous.width;
    input.style.height = previous.height;
    input.style.minHeight = previous.minHeight;
    input.style.maxHeight = previous.maxHeight;

    return height;
  }

  static layoutEditingInput(input, cell) {
    if (GridRenderer.isInputComposing(input)) {
      return;
    }

    GridRenderer.resetEditingInputLayout(input);

    const cellRect = cell.getBoundingClientRect();
    const spaceToRight = window.innerWidth - cellRect.left - 24;
    const value = input.value ?? '';
    const isMultiline = value.includes('\n');
    const contentWidth = GridRenderer.longestLineWidth(input, value);
    const needsWider =
      contentWidth + EDITING_INPUT_EXPAND_PADDING > cellRect.width;

    let width = cellRect.width;
    if (needsWider) {
      width = Math.min(
        Math.max(cellRect.width, contentWidth + EDITING_INPUT_EXPAND_PADDING),
        EDITING_INPUT_MAX_WIDTH,
        spaceToRight,
      );
    }

    let height = cellRect.height;
    if (isMultiline) {
      height = GridRenderer.measureMultilineHeight(input, width, cellRect.height);
    }

    input.style.position = 'fixed';
    input.style.left = `${cellRect.left}px`;
    input.style.top = `${cellRect.top}px`;
    input.style.width = `${width}px`;
    input.style.minHeight = `${height}px`;
    input.style.height = isMultiline ? `${height}px` : `${cellRect.height}px`;
    input.style.zIndex = '200';
    input.style.maxHeight = isMultiline ? `${EDITING_INPUT_MAX_HEIGHT}px` : `${cellRect.height}px`;
  }

  static insertNewlineAtCursor(field) {
    const start = field.selectionStart;
    const end = field.selectionEnd;
    field.value = `${field.value.slice(0, start)}\n${field.value.slice(end)}`;
    field.selectionStart = start + 1;
    field.selectionEnd = start + 1;
    GridRenderer.updateCellInputLayout(field);
  }

  static insertTextAtCursor(field, text) {
    const start = field.selectionStart;
    const end = field.selectionEnd;
    field.value = `${field.value.slice(0, start)}${text}${field.value.slice(end)}`;
    const cursor = start + text.length;
    field.selectionStart = cursor;
    field.selectionEnd = cursor;
  }

  bindCellEvents(input, cell) {
    const { app } = this;
    const coords = () => ({
      row: Number(cell.dataset.row),
      col: Number(cell.dataset.col),
    });

    input.addEventListener('beforeinput', (event) => {
      if (app.model.mode !== 'select') {
        return;
      }
      if (!isCellInsertBeforeInput(event)) {
        return;
      }
      const { row, col } = coords();
      const expectComposition =
        event.isComposing === true ||
        event.inputType === 'insertCompositionText' ||
        event.inputType === 'insertFromComposition';
      app.prepareCellEditFromInput(row, col, { expectComposition });
    });

    input.addEventListener(
      'keydown',
      (event) => {
        if (app.model.mode !== 'select') {
          return;
        }
        if (shouldRouteToImeInput(event)) {
          const { row, col } = coords();
          app.prepareCellEditFromInput(row, col, { expectComposition: true });
        }
      },
      true,
    );

    const syncEditingInput = (target, event) => {
      if (GridRenderer.isInputComposing(target, event)) {
        return;
      }
      const { row, col } = coords();
      GridRenderer.updateCellInputLayout(target);
      app.handleCellInput(row, col, target.value);
      if (
        cell.classList.contains('editing') &&
        GridRenderer.needsEditingOverlay(target, cell)
      ) {
        GridRenderer.layoutEditingInput(target, cell);
      } else if (cell.classList.contains('editing')) {
        GridRenderer.resetEditingInputLayout(target);
      }
    };

    const markImeComposing = () => {
      input.dataset.imeComposing = 'true';
    };

    const clearImeComposing = (target, event) => {
      delete input.dataset.imeComposing;
      requestAnimationFrame(() => {
        syncEditingInput(target, event);
      });
    };

    input.addEventListener('compositionstart', markImeComposing);
    input.addEventListener('compositionupdate', markImeComposing);

    input.addEventListener('compositionend', (event) => {
      clearImeComposing(event.target, event);
    });

    input.addEventListener('input', (event) => {
      syncEditingInput(event.target, event);
    });

    input.addEventListener('paste', (event) => {
      event.preventDefault();
      const pastedText = event.clipboardData.getData('text/plain').replace(/\r?\n/g, ' ');
      GridRenderer.insertTextAtCursor(event.target, pastedText);
      syncEditingInput(event.target);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }
      if (isComposingInput(event) || GridRenderer.isInputComposing(event.target, event)) {
        return;
      }
      if (app.model.mode !== 'edit') {
        return;
      }
      const { row, col } = coords();
      if (isNewlineShortcut(event)) {
        event.preventDefault();
        event.stopPropagation();
        GridRenderer.insertNewlineAtCursor(event.target);
        syncEditingInput(event.target, event);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      syncEditingInput(event.target, event);
      app.finishEditAndMoveDown(row, col);
    });

    input.addEventListener('blur', () => {
      const { row, col } = coords();
      GridRenderer.collapseInputSelection(input);
      app.exitEditMode(row, col);
    });

    cell.addEventListener('mousedown', (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      const { row, col } = coords();
      app.beginDragSelection('cell', row, col, event.shiftKey);
    });
  }

  bindRowHeaderEvents(rowHeader) {
    const { app } = this;
    rowHeader.addEventListener('mousedown', (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      const row = Number(rowHeader.dataset.row);
      app.beginDragSelection('row', row, 0, event.shiftKey);
    });

    rowHeader.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const row = Number(rowHeader.dataset.row);
      if (!app.model.isRowInSelection(row)) {
        app.beginDragSelection('row', row, 0, event.shiftKey);
        app.endDragSelection();
      }
      app.contextMenu.show('row', row, event.clientX, event.clientY);
    });
  }

  bindColHeaderEvents(colHeader) {
    const { app } = this;
    colHeader.addEventListener('mousedown', (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      const col = Number(colHeader.dataset.col);
      app.beginDragSelection('column', 0, col, event.shiftKey);
    });

    colHeader.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const col = Number(colHeader.dataset.col);
      if (!app.model.isColumnInSelection(col)) {
        app.beginDragSelection('column', 0, col, event.shiftKey);
        app.endDragSelection();
      }
      app.contextMenu.show('column', col, event.clientX, event.clientY);
    });
  }

  createCornerHeader() {
    const cornerCell = document.createElement('th');
    cornerCell.className = 'corner-header';
    cornerCell.addEventListener('mousedown', (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      this.app.selectEntireSheet();
    });
    return cornerCell;
  }

  createColHeader(col) {
    const colHeader = document.createElement('th');
    colHeader.className = 'col-header';
    colHeader.dataset.col = String(col);
    colHeader.textContent = columnIndexToLabel(col);
    this.bindColHeaderEvents(colHeader);
    return colHeader;
  }

  createRowHeader(row) {
    const rowHeader = document.createElement('th');
    rowHeader.className = 'row-header';
    rowHeader.dataset.row = String(row);
    rowHeader.textContent = String(row + 1);
    this.bindRowHeaderEvents(rowHeader);
    return rowHeader;
  }

  createCell(row, col) {
    const { model } = this.app;
    const cell = document.createElement('td');
    cell.className = 'cell';
    cell.dataset.row = String(row);
    cell.dataset.col = String(col);

    const input = document.createElement('textarea');
    input.className = 'cell-input';
    input.id = `cell-input-${row}-${col}`;
    input.name = `cell_${row}_${col}`;
    input.rows = 1;
    input.value = model.data[row][col] ?? '';
    input.setAttribute('aria-label', formatCellAddress(row, col));
    GridRenderer.updateCellInputLayout(input);

    this.bindCellEvents(input, cell);
    cell.appendChild(input);
    return cell;
  }

  createBodyRow(row) {
    const tableRow = document.createElement('tr');
    tableRow.appendChild(this.createRowHeader(row));
    for (let col = 0; col < this.app.model.cols; col += 1) {
      tableRow.appendChild(this.createCell(row, col));
    }
    return tableRow;
  }

  needsFullRender() {
    const table = this.getTable();
    if (!table) {
      return true;
    }
    if (table.rows.length !== this.app.model.rows + 1) {
      return true;
    }
    const expectedCols = this.app.model.cols + 1;
    return table.rows[0]?.cells.length !== expectedCols;
  }

  syncCellValues() {
    const { model, app } = this.app;
    const skipCell =
      model.mode === 'edit' && model.isSingleCellSelection()
        ? model.getActiveCell()
        : null;

    const table = this.getTable();
    if (!table) {
      return;
    }

    for (let row = 0; row < model.rows; row += 1) {
      for (let col = 0; col < model.cols; col += 1) {
        if (skipCell && skipCell.row === row && skipCell.col === col) {
          continue;
        }
        const input = table.rows[row + 1]?.cells[col + 1]?.querySelector('.cell-input');
        if (!input) {
          continue;
        }
        const nextValue = model.data[row][col] ?? '';
        if (input.value !== nextValue) {
          input.value = nextValue;
          GridRenderer.updateCellInputLayout(input);
        }
      }
    }
  }

  finishRender() {
    const { model, app } = this.app;
    model.clampSelection();
    app.refreshSelectionUI();
  }

  renderFull() {
    const { app } = this;
    const { model } = app;
    const table = document.createElement('table');
    table.className = 'grid-table';

    const headerRow = document.createElement('tr');
    headerRow.appendChild(this.createCornerHeader());
    for (let col = 0; col < model.cols; col += 1) {
      headerRow.appendChild(this.createColHeader(col));
    }
    table.appendChild(headerRow);

    for (let row = 0; row < model.rows; row += 1) {
      table.appendChild(this.createBodyRow(row));
    }

    this.container.replaceChildren(table);
    this.table = table;
    this.renderedRows = model.rows;
    this.renderedCols = model.cols;
    this.finishRender();
  }

  render() {
    if (this.needsFullRender()) {
      this.renderFull();
      return;
    }

    this.syncCellValues();
    this.finishRender();
  }
}
