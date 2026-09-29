# jelly-flow 작업 순서

목표는 실제 TypeScript 앱의 함수 호출 관계 개선이다. DART는 첫 검증 대상이며,
React 전용 제품이나 완전한 JS/TS 그래프를 목표로 하지 않는다.

| 순서 | 작업 파일 | 상태 | 완료 조건 |
|---|---|---|---|
| 01 | [기준 확립과 재현](01-baseline.md) | 완료 | 버전·재현 예제·기대 연결·알려진 실패 기록 |
| 02 | [React callback 모델](02-react-callback.md) | 완료 | 제한된 모델과 음성 대조군, 모델 적용 범위 검증 |
| 03 | [Map 상수 키](03-map-keys.md) | 완료 | 올바른 2개 연결 유지, 잘못된 2개 연결 제거 |
| 04 | [DART 동일 조건 비교](04-dart-comparison.md) | 완료 — hook 성공 / renderer OOM | 실제 호출부와 비용을 원본/fork에서 비교 |
| 05 | [수집기 출력 계약](05-output-contract.md) | 설계·평가 adapter 완료 | bounded 결과 계약, production 통합 보류 |
| 06 | [OOM 원인 측정](06-oom-profile.md) | 계획 | phase별 증가 구간과 주요 보유 구조 확인 |
| 07 | [예산 제한 후 종료](07-bounded-finalization.md) | 계획 | 중단 후 crash 방지와 진단 보존 |
| 08 | [병목 메모리 절감](08-memory-optimization.md) | 계획 | 근거 있는 구조 최적화와 정확성 유지 |
| 09 | [renderer 재검증](09-renderer-validation.md) | 계획 | 같은 4GB/90초/120초 조건의 3회 완료 판정 |

각 파일은 목적 → 선행 조건 → 작업 → 검증 → 결과/다음 시작점 순서로 관리한다.
단계가 끝나면 그 파일과 이 표를 함께 갱신한다. 실패와 미검증 항목을 완료로 바꾸지 않는다.
현재 단계의 검증 가능한 변경 묶음을 완성한 후 다음 단계로 넘어간다.

## 공통 제약

- 기존 solver 전체 재작성, 제한 없는 모델 추가/heap 증설은 범위 밖이다.
- 정적 호출, 모델 추론, 전달/등록, 미해결 관계를 혼동하지 않는다.
- 원본 평가 결과를 덮어쓰지 않는다. DART 평가 worktree와 기존 변경을 보존한다.
- DART production scanner 통합, Electron IPC, DART 전용 규칙은 이번 초기 작업과 분리한다.
- CodeQL과 제거된 CodeGraph는 후보에 넣지 않는다.
- 정확성은 선택한 실제 연결과 금지 연결로 확인한다. 정상 종료는 완전성 증명이 아니다.

## 인계 근거

- [원본 인계](../baseline/handoff-20260929.md)
- [이전 평가 보고서](../baseline/evaluation-20260929.md)
- [이전 선택 결과](../baseline/results-20260929.json)

원본을 보존한 자료이며 현재 fork의 실행 결과와 구분한다.

현재 완료 지점: 01~05의 구현/평가/계약 설계. 각 단계별 별도 커밋.
01에서는 분석기 production 코드를 변경하지 않았다.
06~09는 후속 OOM 개선 계획이며 아직 구현/실행하지 않았다. 다음 시작점은 06이다.

## 최종 결과와 남은 한계

- React 반환 callback 모델과 Map literal key 모델은 독립 opt-in 옵션이다.
- DART hook의 실제 closeViewInstance 호출 연결 성공, 선택 Map 오연결 2개 제거.
- 전체 renderer는 원본/기준/개선 모두 4GB heap OOM. 해결됐다고 표시하지 않는다.
- DART production 통합과 renderer 성능 조사는 별도 후속 범위다.
- 평가 로그/원시 graph는 ignored `tmp/`에, 재현 입력/선택 결과/해시는 문서에 보존한다.

## 최종 검증 (2026-09-29)

- flow + upstream unit: 7 suites / 238 tests 통과.
- 관련 upstream micro: 40 tests 통과 (선택 범위 밖 558개 미실행).
- 총 278개 통과, 알려진 실패 처리(`test.failing`)로 남긴 신규 테스트 없음.
- TypeScript build 및 전체 noEmit 검사, staged diff whitespace 검사 통과.
- 실제 DART 6회 비교: hook 3회 완료, renderer 3회 OOM을 실패로 기록.
- 두 모델을 함께 켠 React/Map 최종 음성 대조군 통과.
- DART worktree의 원래 미추적 평가 문서/도구는 보존했고 앱 source/lock/dependency 수정 없음.

## 단계별 커밋

1. `574ef30` — 기준 재현 및 작업 파일
2. `6658550` — React callback 반환 모델
3. `5cb50be` — Map literal key 정밀도
4. `52f46e6` — DART 동일 예산 비교
5. `feat: define bounded analysis evidence contract` — 계약/adapter/실제 예제 (이 파일과 같은 커밋)

브랜치: `codex/baseline-reproduction`. 원격 발행은 하지 않았다.
