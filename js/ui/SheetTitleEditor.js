import { SHEET_TITLE_MAX_LENGTH } from '../constants.js';

function readTitle(field) {
  return field.textContent.replace(/\r?\n/g, '').trim();
}

function placeCaretAtEnd(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function selectAll(field) {
  const range = document.createRange();
  range.selectNodeContents(field);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

export class SheetTitleEditor {
  constructor({ model, onChange, onCommit }) {
    this.model = model;
    this.onChange = onChange;
    this.onCommit = onCommit;
    this.field = document.getElementById('sheet-title-field');
    this.wrap = document.getElementById('sheet-title-wrap');
    this.editSnapshot = '';
    this.bindEvents();
  }

  bindEvents() {
    if (!this.field || !this.wrap) {
      return;
    }

    this.field.addEventListener('click', () => {
      if (!this.wrap.classList.contains('is-editing')) {
        this.startEdit();
      }
    });

    this.field.addEventListener('input', () => {
      this.model.title = this.enforceLength();
      this.wrap.classList.toggle('is-empty', !readTitle(this.field));
      this.onChange();
    });

    this.field.addEventListener('paste', (event) => {
      event.preventDefault();
      const pasted = event.clipboardData
        .getData('text/plain')
        .replace(/\r?\n/g, ' ')
        .slice(0, SHEET_TITLE_MAX_LENGTH);
      document.execCommand('insertText', false, pasted);
    });

    this.field.addEventListener('blur', () => this.finishEdit(false));
    this.field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.field.blur();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        this.finishEdit(true);
      }
    });
  }

  clearIfEmpty() {
    if (readTitle(this.field)) {
      return;
    }
    if (this.field.childNodes.length > 0) {
      this.field.textContent = '';
      placeCaretAtEnd(this.field);
    }
  }

  enforceLength() {
    this.clearIfEmpty();
    const text = this.field.textContent.replace(/\r?\n/g, '');
    if (!text || text.length <= SHEET_TITLE_MAX_LENGTH) {
      return text;
    }
    this.field.textContent = text.slice(0, SHEET_TITLE_MAX_LENGTH);
    placeCaretAtEnd(this.field);
    return this.field.textContent;
  }

  syncFromModel() {
    if (!this.field || !this.wrap || this.wrap.classList.contains('is-editing')) {
      return;
    }
    this.field.textContent = this.model.title ?? '';
    this.wrap.classList.toggle('is-empty', !String(this.model.title ?? '').trim());
  }

  applyToField() {
    this.syncFromModel();
  }

  isEditing() {
    return Boolean(this.wrap?.classList.contains('is-editing'));
  }

  readFromFieldIfEditing() {
    if (this.isEditing()) {
      this.model.title = this.enforceLength();
    }
  }

  startEdit() {
    if (!this.wrap || !this.field || this.wrap.classList.contains('is-editing')) {
      return;
    }
    this.editSnapshot = this.model.title ?? '';
    this.field.textContent = this.model.title ?? '';
    this.field.contentEditable = 'plaintext-only';
    this.wrap.classList.add('is-editing');
    this.wrap.classList.toggle('is-empty', !this.field.textContent.trim());
    this.field.focus();

    if (this.field.textContent.length) {
      selectAll(this.field);
    } else {
      placeCaretAtEnd(this.field);
    }
  }

  finishEdit(revert) {
    if (!this.wrap || !this.field || !this.wrap.classList.contains('is-editing')) {
      return;
    }

    this.model.title = revert
      ? this.editSnapshot
      : readTitle(this.field).slice(0, SHEET_TITLE_MAX_LENGTH);

    this.field.contentEditable = 'false';
    this.field.textContent = this.model.title ?? '';
    this.wrap.classList.remove('is-editing');
    this.syncFromModel();
    this.onCommit();
  }
}
