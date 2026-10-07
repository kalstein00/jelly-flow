---
name: jelly-flow
description: Analyze JavaScript/TypeScript possible calls and explore overall code connections, concentration, cycles, or tangled areas using a portable offline HTML report.
---

# Jelly Flow

일반 호출 분석과 코드 연결 시각화에 사용한다. 실행 순서가 아닌 정적 가능 관계를 설명한다.

## 요청에 맞는 경로

- 일반 호출 질문: 필요한 분석 결과와 근거를 답하고 “전체 파일 지도 또는 현재 부분을 오프라인 그래프로 볼 수 있습니다”를 안내한다. 사용자가 선택하기 전에는 HTML을 생성하지 않는다. 후속 액션 UI가 없으면 텍스트 안내한다.
- 전체 구조, 연결 집중, 얽힌 영역을 시각적으로 보고 싶은 요청: 바로 보고서를 생성한다.
- 전체/현재 부분 선택: 아래 실행 경로를 사용하며 현재 부분은 명시적인 상대 파일 경로 목록으로 설정한다.
- 기존 보고서: 파일의 존재나 수정 시각만으로 재사용하지 않는다. 생성 명령이 반환하는 reused 상태와 snapshot을 확인한다.

## 실행

1. [CLI 계약](references/cli.md)을 읽는다. JELLY_FLOW_HOME 또는 사용자가 지정한 analyzer checkout 위치를 확인한다. 필요하면 해당 checkout에서 npm ci와 node node_modules/typescript/bin/tsc --build tsconfig-build.json으로 준비한다.
2. 소비 프로젝트의 빌드 설정과 실제 진입점을 읽어 root, areas(name/entries/roots)를 작성한다. main/renderer/preload/worker는 해당 프로젝트에 존재할 때만 사용한다. 여러 worker 진입점도 누락하지 않는다. roots에는 미도달 파일을 포함하는 앱 source 폴더를 넣는다. 외부 구현과 테스트는 기본 제외다.
3. 설정은 프로젝트의 .jelly-flow 폴더나 프로젝트 외부에 저장한다. 선택 범위는 all 또는 정확한 상대 파일 경로 목록이다. 개인 절대경로를 복사본에 하드코딩하지 않는다.
4. node <copied-skill>/scripts/report.cjs <config.json> <output.html>을 실행한다. 실패 exit와 진단을 확인한다. 실패한 실행의 남은 graph나 오래된 HTML을 새 성공으로 제시하지 않는다.
5. 결과 HTML을 링크하고 전체/부분 범위, 영역별 완료/부분/실패, 미분석 파일과 경고를 함께 설명한다. partial은 전체 완료가 아니다. 생성이 실패했으면 원인과 보존된 이전 결과를 구별한다.
6. 새 환경에서 처음 사용할 때 HTML을 실제 브라우저에서 직접 열어 선택·검색·관계/영역 필터·함수 펼치기를 확인한다. 보고서는 CDN, 서버, 원본 소스 fetch 없이 동작한다.

## 해석

Possible calls와 Imports를 구별한다. 노드 크기는 서로 다른 caller 파일 수이고 호출 선 굵기는 서로 다른 함수 쌍 수다. 순환과 영역 간 연결은 검토 후보이며 결함 점수가 아니다. incoming 0은 dead code의 증거가 아니다. JSX/event/IPC 전체 수집 및 실제 callback 실행은 보장하지 않는다. 함수명·경로·호출 위치를 근거로 에디터에서 원문을 확인한다.
