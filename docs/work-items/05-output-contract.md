# 05 — 수집기 통합 전 출력 계약

상태: 조건부 후속. 선행 조건: 04에서 개선 효과 입증.

## 목적

분석 결과를 소비하는 쪽에서 근거와 한계를 판별할 계약을 만든다.
DART architecture-evidence production 통합은 별도 작업으로 진행한다.

## 작업

- [ ] 정적 호출 / 모델 추론 / 등록·전달 / 미해결 관계의 구분 설계.
- [ ] entry, dependency 범위, source/model 버전과 적용 범위 메타데이터 설계.
- [ ] complete/bounded/partial/failed와 누락 원인을 소비자가 구분하도록 설계.
- [ ] 04의 실제 결과를 계약 예제로 작성.
- [ ] DART 통합 범위와 검증 계획을 별도 결정.

## 범위 밖

기존 unavailable 36개/prior comparison 진단이 자동 해소됐다는 주장,
Electron IPC, 근거 없는 DART 전용 규칙, CodeQL/CodeGraph 재도입.

## 결과와 다음 시작점

미실행. 04의 결과가 선행 조건을 만족할 때 시작.
