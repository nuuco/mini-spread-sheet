export function isTypingKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  return event.key.length === 1;
}

export function isGridKeyboardTarget(event) {
  return !event.target.closest('.controls') && !event.target.closest('.toolbar');
}

export function isCopyShortcut(event) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c' && !event.shiftKey;
}

export function isPasteShortcut(event) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v' && !event.shiftKey;
}

export function isUndoShortcut(event) {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey;
}

export function isRedoShortcut(event) {
  if (!(event.metaKey || event.ctrlKey)) {
    return false;
  }
  const key = event.key.toLowerCase();
  return (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey);
}

export function getArrowDelta(key) {
  const deltas = {
    ArrowUp: { row: -1, col: 0 },
    ArrowDown: { row: 1, col: 0 },
    ArrowLeft: { row: 0, col: -1 },
    ArrowRight: { row: 0, col: 1 },
  };
  return deltas[key] ?? null;
}

export function isNewlineShortcut(event) {
  return event.metaKey || event.ctrlKey;
}
