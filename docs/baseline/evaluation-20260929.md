# Jelly 호출 그래프 평가 — 2026-09-29

## 결론

Jelly는 LSP가 놓친 인자·반환값·Map callback을 연결했고, 실제 React의 useCallback
반환 함수도 연결했다. 그러나 Map 키를 섞는 오연결, 진입점/의존성에 따른 누락,
전체 renderer 분석의 메모리 부족이 확인됐다. **제한된 범위의 보조 분석 후보**로는
유용하지만, 현재 결과로 DART 전체 호출 그래프 수집기 채택을 권하지 않는다.
채택/통합은 미결정이며 production scanner, 앱 코드, package/lockfile, ADR은 변경하지 않았다.

## 범위와 환경

- 별도 managed worktree: `C:/Users/hj0712.jo/.codex/worktrees/jelly-evaluation/dev-branch`
- 브랜치 `codex/jelly-evaluation`, source HEAD `e6628e840ed5d9c27f3cb99023a93f6ef979dc5b`.
- Windows, Node 24.20.0, npm Jelly **0.13.0**, React/ReactDOM **18.3.1**.
- Jelly는 temp 전용 prefix에 버전 고정 설치했다. 전역/MCP 등록은 하지 않았다.
- 기존 checkout node_modules를 junction으로 읽었다. Jelly가 realpath를 사용하므로
  worktree와 dependency 경로의 공통 조상 `C:/Users/hj0712.jo`를 basedir로 사용했다.
  지정 entry의 import만 추적했다. 완료한 DART hook 결과의 모든 파일은 이 worktree의
  소스 또는 node_modules였다. 이 설정은 사용자 디렉터리 전체 스캔을 뜻하지 않는다.
- 처음 worktree만 basedir로 지정한 react/dart 결과는 React 의존성을 제외했다.
  `excluded-dependencies/`에 보존했고 최종 React 검증 근거로 사용하지 않았다.
- junction 제거 및 lockfile 기반 재설치 시도는 자동 승인 정책에 차단되어 실행되지 않았다.
  삭제 대신 읽기 전용 분석 범위를 조정했다. 기존 checkout의 문서 변경도 보존했다.
- library-docs lock에 Jelly scope가 없으므로 공식 README, npm 배포물 CLI help 및
  설치된 구현을 확인했다. 이 단계에서 library-docs search/get은 호출하지 않았다.

## 연결 검증

[고정 fixture와 실행 방법](../../tools/jelly-evaluation/README.md),
[기계 추출 결과](../../tools/jelly-evaluation/results-20260929.json).

| 사례 | 관측 |
|---|---|
| 기존 LSP와 동일한 최소 fixture | 별칭, 재수출, A.run/B.run, 인자 callback, 반환 callback, callback 본문, Map callback의 기대 연결 **8/8** 존재 |
| 최소 fixture의 wrapped | 로컬 identity 함수 이름이 useCallback인 예제이며 React 검증으로 해석하지 않음 |
| 실제 React/ReactDOM fixture | onClick → useCallback에 전달된 arrow → persist 연결 존재 |
| 실제 React, `--no-callgraph-external` | 위 두 연결 유지; 이것만으로 다른 모든 추정/escape patching이 제거된 것은 아님 |
| 무관한 함수 | negative.neverCalled / react.unrelated에 incoming 0 |
| Map 키 음성 대조군 | saveOnly → remove, removeOnly → save의 **잘못된 연결 2개** 존재; 올바른 연결 2개도 존재 |
| DART useWorkspaceAggregate.ts를 entry로 사용 | closeViewInstance callback 본문(430행) → conflict reconciliation / mutationFailureMessage 연결 존재. incoming은 0 |
| DART main.tsx를 entry로 사용 | 4GB 힙에서 메모리 부족 종료. 그래프·diagnostics 파일 없음 |

8/8은 선택한 정적 연결에 대한 확인이며 전체 정확도/재현율이 아니다. function->function
집합은 실행 시각/순서나 성공을 증명하지 않는다. Map 대조군은 코드상 상수 키가 다른데도
양쪽 함수 모두로 연결되는 것을 확인했다. 실제 React fixture는 browser 실행/동적 추적을
하지 않았다. DART의 callback 호출자 누락이 React 문맥 부족 때문인지는 가설이며,
전체 renderer 분석 실패로 해당 원인을 확정하지 못했다. IPC는 이번 평가에서 검증하지 않았다.

## 비용과 제한

| 실행 | Jelly analysis time | Jelly memory 표기 | errors / warnings | 결과 |
|---|---:|---:|---:|---|
| 최소 fixture | 79ms | 48MB | 0 / 0 | 완료 |
| Map 음성 대조군 | 44ms | 46MB | 0 / 0 | 완료, 오연결 확인 |
| 실제 React | 11.504초 | 1034MB | 0 / 287 | 완료 |
| React no-external | 10.638초 | 1022MB | 0 / 287 | 완료 |
| DART hook entry | 17.219초 | 998MB | 0 / 1055 | 완료, 호출자 누락 |
| DART renderer entry | 측정 결과 없음 | Node old-space 한도 4096MB | diagnostics 없음 | wall 92.562초, exit 134 |

완료한 5개 분석은 timeout=false, aborted=false, unprocessedTokens=0이었다.
memory는 `--gc` 없이 Jelly가 보고한 값이며 OS peak RSS가 아니다. renderer는
`FATAL ERROR: ... JavaScript heap out of memory`로 종료했다. 90초 Jelly 제한과 별개로
메모리 실패가 발생했으며 정상 시간 제한 완료로 해석하지 않는다.

DART hook entry는 의존성을 포함해 1130 modules / 5553 functions를 분석했다.
주요 warnings는 dynamic property read 604건, object spread 140건, native call 관련
111건 등이다. `--obj-spread` 및 다른 정밀도 옵션은 미평가이며 기본 설정의 한계다.
오류 0이나 정상 종료가 분석 완전성을 보장하지 않는다. 생산 코드 순수 호출 수와
module-loading/native/external 연결이 포함된 원시 graph 수를 혼동하지 않는다.

## 재현·보존·검증

원시 실행물은 `%TEMP%/dart-jelly-evaluation-20260929`에 보존했다. CLI 설치 lockfile,
각 case JSON/log/diagnostics/run 기록, initial excluded-dependencies 결과가 포함된다.
temp 영구 보존은 보장하지 않으며 선택 결과와 원본 JSON SHA-256을 저장소에 남겼다.
baseline 첫 실행만 fixture 디렉터리를 basedir로 직접 호출했고 나머지는 runner를 사용했다.
그래프 측정 중 source를 변경하지 않았으며 source/fixture 내용을 별도 수정해서 연결을
좋게 만드는 보정은 하지 않았다. renderer 예산 초과를 숨기거나 heap을 늘려 재시도하지 않았다.

실행기와 JSON 해석기 `node --check` 통과. 결과 원문/선택 연결을 수동 대조했고
`git diff --check`를 확인했다. 앱 수정이 없어 앱 테스트/E2E는 실행하지 않았다.
커밋·푸시는 요청되지 않아 수행하지 않았다.

공식 근거: [Jelly README](https://github.com/cs-au-dk/jelly),
[package](https://www.npmjs.com/package/@cs-au-dk/jelly/v/0.13.0).
