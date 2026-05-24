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
      data: this.collectData(),
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
    this.shiftSelectionForRowInsert(index, count);
    this.clampSelection();
  }

  deleteRowAt(index) {
    if (this.rows <= 1) {
      return false;
    }
    this.data.splice(index, 1);
    this.rows -= 1;
    this.shiftSelectionForRowDelete(index, 1);
    this.clampSelection();
    return true;
  }

  deleteRowRange(rowMin, deleteCount) {
    if (deleteCount >= this.rows) {
      this.data = [Array(this.cols).fill('')];
      this.rows = 1;
      this.anchor = { row: 0, col: 0 };
      this.focus = { row: 0, col: 0 };
      this.selectionKind = 'range';
    } else {
      this.data.splice(rowMin, deleteCount);
      this.rows -= deleteCount;
      this.shiftSelectionForRowDelete(rowMin, deleteCount);
    }
    this.clampSelection();
  }

  insertColumnsAt(index, count) {
    this.data.forEach((row) => {
      row.splice(index, 0, ...Array(count).fill(''));
    });
    this.cols += count;
    this.shiftSelectionForColumnInsert(index, count);
    this.clampSelection();
  }

  deleteColumnAt(index) {
    if (this.cols <= 1) {
      return false;
    }
    this.data.forEach((row) => row.splice(index, 1));
    this.cols -= 1;
    this.shiftSelectionForColumnDelete(index, 1);
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
      this.anchor = { row: 0, col: 0 };
      this.focus = { row: 0, col: 0 };
      this.selectionKind = 'range';
    } else {
      this.data.forEach((row) => row.splice(colMin, deleteCount));
      this.cols -= deleteCount;
      this.shiftSelectionForColumnDelete(colMin, deleteCount);
    }
    this.clampSelection();
  }

  getAxisSpanForHeaderMenu(axis, contextIndex) {
    const isRow = axis === 'row';
    const bounds = this.getSelectionBounds();
    const index = contextIndex ?? (isRow ? bounds?.rowMin : bounds?.colMin) ?? 0;
    const minKey = isRow ? 'rowMin' : 'colMin';
    const maxKey = isRow ? 'rowMax' : 'colMax';
    const selectionAxis = isRow ? 'row' : 'column';

    if (!bounds) {
      return isRow
        ? { rowMin: index, rowMax: index, count: 1 }
        : { colMin: index, colMax: index, count: 1 };
    }
    if (this.selectionKind === selectionAxis) {
      return {
        [minKey]: bounds[minKey],
        [maxKey]: bounds[maxKey],
        count: bounds[maxKey] - bounds[minKey] + 1,
      };
    }
    if (
      this.selectionKind === 'range' &&
      index >= bounds[minKey] &&
      index <= bounds[maxKey]
    ) {
      return {
        [minKey]: bounds[minKey],
        [maxKey]: bounds[maxKey],
        count: bounds[maxKey] - bounds[minKey] + 1,
      };
    }
    return isRow
      ? { rowMin: index, rowMax: index, count: 1 }
      : { colMin: index, colMax: index, count: 1 };
  }

  getRowSpanForHeaderMenu(contextIndex) {
    return this.getAxisSpanForHeaderMenu('row', contextIndex);
  }

  getColumnSpanForHeaderMenu(contextIndex) {
    return this.getAxisSpanForHeaderMenu('column', contextIndex);
  }

  canDeleteRowsForMenu(spanCount) {
    return this.rows > 1 || spanCount < this.rows;
  }

  canDeleteColumnsForMenu(spanCount) {
    return this.cols > 1 || spanCount < this.cols;
  }

  isRowInSelection(row) {
    const bounds = this.getSelectionBounds();
    if (!bounds) {
      return false;
    }
    if (this.selectionKind === 'row') {
      return row >= bounds.rowMin && row <= bounds.rowMax;
    }
    if (this.selectionKind === 'range') {
      return row >= bounds.rowMin && row <= bounds.rowMax;
    }
    return false;
  }

  isColumnInSelection(col) {
    const bounds = this.getSelectionBounds();
    if (!bounds) {
      return false;
    }
    if (this.selectionKind === 'column') {
      return col >= bounds.colMin && col <= bounds.colMax;
    }
    if (this.selectionKind === 'range') {
      return col >= bounds.colMin && col <= bounds.colMax;
    }
    return false;
  }

  shiftSelectionForRowInsert(insertIndex, count) {
    if (!this.hasSelection()) {
      return;
    }
    const shift = (row) => (row >= insertIndex ? row + count : row);
    this.anchor = { ...this.anchor, row: shift(this.anchor.row) };
    this.focus = { ...this.focus, row: shift(this.focus.row) };
  }

  shiftSelectionForColumnInsert(insertIndex, count) {
    if (!this.hasSelection()) {
      return;
    }
    const shift = (col) => (col >= insertIndex ? col + count : col);
    this.anchor = { ...this.anchor, col: shift(this.anchor.col) };
    this.focus = { ...this.focus, col: shift(this.focus.col) };
  }

  shiftSelectionForRowDelete(deleteIndex, deleteCount) {
    if (!this.hasSelection()) {
      return;
    }
    const adjust = (row) => {
      if (row >= deleteIndex + deleteCount) {
        return row - deleteCount;
      }
      if (row >= deleteIndex) {
        return Math.max(0, deleteIndex - 1);
      }
      return row;
    };
    this.anchor = { ...this.anchor, row: adjust(this.anchor.row) };
    this.focus = { ...this.focus, row: adjust(this.focus.row) };
  }

  shiftSelectionForColumnDelete(deleteIndex, deleteCount) {
    if (!this.hasSelection()) {
      return;
    }
    const adjust = (col) => {
      if (col >= deleteIndex + deleteCount) {
        return col - deleteCount;
      }
      if (col >= deleteIndex) {
        return Math.max(0, deleteIndex - 1);
      }
      return col;
    };
    this.anchor = { ...this.anchor, col: adjust(this.anchor.col) };
    this.focus = { ...this.focus, col: adjust(this.focus.col) };
  }

  getRowInsertContext(contextIndex) {
    const span = this.getRowSpanForHeaderMenu(contextIndex);
    return {
      count: span.count,
      aboveIndex: span.rowMin,
      belowIndex: span.rowMax + 1,
    };
  }

  getColumnInsertContext(contextIndex) {
    const span = this.getColumnSpanForHeaderMenu(contextIndex);
    return {
      count: span.count,
      leftIndex: span.colMin,
      rightIndex: span.colMax + 1,
    };
  }
}
