export class ContextMenu {
  constructor({ model, onAction }) {
    this.model = model;
    this.onAction = onAction;
    this.menu = document.getElementById('context-menu');
    this.state = { type: null, index: null };
    this.bindEvents();
  }

  bindEvents() {
    if (!this.menu) {
      return;
    }

    this.menu.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) {
        return;
      }
      const { type, index } = this.state;
      this.hide();
      this.onAction(type, button.dataset.action, index);
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('#context-menu')) {
        this.hide();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.hide();
      }
    });

    window.addEventListener('scroll', () => this.hide(), true);
    window.addEventListener('resize', () => this.hide());
  }

  getRowItems(index) {
    const { count } = this.model.getRowSpanForHeaderMenu(index);
    const countLabel = count > 1 ? ` ${count}개` : '';
    return [
      { action: 'row-above', label: `위에 행${countLabel} 추가` },
      { action: 'row-below', label: `아래에 행${countLabel} 추가` },
      { action: 'row-delete', label: count > 1 ? `행 삭제 (${count}개)` : '행 삭제', danger: true },
    ];
  }

  getColItems(index) {
    const { count } = this.model.getColumnSpanForHeaderMenu(index);
    const countLabel = count > 1 ? ` ${count}개` : '';
    return [
      { action: 'col-left', label: `왼쪽에 열${countLabel} 추가` },
      { action: 'col-right', label: `오른쪽에 열${countLabel} 추가` },
      { action: 'col-delete', label: count > 1 ? `열 삭제 (${count}개)` : '열 삭제', danger: true },
    ];
  }

  hide() {
    if (!this.menu) {
      return;
    }
    this.menu.classList.add('hidden');
    this.menu.style.visibility = '';
    this.state.type = null;
    this.state.index = null;
  }

  show(type, index, x, y) {
    if (!this.menu) {
      return;
    }

    const items = type === 'row' ? this.getRowItems(index) : this.getColItems(index);
    this.menu.replaceChildren(
      ...items.map((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = item.label;
        button.dataset.action = item.action;
        if (item.danger) {
          button.classList.add('danger');
        }
        return button;
      }),
    );

    this.state = { type, index };
    this.position(x, y, type, index);
  }

  position(x, y, type, index) {
    this.menu.classList.remove('hidden');
    this.menu.style.visibility = 'hidden';
    this.menu.style.left = '0';
    this.menu.style.top = '0';

    const menuWidth = this.menu.offsetWidth;
    const menuHeight = this.menu.offsetHeight;
    const padding = 8;
    let left = x;
    let top = y;

    if (type === 'column' && index === this.model.cols - 1) {
      left = x - menuWidth;
    }
    if (type === 'row' && index === this.model.rows - 1) {
      top = y - menuHeight;
    }

    left = Math.max(padding, Math.min(left, window.innerWidth - menuWidth - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - menuHeight - padding));

    this.menu.style.left = `${left}px`;
    this.menu.style.top = `${top}px`;
    this.menu.style.visibility = '';
  }
}
