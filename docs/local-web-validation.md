# 로컬 웹 도구 검증 — 2026-10-13

대상은 GitHub #9와 하위 #10–#18이다. 구현 비교 기준은 `b2f8e539b1ccf6f6c340f903d0aecb25ebd72886`이다. 과거 오프라인 결과를 새 웹 도구의 통과 증거로 대신 쓰지 않았다.

## 실행 환경과 재현

Windows, Node v24.20.0, Chrome 154.0.8037.98, viewport 1500×960에서 실제 브라우저와 실제 분석기를 사용했다. `npm ci --ignore-scripts` 및 `tests/install.sh`에 나열된 4개 fixture의 `npm ci --ignore-scripts`로 의존성을 준비했다. 사용법과 재현 명령은 [로컬 웹 가이드](local-web.md)에 있다.

`npm run web`으로 실행한 주소의 HTTP 200 응답과 Ctrl+C 이후 리스너 종료를 확인했다. 공개 서버 경계 테스트에서는 실행 중 분석을 종료하고 재시작했을 때 실패 상태로 복원됨을 확인했다. 기본 저장 위치는 사용자 홈이며 대상 소스에 도구용 파일을 만들지 않는다.

측정값은 이 장비의 단일 실행이며 브라우저 자동화와 identity 검증 비용을 포함한다. 일부 측정은 독립 검증과 동시에 실행됐다. 임의의 ms/FPS 합격선을 추가하지 않았다.

## 작은 TypeScript 프로젝트

package source를 가진 독립 fixture에서 제안 확인·저장·실제 분석·후보 선택·함수 펼치기·근거 복사·재분석을 완주했다. 4개 inventory 중 3개 analyzed, 1개 unanalyzed였다. 중복 callsite와 두 caller가 있어도 `save`의 수신 파일 수는 2이며 발신은 0이다. import 순환은 Possible calls 순환으로 섞이지 않는다.

실제 브라우저 측정: 제안 82ms, 첫 분석 86,855ms, 완료 표시 후 지도 준비 대기 21ms, 후보 선택 40ms, 함수 펼치기 48ms, 검색 15ms, 동일 입력 재분석 43,883ms (`Reused`). 오류 0건. 선택과 viewport를 유지했고 이동한 독립 HTML은 네트워크 없이 탐색됐으며 외부 요청 0건이었다.

이 측정의 snapshot은 `4d32c5adbcdbf7ed1a9c5c1326bfda6df965c9a4cc4fe3357b8083efc2b2a929`다. 이후 리뷰로 추가한 부분 결과 전환·무결성·응답 경합 보강은 별도 회귀 테스트로 검증했다.

브라우저 fixture에서는 실제 소스를 수정해 추가 함수 반영, 삭제된 선택 파일 알림, 재분석 중 이전 지도 탐색과 확대 위치 보존을 확인했다. 사용자의 DART 소스는 변경하지 않았다.

## DART 실제 범위

현재 DART source HEAD는 `06ba4000436b8ae82086ec6c909f793d4061bb50`다. HEAD만으로 입력을 식별하지 않고 미커밋 소스·설정·의존성·분석기 bytes를 포함한 snapshot을 사용한다.

모노레포 루트의 자동 제안은 log-viewer-app 및 query-service-gui의 main/preload/renderer와 명시적인 dataset observation worker, 총 7개 영역이다. 첫 분석은 7개 영역 모두 completed였고 inventory 864개 중 788개 analyzed·76개 unanalyzed, 함수 10,477개를 기록했다. Possible calls 파일 쌍은 내부 파일 관계 포함 2,647개, Imports는 2,894개다. completed는 모든 runtime 관계의 수집 완료를 뜻하지 않는다.

루트 분석 snapshot: `1abf682b557a6aa9014f84da6012181edb05905f87a86a3ee9ee5fae5a3f57b3`. 작업 설정 생성부터 HTML 기록까지 파일 시각 차이는 약 640초다. 이는 브라우저 측정과 구분되는 산출물 시각 기반 값이다. 루트에는 Rust·배포·빌드 산출물과 의존성이 많고 기존 보수적인 전체 입력 검증 비용이 크다. 루트의 후보 선택·함수 펼치기·클립보드 복사 화면은 생성됐지만, 이어진 재사용 검증은 리뷰 수정 적용을 위해 중단했다.

리뷰 수정 후 `log-viewer-app`을 실제 대상으로 다시 등록해 main/preload/renderer와 명시적 worker 4개 영역을 분석했다. 모두 completed이며 inventory 840개 중 764개 analyzed·76개 unanalyzed, 함수 10,139개, 내부 파일 관계를 포함한 Possible calls 파일 쌍 2,460개와 Imports 2,867개였다. snapshot은 `c412455ebc0d00b5bd18b79a77281774777d74c0a5cdd192dd944b9bed68995c`다.

| 앱 단위 브라우저 측정 | 소요 시간 |
| --- | ---: |
| 설정 제안 | 2,216ms |
| 첫 분석·입력 검증 | 489,794ms |
| 완료 표시 후 지도 준비 대기 | 893ms |
| 후보 선택 | 448ms |
| 함수 펼치기 | 876ms |
| 검색 | 65ms |
| 동일 입력 재분석 (`Reused`) | 220,620ms |

최종 흐름의 브라우저 오류는 0건이었다. 재사용 후 선택과 viewport가 보존됐고, 다른 위치로 옮긴 HTML의 오프라인 선택과 외부 요청 0건을 확인했다. 값은 자동화로 측정한 경과 시간이며 순수 renderer 실행 시간이나 성능 보장을 의미하지 않는다.

## 관찰된 사용성과 제한

전체 파일 지도에서는 관계 밀집과 영역·폴더 색을 볼 수 있고, 선택·검색·확대 후 경로와 상세 소스 위치를 읽는다. 864개 파일의 전체 화면에서 모든 라벨을 동시에 읽는 방식은 아니다. Projects 패널을 접어 그래프 공간을 넓힐 수 있다. 후보와 순환 목록, coverage는 왼쪽 스크롤 영역에 있다. 선택 상세와 근거 텍스트는 오른쪽 패널에 표시한다.

명시적 worker 소스는 별도 영역으로 제안하지만 동적 worker와 문자열 내부 코드는 자동으로 실행하거나 완전히 분석하지 않는다. JSX/event/IPC 전체 수집, 실제 실행 순서, 자동 리팩터링, 성능 병목 판정은 제공하지 않는다. 전체 입력 fingerprint가 큰 프로젝트에서 비싼 점은 남은 제한이다.

## 검토와 AC 대응

Standards 검토에서 대상 내부 `..jelly-data` 저장 폴더가 경계를 우회하는 문제 1건을 수정했다. Spec 검토에서 이전 부분 결과 복귀, 저장 산출물 무결성 검사, 늦은 설정 응답의 프로젝트 혼동 3건을 수정했다. 두 독립 검토의 재검토 결과 남은 지적은 각각 0건이다.

느린 HTML 응답을 추가로 재현하면서 새 프로젝트 제목 아래 이전 지도가 잠시 보이는 화면 전환 문제를 발견했다. 새 결과 문서의 로딩이 끝날 때까지 iframe을 숨기고 프로젝트·경로·선택 세대가 일치할 때만 표시하도록 수정했다. 이전 문서가 로딩 중인 새 프로젝트의 탐색 상태로 저장되지 않게 했고, A→B→A 전환에서 오래된 상태 응답도 차단했다. 재현은 수정 전 `frameVisible: true`, 수정 후 `false`였으며 Spec 축의 추가 검토에서도 남은 지적은 없었다.

## 테스트 결과

- Production build와 전체 타입 검사 통과.
- 전체 Jest는 한 번 실행했다: 27 suites 중 21 통과·6 실패, 1,025 tests 중 1,010 통과·15 실패, 1,421초.
- 이 중 기존 실패 14개는 [이전 baseline 기록](offline-report-validation.md)의 이름과 모두 일치한다: micro client9/import12 soundness 2개, approx-load dynamic/library soundness 2개, Windows Bash wrapper 5개, helloworld/approx facts·soundness 4개, mochatest require-hook soundness 1개.
- 새 실패 1개는 접힌 coverage 패널에서 `innerText`를 읽던 브라우저 검증이었다. 실제 사용자처럼 **Coverage and limitations**를 펼친 뒤 읽도록 수정했다.
- 공개 API의 부분 결과 복원·전환·손상 산출물 거부, 저장 경계, 서버 종료, artifact/config/source 무효화 테스트 4개는 전체 실행에서 통과했다. 웹 브라우저 11개 중 위 coverage 검증을 제외한 10개도 통과했다.
- 전체 실행 후 보완한 coverage 확인과 지연된 결과 로딩을 포함하여 등록·저장/재시작·재분석·첫 부분 결과의 영향 경로 4개를 개별 재검증했고 모두 통과했다(394.318초). 새 coverage 검증 실패는 해소됐으며, 전체 실행에서 확인한 기존 실패 14개는 이번 작업 범위에서 수정하지 않았다. 최종 개별 실행 결과는 `tmp/web-final-browser.log`에 기록했다.
- `--json` 보고서는 테스트 실행 종료 후 순환 Error 객체 직렬화 오류로 저장되지 않았다. 위 수치는 출력된 Jest 텍스트 요약과 개별 실패 이름을 기준으로 기록했다. 전체 suite를 GREEN으로 보고하지 않는다.

| AC | 증거 |
| --- | --- |
| 01 | 실제 npm 명령·HTTP·Ctrl+C 및 공개 서버 종료/재시작 테스트 |
| 02–03 | DART/작은 TS 제안, Electron workspace fixture, JSON 수정·저장·재시작·복수 프로젝트 분리 |
| 04 | 실제 분석 coverage/영역 상태/시점, 미도달 파일 fixture |
| 05–07 | 실제 지도 screenshot, 드래그·필터·함수·검색·확대·이동, 기존 키보드 탐색 회귀 |
| 08–09 | 공용 caller/중복 callsite 집계, 독립 Imports 순환, 후보 선택 및 필터에 숨겨진 순환 알림 |
| 10 | 실제 clipboard 성공, 권한 거부 시 선택 가능한 근거 텍스트, 부분 결과의 시점/범위 |
| 11 | 실제 소스 추가/삭제 재분석, 이전 지도 사용, 파일 선택·viewport 보존 |
| 12 | 동일 입력 재사용, 의존성·소스·설정 변경, 손상 산출물 재생성, 분석 도중 입력 변경 거부 |
| 13–14 | 완료→부분→실패, 첫 부분→새 부분→이전 부분, 첫 실패, 재시작 및 손상 결과 열기 거부 |
| 15 | 중복 실행 거부, 분석 중 프로젝트 전환, 지연된 제안·저장 응답 경합 |
| 16 | 공개 HTML 생성 회귀, 이동한 HTML의 서버·네트워크 없는 탐색 |
| 17 | 실제 DART와 독립 TS 브라우저 실행, 환경·snapshot·coverage·상호작용 측정 |

로컬 증거는 `%TEMP%/jelly-web-acceptance-20261013/`의 dart, dart-app, small 디렉터리에 있다. 산출물은 로컬 경로·소스 위치를 포함하므로 저장소에는 검증 요약과 재현 도구를 남겼다. 전체-suite 로그는 `tmp/web-full-suite.log`다.
