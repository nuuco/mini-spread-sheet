# 작업 이력

- 프로젝트 초기화: Vanilla JS 3파일 구조로 미니 스프레드시트 프로젝트 생성
- index.html 작성: 좌표 표시, Export 버튼, 그리드 컨테이너, 행/열 조작 버튼
- app.js 핵심 구현: CONFIG, 그리드 렌더, 셀 input/focus, 좌표·헤더 하이라이트
- CSV Export 구현: collectSpreadsheetData, escapeCsvField, buildCsvContent, downloadCsv
- 선택 기능 구현: 행/열 추가·삭제, localStorage debounce 자동 저장
- style.css 작성: 목업 기반 그리드·헤더·선택 셀·Export 버튼 스타일
- 문서 작성: README.md, PROMPT_LOG.md, 디렉터리 구조(screenshots, exports)
- 붙여넣기 개선: HTML 테이블·TSV·마크다운 표 파싱, 구분선 행 스킵
- 실행 취소/다시 실행: undo/redo 스택, Cmd/Ctrl+Z·Shift+Z·Ctrl+Y 단축키
- 컨텍스트 메뉴 위치: 마지막 행·열 오른클릭 시 위·왼쪽으로 표시
- Export Excel: SheetJS로 .xlsx 다운로드 (파일명·시트탭에 제목 반영)
- 시트 제목 입력: 툴바 제목 필드, localStorage 저장, Export 시 1행·시트명·파일명 반영
- 시트 제목 UI: 클릭 편집, 기본 표시 「제목없음」, 라벨 제거
- 툴바 레이아웃: 1행 제목+Export, 2행 셀정보+행×열(우측 정렬)
- Export: 시트 본문에 제목 행 제외, 파일명·탭명만 제목 반영
- Export 제목 정규화: 금지문자 제거, 공백→`_`, 연속·앞뒤 `_` 정리
- 요구사항 문서: 플랜 기준 docs/PRD.md, SRD.md, TRD.md 작성
- 요구사항 문서 최신화: 현재 구현 기준 PRD/SRD/TRD/README 동기화 (xlsx, 선택·undo·붙여넣기·시트제목)
