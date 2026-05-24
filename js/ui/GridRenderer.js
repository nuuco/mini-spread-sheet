import { columnIndexToLabel, formatCellAddress } from '../utils/cellAddress.js';
import { isNewlineShortcut } from '../utils/keyboard.js';
import {
  EDITING_INPUT_EXPAND_PADDING,
  EDITING_INPUT_MAX_HEIGHT,
  EDITING_INPUT_MAX_WIDTH,
} from '../constants.js';

export class GridRenderer {
  constructor(app) {
    this.app = app;
    this.container = document.getElementById('spreadsheet');
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
    input.style.minWidth = '';
    input.style.minHeight = '';
    input.style.maxHeight = '';
    input.style.zIndex = '';
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

  bindCellEvents(input, cell, row, col) {
    const { app } = this;

    input.addEventListener('input', (event) => {
      GridRenderer.updateCellInputLayout(event.target);
      app.handleCellInput(row, col, event.target.value);
      if (cell.classList.contains('editing')) {
        GridRenderer.layoutEditingInput(event.target, cell);
      }
    });

    input.addEventListener('paste', (event) => {
      event.preventDefault();
      const pastedText = event.clipboardData.getData('text/plain').replace(/\r?\n/g, ' ');
      GridRenderer.insertTextAtCursor(event.target, pastedText);
      GridRenderer.updateCellInputLayout(event.target);
      app.handleCellInput(row, col, event.target.value);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') {
        return;
      }
      if (isNewlineShortcut(event)) {
        event.preventDefault();
        GridRenderer.insertNewlineAtCursor(event.target);
        app.handleCellInput(row, col, event.target.value);
        return;
      }
      event.preventDefault();
      app.finishEditAndMoveDown(row, col);
    });

    input.addEventListener('blur', () => {
      const { model } = app;
      if (
        model.mode === 'edit' &&
        model.focus.row === row &&
        model.focus.col === col
      ) {
        app.editUndoRecorded = false;
        model.mode = 'select';
        app.refreshSelectionUI();
      }
    });

    cell.addEventListener('mousedown', (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      app.beginDragSelection('cell', row, col, event.shiftKey);
    });
  }

  bindRowHeaderEvents(rowHeader, row) {
    const { app } = this;
    rowHeader.addEventListener('mousedown', (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      app.beginDragSelection('row', row, 0, event.shiftKey);
    });

    rowHeader.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      if (!app.model.isRowInSelection(row)) {
        app.beginDragSelection('row', row, 0, event.shiftKey);
        app.endDragSelection();
      }
      app.contextMenu.show('row', row, event.clientX, event.clientY);
    });
  }

  bindColHeaderEvents(colHeader, col) {
    const { app } = this;
    colHeader.addEventListener('mousedown', (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      app.beginDragSelection('column', 0, col, event.shiftKey);
    });

    colHeader.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      if (!app.model.isColumnInSelection(col)) {
        app.beginDragSelection('column', 0, col, event.shiftKey);
        app.endDragSelection();
      }
      app.contextMenu.show('column', col, event.clientX, event.clientY);
    });
  }

  render() {
    const { app } = this;
    const { model } = app;
    const table = document.createElement('table');
    table.className = 'grid-table';

    const headerRow = document.createElement('tr');
    const cornerCell = document.createElement('th');
    cornerCell.className = 'corner-header';
    cornerCell.addEventListener('mousedown', (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      app.selectEntireSheet();
    });
    headerRow.appendChild(cornerCell);

    for (let col = 0; col < model.cols; col += 1) {
      const colHeader = document.createElement('th');
      colHeader.className = 'col-header';
      colHeader.dataset.col = String(col);
      colHeader.textContent = columnIndexToLabel(col);
      this.bindColHeaderEvents(colHeader, col);
      headerRow.appendChild(colHeader);
    }
    table.appendChild(headerRow);

    for (let row = 0; row < model.rows; row += 1) {
      const tableRow = document.createElement('tr');
      const rowHeader = document.createElement('th');
      rowHeader.className = 'row-header';
      rowHeader.dataset.row = String(row);
      rowHeader.textContent = String(row + 1);
      this.bindRowHeaderEvents(rowHeader, row);
      tableRow.appendChild(rowHeader);

      for (let col = 0; col < model.cols; col += 1) {
        const cell = document.createElement('td');
        cell.className = 'cell';
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);

        const input = document.createElement('textarea');
        input.className = 'cell-input';
        input.rows = 1;
        input.value = model.data[row][col] ?? '';
        input.setAttribute('aria-label', formatCellAddress(row, col));
        GridRenderer.updateCellInputLayout(input);

        this.bindCellEvents(input, cell, row, col);
        cell.appendChild(input);
        tableRow.appendChild(cell);
      }
      table.appendChild(tableRow);
    }

    this.container.replaceChildren(table);
    model.clampSelection();
    app.refreshSelectionUI();
  }
}
