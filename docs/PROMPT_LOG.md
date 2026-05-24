# AI 프롬프트 사용 기록

과제 제출용 AI 활용 로그입니다.

---

## 기본 구현 프롬프트

### 프롬프트 1: 과제 분석 및 계획

**요청 내용:**
- PDF 과제 요구사항(필수 6기능 + 선택 기능) 기반 구현 계획 수립
- 의사결정 필요 항목 질문

**의사결정:**
- 그리드 크기: `app.js` CONFIG 상수 + 런타임 행/열 추가·삭제
- 선택 기능: localStorage, 행/열 조작, 스타일 모두 포함
- Export: 순수 JS CSV (외부 라이브러리 없음)

**AI 응답 요약:**
- index.html / style.css / app.js 3파일 구조
- 1함수 1역할 원칙으로 app.js 함수 분리
- UTF-8 BOM CSV로 Excel·Google Sheets 호환

---

### 프롬프트 2: 계획대로 구현

**요청 내용:**
- 첨부된 계획 파일 기준 전체 구현
- README, AGENTS.md, PROMPT_LOG 포함

**적용 결과:**
- 필수 6기능 + 선택 3기능 구현 완료
- 제출용 문서 및 디렉터리 구조 생성

---

## 추가 개선 프롬프트

---

- 프롬프트:

```
.app 영역을 전체 너비로 쓰고 싶어. 지금은 좌우 여백이 너무 많고 그리드 너비도 좁아.
```

> 의도/반영: `style.css`에서 `.app`의 `max-width: 720px`·바깥 margin·box-shadow 제거, `width: 100%`로 전환. 그리드는 `table-layout: fixed`로 데이터 열이 남은 너비를 균등 분배하고, 셀 고정 80px 제거·행 높이 36px로 조정.

---

- 프롬프트:

```
상하좌우 padding 좀 넣어줘. 지금 너무 답답해 보여.
```

> 의도/반영: `.app` padding을 `12px 16px` → `24px 32px`(상하 24px, 좌우 32px)로 늘림.

---

- 프롬프트:

```
셀 선택하면 그 행이랑 열에도 배경색 살짝 들어가게 해줘. 하늘색 정도면 될 것 같아.
```

> 의도/반영: `updateCellSelection()`에 `highlight-row`·`highlight-col` 클래스 토글 추가. `style.css`에서 해당 행·열 셀 `#e8f4fc`, 선택 셀 `#cce8f9` 하늘색 배경 적용.

---

- 프롬프트:

```
셀 한 번 클릭은 선택, 선택된 상태에서 Backspace면 내용 삭제. 같은 셀 한 번 더 클릭하면 편집 모드로 들어가서 수정하게.
```

> 의도/반영: `spreadsheet.mode`(select/edit) 분리. 1클릭 `enterSelectMode`(input readonly), 동일 셀 2클릭 `enterEditMode`(input focus). 선택 모드에서 Backspace 시 `clearSelectedCellContent()`. readonly input은 `pointer-events: none`으로 셀 클릭 처리.

---

- 프롬프트:

```
여러 셀도 선택되게 해줘. 행 번호나 열 헤더 클릭하면 그 행/열 전체 선택되게.
```

> 의도/반영: `anchor`/`focus` 범위 선택 모델 도입. **Shift+클릭**으로 셀·행·열 범위 확장. **행/열 헤더 클릭** 시 해당 행·열 전체 선택. 다중 선택 시 Backspace로 선택 영역 일괄 삭제, 좌표 표시는 `Selection: A1:C3` 형식. CSS는 `.in-selection`·`.active-cell`로 구분.

---

- 프롬프트:

```
편집 모드 아니어도 바로 타이핑 되게 해줘. Backspace는 삭제고, 이미 값 있으면 새로 치면 덮어쓰기.
```

> 의도/반영: 선택 모드에서 printable 키 입력 시 `startTypingInActiveCell()`로 포커스 셀 내용을 해당 문자로 교체 후 편집 모드 진입. Backspace는 선택 영역 일괄 삭제 유지. 더블클릭 편집은 기존 텍스트 전체 선택 후 수정.

---

- 프롬프트:

```
셀 하나만 선택했을 때 행/열 하이라이트가 안 보여. 행만 골랐을 땐 열 헤더 안 밝게, 열만 골랐을 땐 행 헤더 안 밝게.
```

> 의도/반영: 단일 셀 선택 시 `highlight-row`·`highlight-col`로 해당 행·열 전체에 `#e8f4fc` 배경 복원. `updateHeaderHighlights()`에서 `selectionKind === 'row'`면 행 헤더만, `'column'`이면 열 헤더만 진하게 표시.

---

- 프롬프트:

```
행이나 열 여러 개 쭉 선택했을 때, 포커스는 선택 범위 맨 앞 셀에 가 있어야 할 것 같아.
```

> 의도/반영: `getActiveCell()` 추가 — 행 선택 시 `{ rowMin, 0 }`, 열 선택 시 `{ row: 0, colMin }` 반환. `setRowSelection`/`setColumnSelection`의 focus를 첫 셀 기준으로 변경, active-cell·타이핑·편집 UI도 `getActiveCell()` 사용.

---

- 프롬프트:

```
버튼 이름은 Export Excel 이어야 해.
```

> 의도/반영: `index.html` Export 버튼 라벨을 `Export Excel`로 변경, README 안내 문구 동일 반영.

---

- 프롬프트:

```
셀이랑 행/열 헤더 드래그해서도 범위 선택 되게 해줘.
```

> 의도/반영: `beginDragSelection`·`updateDragSelection`·`endDragSelection` 추가. 셀·행·열 헤더 `mousedown`→드래그→`mouseup`으로 범위 확장. 클릭만 하면 기존 선택/더블클릭 편집 유지, 드래그 시 `body.is-dragging`으로 텍스트 선택 방지.

---

- 프롬프트:

```
행/열 추가·삭제 버튼 빼고, 헤더 오른클릭 메뉴로 위/아래(또는 왼/오른) 추가·삭제하게 바꿔줘. 아래에는 몇 행 × 몇 열인지 보이게.
```

> 의도/반영: 하단 버튼 제거. 행·열 헤더 `contextmenu`로 메뉴 표시, `insertRowAt`/`deleteRowAt`/`insertColumnAt`/`deleteColumnAt` 구현. 하단 `5행 × 5열` 라벨(`updateGridSizeLabel`) 추가.

---

- 프롬프트:

```
행/열 여러 개 선택해놓고 헤더에서 오른클릭하면 그만큼 한꺼번에 삭제되게.
```

> 의도/반영: 선택된 행/열 범위 내 헤더 오른클릭 시 선택 유지. `deleteSelectedRows`/`deleteSelectedColumns`로 범위 일괄 삭제, 다중 선택 시 메뉴 `행 삭제 (N개)` 표시. 최소 1행·1열은 남김.

---

- 프롬프트:

```
방향키로 포커스 셀 움직이게 해줘.
```

> 의도/반영: `getArrowDelta`/`moveActiveCellBy` 추가. 선택 모드에서 `ArrowUp/Down/Left/Right` 입력 시 활성 셀이 이동하고, `Shift + 방향키`는 선택 범위를 확장.

---

- 프롬프트:

```
행/열 여러 개 선택하고 오른클릭으로 추가할 때, 선택한 개수만큼 넣어줘. 행은 첫 행 위/마지막 행 아래, 열은 왼쪽/오른쪽 메뉴로 나눠줘.
```

> 의도/반영: `insertRowsAt`/`insertColumnsAt`로 N개 일괄 삽입. 행 `위`→선택 첫 행 위, `아래`→마지막 행 아래. 열 메뉴 `왼쪽에 열 추가`/`오른쪽에 열 추가`, 다중 선택 시 `3개` 라벨 표시.

---

- 프롬프트:

```
열 메뉴는 왼쪽 추가가 위에 오게.
```

> 의도/반영: `getColContextMenuItems()`에서 `왼쪽에 열 추가`를 `오른쪽에 열 추가`보다 위에 배치.

---

- 프롬프트:

```
맨 왼쪽 위 코너(행/열 헤더 만나는 칸) 누르면 시트 전체 선택되게.
```

> 의도/반영: `selectionKind: 'sheet'`·`selectEntireSheet()` 추가. `.corner-header` 클릭 시 전체 셀·행·열 헤더 하이라이트, 좌표는 `Selection: A1:…` 형식.

---

- 프롬프트:

```
셀 input 좌우 여백 줄여서 양옆 2px 정도만 남게.
```

> 의도/반영: `.cell-input` padding을 `0 10px` → `0 2px`로 변경.

---

- 프롬프트:

```
입력 중에 Enter 치면 아래 셀로, Cmd+Enter면 셀 안에서 줄바꿈.
```

> 의도/반영: 셀 입력을 `textarea`로 변경. `Enter` → 아래 셀 이동, `Cmd/Ctrl+Enter` → 셀 내 줄바꿈. 그 외는 `nowrap` 한 줄 표시, 붙여넣기 개행은 공백으로 치환.

---

- 프롬프트:

```
Cmd+Enter(윈도우는 Ctrl+Enter)로 넣은 줄바꿈만 여러 줄로 보이게, 나머지는 한 줄로.
```

> 의도/반영: 개행 단축키 `metaKey || ctrlKey` 통일. `.cell-input` 기본 `nowrap`, `\n` 있을 때만 `.multiline`·`pre-wrap`. 붙여넣기 줄바꿈은 공백으로 변환.

---

- 프롬프트:

```
편집 모드일 때 input이 셀보다 넓게 위에 떠 있으면 좋겠어.
```

> 의도/반영: `layoutEditingInput()`로 편집 중 `position: fixed` 오버레이(최소 280px, 최대 520px). 흰 배경·파란 테두리·그림자 적용, 셀 위에 넓게 표시.

---

- 프롬프트:

```
표 데이터 copy/paste 할 때 스프레드시트처럼 셀에 들어가게 하고, 행/열 부족하면 자동으로 늘려줘.
```

> 의도/반영: `Ctrl/Cmd+C` TSV 복사, `Ctrl/Cmd+V` TSV 붙여넣기(`parseClipboardTable`). 활성 셀 기준으로 채우고 `ensureGridSize`로 행·열 자동 확장 후 선택 범위 갱신.

---

- 프롬프트:

```
엑셀이나 구글 시트에서 복사한 거 붙여넣으면 셀에 그대로 들어가게 해줘. 탭으로 구분된 거랑 | 표 형식도.
```

> 의도/반영: 클립보드 `text/html` 테이블 파싱(시트 복사 우선). plain text는 탭 구분(TSV) 및 `|` 마크다운 표 파싱, 구분선 행 스킵, 셀 trim·BOM 제거.

---

- 프롬프트:

```
실행취소, 다시실행 단축키 되게 해줘.
```

> 의도/반영: undo/redo 스택(최대 100). `Cmd/Ctrl+Z` 실행 취소, `Cmd/Ctrl+Shift+Z`·`Ctrl+Y` 다시 실행. 셀 편집·붙여넣기·삭제·행/열 조작 전 스냅샷 저장.

---

- 프롬프트:

```
마지막 행/마지막 열에서 오른클릭하면 메뉴가 잘려. 마지막 열은 클릭한 위치 왼쪽으로, 마지막 행은 위로 뜨게 해줘.
```

> 의도/반영: `positionContextMenu` — 마지막 열은 `left = x - menuWidth`, 마지막 행은 `top = y - menuHeight`. 뷰포트 밖으로 나가지 않도록 여백 클램프.

---

- 프롬프트:

```
엑셀로 저장하는 버튼인데 csv 로 저장되는거 같아. .xls로 내보내도록 수정해.
```

> 의도/반영: `buildExcelXmlContent`로 SpreadsheetML 생성, `spreadsheet.xls` 다운로드(`application/vnd.ms-excel`). Excel에서 바로 열림.

---

- 프롬프트:

```
시트 제목 넣는 입력칸 추가하고, 그 제목이 export 파일에도 들어가게 해줘.
```

> 의도/반영: 툴바 `#sheet-title` 추가·localStorage `title` 저장. Export 시 1행 제목(병합·굵게), 빈 행, 데이터 / 워크시트 이름·파일명(`{제목}.xls`) 반영.

---

- 프롬프트:

```
제목 입력 UI 좀 세련되게. "제목" 라벨 빼고, 기본은 제목없음 보이다가 클릭하면 편집되게.
```

> 의도/반영: 표시용 버튼(`제목없음` 플레이스홀더) + 클릭 시 input 편집. Enter 저장·Esc 취소, 호버·편집 스타일 정리.

---

- 프롬프트:

```
셀 정보는 제목 아래, 행/열 개수는 그 줄 오른쪽에 넣어줘.
```

> 의도/반영: `toolbar-meta` 행에 좌표·`N행 × M열` 배치, 하단 footer 제거.

---

- 프롬프트:

```
export 할 때 시트 데이터에 제목이 들어갈 필요는 없어.
```

> 의도/반영: Export 본문은 그리드 데이터만. 제목은 파일명·워크시트 탭 이름에만 사용.

---

- 프롬프트:

```
행열 정보 우측에 딱 붙게. 1행은 제목+엑셀버튼, 2행은 셀정보+행열개수로 나눠줘.
```

> 의도/반영: `toolbar-row-title` / `toolbar-row-meta` 2단 구조. 행×열은 Export 버튼과 같은 우측 끝에 정렬.

---

- 프롬프트:

```
.xlsx 도 가능하게 그냥 바꿀까?
```

> 의도/반영: SheetJS CDN 추가, `XLSX.writeFile`로 `{제목}.xlsx` 저장. 시트 본문은 그리드 데이터만, 탭명·파일명에 제목 사용.

---

- 프롬프트:

```
제목을 파일/시트 이름으로 쓸 때 정규식으로 에러 날 문자 막고, 공백은 _ 로 바꿔줘.
```

> 의도/반영: `sanitizeTitleForExport` — 제어문자·`\ / : * ? " < > | [ ]` 제거, 공백→`_`, 연속·양끝 `_`·`.` 정리 후 파일명(80자)·시트명(31자).

---

- 프롬프트:

```
PRD, SRD, TRD가 뭔지 설명해 주고, 플랜 문서 기준으로 docs에 각각 작성해 줘.
```

> 의도/반영: `docs/PRD.md`, `SRD.md`, `TRD.md` 초안 작성(당시 플랜·CSV Export 기준).

---

- 프롬프트:

```
현재 최신 코드 상태에 맞춰 PRD/SRD/TRD·README 최신화해 줘.
```

> 의도/반영: 문서 v2.0 — SheetJS `.xlsx`, contenteditable 시트 제목, 헤더 오른클릭 행·열, undo/redo, 복사·붙여넣기 등 실제 구현과 동기화. README 기술 스택·기능·단축키 정리.

---

- 프롬프트:

```
제목 인풋 편집 모드일 때 더 세련되게. 굳이 인풋 형태로 보일 필요 없고, 커서가 보이는 식으로.
```

> 의도/반영: 표시용 버튼+`<input>` 이중 구조 제거 → `#sheet-title-field` `contenteditable`(plaintext-only). 편집 시 테두리·흰 박스 없음, `caret-color`·하단 그라데이션 밑줄 애니메이션만. 플레이스홀더는 `:empty::before` + `data-placeholder="제목없음"`.

---

- 프롬프트:

```
제목 전체 선택 후 삭제하면 입력칸 높이가 높아지는 버그가 있어. 왜 그럴까?
```

> 의도/반영: 원인 — `contenteditable` 전체 삭제 시 브라우저가 커서용 `<br>`을 남겨 `:empty`가 깨지고 줄 높이가 2줄처럼 잡힘. `clearSheetTitleFieldIfEmpty()`로 실질 빈 값이면 `textContent = ''` 정규화, 편집 중 `overflow: hidden` 유지.

---

- 프롬프트:

```
README에 내가 추가한 기능 상세하게 잘 적혀있는지 확인해줘. (행, 열 선택, 여러개 드래그 선택, 행열 추가 제거, 실행취소 다시실행 등)
```

> 의도/반영: README에 `## 기능 상세` 섹션 추가 — 1클릭/2클릭 편집, 드래그·Shift 선택, 행·열·전체 시트, 컨텍스트 메뉴 일괄 추가·삭제, undo 대상, 붙여넣기 형식 등 표로 정리.

---

- 프롬프트:

```
js 코드를 객체지향 방식으로 리팩토링해보자. 모듈화도 필요하면 하고, 불필요 코드 정리하고, 전체 검수해줘.
```

> 의도/반영: 단일 `app.js`(약 1,700줄)를 ES modules + 클래스로 분리. `SpreadsheetModel`(데이터·선택·행열), `UndoStack`, `StorageService`, `clipboard` 파서, `GridRenderer`·`SheetTitleEditor`·`ContextMenu`, `SpreadsheetApp`(조율), `main.js` 진입점. 미사용 `insertRowAt`/`insertColumnAt` 제거. `index.html` → `<script type="module" src="js/main.js">`. README·TRD·AGENTS 구조 갱신.

---

- 프롬프트:

```
이렇게 모듈화 하면 파일로는 안 뜨나??
```

> 의도/반영: ES modules는 `file://`에서 CORS로 `import`가 막히는 경우가 많음. 실행은 `npx serve .` 등 로컬 서버 권장. `file://` 필수 시 단일 `app.js` 복구 또는 번들(Vite/Rollup) 필요 — README에 안내.

---

- 프롬프트:

```
GET favicon.ico 404 — 파비콘 어울리는 걸로 하나 만들어줘.
```

> 의도/반영: 앱 색상(#1e4d8c) 그리드·선택 셀 느낌의 `favicon.svg`·`favicon.png`·`favicon.ico` 추가. `index.html`에 icon 링크(ico, svg, png, apple-touch-icon).

---

- 프롬프트:

```
제목 없이 다운로드하면 '제목없음'이 제목이 되게 / 셀에서 엔터치면 편집모드 / 셀 텍스트 길 때만 인풋 확장
```

> 의도/반영: Export 빈 제목 → `제목없음.xlsx`·시트탭 `제목없음`(`resolveExportTitle`). 선택 모드 Enter → 편집 진입. `layoutEditingInput` — 짧은 글은 셀 크기, 긴 글·줄바꿈만 가로·세로 확장.

---

- 프롬프트:

```
GridRenderer model.cols undefined 오류 / 파비콘·모서리칸 README·AGENTS·프롬프트 로그 추가
```

> 의도/반영: `render()`에서 `const { model } = app` 수정. README 모서리 칸(헤더 교차 빈 칸) 전체 선택 문구 보강. AGENTS·PROMPT_LOG에 파비콘·후속 수정 기록.

---

- 프롬프트:

```
제목 인풋 포커즈아웃되면 편집모드 풀리는거 맞아? 셀 클릭해도 편집모드가 유지되고 있어.
```

> 의도/반영: blur 시 `finishEdit()`로 제목 편집 종료는 맞음. 셀 `mousedown`의 `preventDefault()` 때문에 blur가 안 뜨는 경우 보완 — `finishTitleEditIfActive()`·제목 영역 밖 capture `mousedown`·`beginDragSelection`/`selectEntireSheet` 진입 시 제목 편집 저장 후 종료.

---

- 프롬프트:

```
편집모드에서 해당 셀 :select 되었다가 다른 셀 클릭하면 이전 셀 :select가 그대로 있어. 취소되게 하는 방법 없을까?
```

> 의도/반영: 편집 진입 시 `input.select()`로 텍스트 전체 선택이 걸리는데, 다른 셀 `mousedown` → `beginDragSelection`이 먼저 `mode = 'select'`로 바꿔 blur 조건(`mode === 'edit'`)이 맞지 않아 이전 셀에 선택 하이라이트·편집 UI가 남을 수 있음. `GridRenderer.collapseInputSelection`·`SpreadsheetApp.exitEditMode` 추가. 다른 셀 클릭·blur·방향키 이동·Enter 아래 이동·전체 시트 선택 시 편집 종료·텍스트 선택 해제·오버레이 레이아웃 초기화. AGENTS.md 작업 이력 반영.

---

- 프롬프트:

```
새로고침하면 항상 A1칸 포커즈가 되어 있는데, 처음에는 그냥 어느 셀도 포커즈 안되게 하고싶어. 그리고 포커즈 되었더라도 바깥을 클릭했으면 포커즈 풀리게
```

> 의도/반영: 기본·로드 후 A1 자동 선택 제거. `SpreadsheetModel`에 `selectionKind: 'none'`·`hasSelection()`·`clearSelection()` 추가, `getSelectionBounds` 등 선택 API는 none 시 빈 처리. `init()`에서 선택 해제·좌표 `—` 표시. `#spreadsheet` 밖 왼쪽 클릭 시 `clearCellSelection()`(편집 종료·하이라이트 제거). 선택 없을 때 방향키는 A1부터 이동, 붙여넣기는 A1 기준, Backspace·Enter·타이핑·복사는 무시. `index.html` 초기 좌표 `—`. AGENTS.md 작업 이력 반영.

---

- 프롬프트:

```
전체적으로 컬러를 좀 더 세련되게 / 채도 높게(너무 칙칙함) / 배경만 밝은 회색(살짝 푸른끼) / 셀 강조색(--color-accent-strong)만 살짝 밝고 채도 낮게
```

> 의도/반영: `style.css`에 `:root` CSS 변수 팔레트 도입 — 1차 슬레이트·뮤트 톤, 2차 피드백 반영해 블루 액센트·선택 하이라이트·`#16a34a` Export·그리드 섀도우 등 채도 상향, 3차 앱 배경만 `#e9edf2`(밝은 푸른 회색)로 조정·그리드·버튼 색은 유지, 4차 `--color-accent-strong`만 `#2563eb` → `#4183e8`(활성 헤더·선택 셀·편집 테두리, 채도 소폭↓·밝기↑). 제목 밑줄 그라데이션·컨텍스트 메뉴·편집 셀 테두리 통일. `favicon.svg` 액센트색 동기화. AGENTS.md 작업 이력 반영.

---

- 프롬프트:

```
처음본 사용자를 위해 적당한 사용 가이드를 넣고 싶어. 버튼 하나를 만들어서 클릭하면 모달로 기본 사용법이 나오게.
셀은 드래그해서 선택 가능하고, 실행취소/다시실행 되는 거랑, 행/열 오른클릭 추가·삭제(여러 개 선택하면 그만큼), 복사·붙여넣기, xlsx Export 같은 것도 안내해줘. 일단 코딩 말고 가이드 내용만 써줘.
```

```
(가이드 초안 피드백) 시작 안내·편집 표는 빼고 핵심만. 테이블 위주로 심플하게.
```

```
이제 이렇게 가이드 넣어줘.
```

```
시트 제목 부분을 가장 상단에 쓰자.
```

```
모달 테이블 디자인이 별론데.
```

```
사용가이드 앞에 인포 아이콘 못 붙여?
```

```
모바일 화면에서도 잘 나오도록 수정해? 버튼 위치 저기 괜찮은 거 같아?
```

```
"가이드"라고 최소 버튼명은 잘 나와야 하지 않나?
```

> 의도/반영: `HelpGuide.js`·「사용 가이드」버튼·모달(기능 카드 목록). 툴바 1행 제목·2행 좌표·크기·가이드·Export. UI: 테이블→카드형, 인포 SVG, 모바일 줄바꿈·가로 스크롤·하단 시트·좁은 화면「가이드」/「Export」 짧은 라벨. AGENTS.md 반영.

---

- 프롬프트:

```
실행취소·다시실행을 툴바에 아이콘 버튼으로 넣어줘. 옆에 (⌘Z)처럼 단축키도 보이게. 아이콘은 figma 느낌으로, 실행취소는 다시실행이랑 대칭되게.
```

> 의도/반영: `toolbar-history`에 undo/redo 아이콘 버튼 추가·`UndoStack`과 disabled 연동. OS별 `(⌘Z)`/`(Ctrl+Z)`·호버 `title`. 곡선 화살 SVG, 실행 취소는 다시 실행 아이콘 좌우 반전. 아이콘 크기·진한 회색 톤, 단축키는 연한색(모바일은 아이콘만). AGENTS.md 반영.

---
