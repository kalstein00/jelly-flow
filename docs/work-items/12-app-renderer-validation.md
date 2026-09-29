# 12 — 앱 코드 renderer 검증

상태: 완료 — 앱 코드 범위에서 4GB renderer 3회 정상 완료.

- 기존 DART snapshot, Node 24.20.0, old-space 4096MiB, 90초 분석/120초 외부 제한 유지.
- 앱 코드 범위로 변경했음을 명시한다. 외부 구현 포함 모드의 OOM 해결로 주장하지 않는다.
- 실제 hook 및 renderer의 closeViewInstance 호출/내부 호출 확인.
- renderer 3회 정상 완료, 외부 구현 파일 0, 오류/timeout/미처리 상태 확인.
- 기존 회귀 테스트와 새 범위/모델 테스트, 재현 문서/측정 결과를 기록하고 커밋한다.

## 파일 종류 보완

첫 실행은 OOM 없이 약 12초에 전파를 마쳤지만 CSS 45건/JSON 1건을 TS 해석 오류로
보고했다. 앱 모드에서는 실제 파일이 해석되는 plain `.css`/`.json` import를 별도
`resourceImports`로 기록하고 JS 구현 분석에서 제외한다. 없는 CSS/JS import는
계속 오류다. CSS loader, JSON 안의 문자열을 동적으로 실행하는 경로는 분석하지 않는다.

보완 후 예비 실행: 530 modules / 6,663 functions, 11,529ms wall, 10,169ms analysis,
sampled heap 672MiB, errors 0 / timeout false / unprocessedTokens 0, 실제 close 호출 target 1.
실행 원본: `tmp/flow-app-only-20260929/{pilot,resources}`. 최종 실행과 구분한다.

## 최종 결과

동일한 최종 빌드와 DART commit `e6628e840ed5d9c27f3cb99023a93f6ef979dc5b`로
`--app-only <DART repo root> --map-keys`를 적용했다. 별도 heap 중단 옵션,
memory profile, 강제 GC는 사용하지 않았다. Node old-space 4096MiB,
분석 90초/외부 120초 제한에서 다음 결과를 얻었다.

| 실행 | 종료 | 전체 시간(ms) | 분석 시간(ms) | 표본 heap(MiB) |
|---|---|---:|---:|---:|
| hook | completed | 2,697 | 1,645 | 173 |
| renderer 1 | completed | 11,207 | 9,858 | 725 |
| renderer 2 | completed | 11,480 | 10,109 | 713 |
| renderer 3 | completed | 11,110 | 9,732 | 730 |

heap 값은 분석기의 표본 값이며 프로세스 peak RSS 측정값이 아니다.
renderer 전체 시간 중앙값은 11,207ms다.

- renderer마다 앱 모듈 530개/함수 6,663개, 외부 구현 파일 0개.
- 제외한 외부 모듈 12개는 진단에 남겼고 CSS 45건/JSON 1건은 리소스로 기록했다.
- 오류 0, 미처리 token 0, timeout/abort/memory limit 도달 없음.
- finalization/statistics/graph output 모두 complete.
- timestamp를 제외한 renderer graph는 3회 모두 동일하다.
- 실제 `useWorkspaceAggregate.ts:483` 호출은 `:430` callback 한 개로 연결된다.
- callback 내부의 `workspaceAggregateProjection.ts:113`, `:341`,
  `useWorkspaceAggregate.ts:101` 연결도 유지된다.
- renderer의 callback incoming 함수는 5개다. 이는 정적 가능 관계이며 런타임 실행 증명이 아니다.

입력/빌드/graph 해시와 실행별 선택 결과는
[측정 자료](../baseline/app-renderer-validation-20260929.json)에 보존했다.
실행 시 source HEAD는 단계 11이며, 미커밋 단계 12 코드를 포함한 실제 빌드는
`buildSha256`으로 식별한다. 원시 graph/로그는 ignored
`tmp/flow-app-only-20260929/final-*`에 있다.

## 회귀 검증과 재현

- flow + unit: 13 suites / 278 tests 통과.
- 관련 upstream micro: 40 tests 통과, 선택 범위 밖 558개 미실행.
- 총 318개 통과. TypeScript build 및 전체 noEmit 검사 통과.
- 범위 제한, 외부 React 반환 모델, 일반 외부 API fallback, 실제/없는 리소스,
  evidence의 분석 범위/구현 미분석 표시를 검증했다.
- DART 앱 source/lock/dependency는 수정하지 않았다.

저장소 root에서 빌드 후 새 출력 디렉터리로 실행한다.

```powershell
node node_modules/typescript/bin/tsc --build tsconfig-build.json
node tools/flow-evaluation/run-dart.cjs lib/main.js tmp/new-app-run C:/Users/hj0712.jo/.codex/worktrees/jelly-evaluation/dev-branch renderer --app-only --map-keys
```

네 최종 실행을 합치고 완료/범위/선택 연결/graph 동일성을 확인한 명령:

```powershell
node tools/flow-evaluation/summarize-app-validation.cjs tmp/flow-app-only-20260929
```

## 판정과 한계

사용자가 선택한 **앱 코드 renderer 분석의 4GB 정상 완료 목표를 달성**했다.
외부 구현까지 포함한 이전 모드의 OOM은 해결됐다고 주장하지 않는다.

renderer 경고는 실행당 1,373개 남아 있다. 정상 종료가 모든 호출 관계의
완전성을 뜻하지 않는다. 외부 API 구현은 불투명하며 정밀한 외부 반환 모델은
React 18.3.1 public `useCallback`에 한정된다. CSS/JSON 리소스 내부와 문자열의
동적 실행은 분석 범위 밖이다. 다른 외부 callback의 가능 호출 연결을 이벤트
등록/실행 의미로 해석하면 안 된다. DART production scanner 통합은 후속 범위다.
