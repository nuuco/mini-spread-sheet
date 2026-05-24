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
