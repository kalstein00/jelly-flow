# 02 — React 반환 callback의 제한된 모델

상태: 대기. 선행 조건: [01](01-baseline.md)의 기준 결과 확보.

## 목적

확인된 React 패키지의 `useCallback` 인자 함수 값을 반환값으로 연결한다.
이름이 같은 사용자 함수/다른 패키지에 적용하지 않으며 hook이 callback을 직접
실행했다고 기록하지 않는다. 기존 fixture는 이미 연결되므로 비용과 실제 누락의
개선 여부를 따로 검증한다.

## 작업

- [ ] 실제 resolved module/package version을 식별하는 적용 지점 설계.
- [ ] 지원 버전과 API, 미지원 import/subpath를 명시.
- [ ] named/alias/namespace/re-export import와 custom hook 반환 검증.
- [ ] 동명 로컬 함수와 다른 패키지 음성 대조군 작성.
- [ ] callback 전달과 실행을 구분하는 금지 edge 검사.
- [ ] 원본 코드 분석을 유지한 작은 모델 시제품부터 비교.
- [ ] React/ReactDOM 구현을 대체하는 요약은 지원 범위/미해결 표시를 설계한 후 검토.
- [ ] 모델 적용/비적용과 기존 upstream 회귀 검증.

## 완료/재설계 기준

모델로 누락을 숨기지 않고 적용 범위를 보고할 수 있어야 한다. 단순 의존성 제외는
성공이 아니다. 실제 DART 호출자 개선은 [04](04-dart-comparison.md)에서 판정한다.
광범위한 library framework나 solver 변경이 필요하면 설계를 다시 기록한다.

## 결과와 다음 시작점

미실행. 01에서 원본 예제를 `tests/flow/fixtures/react.tsx`로 이식했고 두 연결을
fork 및 npm 배포본에서 모두 확인했다. `tools/flow-evaluation/run.cjs`로 비용과
음성 대조군을 재사용할 수 있다. 최소 지원 계약과 추가 RED 테스트부터 시작한다.
현재 fork 자체가 npm 배포본보다 가벼웠으므로, 모델 효과는 fork 시작 SHA와 비교한다.
