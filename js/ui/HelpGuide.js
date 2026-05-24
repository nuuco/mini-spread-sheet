const GUIDE_ROWS = [
  {
    feature: '셀·범위 선택',
    description: '셀 클릭·드래그로 범위 선택. Shift+클릭/방향키로 범위 확장',
  },
  {
    feature: '행·열 선택',
    description: '행 번호·열 헤더 클릭·드래그로 여러 행/열 선택',
  },
  {
    feature: '전체 시트',
    description: '좌상단 모서리 칸 클릭',
  },
  {
    feature: '편집',
    description:
      'Enter / 같은 셀 다시 클릭 / 선택 후 입력. 편집 중 Enter → 아래 셀, Cmd·Ctrl+Enter → 줄바꿈',
  },
  {
    feature: '실행 취소·다시 실행',
    description: '셀 수정·삭제, 행/열 추가·삭제, 붙여넣기 등 최대 100단계 되돌리기',
  },
  {
    feature: '행·열 추가·삭제',
    description:
      '행 번호·열 헤더 오른쪽 클릭 메뉴. 여러 행/열 선택 시 선택 개수만큼 일괄 추가·삭제',
  },
  {
    feature: '복사·붙여넣기',
    description: 'Excel·표·TSV 등 표 데이터 붙여넣기 가능. 범위가 크면 행·열 자동 확장',
  },
  {
    feature: 'Excel Export',
    description: 'Export Excel → .xlsx 다운로드 (파일명·시트 탭에 시트 제목 반영)',
  },
  {
    feature: '자동 저장',
    description: '입력·구조 변경 내용 브라우저에 자동 저장 (새로고침 후 유지)',
  },
  {
    feature: '시트 제목',
    description: '툴바 제목 클릭 후 편집 (비우면 「제목없음」)',
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

        const feature = document.createElement('span');
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
