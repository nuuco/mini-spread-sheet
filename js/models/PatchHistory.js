import { MAX_UNDO_STACK } from '../constants.js';

export class PatchHistory {
  constructor(maxSize = MAX_UNDO_STACK) {
    this.maxSize = maxSize;
    this.undoStack = [];
    this.redoStack = [];
  }

  execute(command, model) {
    command.execute(model);
    if (Array.isArray(command.patches) && command.patches.length === 0) {
      return null;
    }
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    return command;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo(model) {
    if (!this.canUndo()) {
      return null;
    }
    const command = this.undoStack.pop();
    command.undo(model);
    this.redoStack.push(command);
    return command;
  }

  redo(model) {
    if (!this.canRedo()) {
      return null;
    }
    const command = this.redoStack.pop();
    command.execute(model);
    this.undoStack.push(command);
    return command;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
