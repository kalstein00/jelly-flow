# 05 — 수집기 통합 전 출력 계약

상태: 계약 설계 및 평가용 adapter 완료 (2026-09-29). production 통합은 보류.

## 목적

분석 결과를 소비하는 쪽에서 근거와 한계를 판별할 계약을 만든다.
DART architecture-evidence production 통합은 별도 작업으로 진행한다.

## 작업

- [x] 정적 호출 / 모델 추론 / 등록·전달 / 미해결 관계의 구분 설계.
- [x] entry, dependency 범위, source/model 버전과 적용 범위 메타데이터 설계.
- [x] 종료 상태 completed/partial/failed와 coverage bounded를 구분; 완전성 미입증 표시.
- [x] 04의 실제 결과를 계약 예제로 작성.
- [x] DART 통합 범위 결정: bounded prototype만 후보, renderer production 통합은 보류.

## 범위 밖

기존 unavailable 36개/prior comparison 진단이 자동 해소됐다는 주장,
Electron IPC, 근거 없는 DART 전용 규칙, CodeQL/CodeGraph 재도입.

## 결과와 다음 시작점

[계약 문서](../contracts/analysis-evidence-v1.md)와
[TypeScript 계약](../contracts/analysis-evidence-v1.ts)을 작성했다.
평가용 `tools/flow-evaluation/export-evidence.ts`는 저장된 DART run/summary를 변환하며
기존 Jelly graph 형식이나 DART production scanner를 변경하지 않는다.

- `may-call`: 정적 가능한 호출. 실행 사실이 아니며 per-edge 원인은 `unclassified`.
- `return-transfer`: React 모델이 실제 적용한 argument 0 → 반환값 전달. callback 실행과 구분.
- `registration`: 계약에 정의하되 현재 추출 미지원. `registrationCoverage=unavailable` 명시.
- `unresolved`: 선택 호출의 static target 미해결. 호출 불가능으로 해석하지 않는다.

모델을 켰다는 이유로 모든 edge를 model-inferred로 표시하지 않는다. propagation provenance를
저장하지 않으므로 A/B 차이도 모델의 인과 경로 증명은 아니다. 그래프 ID 대신 source SHA와
basedir 상대 source range를 쓴다. 실패는 `relations=null`, `diagnostics=null`이며 빈 그래프와
구분한다. OOM 잔여 graph 파일도 성공으로 채택하지 않는다.

[실제 6개 예제](../baseline/evidence-v1/)를 생성했다. npm/fork 기준 hook은 483행 호출이
unresolved, 개선 hook은 target 1개의 may-call과 71개 return-transfer가 있다.
renderer 예제 3개는 모두 failed/null이며 DART 파일에는 쓰지 않았다.

계약 adapter 검증 9개 통과: 실패 잔여 데이터, unresolved, 반환 전달과 호출 구분,
Windows 경로 정규화, partial 상태, 모순된 exit/diagnostics, 누락·범위 밖 데이터 거절.
TypeScript 전체 검사와 최종 관련 회귀 검증 결과는 작업 목록의 최종 검증에 기록한다.

production 통합 검증은 별도 후속이다: source/entry별 bounded 범위를 UI/소비자에 표시하고,
미해결과 기존 unavailable 진단을 보존하며, renderer OOM의 profile/해결을 선행해야 한다.
범용 수집기로 채택하거나 IPC·DART 규칙을 추가하는 작업은 이번 5단계에 포함하지 않았다.
