# 오프라인 보고서 검증 — 2026-10-08

대상: GitHub #1의 하위 티켓 #2–#8. 구현 기준 8053bf0, DART source HEAD f6dad3b5b0e5249895e4eaf75f73e7fe27296564.
source/config/dependency 실제 bytes와 analyzer build/options를 포함한 snapshot을 분석 전후 비교했다. 이 문서의 날짜는 Asia/Seoul 기준이다.

## 결과 구분

- 보고서 기능의 집중 검증 13개 통과: 공개 생성 8개, 프로젝트 생성·재사용 3개, 실제 브라우저 2개.
- 전체 타입 검사와 production build 통과.
- 전체 Jest 실행: 25 suites 중 20 통과·5 실패, 1009 tests 중 995 통과·14 실패. 이후 추가된 키보드/거부 clipboard 브라우저 테스트는 개별 실행으로 통과했다.
- 남은 전체-suite 실패 14개는 모두 구현 전 e98c486의 독립 checkout에서도 재현했다. 원래 실패를 새 기능 통과로 재분류하거나 전체 suite GREEN으로 보고하지 않는다.
- Standards: 문서화된 규칙 위반 없음. Spec: 리뷰 발견 사항 수정 후 남은 필수 수정 없음.

## DART 범위와 제한

| 영역 | 진입점 | 완료 상태 | 오류 | 경고 |
| --- | --- | --- | --- | --- |
| main | main index | completed | 0 | 980 |
| preload | preload index | completed | 0 | 4 |
| renderer | renderer main | completed | 0 | 1555 |
| worker | dataset observation session worker, table ordinal worker, tag ordinal worker protocol | completed | 0 | 10 |

inventory 864개 중 759개 analyzed, 105개 unanalyzed. 완료 상태는 각 진입점 분석 실행의 종료 상태이며 앱의 모든 파일 또는 모든 runtime 관계가 분석됐다는 의미가 아니다. 공유 영역의 파일은 중복 제거했다. 함수 10,091개, 파일 간 Possible calls 1,825쌍, Imports 3,235쌍.

두 ordinal worker는 소스 문자열에 들어 있는 코드다. wrapper 파일을 inventory에 포함하지만 문자열 내부 실행은 분석하지 않는다. JSX/event/IPC 전체 수집 및 실제 실행 순서는 범위 밖이며 HTML에 한계를 표시한다.

처음 발견한 main 오류 두 건은 기존 asset/modulePath 경로 리소스였다. 실제 파일을 확인하고 리소스 증거로 기록하도록 수정했다. 누락된 리소스를 성공으로 처리하거나 worker를 암묵적으로 실행하지 않는다.

## 실제 브라우저와 이식성

Windows, Node v24.16.0, Chrome 154.0.8037.93, 1500×960. 로컬 HTML을 실제 headed Chrome에서 file URL로 열고 네트워크를 차단했다. DART 및 별도 TypeScript 프로젝트 모두 외부 요청 0건·브라우저 오류 0건.

최종 DART 생성 65,382ms. browser helper에서 측정한 최초 표시 440ms, 검색 129ms, 선택 84ms, 함수 펼치기 126ms, 영역 필터 60ms. 이 값은 해당 환경의 1회 end-to-end 측정이며 자동화 비용을 포함한다. 별도의 ms/FPS 합격선을 만들지 않았다.

최종 snapshot: 8568cfc1e97e84e1b10896613f4ec64ae487dc7c1ccd8d547a571688f84a39ac.
HTML SHA-256: d6634e32c6078f15f2905315bb6d5225e10259819fcc062e84f74de711eb0df1.

검색, 영역/관계 필터, 선택·이웃·2단계 강조, 함수 펼치기, 순환/영역 간 강조, clipboard 성공을 직접 확인했다. 별도 browser regression에서 키보드 선택, 접기, 이동, clipboard 거부 대안, HTML 유사 경로의 안전한 표시를 확인했다. Overview와 selection screenshot도 확인했다. 전체 지도에서 작은 폴더 라벨은 확대하거나 검색해서 확인하는 사용 방식이다.

skill 폴더를 다른 위치로 복사하고 JELLY_FLOW_HOME을 설정해 두 번째 프로젝트에서 generated→reused를 확인했다. 한 파일 selection은 1개 파일의 보고서를 만들었다. 실패 진입점은 exit 1이며 이전 HTML digest를 보존했다. 일반 호출 질문은 analyzer만 실행하고 그래프 선택지를 텍스트로 안내했다. 이는 현재 에이전트의 실제 절차 실행이며 별도 모델의 자동 routing 평가는 아니다.

## 재현 명령과 산출물

저장소 cwd에서:

```text
node node_modules/typescript/bin/tsc --noEmit --incremental false --composite false
node node_modules/typescript/bin/tsc --build tsconfig-build.json
node node_modules/jest/bin/jest.js --runInBand
node node_modules/jest/bin/jest.js tests/output/offline-report.test.ts tests/output/offline-browser.test.ts --runInBand
node node_modules/jest/bin/jest.js tests/output/report-project.test.ts --runInBand
node .agents/skills/jelly-flow/scripts/report.cjs <project-config.json> <report.html>
node tools/report-browser-check.cjs <report.html> <artifact-directory>
```

프로젝트 설정은 [skill CLI 계약](../.agents/skills/jelly-flow/references/cli.md)에 따른다. 실제 DART 설정은 main/preload/renderer 및 명시적인 worker 진입점과 source roots를 사용했다. budgets는 영역당 분석 90초·heap 4096MiB이며 외부 프로세스 한도는 120초다. 전체 생성 시간에는 별도의 identity 검증 비용이 포함된다.

로컬 증거는 OS 임시 폴더의 jelly-flow-acceptance-20261008에 있다: dart-config.json, dart.html, manifest, browser JSON/screenshot, second/selected 보고서 및 일반 질문 시나리오. 임시 폴더 접근 없이도 이 문서와 공개 설정 계약으로 다시 실행할 수 있다.

전체-suite 로그는 저장소 tmp/report-full-suite-installed.log. baseline 6 suites의 별도 실행은 24 실패·666 통과였으며 현재 실패 14개의 이름이 모두 baseline 실패 집합에 들어 있음을 비교했다. baseline만의 추가 실패는 junction으로 연결한 fixture 의존성 경로 영향 가능성이 있어 현재 회귀 수에 합산하지 않는다.

잔여 실패: micro client9/import12 soundness(2), approx-load dynamic/library soundness(2), Windows Bash wrapper(5), helloworld/approx facts·soundness(4), mochatest require-hook soundness(1).

## AC 증거 대응

| 부모 AC | 증거 |
| --- | --- |
| 01 | 실제 앱 inventory/영역, multi-entry·공유·미분석 fixture, DART 759/864 coverage |
| 02 | 독립 import 증거, type-only/module-body 집계 분리, 브라우저 토글 |
| 03 | 실제 analyzer 중복 callsite와 multi-entry 중복 제거 |
| 04 | 파일/함수 펼치기·접기, 방향 화살표, 직접/2단계 탐색 |
| 05 | 검색·영역 필터·확대/이동, keyboard·선택/hover 라벨, 상태 텍스트 |
| 06 | 관계별 순환 fixture, 영역 membership 차이 및 강조 |
| 07 | 이름·위치·관계 수, 실제 clipboard 성공과 거부 대안 |
| 08 | 다른 폴더의 standalone HTML, offline request 관찰, 특수문자 경로 |
| 09 | dirty source/dependency 변경, 잘못된 완료 진단 거부, 실패 시 이전 결과 보존 |
| 10 | 일반 질문의 비생성 경로, 명시적 생성, 동일 입력 reused, 실패 진단 |
| 11 | 복사한 skill의 두 번째 TS 프로젝트 생성 및 실제 browser open |
| 12 | 실제 DART 전체 inventory 지도와 live 탐색, coverage/한계/측정 기록 |
