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
