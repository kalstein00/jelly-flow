# jelly-flow 작업 순서

목표는 실제 TypeScript 앱의 함수 호출 관계 개선이다. DART는 첫 검증 대상이며,
React 전용 제품이나 완전한 JS/TS 그래프를 목표로 하지 않는다.

현재 사용자 선택 범위는 **앱 코드만 분석**이다. 10~12에서 `--app-only <root>`를
추가했고, 외부 구현 대신 필요한 반환 모델을 적용한다. 01~09의 전체 의존성 포함
측정은 이전 범위의 기록이며 앱 모드 결과와 구분한다.

| 순서 | 작업 파일 | 상태 | 완료 조건 |
|---|---|---|---|
| 01 | [기준 확립과 재현](01-baseline.md) | 완료 | 버전·재현 예제·기대 연결·알려진 실패 기록 |
| 02 | [React callback 모델](02-react-callback.md) | 완료 | 제한된 모델과 음성 대조군, 모델 적용 범위 검증 |
| 03 | [Map 상수 키](03-map-keys.md) | 완료 | 올바른 2개 연결 유지, 잘못된 2개 연결 제거 |
| 04 | [DART 동일 조건 비교](04-dart-comparison.md) | 완료 — hook 성공 / renderer OOM | 실제 호출부와 비용을 원본/fork에서 비교 |
| 05 | [수집기 출력 계약](05-output-contract.md) | 설계·평가 adapter 완료 | bounded 결과 계약, production 통합 보류 |
| 06 | [OOM 원인 측정](06-oom-profile.md) | 완료 | 전파 중 메모리 증가와 queue 보유 확인 |
| 07 | [예산 제한 후 종료](07-bounded-finalization.md) | 완료 — A 수준 | 협력적 중단과 진단/partial graph 보존 |
| 08 | [병목 메모리 절감](08-memory-optimization.md) | 구현·검증 완료 — 전체 OOM 지속 | queue 수명과 singleton 저장 개선, graph 동일 |
| 09 | [renderer 재검증](09-renderer-validation.md) | 검증 완료 — A 달성 / B·C 미달 | 같은 4GB/90초/120초 조건의 종료·정확성 판정 |
| 10 | [앱 소스 범위](10-app-only-scope.md) | 완료 | 명시적 root와 외부 구현 제외 |
| 11 | [외부 경계 모델](11-external-boundary-model.md) | 완료 | 외부 소스 없이 callback 반환 연결 |
| 12 | [앱 renderer 검증](12-app-renderer-validation.md) | 완료 | 4GB 앱 분석 3회 완료 및 선택 연결 검증 |

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

현재 완료 지점: 01~12의 구현/평가/계약 설계. 앱 코드 renderer는 4GB에서 3회 정상 완료했다.
01에서는 분석기 production 코드를 변경하지 않았다.
06/07 및 08의 두 구조 최적화를 구현했고, 09에서 A 달성 / B·C 미달로 판정했다.

## 최종 결과와 남은 한계

- 전체 모드의 React 반환 callback 모델과 Map literal key 모델은 독립 opt-in 옵션이다.
- 앱 모드 `--app-only <root>`에서는 지원되는 외부 React callback 반환 모델을 자동 적용한다.
- DART hook의 실제 closeViewInstance 호출 연결 성공, 선택 Map 오연결 2개 제거.
- 앱 코드 renderer: 530 modules / 6,663 functions, 3회 모두 오류/미처리 token 0.
- 전체 시간 11.1~11.5초, 표본 heap 713~730MiB, 선택 callback 연결 유지.
- 외부 구현을 포함한 renderer의 예산 옵션 없는 4GB 실행은 아직 OOM이다.
- `--max-heap-mb 3072`의 진단/partial graph 보존은 전체 분석 완료와 구분한다.
- DART production 통합과 추가 solver/library 요약 설계는 후속 범위다.
- 평가 로그/원시 graph는 ignored `tmp/`에, 재현 입력/선택 결과/해시는 문서에 보존한다.

## 01~05 검증 (2026-09-29, 당시 결과)

- flow + upstream unit: 7 suites / 238 tests 통과.
- 관련 upstream micro: 40 tests 통과 (선택 범위 밖 558개 미실행).
- 총 278개 통과, 알려진 실패 처리(`test.failing`)로 남긴 신규 테스트 없음.
- TypeScript build 및 전체 noEmit 검사, staged diff whitespace 검사 통과.
- 실제 DART 6회 비교: hook 3회 완료, renderer 3회 OOM을 실패로 기록.
- 두 모델을 함께 켠 React/Map 최종 음성 대조군 통과.
- DART worktree의 원래 미추적 평가 문서/도구는 보존했고 앱 source/lock/dependency 수정 없음.

## 단계별 커밋

06~09 최종 검증: 292개 테스트, build/noEmit 통과. Fixture/hook 전체 graph 동일.
Renderer는 예산 미설정 시 여전히 OOM이며, 예산 적용 3회는 50.7~52.8초에
진단/partial graph를 보존했다. 결과·해시·제한은 [09](09-renderer-validation.md)에 있다.

10~12 앱 범위 최종 검증: 318개 테스트, build/noEmit 통과. renderer 3회 정상 완료,
timestamp 제외 graph 동일. 결과·해시·경고/제한은 [12](12-app-renderer-validation.md)에 있다.

1. `574ef30` — 기준 재현 및 작업 파일
2. `6658550` — React callback 반환 모델
3. `5cb50be` — Map literal key 정밀도
4. `52f46e6` — DART 동일 예산 비교
5. `5df974c` — 계약/adapter/실제 예제
6. `42a94e6` — phase별 메모리 계측, 원인 후보 측정
7. `9545c24` — 협력적 예산 중단 및 진단/partial graph 보존
8. `b95844b`, `9cf6641` — listener queue 수명 및 singleton 중복 방지 저장
9. `1ffc675` — 전체 renderer 반복 검증과 후처리 진단 보완
10. `21188f4` — 명시적 앱 소스 범위와 외부 구현 제외
11. `0ed52cf` — 외부 React callback 반환 모델과 일반 API fallback
12. 앱 renderer 정상 완료 검증과 리소스/출력 계약 보완 — 이 검증 문서와 같은 커밋

브랜치: `codex/baseline-reproduction`. 원격 발행은 하지 않았다.
