export function isTypingKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  return event.key.length === 1;
}

export function isGridKeyboardTarget(event) {
  if (event.target.closest('.controls') || event.target.closest('.toolbar')) {
    return false;
  }
  if (event.target.closest('#help-guide-modal')) {
    return false;
  }
  if (document.body.classList.contains('help-guide-open')) {
    return false;
  }
  return true;
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

export function isComposingInput(event) {
  if (!event) {
    return false;
  }
  return event.isComposing === true || event.keyCode === 229 || event.key === 'Process';
}

/** 선택 모드에서 IME 조합이 필요한 입력인지 (완성 음절 한 글자는 startTyping으로 처리) */
export function shouldRouteToImeInput(event) {
  if (isComposingInput(event)) {
    return true;
  }
  if (event.key.length !== 1) {
    return false;
  }
  if (/[\uAC00-\uD7A3]/.test(event.key)) {
    return false;
  }
  return /[\u1100-\u11FF\u3130-\u318F]/.test(event.key);
}

export function isCellInputEvent(event) {
  return Boolean(event.target.closest('.cell-input'));
}

/** 편집 중인 셀 textarea로 키가 들어온 경우 */
export function isEditingCellInputEvent(event) {
  return Boolean(event.target.closest('.cell.editing .cell-input'));
}

export function isCellInsertBeforeInput(event) {
  const { inputType } = event;
  if (!inputType) {
    return Boolean(event.data);
  }
  return inputType.startsWith('insert');
}

export function isMacLikePlatform() {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return (
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform) ||
    navigator.userAgentData?.platform === 'macOS'
  );
}

export function getUndoShortcutLabel() {
  return isMacLikePlatform() ? '⌘Z' : 'Ctrl+Z';
}

export function getRedoShortcutLabel() {
  return isMacLikePlatform() ? '⇧⌘Z' : 'Ctrl+Y';
}
