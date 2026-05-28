# 실행 취소·다시 실행 (Undo / Redo)

이 문서는 미니 스프레드시트에 구현된 undo/redo 방식, 코드 위치, 동작 규칙, 성능·확장 시 우려 지점을 정리합니다.  
요구사항 요약은 [SRD.md](./SRD.md) §2.6, 기술 개요는 [TRD.md](./TRD.md) §11을 참고하세요.

---

## 1. 개요

| 항목 | 내용 |
|------|------|
| 패턴 | **Immer Patch + Command + 이중 스택** (`StatePatchCommand`) |
| 되돌리는 단위 | patch / inversePatch (RFC 6902 경로 기반) |
| 제외 | 시트 **제목** (`title`) — undo/redo 대상 아님 |
| 최대 단계 | 100 (`MAX_UNDO_STACK`, `js/constants.js`) |
| 단축키 | Cmd/Ctrl+Z (취소), Cmd/Ctrl+Shift+Z·Ctrl+Y (다시 실행) |

**한 줄 요약:** 사용자 동작을 `StatePatchCommand`로 기록하고, 최초 실행 시 Immer가 생성한 `patches`/`inversePatches`를 undo/redo에서 재사용해 최소 변경만 복원합니다.

---

## 2. 관련 파일

| 파일 | 역할 |
|------|------|
| `js/models/commands/StatePatchCommand.js` | `produceWithPatches`/`applyPatches`, 메타 생성 |
| `js/models/PatchHistory.js` | command 기반 undo/redo 스택 |
| `js/models/SpreadsheetModel.js` | `createPatchState`, `applyPatchState` |
| `js/models/statePatchMutators.js` | 행/열/붙여넣기/삭제 patch mutator |
| `js/SpreadsheetApp.js` | `runStateCommand`, 액션별 command 실행 |
| `js/ui/GridRenderer.js` | `renderByCommandMeta` 셀 단위 부분 갱신 |
| `js/services/PerfTracker.js` | undo/redo/render/persist 계측 로그 |
| `js/utils/keyboard.js` | `isUndoShortcut`, `isRedoShortcut` |
| `js/constants.js` | `MAX_UNDO_STACK` |

---

## 3. 커맨드 구조

```javascript
new StatePatchCommand(actionName, (draftState) => {
  // draftState.rows/cols/data/selection...
  // statePatchMutators 함수로 상태 변경
});
```

- 최초 실행에서 Immer `produceWithPatches`로 `patches`/`inversePatches`를 생성합니다.
- undo는 `inversePatches`, redo는 `patches`를 `applyPatches`로 적용합니다.
- command 메타(`changedCells`, `structureChanged`)를 렌더러에 전달해 부분 갱신합니다.

---

## 4. UndoStack 동작

### 4.1 push

1. undo 스택 **맨 위**와 새 스냅샷이 `snapshotsEqual`이면 push **생략**.
2. 아니면 undo 스택에 push.
3. 길이가 `maxSize`(100)를 넘으면 `shift()`로 가장 오래된 항목 제거.
4. **`redoStack = []`** — 새 분기가 생기면 다시 실행 경로는 무효.

### 4.2 undo(currentSnapshot)

1. undo 스택이 비어 있으면 `null`.
2. **현재** `currentSnapshot`을 redo 스택에 push.
3. undo 스택에서 `pop()`한 스냅샷 반환 → 호출 측에서 `applySnapshot`.

### 4.3 redo(currentSnapshot)

undo와 대칭: 현재를 undo 스택에 push, redo에서 pop.

### 4.4 스냅샷 동등 비교

`rows`, `cols`가 같고, 모든 `(row, col)` 셀 문자열이 `===`로 같을 때만 동일로 간주합니다. push마다 **O(rows × cols)** 비교가 들어갑니다.

---

## 5. SpreadsheetApp 연동

### 5.1 저장 (push)

```text
pushUndoSnapshot()
  → history.push(model.createSnapshot())
  → updateHistoryButtons()
```

### 5.2 실행 취소 / 다시 실행

```text
undo() / redo()
  → syncActiveCellFromInput()   // 편집 중 textarea → model.data
  → blurActiveCellInput()
  → history.undo/redo(model.createSnapshot())
  → applySnapshot(snapshot)     // model + grid.render() + persist() + 버튼 갱신
```

- undo/redo 직후 **localStorage 즉시 저장** (`persist()`). 일반 입력은 300ms debounce(`scheduleSave`)와 다릅니다.

### 5.3 툴바·키보드

- `#undo-btn`, `#redo-btn`: `history.canUndo()` / `canRedo()`로 `disabled`.
- `document` capture `keydown`: `isGridKeyboardTarget`이 false면 그리드 단축키(undo 포함) 무시 (툴바·가이드 모달 포커스 등).

---

## 6. 스냅샷을 넣는 시점 (push)

**원칙:** 데이터·그리드 크기를 **바꾸기 직전**에 `pushUndoSnapshot()`.

| 작업 | 호출 경로 |
|------|-----------|
| 행·열 추가·삭제 | `mutateGrid()` 맨 앞 |
| 붙여넣기 | `pasteTable()` |
| 선택 영역 삭제 (Backspace) | `clearSelectedContent()` |
| 선택 모드에서 타이핑 시작 | `startTypingInActiveCell()` |
| IME/beforeinput으로 편집 진입 | `prepareCellEditFromInput()` |
| 편집 중 값 변경 (첫 변경만) | `handleCellInput()` → `ensureEditUndoSnapshot()` |

`mutateGrid` 예:

```javascript
mutateGrid(mutator) {
  this.pushUndoSnapshot();
  mutator();
  this.grid.render();
  this.persist();
}
```

### 6.1 셀 편집 — 한 세션당 스냅샷 1개

- `editUndoRecorded`: 이미 이번 편집에서 push 했으면 `ensureEditUndoSnapshot()`은 스킵.
- 편집 종료(`exitEditMode`), 스냅샷 적용(`applySnapshot`) 등에서 `false`로 리셋.
- **글자마다** undo 스택에 쌓이지 않음 → undo 한 번에 「편집 시작 전 셀 내용」으로 복귀.

---

## 7. 데이터 흐름 (다이어그램)

```mermaid
flowchart LR
  A[사용자 작업] --> B[pushUndoSnapshot]
  B --> C[undo 스택]
  B --> D[redo 스택 비움]
  E[Cmd+Z] --> F[현재 스냅샷 → redo]
  F --> G[undo pop → applySnapshot]
  H[Redo 단축키] --> I[현재 → undo]
  I --> J[redo pop → applySnapshot]
```

---

## 8. 성능·검증 기준선

### 8.1 왜 부담이 생기는가

| 시점 | 측정 항목 |
|------|------|
| **command 실행** | `command:<액션명>` 소요 시간(ms) |
| **undo/redo** | `undo`, `redo` 소요 시간(ms) |
| **저장** | `persist` 직렬화/저장 시간(ms) |
| **렌더** | `render:<액션명>`, `render(undo)`, `render(redo)` |

그리드 **최대 행·열 상한은 없음** (`ensureGridSize`, 붙여넣기·행열 삽입으로 확장 가능). 기본값은 5×5(`CONFIG`)이나, 대량 paste 시 셀 수가 급증할 수 있습니다.

### 8.2 계측 방법

1. `js/constants.js`에서 `ENABLE_PERF_LOG = true`.
2. 브라우저 DevTools Console에서 `[perf]` 로그 확인.
3. 시나리오 고정:
   - 100x100, 200x200 그리드에서 긴 문자열 붙여넣기
   - 행/열 다중 삽입·삭제 20회
   - undo/redo 연속 50회
4. 지표 비교: 평균/최대 `undo`, `redo`, `persist`, `render` 시간.

### 8.3 부담이 커지는 사용 예

- 수백×수백 이상 격자 + 셀마다 긴 텍스트.
- 붙여넣기·행열 조작을 **많이** 해 undo 스택 100칸이 모두 **서로 다른** 대형 시트인 경우.
- undo를 연속으로 눌러 `persist()`·`render()`가 반복되는 경우.

**미니 시트 + 소규모 데이터**에서는 구현 단순성 대비 실용적으로 충분한 수준입니다. Excel급 대용량은 **의도적 트레이드오프**입니다.

### 8.4 확장 시 검토할 개선 (미구현)

| 방향 | 설명 |
|------|------|
| 변경분만 저장 | 전체 `data` 대신 diff/patch 또는 변경 영역 bounding box만 스냅샷 |
| 상한 | `MAX_ROWS` / `MAX_COLS` / 셀당 최대 글자 수 |
| undo 시 저장 | `persist()`를 debounce하거나 undo 전용 플래그로 묶기 |
| 제목 포함 | 필요 시 스냅샷에 `title` 필드 추가 (현재 SRD·README와 불일치 주의) |

---

## 9. 알려진 제한 (요구사항과 일치)

- 시트 제목 변경은 undo 대상이 **아님** ([SRD.md](./SRD.md) FR-034, [README.md](../README.md)).
- **시트 초기화**(`resetSheet`) 시 undo·redo 스택을 `clear()`하며, 초기화 자체는 undo로 되돌릴 수 없음 ([README.md](../README.md)).
- 선택 상태(`anchor`/`focus`/`selectionKind`)는 스냅샷에 없음. 복원 후 `clampSelection()`으로 범위만 맞춤.
- 편집 undo는 **한 편집 세션 = undo 1단계** (글자 단위 undo 아님).

---

## 10. 다른 프로젝트에 옮길 때 최소 골격

```javascript
class History {
  undoStack = [];
  redoStack = [];
  push(snap) {
    this.undoStack.push(snap);
    this.redoStack = [];
  }
  undo(current) {
    if (!this.undoStack.length) return null;
    this.redoStack.push(current);
    return this.undoStack.pop();
  }
  redo(current) {
    if (!this.redoStack.length) return null;
    this.undoStack.push(current);
    return this.redoStack.pop();
  }
}

// 사용: 변경 전 history.push(clone(state)); undo 시 clone(state)를 넘기고 pop 결과로 state 복원 + UI 갱신
```

이 저장소에서는 위 골격에 `SpreadsheetModel` 스냅샷, `GridRenderer.render`, 편집 input 동기화, push 타이밍(`mutateGrid`·편집 플래그)이 추가된 형태입니다.

---

## 11. 관련 문서

- [README.md](../README.md) — 사용자용 단축키·undo 대상 요약
- [TRD.md](./TRD.md) §11 — 기술 요약 표
- [SRD.md](./SRD.md) §2.6 — 기능 요구 FR-033~034

---

## 12. 피드백 반영 요약 (A → B)

대형 시트(100x100+)와 긴 문자열 환경에서, 전체 스냅샷 복제/비교/직렬화의 `O(Rows × Cols)` 비용이 커질 수 있다는 피드백을 반영했습니다.

- A안 검토: **Command 기반 Delta 기록** (행동 맥락 보존 강점, 개별 커맨드 보일러플레이트 증가 한계)
- B안 검토: **Patch/Diff(Immer) 기반 기록** (자동 diff 강점, 단독 사용 시 행동 맥락 유실 우려)
- 최종 적용: **하이브리드(Immmer Patch + Command)**  
  `StatePatchCommand` 1종으로 행동 이름은 Command가 담당하고, 미시 변경 이력은 Immer `produceWithPatches`가 자동 생성
- 적용 결과: undo/redo는 `patches`/`inversePatches`를 재사용해 최소 변경만 복원하고, 렌더링도 변경 셀 중심 부분 갱신으로 전환

### 변경 요약 (A → B)

- **A(기존):** 스냅샷 중심 UndoStack (`createSnapshot/applySnapshot`, 전체 비교/복원)
- **B(현재):** `PatchHistory + StatePatchCommand + Immer patches` 기반 최소 변경 복원 구조
