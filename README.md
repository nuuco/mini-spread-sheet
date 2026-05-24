# Mini Spreadsheet

JavaScript로 만든 미니 스프레드시트 웹 애플리케이션입니다. 셀 입력, 범위·행·열 선택, 포커스 좌표 표시, 행/열 헤더 하이라이트, 데이터 수집, Excel(.xlsx) Export, 실행 취소, 복사·붙여넣기, localStorage 자동 저장을 제공합니다.

요구사항 상세는 [docs/PRD.md](docs/PRD.md), [docs/SRD.md](docs/SRD.md), [docs/TRD.md](docs/TRD.md)를 참고하세요.

## 기능 목록

### 필수 기능

1. **셀 그리드 렌더링** — 열 A, B, … / 행 1, 2, … 형태의 표 UI
2. **셀 값 입력** — `textarea` 기반 텍스트 입력 (Cmd/Ctrl+Enter로 줄바꿈)
3. **포커스·선택 좌표 표시** — `Cell: C1` 또는 `Selection: A1:C3`
4. **행/열 헤더 하이라이트** — 단일 셀 선택 시 해당 열·행 헤더 동시 강조
5. **데이터 구조화 수집** — 2차원 배열 `string[][]` (`collectSpreadsheetData`)
6. **Export 기능** — SheetJS로 Excel 파일(`.xlsx`) 다운로드

### 선택·확장 기능

- **시트 제목** — 툴바 클릭 편집, 기본 「제목없음」, Export 시 파일명·시트 탭명에 반영 (본문 데이터에는 제목 행 없음)
- **행/열 추가·삭제** — 행·열 **헤더 오른클릭** 컨텍스트 메뉴 (다중 행·열 선택 시 일괄 처리)
- **범위 선택** — 셀 드래그, Shift+화살표, 행/열 헤더·코너(전체 시트) 선택
- **실행 취소/다시 실행** — Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y (최대 100단계)
- **복사·붙여넣기** — TSV 복사, HTML 표·TSV·마크다운 표 붙여넣기 (부족 시 그리드 자동 확장)
- **localStorage 자동 저장** — 데이터·그리드 크기·제목 (300ms debounce)
- **UI** — 선택 셀·범위 스타일, 툴바 2행 레이아웃, `N행 × M열` 표시

## 실행 방법

1. 저장소 클론 또는 다운로드
2. 아래 중 하나로 실행:
   - `index.html`을 브라우저에서 직접 열기
   - 로컬 서버: `npx serve .` 후 안내 URL 접속

> **Export:** SheetJS는 CDN에서 로드됩니다. Excel보내기 시 네트워크 연결이 필요합니다.

## 그리드 크기 변경

[`app.js`](app.js) 상단 `CONFIG`로 **초기** 크기를 바꿉니다.

```javascript
const CONFIG = {
  defaultRows: 5,
  defaultCols: 5,
};
```

**런타임**에는 행·열 **헤더를 오른클릭**해 위/아래·왼쪽/오른쪽에 추가하거나 삭제합니다. 툴바에 `N행 × M열`이 표시됩니다. 붙여넣기로 필요한 만큼 행·열도 자동 확장됩니다.

## 키보드·마우스 (요약)

| 동작 | 입력 |
|------|------|
| 셀 편집 시작 | 셀 재클릭 또는 문자 입력 |
| 아래로 이동 | Enter |
| 셀 내 줄바꿈 | Cmd/Ctrl + Enter |
| 범위 확장 | Shift + 화살표 / Shift + 드래그 |
| 전체 시트 선택 | 좌상단 코너 클릭 |
| 복사 / 붙여넣기 | Cmd/Ctrl+C / Cmd/Ctrl+V |
| 실행 취소 / 다시 실행 | Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z 또는 Ctrl+Y |
| 선택 영역 비우기 | Backspace |
| 행·열 메뉴 | 행·열 헤더 **오른클릭** |

## Export 및 Google Sheets 검증

1. 데이터 입력 (선택: 툴바에서 시트 제목 편집)
2. **Export Excel** 클릭 → `{제목}.xlsx` 다운로드 (제목 없으면 `spreadsheet.xlsx`)
3. Excel에서 열거나 [Google Sheets](https://sheets.google.com) → **파일 → 가져오기 → 업로드**
4. 시트 **본문** 셀 위치·값이 그리드와 같은지 확인 (파일명·탭명만 제목 반영)

## 파일 구조

```
├── index.html       # DOM, SheetJS CDN
├── style.css        # 스타일
├── app.js           # 로직
├── README.md
├── AGENTS.md
├── docs/
│   ├── PRD.md
│   ├── SRD.md
│   ├── TRD.md
│   ├── PROMPT_LOG.md
│   └── screenshots/
└── exports/         # (수동) Export 샘플
```

## app.js 주요 함수

| 함수 | 역할 |
|------|------|
| `initSpreadsheet()` | 초기화·이벤트 바인딩 |
| `renderGrid()` | 그리드 DOM 생성 |
| `updateSelectionUI()` | 좌표·헤더·선택·크기 라벨 동기화 |
| `collectSpreadsheetData()` | 2D 배열 반환 |
| `exportSpreadsheet()` | Excel(.xlsx) 다운로드 |
| `saveToLocalStorage()` / `loadFromLocalStorage()` | 자동 저장/복원 |
| `undoSpreadsheet()` / `redoSpreadsheet()` | 실행 취소/다시 실행 |
| `copySelectionToClipboard()` / `pasteFromClipboard()` | 복사·붙여넣기 |
| `insertRowsAt()` / `deleteSelectedRows()` 등 | 행·열 조작 |

## 제출 전 체크리스트

- [ ] 표 화면이 정상적으로 잘 나오나요?
- [ ] 칸마다 텍스트 입력이 잘 되나요?
- [ ] 셀 선택 시 좌표가 바뀌고, 단일 셀일 때 가로/세로 헤더가 동시에 강조되나요?
- [ ] Excel 파일이 정상적으로 만들어지고 Google Sheets에 올렸을 때도 잘 연동되나요?
- [ ] 새로고침 후 데이터·제목·그리드 크기가 유지되나요?
- [ ] 코드가 HTML/CSS/JS로 분리되어 있나요?
- [ ] README와 `docs/PROMPT_LOG.md`를 포함했나요?

## 기술 스택

- HTML5, CSS3, Vanilla JavaScript
- [SheetJS](https://sheetjs.com/) (CDN, Excel Export 전용)
