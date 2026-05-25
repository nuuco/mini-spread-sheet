import { MAX_UNDO_STACK } from '../constants.js';

export class UndoStack {
  constructor(maxSize = MAX_UNDO_STACK) {
    this.maxSize = maxSize;
    this.undoStack = [];
    this.redoStack = [];
  }

  static snapshotsEqual(a, b) {
    if (a.rows !== b.rows || a.cols !== b.cols) {
      return false;
    }
    return a.data.every((row, rowIndex) =>
      row.every((cell, colIndex) => cell === b.data[rowIndex][colIndex]),
    );
  }

  push(snapshot) {
    const top = this.undoStack[this.undoStack.length - 1];
    if (top && UndoStack.snapshotsEqual(top, snapshot)) {
      return;
    }
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo(currentSnapshot) {
    if (!this.canUndo()) {
      return null;
    }
    this.redoStack.push(currentSnapshot);
    return this.undoStack.pop();
  }

  redo(currentSnapshot) {
    if (!this.canRedo()) {
      return null;
    }
    this.undoStack.push(currentSnapshot);
    return this.redoStack.pop();
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
