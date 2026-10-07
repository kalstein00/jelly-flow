# 오프라인 코드 그래프

복사 가능한 skill과 실행 계약은 [.agents/skills/jelly-flow](../.agents/skills/jelly-flow/SKILL.md)에 있다.
이 기능은 기존 CDN visualizer를 변경하지 않으며 기존 CallGraph에 optional functionMetadata만 추가한다.
라이브러리를 추가하지 않은 SVG/DOM UI로 구성하여 외부 CDN·라이선스 번들·서버 의존을 피한다.

## 공개 보고서 입력

generateReport / writeReport와 report CLI가 공유하는 version 1 envelope:

- snapshot, created, selection: 입력 identity, 생성 시점, all 또는 상대 파일 경로 목록.
- inventory: path와 areas 배열. 실제 분석 도달성보다 넓은 앱 파일 목록.
- runs: area, completed/partial/failed status, diagnostics, 유효할 때만 graph.
- graph: 기존 CallGraph 파일/함수/호출 위치와 fun2fun/call2fun. functionMetadata의 kind는 function 또는 module이며 이름은 optional. 메타데이터가 없으면 추정하지 않고 제한을 표시한다.
- imports: 선택적인 독립 소스 증거. source, optional target, specifier, typeOnly, location. 없으면 unavailable이며 빈 배열과 다르다.

순수 생성 경계는 전달받은 snapshot 증거를 사용한다. 현재 filesystem과의 identity 검증 및 실행 실패 관리는 project CLI가 맡는다.
graph의 함수 인덱스는 실행 로컬이다. 보고서는 상대 경로와 범위를 합친 identity로 동일 snapshot의 여러 분석을 합친다.
파일 내부 함수 연결은 함수 확장에 사용하고 파일 caller 수에는 포함하지 않는다.

## 사용자 동작

파일 지도는 폴더별 배치·색을 사용한다. 실행 영역 필터는 별개다.
검색, 확대/이동, 직접 이웃 강조, 2단계 확장, 선택 파일 함수 펼치기와 접기를 제공한다.
좌측 graph와 우측 키보드 목록은 같은 선택 정보와 호출 위치를 사용한다.
Imports는 점선, Possible calls는 실선이며 기본은 Possible calls다.
순환은 관계 종류별 strongly connected components로 구분한다. Across areas는 두 파일의 영역 membership 집합이 다를 때다.
공유 파일 membership을 포함한 근거를 선택 패널에서 확인한다.
수치·순환은 결함 점수가 아니며 필터가 원본 snapshot 집계 기준을 바꾸지 않는다.

## 검증

테스트는 실제 analyzer 산출물→공개 보고서 생성과 실제 HTML 브라우저 사용을 검증한다.
정확한 layout 좌표나 내부 helper 결과를 테스트 계약으로 고정하지 않는다.
일반 분석 질문에는 그래프 선택지를 안내하고 명시적 시각화 요청에만 자동 생성하는 skill 경로를 사용한다.
