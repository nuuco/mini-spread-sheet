export class ResetConfirmModal {
  constructor({ onConfirm } = {}) {
    this.onConfirm = onConfirm;
    this.modal = document.getElementById('reset-confirm-modal');
    this.openBtn = document.getElementById('reset-btn');
    this.cancelBtn = document.getElementById('reset-confirm-cancel');
    this.confirmBtn = document.getElementById('reset-confirm-ok');
    this.backdrop = this.modal?.querySelector('.reset-confirm-backdrop');
    this.isOpen = false;
    this.bindEvents();
  }

  bindEvents() {
    this.openBtn?.addEventListener('click', () => this.open());
    this.cancelBtn?.addEventListener('click', () => this.close());
    this.backdrop?.addEventListener('click', () => this.close());
    this.confirmBtn?.addEventListener('click', () => {
      this.close();
      this.onConfirm?.();
    });

    document.addEventListener('keydown', (event) => {
      if (!this.isOpen) {
        return;
      }
      if (event.key === 'Escape') {
        this.close();
      }
    });
  }

  open() {
    if (!this.modal) {
      return;
    }
    this.isOpen = true;
    this.modal.classList.remove('hidden');
    this.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('reset-confirm-open');
    this.cancelBtn?.focus();
  }

  close() {
    if (!this.modal) {
      return;
    }
    this.isOpen = false;
    this.modal.classList.add('hidden');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('reset-confirm-open');
    this.openBtn?.focus();
  }
}
