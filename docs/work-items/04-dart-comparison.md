# 04 — DART 실제 호출부와 비용 비교

상태: 비교 완료 (2026-09-29). hook 목표 성공, 전체 renderer는 세 버전 모두 OOM.

## 고정 조건

- source HEAD: `e6628e840ed5d9c27f3cb99023a93f6ef979dc5b`
- 평가 checkout: `C:/Users/hj0712.jo/.codex/worktrees/jelly-evaluation/dev-branch`
- hook: `log-viewer-app/src/renderer/src/app/useWorkspaceAggregate.ts`
- renderer: `log-viewer-app/src/renderer/src/main.tsx`
- React/ReactDOM 18.3.1. dependency realpath가 basedir 내부인지 확인.
- Node old-space 4096MB / Jelly timeout 90초 / 외부 deadline 120초.
- approximate interpretation/동적 실행 비활성.

## 작업

- [x] 재실행 시 HEAD, 미커밋 source, lock/dependency 버전 및 fixture 해시 확인.
- [x] 동일 entry/범위/옵션에서 npm 기준, fork 기준, 개선 fork 비교.
- [x] hook부터 실행하고 closeViewInstance 내부 호출과 실제 호출부 incoming 확인.
- [x] renderer 예산 내 실행, exit/timeout/aborted/unprocessed/graph 생성 여부 기록.
- [x] 경고, 모델 적용/제외 API, 미지원 callback, 선택 음성 대조군 비교.
- [x] 분석 시간/메모리 정의와 wall time 구분. OS peak RSS로 오표기하지 않기.

## 성공/중단 기준

실제 callback 호출자 연결 개선과 알려진 오연결 비증가를 확인해야 한다.
OOM/timeout 결과는 실패 또는 partial로 남긴다. 단위 테스트 통과를 DART 성공으로
대체하지 않는다. 해결되지 않으면 다음 조사 대상을 기록하고 heap만 늘리지 않는다.

## 결과와 다음 시작점

새 [실행기](../../tools/flow-evaluation/run-dart.cjs)는 고정 HEAD/분석 source clean/
React 버전을 검사하고, DART에 쓰기 없이 explicit entry import를 추적한다.
dependency junction realpath와 source의 공통 조상 `C:/Users/hj0712.jo`를 basedir로 사용했다.
fork 기준은 managed worktree `C:/Users/hj0712.jo/.codex/worktrees/analysis-baseline/jelly-flow`의
`574ef30` 빌드 (production source는 upstream `62e60eb4...`와 동일), 개선은 `5cb50be` 빌드다.
기준 worktree는 재현용으로 보존한다. npm 비교는 01에 보존한 설치/lockfile을 재사용했다.

| hook | analysisTime | Jelly memory | warnings | 483행 → 430행 | callback incoming |
|---|---:|---:|---:|---|---:|
| npm 0.13.0 | 16,873ms | 1,003MB | 1,055 | 없음 | 0 |
| fork 기준 | 15,281ms | 1,032MB | 968 | 없음 | 0 |
| 개선 (`--react-callback-model --map-keys`) | 15,585ms | 976MB | 968 | 있음, target 정확히 1개 | 1 |

셋 모두 1,130 modules / 5,553 functions, errors=0, timeout=false, aborted=false,
unprocessedTokens=0, 범위 밖 파일=0이다. 새 incoming은 실제 소스의 464행 async IIFE이며
483행의 `closeViewInstance(tab.id)`가 430행 callback으로 연결됐다. 기존 내부 호출
`reconcileWorkspaceMutationConflict`(projection.ts:341)와 `mutationFailureMessage`(:113)는
유지됐다. 추가 outgoing인 hook:101 `reportFailure`도 434/441/455행의 실제 호출과 일치한다.

React 모델은 확인된 18.3.1 entry에서 71개 argument-return 전달 위치를 보고했다.
hook 원시 function/module edge 집합은 21,378 → 21,519 (141개 추가/제거 0).
141개 전체의 정확성을 수동 검증한 것은 아니다. 선택 실제 호출 및 fixture 음성 대조군에
한정한 성공이며, 모델 적용은 관계의 runtime 실행을 뜻하지 않는다.

| renderer | wall time | 결과 |
|---|---:|---|
| npm 0.13.0 | 101,172ms | heap OOM, graph/diagnostics 없음 |
| fork 기준 | 95,583ms | heap OOM, graph/diagnostics 없음 |
| 개선 | 94,786ms | heap OOM, graph/diagnostics 없음 |

모두 4GB 제한을 유지했으며 외부 deadline에 의해 kill된 결과가 아니다. renderer를
성공/빈 그래프로 표시하지 않는다. 실패한 실행의 Jelly 시간/메모리/경고 값은 채우지 않는다.
Jelly의 90초 timeout은 모든 native 작업을 선점하는 외부 시간 제한이 아니므로 wall이
90초를 넘을 수 있으며, outer deadline은 120초였다. heap 증설/solver 재작성은 하지 않았다.

추가 최종 fixture 검증에서 두 모델을 동시에 켜도 React 기본/no-external 연결 2/2,
unrelated incoming=0, Map 정상 2/오연결 0을 유지했다. 설치/실행은 정적 분석만 사용했다.
단일 관측이므로 비용 절감은 입증되지 않았다. 모든 입력/옵션/exit/선택 결과/원시 해시는
[비교 JSON](../baseline/dart-comparison-20260929.json)에 기록했다.
원시 graph/log/diagnostics는 `tmp/flow-dart-20260929`에 별도 보존한다.

05는 이 성공을 **bounded hook 분석의 출력 계약** 근거로만 사용한다. 전체 renderer
production 수집기 채택은 보류한다. 다음 성능 조사 후보는 예산 안에서 모듈/solver
메모리 사용을 profile하는 별도 작업이며, React 요약이 OOM을 해결한다는 가설은 미입증이다.
