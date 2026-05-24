# Mini Spreadsheet

JavaScript로 만든 미니 스프레드시트 웹 애플리케이션입니다. 셀 입력, 포커스 좌표 표시, 행/열 헤더 하이라이트, 데이터 수집, Excel Export 기능을 제공합니다.

## 기능 목록

### 필수 기능

1. **셀 그리드 렌더링** — A~E 열, 1~N 행 형태의 표 UI
2. **셀 값 입력** — 각 셀 클릭 후 텍스트/숫자 입력
3. **현재 포커스 좌표 표시** — 상단 `Cell: C1` 형식으로 표시
4. **행/열 헤더 하이라이트** — 선택 셀의 열·행 헤더 동시 강조
5. **데이터 구조화 수집** — 2차원 배열 `string[][]` 형태로 수집
6. **Export 기능** — Excel 파일(`spreadsheet.xlsx`) 다운로드 (SheetJS 사용)

### 선택 기능

- 행/열 추가·삭제
- UI 스타일 개선 (선택 셀, 헤더, 버튼)
- localStorage 자동 저장 (새로고침 후 데이터 유지)

## 실행 방법

1. 저장소 클론 또는 다운로드
2. 아래 중 하나로 실행:
   - `index.html` 파일을 브라우저에서 직접 열기
   - 로컬 서버 사용: `npx serve .` 후 브라우저에서 안내 URL 접속

## 그리드 크기 변경

[`app.js`](app.js) 상단의 `CONFIG` 상수를 수정합니다.

```javascript
const CONFIG = {
  defaultRows: 5,
  defaultCols: 5,
};
```

런타임에는 **행·열 헤더를 오른클릭**하여 위/아래(왼쪽/오른쪽)에 행·열을 추가하거나 삭제할 수 있습니다. 툴바에 현재 `N행 × M열` 크기가 표시됩니다.

## Export 및 Google Sheets 검증

1. 스프레드시트에 데이터 입력
2. **Export Excel** 버튼 클릭 → `spreadsheet.xlsx` 다운로드 (제목이 있으면 `{제목}.xlsx`)
3. Excel에서 열거나, [Google Sheets](https://sheets.google.com) → **파일 → 가져오기 → 업로드** 로 업로드
4. 데이터 위치가 그리드와 동일한지 확인

## 파일 구조

```
├── index.html       # DOM 구조
├── style.css        # 스타일
├── app.js           # 로직 (1함수 1역할)
├── README.md        # 프로젝트 설명
├── AGENTS.md        # 작업 이력
├── docs/
│   ├── PROMPT_LOG.md
│   └── screenshots/ # (수동) 캡처 저장
└── exports/
    └── spreadsheet.xlsx # (수동) Export 샘플
```

## app.js 주요 함수

| 함수 | 역할 |
|------|------|
| `initSpreadsheet()` | 초기화 및 이벤트 바인딩 |
| `renderGrid()` | 그리드 DOM 생성 |
| `setFocus()` | 포커스 상태 및 UI 동기화 |
| `collectSpreadsheetData()` | 2D 배열 데이터 반환 |
| `exportSpreadsheet()` | Excel(.xlsx) 다운로드 |
| `saveToLocalStorage()` / `loadFromLocalStorage()` | 자동 저장/복원 |
| `addRow()` / `removeRow()` / `addColumn()` / `removeColumn()` | 행·열 조작 |

## 제출 전 체크리스트

- [ ] 표 화면이 정상적으로 잘 나오나요?
- [ ] 칸마다 텍스트 입력이 잘 되나요?
- [ ] 셀을 누르면 좌표가 잘 바뀌고 가로/세로 헤더가 동시에 강조되나요?
- [ ] Excel 파일이 정상적으로 만들어지고 Google Sheets에 올렸을 때도 잘 연동되나요?
- [ ] 코드 파일이 HTML/CSS/JS로 분리되어 있나요?
- [ ] README와 AI 프롬프트 로그(`docs/PROMPT_LOG.md`)를 포함했나요?

## 기술 스택

- HTML5, CSS3, Vanilla JavaScript (외부 라이브러리 없음)
