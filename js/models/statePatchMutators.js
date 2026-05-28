function hasSelection(state) {
  return state.selectionKind !== 'none';
}

function clampPoint(state, point) {
  return {
    row: Math.max(0, Math.min(point.row, state.rows - 1)),
    col: Math.max(0, Math.min(point.col, state.cols - 1)),
  };
}

function clampSelection(state) {
  if (!hasSelection(state)) {
    return;
  }
  state.anchor = clampPoint(state, state.anchor);
  state.focus = clampPoint(state, state.focus);
}

function getSelectionBounds(state) {
  const { anchor, focus, selectionKind } = state;
  if (selectionKind === 'none') {
    return null;
  }
  if (selectionKind === 'row') {
    return {
      rowMin: Math.min(anchor.row, focus.row),
      rowMax: Math.max(anchor.row, focus.row),
      colMin: 0,
      colMax: state.cols - 1,
    };
  }
  if (selectionKind === 'column') {
    return {
      rowMin: 0,
      rowMax: state.rows - 1,
      colMin: Math.min(anchor.col, focus.col),
      colMax: Math.max(anchor.col, focus.col),
    };
  }
  if (selectionKind === 'sheet') {
    return {
      rowMin: 0,
      rowMax: state.rows - 1,
      colMin: 0,
      colMax: state.cols - 1,
    };
  }
  return {
    rowMin: Math.min(anchor.row, focus.row),
    rowMax: Math.max(anchor.row, focus.row),
    colMin: Math.min(anchor.col, focus.col),
    colMax: Math.max(anchor.col, focus.col),
  };
}

function shiftSelectionForRowInsert(state, insertIndex, count) {
  if (!hasSelection(state)) {
    return;
  }
  const shift = (row) => (row >= insertIndex ? row + count : row);
  state.anchor.row = shift(state.anchor.row);
  state.focus.row = shift(state.focus.row);
}

function shiftSelectionForColumnInsert(state, insertIndex, count) {
  if (!hasSelection(state)) {
    return;
  }
  const shift = (col) => (col >= insertIndex ? col + count : col);
  state.anchor.col = shift(state.anchor.col);
  state.focus.col = shift(state.focus.col);
}

function shiftSelectionForRowDelete(state, deleteIndex, deleteCount) {
  if (!hasSelection(state)) {
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
  state.anchor.row = adjust(state.anchor.row);
  state.focus.row = adjust(state.focus.row);
}

function shiftSelectionForColumnDelete(state, deleteIndex, deleteCount) {
  if (!hasSelection(state)) {
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
  state.anchor.col = adjust(state.anchor.col);
  state.focus.col = adjust(state.focus.col);
}

export function setCellValue(state, row, col, value) {
  state.data[row][col] = value;
}

export function clearSelectionContent(state) {
  const bounds = getSelectionBounds(state);
  if (!bounds) {
    return;
  }
  for (let row = bounds.rowMin; row <= bounds.rowMax; row += 1) {
    for (let col = bounds.colMin; col <= bounds.colMax; col += 1) {
      state.data[row][col] = '';
    }
  }
}

export function ensureGridSize(state, requiredRows, requiredCols) {
  if (requiredCols > state.cols) {
    const colsToAdd = requiredCols - state.cols;
    state.data.forEach((row) => {
      for (let i = 0; i < colsToAdd; i += 1) {
        row.push('');
      }
    });
    state.cols = requiredCols;
  }

  if (requiredRows > state.rows) {
    for (let row = state.rows; row < requiredRows; row += 1) {
      state.data.push(Array(state.cols).fill(''));
    }
    state.rows = requiredRows;
  }
}

export function pasteTableAt(state, startRow, startCol, table) {
  if (!table.length) {
    return;
  }
  const pasteRows = table.length;
  const pasteCols = Math.max(...table.map((row) => row.length), 0);
  const endRow = startRow + pasteRows - 1;
  const endCol = startCol + pasteCols - 1;
  ensureGridSize(state, endRow + 1, endCol + 1);
  state.mode = 'select';

  for (let row = 0; row < pasteRows; row += 1) {
    for (let col = 0; col < pasteCols; col += 1) {
      state.data[startRow + row][startCol + col] = table[row][col] ?? '';
    }
  }

  state.anchor = { row: startRow, col: startCol };
  state.focus = { row: endRow, col: endCol };
  state.selectionKind = 'range';
}

export function insertRowsAt(state, index, count) {
  const newRows = Array.from({ length: count }, () => Array(state.cols).fill(''));
  state.data.splice(index, 0, ...newRows);
  state.rows += count;
  shiftSelectionForRowInsert(state, index, count);
  clampSelection(state);
}

export function insertColumnsAt(state, index, count) {
  state.data.forEach((row) => {
    row.splice(index, 0, ...Array(count).fill(''));
  });
  state.cols += count;
  shiftSelectionForColumnInsert(state, index, count);
  clampSelection(state);
}

export function deleteRowRange(state, rowMin, deleteCount) {
  if (deleteCount >= state.rows) {
    state.data = [Array(state.cols).fill('')];
    state.rows = 1;
    state.anchor = { row: 0, col: 0 };
    state.focus = { row: 0, col: 0 };
    state.selectionKind = 'range';
  } else {
    state.data.splice(rowMin, deleteCount);
    state.rows -= deleteCount;
    shiftSelectionForRowDelete(state, rowMin, deleteCount);
  }
  clampSelection(state);
}

export function deleteColumnRange(state, colMin, deleteCount) {
  if (deleteCount >= state.cols) {
    state.data.forEach((row) => {
      row.length = 0;
      row.push('');
    });
    state.cols = 1;
    state.anchor = { row: 0, col: 0 };
    state.focus = { row: 0, col: 0 };
    state.selectionKind = 'range';
  } else {
    state.data.forEach((row) => row.splice(colMin, deleteCount));
    state.cols -= deleteCount;
    shiftSelectionForColumnDelete(state, colMin, deleteCount);
  }
  clampSelection(state);
}
