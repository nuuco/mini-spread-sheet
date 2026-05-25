import { CONFIG, SAVE_DEBOUNCE_MS } from './constants.js';
import { formatCellAddress } from './utils/cellAddress.js';
import {
  getArrowDelta,
  getRedoShortcutLabel,
  getUndoShortcutLabel,
  isEditingCellInputEvent,
  isComposingInput,
  isCopyShortcut,
  isGridKeyboardTarget,
  isPasteShortcut,
  isRedoShortcut,
  isSelectModeCellInputEvent,
  isTypingKey,
  isUndoShortcut,
} from './utils/keyboard.js';
import { sanitizeExportFileName, sanitizeWorksheetName } from './utils/exportTitle.js';
import {
  buildTsvContent,
  parseClipboardTable,
  parseHtmlClipboardTable,
} from './services/clipboard.js';
import { StorageService } from './services/StorageService.js';
import { SpreadsheetModel } from './models/SpreadsheetModel.js';
import { UndoStack } from './models/UndoStack.js';
import { GridRenderer } from './ui/GridRenderer.js';
import { SheetTitleEditor } from './ui/SheetTitleEditor.js';
import { ContextMenu } from './ui/ContextMenu.js';
import { HelpGuide } from './ui/HelpGuide.js';

export class SpreadsheetApp {
  constructor() {
    this.model = new SpreadsheetModel(CONFIG);
    this.history = new UndoStack();
    this.storage = new StorageService();
    this.grid = new GridRenderer(this);
    this.editUndoRecorded = false;
    this.saveTimer = null;

    this.drag = {
      active: false,
      moved: false,
      kind: null,
      pointerDownOn: { row: 0, col: 0 },
      wasActiveBeforeDown: false,
    };

    this.contextMenu = new ContextMenu({
      model: this.model,
      onAction: (type, action, index) => this.handleContextMenuAction(type, action, index),
    });

    this.titleEditor = new SheetTitleEditor({
      model: this.model,
      onChange: () => this.scheduleSave(),
      onCommit: () => this.persist(),
    });

    this.helpGuide = new HelpGuide();

    this.refs = {
      coordinate: document.getElementById('cell-coordinate'),
      gridSize: document.getElementById('grid-size-label'),
      undoBtn: document.getElementById('undo-btn'),
      redoBtn: document.getElementById('redo-btn'),
      undoShortcutLabel: document.getElementById('undo-shortcut-label'),
      redoShortcutLabel: document.getElementById('redo-shortcut-label'),
      exportBtn: document.getElementById('export-btn'),
    };
  }

  init() {
    this.storage.load(this.model);
    this.titleEditor.applyToField();
    this.grid.render();
    this.model.clearSelection();
    this.bindGlobalEvents();
    this.setupHistoryButtons();
    this.refreshSelectionUI();
  }

  finishTitleEditIfActive() {
    if (this.titleEditor.isEditing()) {
      this.titleEditor.finishEdit(false);
    }
  }

  setupHistoryButtons() {
    const undoLabel = getUndoShortcutLabel();
    const redoLabel = getRedoShortcutLabel();

    if (this.refs.undoShortcutLabel) {
      this.refs.undoShortcutLabel.textContent = `(${undoLabel})`;
    }
    if (this.refs.redoShortcutLabel) {
      this.refs.redoShortcutLabel.textContent = `(${redoLabel})`;
    }
    if (this.refs.undoBtn) {
      this.refs.undoBtn.setAttribute('aria-label', `실행 취소 ${undoLabel}`);
      this.refs.undoBtn.title = `실행 취소 (${undoLabel})`;
      this.refs.undoBtn.addEventListener('click', () => this.undo());
    }
    if (this.refs.redoBtn) {
      this.refs.redoBtn.setAttribute('aria-label', `다시 실행 ${redoLabel}`);
      this.refs.redoBtn.title = `다시 실행 (${redoLabel})`;
      this.refs.redoBtn.addEventListener('click', () => this.redo());
    }

    this.updateHistoryButtons();
  }

  updateHistoryButtons() {
    if (this.refs.undoBtn) {
      this.refs.undoBtn.disabled = !this.history.canUndo();
    }
    if (this.refs.redoBtn) {
      this.refs.redoBtn.disabled = !this.history.canRedo();
    }
  }

  bindGlobalEvents() {
    this.refs.exportBtn?.addEventListener('click', () => this.export());

    document.addEventListener(
      'mousedown',
      (event) => {
        if (event.button !== 0) {
          return;
        }
        if (this.titleEditor.isEditing() && !event.target.closest('#sheet-title-wrap')) {
          this.finishTitleEditIfActive();
        }
        if (
          !event.target.closest('#spreadsheet') &&
          !event.target.closest('#context-menu') &&
          !event.target.closest('#help-guide-modal') &&
          !event.target.closest('#help-guide-btn') &&
          !event.target.closest('.toolbar-history')
        ) {
          this.clearCellSelection();
        }
      },
      true,
    );

    document.addEventListener('mousemove', (event) => this.handleDocumentMouseMove(event));
    document.addEventListener('mouseup', () => this.endDragSelection());

    document.addEventListener(
      'keydown',
      (event) => {
        if (!isGridKeyboardTarget(event)) {
          return;
        }
        if (isEditingCellInputEvent(event)) {
          return;
        }

        const arrowDelta = getArrowDelta(event.key);
        if (arrowDelta && isSelectModeCellInputEvent(event)) {
          event.preventDefault();
          event.stopPropagation();
          this.moveActiveCellBy(arrowDelta.row, arrowDelta.col, event.shiftKey);
          return;
        }

        if (isUndoShortcut(event)) {
          event.preventDefault();
          this.undo();
          return;
        }
        if (isRedoShortcut(event)) {
          event.preventDefault();
          this.redo();
          return;
        }
        if (this.model.mode === 'edit') {
          return;
        }
        if (isCopyShortcut(event)) {
          if (!this.model.hasSelection()) {
            return;
          }
          event.preventDefault();
          void this.copySelection();
          return;
        }
        if (isPasteShortcut(event)) {
          event.preventDefault();
          void this.pasteSelection();
          return;
        }

        if (arrowDelta) {
          event.preventDefault();
          this.moveActiveCellBy(arrowDelta.row, arrowDelta.col, event.shiftKey);
          return;
        }
        if (event.key === 'Backspace') {
          if (!this.model.hasSelection()) {
            return;
          }
          event.preventDefault();
          this.clearSelectedContent();
          return;
        }
        if (event.key === 'Enter') {
          if (!this.model.hasSelection()) {
            return;
          }
          event.preventDefault();
          const { row, col } = this.model.getActiveCell();
          this.model.anchor = { row, col };
          this.model.focus = { row, col };
          this.model.selectionKind = 'range';
          this.enterEditMode(row, col);
          return;
        }
        if (!this.model.hasSelection()) {
          return;
        }
        if (!isTypingKey(event)) {
          return;
        }
        // 활성 셀에 포커스된 선택 모드: beforeinput·IME만 처리 (선삽입 시 ㄱ가방 같은 중복 방지)
        if (isSelectModeCellInputEvent(event)) {
          return;
        }
        event.preventDefault();
        this.startTypingInActiveCell(event.key);
      },
      true,
    );
  }

  clearCellSelection() {
    if (!this.model.hasSelection() && this.model.mode !== 'edit') {
      return;
    }
    this.exitEditMode();
    this.blurActiveCellInput();
    this.model.clearSelection();
    this.refreshSelectionUI();
  }

  persist() {
    this.titleEditor.readFromFieldIfEditing();
    this.storage.save(this.model);
  }

  scheduleSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.persist();
      this.saveTimer = null;
    }, SAVE_DEBOUNCE_MS);
  }

  pushUndoSnapshot() {
    this.history.push(this.model.createSnapshot());
    this.updateHistoryButtons();
  }

  applySnapshot(snapshot) {
    this.model.applySnapshot(snapshot);
    this.editUndoRecorded = false;
    this.grid.render();
    this.persist();
    this.updateHistoryButtons();
  }

  syncActiveCellFromInput() {
    if (this.model.mode !== 'edit') {
      return;
    }
    const { row, col } = this.model.getActiveCell();
    const input = this.grid.getCellInput(row, col);
    if (input) {
      this.model.data[row][col] = input.value;
    }
  }

  ensureEditUndoSnapshot() {
    if (this.editUndoRecorded) {
      return;
    }
    this.pushUndoSnapshot();
    this.editUndoRecorded = true;
  }

  undo() {
    this.syncActiveCellFromInput();
    this.blurActiveCellInput();
    const snapshot = this.history.undo(this.model.createSnapshot());
    if (snapshot) {
      this.applySnapshot(snapshot);
      return;
    }
    this.updateHistoryButtons();
  }

  redo() {
    this.syncActiveCellFromInput();
    this.blurActiveCellInput();
    const snapshot = this.history.redo(this.model.createSnapshot());
    if (snapshot) {
      this.applySnapshot(snapshot);
      return;
    }
    this.updateHistoryButtons();
  }

  blurActiveCellInput() {
    if (document.activeElement?.classList.contains('cell-input')) {
      document.activeElement.blur();
    }
  }

  exitEditMode(row, col) {
    const { model } = this;
    if (model.mode !== 'edit') {
      return;
    }
    const active = model.getActiveCell();
    if (row !== undefined && col !== undefined && (active.row !== row || active.col !== col)) {
      return;
    }
    this.syncActiveCellFromInput();
    this.editUndoRecorded = false;
    model.mode = 'select';
    this.refreshSelectionUI();
  }

  refreshSelectionUI() {
    this.updateCoordinateDisplay();
    this.updateHeaderHighlights();
    this.updateCellsUI();
    this.updateGridSizeLabel();
    this.focusSelectedCellInput();
  }

  focusSelectedCellInput() {
    if (this.titleEditor.isEditing()) {
      return;
    }
    const active = document.activeElement;
    if (
      active?.closest('.toolbar') ||
      active?.closest('#sheet-title-wrap') ||
      active?.closest('#help-guide-modal')
    ) {
      return;
    }
    if (!this.model.hasSelection()) {
      return;
    }
    if (this.model.mode === 'edit' && !this.model.isSingleCellSelection()) {
      return;
    }
    if (this.model.mode === 'select' && !this.model.isSingleCellSelection()) {
      return;
    }
    const { row, col } = this.model.getActiveCell();
    this.grid.getCellInput(row, col)?.focus({ preventScroll: true });
  }

  updateGridSizeLabel() {
    if (this.refs.gridSize) {
      this.refs.gridSize.textContent = `${this.model.rows}행 × ${this.model.cols}열`;
    }
  }

  updateCoordinateDisplay() {
    if (!this.refs.coordinate) {
      return;
    }
    if (!this.model.hasSelection()) {
      this.refs.coordinate.textContent = '—';
      return;
    }
    const bounds = this.model.getSelectionBounds();
    if (!bounds) {
      this.refs.coordinate.textContent = '—';
      return;
    }
    if (bounds.rowMin === bounds.rowMax && bounds.colMin === bounds.colMax) {
      this.refs.coordinate.textContent = `Cell: ${formatCellAddress(bounds.rowMin, bounds.colMin)}`;
      return;
    }
    const start = formatCellAddress(bounds.rowMin, bounds.colMin);
    const end = formatCellAddress(bounds.rowMax, bounds.colMax);
    this.refs.coordinate.textContent = `Selection: ${start}:${end}`;
  }

  updateHeaderHighlights() {
    const bounds = this.model.getSelectionBounds();

    if (!bounds) {
      document.querySelectorAll('.col-header, .row-header').forEach((header) => {
        header.classList.remove('active');
      });
      return;
    }

    const singleCell = this.model.isSingleCellSelection();
    const activeCell = this.model.getActiveCell();
    const { selectionKind } = this.model;

    document.querySelectorAll('.col-header').forEach((header) => {
      const col = Number(header.dataset.col);
      header.classList.toggle(
        'active',
        isColumnHeaderActive(col, selectionKind, bounds, singleCell, activeCell),
      );
    });

    document.querySelectorAll('.row-header').forEach((header) => {
      const row = Number(header.dataset.row);
      header.classList.toggle(
        'active',
        isRowHeaderActive(row, selectionKind, bounds, singleCell, activeCell),
      );
    });
  }

  updateCellsUI() {
    const cells = document.querySelectorAll('.cell');
    const dragging = this.drag.active;

    if (!this.model.hasSelection()) {
      cells.forEach((cell) => {
        cell.classList.remove(
          'in-selection',
          'active-cell',
          'highlight-row',
          'highlight-col',
          'editing',
        );
        const input = cell.querySelector('.cell-input');
        if (!input) {
          return;
        }
        input.readOnly = true;
        GridRenderer.collapseInputSelection(input);
        GridRenderer.resetEditingInputLayout(input);
      });
      return;
    }

    const { row: activeRow, col: activeCol } = this.model.getActiveCell();
    const showRowColGuide =
      this.model.isSingleCellSelection() && this.model.selectionKind === 'range';
    const isEditing = this.model.mode === 'edit' && this.model.isSingleCellSelection();
    const isSingleCellSelect =
      this.model.mode === 'select' && this.model.isSingleCellSelection();

    cells.forEach((cell) => {
      const cellRow = Number(cell.dataset.row);
      const cellCol = Number(cell.dataset.col);
      const inSelection = this.model.isCellInSelection(cellRow, cellCol);
      const isActive = inSelection && cellRow === activeRow && cellCol === activeCol;

      cell.classList.toggle('in-selection', inSelection);
      cell.classList.toggle('active-cell', isActive);
      cell.classList.toggle('highlight-row', showRowColGuide && cellRow === activeRow);
      cell.classList.toggle('highlight-col', showRowColGuide && cellCol === activeCol);

      if (dragging) {
        return;
      }

      const editing =
        isEditing && cellRow === activeRow && cellCol === activeCol && inSelection;
      const isActiveCell =
        isSingleCellSelect && cellRow === activeRow && cellCol === activeCol && inSelection;

      cell.classList.toggle('editing', editing);
      const input = cell.querySelector('.cell-input');
      if (!input) {
        return;
      }
      input.readOnly = !editing && !isActiveCell;
      if (editing) {
        if (!GridRenderer.isInputComposing(input)) {
          GridRenderer.updateCellInputLayout(input);
        }
      } else {
        GridRenderer.collapseInputSelection(input);
        GridRenderer.resetEditingInputLayout(input);
      }
    });
  }

  selectEntireSheet() {
    this.finishTitleEditIfActive();
    this.exitEditMode();
    this.model.selectEntireSheet();
    this.blurActiveCellInput();
    this.refreshSelectionUI();
  }

  beginDragSelection(kind, row, col, extend = false) {
    this.finishTitleEditIfActive();

    const { model } = this;
    this.exitEditMode();

    if (kind === 'cell') {
      const activeCell = model.getActiveCell();
      this.drag.wasActiveBeforeDown =
        model.mode === 'select' &&
        model.hasSelection() &&
        model.isSingleCellSelection() &&
        model.selectionKind === 'range' &&
        activeCell.row === row &&
        activeCell.col === col &&
        model.anchor.row === row &&
        model.anchor.col === col;
    } else {
      this.drag.wasActiveBeforeDown = false;
    }

    this.blurActiveCellInput();

    if (kind === 'cell') {
      if (extend) {
        model.focus = { row, col };
        model.selectionKind = 'range';
      } else {
        model.anchor = { row, col };
        model.focus = { row, col };
        model.selectionKind = 'range';
      }
    } else if (kind === 'row') {
      if (extend) {
        model.focus = { row, col: 0 };
      } else {
        model.anchor = { row, col: 0 };
        model.focus = { row, col: 0 };
      }
      model.selectionKind = 'row';
    } else if (kind === 'column') {
      if (extend) {
        model.focus = { row: 0, col };
      } else {
        model.anchor = { row: 0, col };
        model.focus = { row: 0, col };
      }
      model.selectionKind = 'column';
    }

    this.drag.active = true;
    this.drag.moved = false;
    this.drag.kind = kind;
    this.drag.pointerDownOn = { row, col };
    document.body.classList.add('is-dragging');
    this.refreshSelectionUI();
  }

  updateDragSelection(row, col) {
    if (!this.drag.active) {
      return;
    }

    const { model } = this;
    const nextRow = Math.max(0, Math.min(row, model.rows - 1));
    const nextCol = Math.max(0, Math.min(col, model.cols - 1));

    if (this.drag.kind === 'cell') {
      if (model.focus.row === nextRow && model.focus.col === nextCol) {
        return;
      }
      this.drag.moved = true;
      model.focus = { row: nextRow, col: nextCol };
      model.selectionKind = 'range';
    } else if (this.drag.kind === 'row') {
      if (model.focus.row === nextRow) {
        return;
      }
      this.drag.moved = true;
      model.focus = { row: nextRow, col: 0 };
      model.selectionKind = 'row';
    } else if (this.drag.kind === 'column') {
      if (model.focus.col === nextCol) {
        return;
      }
      this.drag.moved = true;
      model.focus = { row: 0, col: nextCol };
      model.selectionKind = 'column';
    }

    this.refreshSelectionUI();
  }

  endDragSelection() {
    if (!this.drag.active) {
      return;
    }

    const wasDragging = this.drag.active;
    const { moved, kind, wasActiveBeforeDown, pointerDownOn } = this.drag;

    this.drag.active = false;
    this.drag.moved = false;
    this.drag.kind = null;
    document.body.classList.remove('is-dragging');

    if (!moved && kind === 'cell' && wasActiveBeforeDown) {
      this.refreshSelectionUI();
      this.enterEditMode(pointerDownOn.row, pointerDownOn.col, { selectAll: true });
      return;
    }

    if (wasDragging) {
      this.refreshSelectionUI();
    }
  }

  handleDocumentMouseMove(event) {
    if (!this.drag.active) {
      return;
    }
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target) {
      return;
    }

    const cell = target.closest('.cell');
    const rowHeader = target.closest('.row-header');
    const colHeader = target.closest('.col-header');

    if (this.drag.kind === 'cell' && cell) {
      const coords = this.getCellCoordsFromElement(cell);
      if (coords) {
        this.updateDragSelection(coords.row, coords.col);
      }
    } else if (this.drag.kind === 'row' && rowHeader) {
      const row = Number(rowHeader.dataset.row);
      if (!Number.isNaN(row)) {
        this.updateDragSelection(row, 0);
      }
    } else if (this.drag.kind === 'column' && colHeader) {
      const col = Number(colHeader.dataset.col);
      if (!Number.isNaN(col)) {
        this.updateDragSelection(0, col);
      }
    }
  }

  getCellCoordsFromElement(cell) {
    let row = Number(cell.dataset.row);
    let col = Number(cell.dataset.col);
    if (!Number.isNaN(row) && !Number.isNaN(col)) {
      return { row, col };
    }
    const id = cell.querySelector('.cell-input')?.id ?? '';
    const match = /^cell-input-(\d+)-(\d+)$/.exec(id);
    if (!match) {
      return null;
    }
    return { row: Number(match[1]), col: Number(match[2]) };
  }

  enterEditMode(row, col, { selectAll = false } = {}) {
    if (!this.model.isCellInSelection(row, col)) {
      return;
    }

    this.editUndoRecorded = false;
    this.model.mode = 'edit';
    this.model.anchor = { row, col };
    this.model.focus = { row, col };
    this.model.selectionKind = 'range';
    this.refreshSelectionUI();

    const input = this.grid.getCellInput(row, col);
    const cell = input?.closest('.cell');
    input?.focus();
    if (selectAll && input?.value) {
      input.select();
    }
    if (input && cell && selectAll) {
      requestAnimationFrame(() => {
        if (GridRenderer.isInputComposing(input)) {
          return;
        }
        GridRenderer.resetEditingInputLayout(input);
        if (GridRenderer.needsEditingOverlay(input, cell)) {
          GridRenderer.layoutEditingInput(input, cell);
        }
      });
    }
  }

  /**
   * 선택 모드에서 활성 셀에 입력이 들어오기 직전 편집 전환·덮어쓰기.
   * beforeinput에서 호출(IME 조합 전). select()·전체 refresh는 하지 않음.
   */
  prepareCellEditFromInput(row, col, { expectComposition = false } = {}) {
    if (this.model.mode === 'edit' || !this.model.isCellInSelection(row, col)) {
      return;
    }

    this.pushUndoSnapshot();
    this.editUndoRecorded = true;
    this.model.mode = 'edit';
    this.model.anchor = { row, col };
    this.model.focus = { row, col };
    this.model.selectionKind = 'range';

    const input = this.grid.getCellInput(row, col);
    if (!input) {
      return;
    }

    if (input.value) {
      input.value = '';
      this.model.data[row][col] = '';
    }

    if (expectComposition) {
      input.dataset.imeComposing = 'true';
    }
    input.readOnly = false;
    input.closest('.cell')?.classList.add('editing');
    input.setSelectionRange(0, 0);

    queueMicrotask(() => this.refreshSelectionUI());
  }

  startTypingInActiveCell(char) {
    const { row, col } = this.model.getActiveCell();
    this.pushUndoSnapshot();
    this.editUndoRecorded = true;

    this.model.anchor = { row, col };
    this.model.focus = { row, col };
    this.model.selectionKind = 'range';
    this.model.data[row][col] = char;

    const input = this.grid.getCellInput(row, col);
    if (input) {
      input.value = char;
    }

    this.model.mode = 'edit';
    this.refreshSelectionUI();
    input?.focus();
    input?.setSelectionRange(char.length, char.length);
    if (input) {
      const cell = input.closest('.cell');
      if (cell && !GridRenderer.isInputComposing(input)) {
        GridRenderer.resetEditingInputLayout(input);
        if (GridRenderer.needsEditingOverlay(input, cell)) {
          GridRenderer.layoutEditingInput(input, cell);
        }
      }
    }
    this.scheduleSave();
  }

  moveActiveCellBy(deltaRow, deltaCol, extend = false) {
    if (!this.model.hasSelection()) {
      this.model.setRangeSelection({ row: 0, col: 0 }, { row: 0, col: 0 });
      if (deltaRow === 0 && deltaCol === 0) {
        this.refreshSelectionUI();
        return;
      }
    }

    const activeCell = this.model.getActiveCell();
    const nextRow = Math.max(0, Math.min(activeCell.row + deltaRow, this.model.rows - 1));
    const nextCol = Math.max(0, Math.min(activeCell.col + deltaCol, this.model.cols - 1));

    this.exitEditMode();
    this.blurActiveCellInput();

    if (extend) {
      this.model.focus = { row: nextRow, col: nextCol };
      this.model.selectionKind = 'range';
    } else {
      this.model.anchor = { row: nextRow, col: nextCol };
      this.model.focus = { row: nextRow, col: nextCol };
      this.model.selectionKind = 'range';
    }
    this.refreshSelectionUI();
  }

  handleCellInput(row, col, value) {
    this.ensureEditUndoSnapshot();
    this.model.data[row][col] = value;
    this.scheduleSave();
  }

  finishEditAndMoveDown(row, col) {
    const input = this.grid.getCellInput(row, col);
    if (input) {
      this.handleCellInput(row, col, input.value);
    }

    this.exitEditMode(row, col);
    this.blurActiveCellInput();

    const nextRow = Math.min(row + 1, this.model.rows - 1);
    this.model.anchor = { row: nextRow, col };
    this.model.focus = { row: nextRow, col };
    this.model.selectionKind = 'range';
    this.refreshSelectionUI();
  }

  clearSelectedContent() {
    if (!this.model.hasSelection()) {
      return;
    }
    this.pushUndoSnapshot();
    this.model.clearSelectionContent();
    const bounds = this.model.getSelectionBounds();
    if (!bounds) {
      return;
    }
    for (let row = bounds.rowMin; row <= bounds.rowMax; row += 1) {
      for (let col = bounds.colMin; col <= bounds.colMax; col += 1) {
        const input = this.grid.getCellInput(row, col);
        if (input) {
          input.value = '';
        }
      }
    }
    this.persist();
  }

  async copySelection() {
    if (!this.model.hasSelection()) {
      return;
    }
    const tsv = buildTsvContent(this.model.getSelectionDataForCopy());
    await navigator.clipboard.writeText(tsv);
  }

  async pasteSelection() {
    if (!this.model.hasSelection()) {
      this.model.setRangeSelection({ row: 0, col: 0 }, { row: 0, col: 0 });
      this.refreshSelectionUI();
    }
    const { row, col } = this.model.getActiveCell();

    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        if (!item.types.includes('text/html')) {
          continue;
        }
        const blob = await item.getType('text/html');
        const htmlTable = parseHtmlClipboardTable(await blob.text());
        if (htmlTable.length) {
          this.pasteTable(row, col, htmlTable);
          return;
        }
      }
    } catch {
      // HTML 읽기 실패 시 plain text 시도
    }

    try {
      const text = await navigator.clipboard.readText();
      const table = parseClipboardTable(text);
      if (table.length) {
        this.pasteTable(row, col, table);
      }
    } catch {
      // clipboard 접근 실패
    }
  }

  pasteTable(startRow, startCol, table) {
    this.pushUndoSnapshot();
    this.model.pasteTableAt(startRow, startCol, table);
    this.blurActiveCellInput();
    this.grid.render();
    this.persist();
  }

  mutateGrid(mutator) {
    this.pushUndoSnapshot();
    mutator();
    this.grid.render();
    this.persist();
  }

  handleContextMenuAction(type, action, index) {
    if (type === 'row') {
      const ctx = this.model.getRowInsertContext(index);
      if (action === 'row-below') {
        this.mutateGrid(() => this.model.insertRowsAt(ctx.belowIndex, ctx.count));
      } else if (action === 'row-above') {
        this.mutateGrid(() => this.model.insertRowsAt(ctx.aboveIndex, ctx.count));
      } else if (action === 'row-delete') {
        this.deleteRows(index);
      }
      return;
    }

    if (type === 'column') {
      const ctx = this.model.getColumnInsertContext(index);
      if (action === 'col-right') {
        this.mutateGrid(() => this.model.insertColumnsAt(ctx.rightIndex, ctx.count));
      } else if (action === 'col-left') {
        this.mutateGrid(() => this.model.insertColumnsAt(ctx.leftIndex, ctx.count));
      } else if (action === 'col-delete') {
        this.deleteColumns(index);
      }
    }
  }

  deleteRows(contextIndex) {
    const { model } = this;
    const span = model.getRowSpanForHeaderMenu(contextIndex);
    if (span.count > 1) {
      this.mutateGrid(() => model.deleteRowRange(span.rowMin, span.count));
      return;
    }
    if (model.rows <= 1) {
      return;
    }
    this.mutateGrid(() => model.deleteRowAt(span.rowMin));
  }

  deleteColumns(contextIndex) {
    const { model } = this;
    const span = model.getColumnSpanForHeaderMenu(contextIndex);
    if (span.count > 1) {
      this.mutateGrid(() => model.deleteColumnRange(span.colMin, span.count));
      return;
    }
    if (model.cols <= 1) {
      return;
    }
    this.mutateGrid(() => model.deleteColumnAt(span.colMin));
  }

  export() {
    if (typeof XLSX === 'undefined') {
      window.alert('Excel보내기 라이브러리를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.');
      return;
    }

    this.finishTitleEditIfActive();
    const data = this.model.collectData();
    const sheetName = sanitizeWorksheetName(this.model.title);
    const filename = `${sanitizeExportFileName(this.model.title)}.xlsx`;
    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, filename);
  }
}

function isColumnHeaderActive(col, selectionKind, bounds, singleCell, activeCell) {
  if (selectionKind === 'column') {
    return col >= bounds.colMin && col <= bounds.colMax;
  }
  if (selectionKind === 'sheet') {
    return true;
  }
  if (selectionKind !== 'row' && singleCell) {
    return col === activeCell.col;
  }
  if (selectionKind === 'range' && !singleCell) {
    return col >= bounds.colMin && col <= bounds.colMax;
  }
  return false;
}

function isRowHeaderActive(row, selectionKind, bounds, singleCell, activeCell) {
  if (selectionKind === 'row') {
    return row >= bounds.rowMin && row <= bounds.rowMax;
  }
  if (selectionKind === 'sheet') {
    return true;
  }
  if (selectionKind !== 'column' && singleCell) {
    return row === activeCell.row;
  }
  if (selectionKind === 'range' && !singleCell) {
    return row >= bounds.rowMin && row <= bounds.rowMax;
  }
  return false;
}
