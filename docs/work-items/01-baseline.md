# 01 — fork 기준 확립과 기존 결과 재현

상태: 완료 (2026-09-29). 이 단계는 재현 기반 구축이며 모델 개선은 02/03에서 진행.

## 목적

모델 변경 전 비교 가능한 기준을 만든다. npm 버전 문자열만으로 동일 소스라고 가정하지 않는다.

## 확인된 환경

- 저장소: `C:/Users/hj0712.jo/vscode/jelly-flow`
- origin: `https://github.com/kalstein00/jelly-flow.git`
- 시작 HEAD: `62e60eb4fd5b991c5bf4cfc992f018984f560ea4`
- 2026-09-29 `git ls-remote https://github.com/cs-au-dk/jelly.git HEAD`도 같은 SHA.
  로컬 upstream remote는 아직 없으며 이 조회는 remote 설정을 변경하지 않았다.
- package: `@cs-au-dk/jelly@0.13.0`, Node `24.20.0`, npm `12.0.2`, Windows.
- 시작 시 working tree clean. 작업 branch: `codex/baseline-reproduction`.
- 저장소 및 상위 경로에서 적용할 `AGENTS.md`를 찾지 못했다.
- `LICENSE`의 BSD-3-Clause 원문과 upstream 저작권 표시를 유지한다.
- 인계에서 언급한 `tdd`, `diagnose`, `git-review-commit`은 현재 제공된 스킬 목록에 없다.
  기존 Jest/TypeScript 테스트 관례로 검증한다.

## 작업

- [x] 로컬/원격 기준 SHA와 라이선스 확인.
- [x] 이전 fixture와 선택 결과를 저장소 안에 보존하고 출처/해시 기록.
- [x] 기존 Jest 관례로 선택 연결과 음성 대조군 검증.
- [x] Map 오연결을 알려진 실패로 명시; 실패를 정상 요구사항으로 고정하지 않기.
- [x] 실제 React/ReactDOM 18.3.1 의존성으로 기본/no-external CLI 재현.
- [x] 기존 분석 코드의 책임과 변경 후보 확인.
- [x] 빌드, 관련 upstream 테스트, 변경 검증 및 결과 기록.

## 실행 원칙

root 의존성은 기존 lockfile로 `npm ci --ignore-scripts --no-audit --no-fund`.
upstream의 build/chmod script는 POSIX shell 명령을 포함하므로 Windows에서는
`node node_modules/typescript/bin/tsc --build tsconfig-build.json`으로 컴파일한다.
별도 평가 package에는 React/ReactDOM 정확한 버전과 자체 lockfile을 둔다.
예제는 실행하지 않고 Jelly 정적 분석 입력으로만 사용한다.

## 코드 책임

- `src/analysis/analyzer.ts`: 모듈 순회, 파싱, AST 방문, solver 실행/후처리.
- `src/analysis/operations.ts`: import/require 결과 전파와 함수/네이티브 호출 처리.
- `src/natives/nativebuilder.ts`: native token과 invoke 모델을 등록.
- `src/natives/ecmascript.ts`: Map set의 값을 `%MAP_VALUES`에 합치고 get에서 그대로 반환.
- `src/natives/nativehelpers.ts`: iterator와 forEach도 공용 Map 값들을 사용.
- `src/analysis/solver.ts`: 제약 전파. 초기 개선에서 상태 소유/solver 의미론을 바꾸지 않는다.

## 결과와 다음 시작점

`tests/flow/fixtures`의 6개 파일은 원본과 SHA-256이 같다. React 의존성을
`tests/flow/package.json`과 자체 lockfile에 고정했고 root package/lock은 변경하지 않았다.
신규 [Jest 테스트](../../tests/flow/jelly.test.ts)와
[CLI 실행기](../../tools/flow-evaluation/README.md)를 추가했다.

현재 fork와 이전 평가에서 사용한 npm 0.13.0 설치를 동일한 복사 fixture/React
의존성으로 각각 재실행했다. 원본 설치 lockfile과 새 실행 메타데이터/해시는
[reproduction-20260929.json](../baseline/reproduction-20260929.json)에 보존했다.
원시 graph/log/diagnostics는 ignored `tmp/flow-baseline-20260929`에 있다.
이 자료는 로컬 생성물이며 Git에는 선택 결과/해시/재현 입력만 보존한다.

| 사례 | npm 0.13.0 시간 / 메모리 | fork 기준 시간 / 메모리 | 선택 검증 |
|---|---|---|---|
| 최소 fixture | 74ms / 49MB | 83ms / 46MB | 기대 8/8, 실제 A.run/B.run 구분 |
| Map 음성 대조 | 43ms / 46MB | 48ms / 43MB | 정상 2개, 잘못된 2개, 무관 incoming 0 |
| React | 11,633ms / 1,033MB | 3,523ms / 365MB | callback 연결 2/2, 무관 incoming 0 |
| React no-external | 10,648ms / 1,026MB | 3,745ms / 377MB | callback 연결 2/2, 무관 incoming 0 |

모든 8개 CLI 실행에서 errors=0, timeout=false, aborted=false,
unprocessedTokens=0. React 각 실행은 실제 두 패키지를 포함한 11 modules /
1,988 functions였다. React warnings는 npm 287 / fork 221이다.
시간은 Jelly analysisTime, 메모리는 `--gc` 없는 Jelly maxMemoryUsage이며 OS peak RSS가 아니다.
단일 실행 관측이며 통계적 성능 주장도, 이번 작업의 개선 성과도 아니다.
동일 0.13.0 문자열이어도 배포본과 현재 upstream 소스/의존성이 다를 수 있으므로
앞으로 **npm 기준 / fork 시작 SHA / 개선 fork**를 분리해서 비교한다.

검증:

- `tsc --build tsconfig-build.json` 통과.
- `tsc --noEmit --incremental false --composite false` 통과 (신규 테스트 포함).
- flow + upstream unit 4 suites: 129개 Jest 성공 보고. 이 중 2개는 `test.failing`으로
  표시한 알려진 Map 결함이며 해결된 것이 아니다. 일반 통과는 127개다.
- upstream micro 중 iterators/mix/more1/narrow2/externmap/JSX/import1 선택 검사:
  40개 통과, 선택 범위 밖 558개 미실행.
- 실행기와 해석기 `node --check`, `git diff --check` 확인.
- 기존 결과 경로 재사용 시 EEXIST로 중단하고 원본을 보존하는 것 확인.
  저장한 8개 원시 결과를 재해석한 summary가 기록된 summary와 모두 일치.
- 처음 검증의 중복 위치 선택 실패를 수정: module 범위와 class 생성자를 함수/메서드와
  구분한다. 첫 raw 결과는 `fork/`, 최종은 `verified-fork/`로 별도 보존했다.

전체 upstream suite, DART hook/renderer 재실행, React 모델 개선은 이 단계의 결과가 아니다.
Map 두 `test.failing`은 수정 시 unexpected-pass로 실패하므로 03에서 `.failing`을
제거해 일반 회귀 검사로 전환한다. 다음 시작점은 **02의 패키지 식별과 최소 지원 계약,
금지 edge를 포함한 RED 테스트**다. 실제 DART incoming 개선은 04에서 판정한다.
