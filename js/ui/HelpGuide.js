const GUIDE_ROWS = [
  {
    feature: '시트 제목',
    description:
      '맨 위 제목을 클릭해 바꿀 수 있습니다. 비워 두면 「제목없음」으로 저장됩니다.',
  },
  {
    feature: '셀·범위 선택',
    description:
      '셀을 클릭하거나 드래그하면 원하는 칸·범위를 고를 수 있어요. Shift를 누른 채 클릭하거나 방향키를 쓰면 선택을 더 넓힐 수 있습니다.',
  },
  {
    feature: '행·열 선택',
    description:
      '왼쪽 행 번호나 위쪽 열 이름(A, B…)을 클릭·드래그하면 그 행·열 전체를 한꺼번에 선택할 수 있어요.',
  },
  {
    feature: '전체 시트 선택',
    description: '표 왼쪽 위 모서리 칸을 누르면 시트 전체가 선택됩니다.',
  },
  {
    feature: '실행 취소·다시 실행',
    description:
      '셀을 고치거나 지우고, 행·열을 추가·삭제한 뒤에도 실행 취소로 되돌릴 수 있어요. 붙여넣기도 포함되며, 최대 100단계까지 가능합니다.',
  },
  {
    feature: '행·열 추가·삭제',
    description:
      '행 번호나 열 헤더에서 오른쪽 클릭하면 추가·삭제 메뉴가 나옵니다. 여러 행·열을 먼저 골라 두면, 선택한 개수만큼 한 번에 넣거나 지울 수 있어요.',
  },
  {
    feature: '복사·붙여넣기',
    description:
      'Excel이나 다른 표에서 복사한 내용을 그대로 붙여 넣을 수 있습니다. 붙여 넣을 자리가 부족하면 행·열이 알아서 늘어납니다.',
  },
  {
    feature: 'Excel Export',
    description:
      'Export Excel 버튼을 누르면 .xlsx 파일로 저장됩니다. 파일 이름과 시트 탭에는 맨 위에 적은 시트 제목이 들어갑니다.',
  },
  {
    feature: '자동 저장',
    description:
      '입력한 내용은 브라우저에 자동으로 저장되니, 새로고침해도 그대로 남아 있어요.',
  },
  {
    feature: '시트 초기화',
    description:
      '다시 실행 버튼 옆 초기화 버튼을 누르면 확인 창이 뜹니다. 확인하면 제목·데이터·실행 취소 기록이 모두 지워지고 빈 5×5 시트로 돌아갑니다.',
  },
];

export class HelpGuide {
  constructor() {
    this.modal = document.getElementById('help-guide-modal');
    this.openBtn = document.getElementById('help-guide-btn');
    this.closeBtn = document.getElementById('help-guide-close');
    this.backdrop = this.modal?.querySelector('.help-guide-backdrop');
    this.list = document.getElementById('help-guide-list');
    this.isOpen = false;

    this.renderList();
    this.bindEvents();
  }

  renderList() {
    if (!this.list) {
      return;
    }

    this.list.replaceChildren(
      ...GUIDE_ROWS.map((row) => {
        const item = document.createElement('li');
        item.className = 'help-guide-item';

        const feature = document.createElement('div');
        feature.className = 'help-guide-feature';
        feature.textContent = row.feature;

        const description = document.createElement('p');
        description.className = 'help-guide-desc';
        description.textContent = row.description;

        item.append(feature, description);
        return item;
      }),
    );
  }

  bindEvents() {
    this.openBtn?.addEventListener('click', () => this.open());
    this.closeBtn?.addEventListener('click', () => this.close());
    this.backdrop?.addEventListener('click', () => this.close());

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.isOpen) {
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
    document.body.classList.add('help-guide-open');
    this.closeBtn?.focus();
  }

  close() {
    if (!this.modal) {
      return;
    }
    this.isOpen = false;
    this.modal.classList.add('hidden');
    this.modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('help-guide-open');
    this.openBtn?.focus();
  }
}
