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
- Export: 순수 JS CSV (외부 라이브러리 없) 

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

---

- 프롬프트:

```
.app 영역을 전체 너비로 쓰고 싶어. 지금은 좌우 여백이 너무 많고 그리드 너비도 좁아.
```

> 의도/반영: `style.css`에서 `.app`의 `max-width: 720px`·바깥 margin·box-shadow 제거, `width: 100%`로 전환. 그리드는 `table-layout: fixed`로 데이터 열이 남은 너비를 균등 분배하고, 셀 고정 80px 제거·행 높이 36px로 조정.

---

- 프롬프트:

```
상하좌우 padding을 적당히 추가해 줘. 지금은 너무 얕아.
```

> 의도/반영: `.app` padding을 `12px 16px` → `24px 32px`(상하 24px, 좌우 32px)로 늘림.

---

- 프롬프트:

```
셀 선택했을 때 해당 행과 열에도 배경색이 살짝 들어가야 해. 하늘색 정도로 드러나면 될 것 같아.
```

> 의도/반영: `updateCellSelection()`에 `highlight-row`·`highlight-col` 클래스 토글 추가. `style.css`에서 해당 행·열 셀 `#e8f4fc`, 선택 셀 `#cce8f9` 하늘색 배경 적용.

---

- 프롬프트:

```
셀 한 번 클릭은 선택 모드, 선택 상태에서 Backspace면 내용 삭제, 같은 셀을 한 번 더 클릭하면 편집 모드로 텍스트 수정.
```

> 의도/반영: `spreadsheet.mode`(select/edit) 분리. 1클릭 `enterSelectMode`(input readonly), 동일 셀 2클릭 `enterEditMode`(input focus). 선택 모드에서 Backspace 시 `clearSelectedCellContent()`. readonly input은 `pointer-events: none`으로 셀 클릭 처리.

---

- 프롬프트:

```
여러 셀도 선택되게 만들어줘. 행 번호나 열 번호 클릭하면 그 행이나 열 전체가 선택되게.
```

> 의도/반영: `anchor`/`focus` 범위 선택 모델 도입. **Shift+클릭**으로 셀·행·열 범위 확장. **행/열 헤더 클릭** 시 해당 행·열 전체 선택. 다중 선택 시 Backspace로 선택 영역 일괄 삭제, 좌표 표시는 `Selection: A1:C3` 형식. CSS는 `.in-selection`·`.active-cell`로 구분.

---

- 프롬프트:

```
셀 편집 모드가 아니어도 글 입력은 되게 해줘. 삭제·편집만 구분하고, 기존 텍스트가 있을 때 입력하면 덮어쓰기.
```

> 의도/반영: 선택 모드에서 printable 키 입력 시 `startTypingInActiveCell()`로 포커스 셀 내용을 해당 문자로 교체 후 편집 모드 진입. Backspace는 선택 영역 일괄 삭제 유지. 더블클릭 편집은 기존 텍스트 전체 선택 후 수정.

---

- 프롬프트:

```
셀 하나 선택 시 행·열 하늘색 배경이 사라졌어. 행만 선택할 때는 열 헤더 강조 없이, 열만 선택할 때는 행 헤더 강조 없이.
```

> 의도/반영: 단일 셀 선택 시 `highlight-row`·`highlight-col`로 해당 행·열 전체에 `#e8f4fc` 배경 복원. `updateHeaderHighlights()`에서 `selectionKind === 'row'`면 행 헤더만, `'column'`이면 열 헤더만 진하게 표시.

---

- 프롬프트:

```
행이나 열을 쭉 선택했을 때는 선택 범위의 첫 번째 셀에 포커스가 가야 해.
```

> 의도/반영: `getActiveCell()` 추가 — 행 선택 시 `{ rowMin, 0 }`, 열 선택 시 `{ row: 0, colMin }` 반환. `setRowSelection`/`setColumnSelection`의 focus를 첫 셀 기준으로 변경, active-cell·타이핑·편집 UI도 `getActiveCell()` 사용.

---

- 프롬프트:

```
버튼명은 Export Excel 이어야 해.
```

> 의도/반영: `index.html` Export 버튼 라벨을 `Export Excel`로 변경, README 안내 문구 동일 반영.

---

- 프롬프트:

```
셀, 행, 열을 드래그로도 여러 개 선택할 수 있게 해줘.
```

> 의도/반영: `beginDragSelection`·`updateDragSelection`·`endDragSelection` 추가. 셀·행·열 헤더 `mousedown`→드래그→`mouseup`으로 범위 확장. 클릭만 하면 기존 선택/더블클릭 편집 유지, 드래그 시 `body.is-dragging`으로 텍스트 선택 방지.

---
