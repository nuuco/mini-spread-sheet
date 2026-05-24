import { CONFIG } from '../constants.js';

export class SpreadsheetModel {
  constructor(config = CONFIG) {
    this.config = config;
    this.resetToDefaults();
  }

  static createEmptyData(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill(''));
  }

  resetToDefaults() {
    this.rows = this.config.defaultRows;
    this.cols = this.config.defaultCols;
    this.data = SpreadsheetModel.createEmptyData(this.rows, this.cols);
    this.title = '';
    this.anchor = { row: 0, col: 0 };
    this.focus = { row: 0, col: 0 };
    this.selectionKind = 'none';
    this.mode = 'select';
  }

  hasSelection() {
    return this.selectionKind !== 'none';
  }

  clearSelection() {
    this.selectionKind = 'none';
    this.mode = 'select';
  }

  toPayload() {
    return {
      rows: this.rows,
      cols: this.cols,
      data: this.data,
      title: this.title,
    };
  }

  applyPayload({ rows, cols, data, title }) {
    this.rows = rows ?? this.config.defaultRows;
    this.cols = cols ?? this.config.defaultCols;
    this.data = data ?? SpreadsheetModel.createEmptyData(this.rows, this.cols);
    this.title = title ?? '';
    this.mode = 'select';
    this.clampSelection();
  }

  createSnapshot() {
    return {
      rows: this.rows,
      cols: this.cols,
      data: this.data.map((row) => [...row]),
    };
  }

  applySnapshot(snapshot) {
    this.rows = snapshot.rows;
    this.cols = snapshot.cols;
    this.data = snapshot.data.map((row) => [...row]);
    this.mode = 'select';
    this.clampSelection();
  }

  collectData() {
    return this.data.map((row) => [...row]);
  }

  clampPoint(point) {
    return {
      row: Math.max(0, Math.min(point.row, this.rows - 1)),
      col: Math.max(0, Math.min(point.col, this.cols - 1)),
    };
  }

  clampSelection() {
    if (!this.hasSelection()) {
      return;
    }
    this.anchor = this.clampPoint(this.anchor);
    this.focus = this.clampPoint(this.focus);
  }

  getSelectionBounds() {
    const { anchor, focus, selectionKind } = this;

    if (selectionKind === 'none') {
      return null;
    }

    if (selectionKind === 'row') {
      return {
        rowMin: Math.min(anchor.row, focus.row),
        rowMax: Math.max(anchor.row, focus.row),
        colMin: 0,
        colMax: this.cols - 1,
      };
    }

    if (selectionKind === 'column') {
      return {
        rowMin: 0,
        rowMax: this.rows - 1,
        colMin: Math.min(anchor.col, focus.col),
        colMax: Math.max(anchor.col, focus.col),
      };
    }

    if (selectionKind === 'sheet') {
      return {
        rowMin: 0,
        rowMax: this.rows - 1,
        colMin: 0,
        colMax: this.cols - 1,
      };
    }

    return {
      rowMin: Math.min(anchor.row, focus.row),
      rowMax: Math.max(anchor.row, focus.row),
      colMin: Math.min(anchor.col, focus.col),
      colMax: Math.max(anchor.col, focus.col),
    };
  }

  isCellInSelection(row, col) {
    const bounds = this.getSelectionBounds();
    if (!bounds) {
      return false;
    }
    return (
      row >= bounds.rowMin &&
      row <= bounds.rowMax &&
      col >= bounds.colMin &&
      col <= bounds.colMax
    );
  }

  isSingleCellSelection() {
    const bounds = this.getSelectionBounds();
    if (!bounds) {
      return false;
    }
    return bounds.rowMin === bounds.rowMax && bounds.colMin === bounds.colMax;
  }

  getActiveCell() {
    const bounds = this.getSelectionBounds();
    if (!bounds) {
      return { row: 0, col: 0 };
    }

    if (this.selectionKind === 'sheet') {
      return { row: 0, col: 0 };
    }
    if (this.selectionKind === 'row') {
      return { row: bounds.rowMin, col: 0 };
    }
    if (this.selectionKind === 'column') {
      return { row: 0, col: bounds.colMin };
    }
    return { row: this.focus.row, col: this.focus.col };
  }

  selectEntireSheet() {
    this.mode = 'select';
    this.selectionKind = 'sheet';
    this.anchor = { row: 0, col: 0 };
    this.focus = { row: this.rows - 1, col: this.cols - 1 };
  }

  setRangeSelection(anchor, focus) {
    this.anchor = anchor;
    this.focus = focus;
    this.selectionKind = 'range';
  }

  ensureGridSize(requiredRows, requiredCols) {
    if (requiredCols > this.cols) {
      const colsToAdd = requiredCols - this.cols;
      this.data.forEach((row) => {
        for (let i = 0; i < colsToAdd; i += 1) {
          row.push('');
        }
      });
      this.cols = requiredCols;
    }

    if (requiredRows > this.rows) {
      for (let row = this.rows; row < requiredRows; row += 1) {
        this.data.push(Array(this.cols).fill(''));
      }
      this.rows = requiredRows;
    }
  }

  pasteTableAt(startRow, startCol, table) {
    if (!table.length) {
      return;
    }

    const pasteRows = table.length;
    const pasteCols = Math.max(...table.map((row) => row.length), 0);
    const endRow = startRow + pasteRows - 1;
    const endCol = startCol + pasteCols - 1;

    this.ensureGridSize(endRow + 1, endCol + 1);
    this.mode = 'select';

    for (let row = 0; row < pasteRows; row += 1) {
      for (let col = 0; col < pasteCols; col += 1) {
        this.data[startRow + row][startCol + col] = table[row][col] ?? '';
      }
    }

    this.setRangeSelection({ row: startRow, col: startCol }, { row: endRow, col: endCol });
  }

  clearSelectionContent() {
    const bounds = this.getSelectionBounds();
    if (!bounds) {
      return;
    }
    for (let row = bounds.rowMin; row <= bounds.rowMax; row += 1) {
      for (let col = bounds.colMin; col <= bounds.colMax; col += 1) {
        this.data[row][col] = '';
      }
    }
  }

  getSelectionDataForCopy() {
    const bounds = this.getSelectionBounds();
    if (!bounds) {
      return [];
    }
    const rows = [];
    for (let row = bounds.rowMin; row <= bounds.rowMax; row += 1) {
      const rowValues = [];
      for (let col = bounds.colMin; col <= bounds.colMax; col += 1) {
        rowValues.push(this.data[row][col] ?? '');
      }
      rows.push(rowValues);
    }
    return rows;
  }

  insertRowsAt(index, count) {
    const newRows = Array.from({ length: count }, () => Array(this.cols).fill(''));
    this.data.splice(index, 0, ...newRows);
    this.rows += count;
    this.clampSelection();
  }

  deleteRowAt(index) {
    if (this.rows <= 1) {
      return false;
    }
    this.data.splice(index, 1);
    this.rows -= 1;
    this.clampSelection();
    return true;
  }

  deleteRowRange(rowMin, deleteCount) {
    if (deleteCount >= this.rows) {
      this.data = [Array(this.cols).fill('')];
      this.rows = 1;
    } else {
      this.data.splice(rowMin, deleteCount);
      this.rows -= deleteCount;
    }
    this.anchor = { row: 0, col: 0 };
    this.focus = { row: 0, col: 0 };
    this.selectionKind = 'range';
    this.clampSelection();
  }

  insertColumnsAt(index, count) {
    this.data.forEach((row) => {
      row.splice(index, 0, ...Array(count).fill(''));
    });
    this.cols += count;
    this.clampSelection();
  }

  deleteColumnAt(index) {
    if (this.cols <= 1) {
      return false;
    }
    this.data.forEach((row) => row.splice(index, 1));
    this.cols -= 1;
    this.clampSelection();
    return true;
  }

  deleteColumnRange(colMin, deleteCount) {
    if (deleteCount >= this.cols) {
      this.data.forEach((row) => {
        row.length = 0;
        row.push('');
      });
      this.cols = 1;
    } else {
      this.data.forEach((row) => row.splice(colMin, deleteCount));
      this.cols -= deleteCount;
    }
    this.anchor = { row: 0, col: 0 };
    this.focus = { row: 0, col: 0 };
    this.selectionKind = 'range';
    this.clampSelection();
  }

  isRowInSelection(row) {
    if (this.selectionKind !== 'row') {
      return false;
    }
    const bounds = this.getSelectionBounds();
    return row >= bounds.rowMin && row <= bounds.rowMax;
  }

  isColumnInSelection(col) {
    if (this.selectionKind !== 'column') {
      return false;
    }
    const bounds = this.getSelectionBounds();
    return col >= bounds.colMin && col <= bounds.colMax;
  }

  getRowInsertContext(contextIndex) {
    const bounds = this.getSelectionBounds();
    if (!bounds) {
      const index = contextIndex ?? 0;
      return { count: 1, aboveIndex: index, belowIndex: index + 1 };
    }
    const count = this.selectionKind === 'row' ? bounds.rowMax - bounds.rowMin + 1 : 1;
    const aboveIndex = this.selectionKind === 'row' ? bounds.rowMin : (contextIndex ?? 0);
    const belowIndex =
      this.selectionKind === 'row' ? bounds.rowMax + 1 : (contextIndex ?? 0) + 1;
    return { count, aboveIndex, belowIndex };
  }

  getColumnInsertContext(contextIndex) {
    const bounds = this.getSelectionBounds();
    if (!bounds) {
      const index = contextIndex ?? 0;
      return { count: 1, leftIndex: index, rightIndex: index + 1 };
    }
    const count = this.selectionKind === 'column' ? bounds.colMax - bounds.colMin + 1 : 1;
    const leftIndex = this.selectionKind === 'column' ? bounds.colMin : (contextIndex ?? 0);
    const rightIndex =
      this.selectionKind === 'column' ? bounds.colMax + 1 : (contextIndex ?? 0) + 1;
    return { count, leftIndex, rightIndex };
  }
}
