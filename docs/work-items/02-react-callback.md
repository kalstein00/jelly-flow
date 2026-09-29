# 02 — React 반환 callback의 제한된 모델

상태: 완료 (2026-09-29). opt-in additive 시제품 구현/검증. DART 효과는 04에서 판정.

## 목적

확인된 React 패키지의 `useCallback` 인자 함수 값을 반환값으로 연결한다.
이름이 같은 사용자 함수/다른 패키지에 적용하지 않으며 hook이 callback을 직접
실행했다고 기록하지 않는다. 기존 fixture는 이미 연결되므로 비용과 실제 누락의
개선 여부를 따로 검증한다.

## 작업

- [x] 실제 resolved module/package version을 식별하는 적용 지점 설계.
- [x] 지원 버전과 API, 미지원 import/subpath를 명시.
- [x] named/alias/namespace/re-export import와 custom hook 반환 검증.
- [x] 동명 로컬 함수와 다른 패키지 음성 대조군 작성.
- [x] callback 전달과 실행을 구분하는 금지 edge 검사.
- [x] 원본 코드 분석을 유지한 작은 모델 시제품부터 비교.
- [x] 구현 대체 요약 검토: 다른 React API/JSX/event 범위를 검증하지 못했으므로 채택하지 않음.
- [x] 모델 적용/비적용과 기존 upstream 회귀 검증.

## 완료/재설계 기준

모델로 누락을 숨기지 않고 적용 범위를 보고할 수 있어야 한다. 단순 의존성 제외는
성공이 아니다. 실제 DART 호출자 개선은 [04](04-dart-comparison.md)에서 판정한다.
광범위한 library framework나 solver 변경이 필요하면 설계를 다시 기록한다.

## 결과와 다음 시작점

`--react-callback-model`을 추가했다 (기본 off). `src/natives/react.ts`가 resolver에서
확인한 package name `react`, version `18.3.1`, public entry `index.js`의 exports에
반환값 모델 token을 추가한다. import identifier 이름으로 매칭하지 않는다.
React/ReactDOM 구현은 계속 분석하며 의존성을 제외하지 않는다. `--no-natives`에서는 꺼진다.

지원: 정적 named/alias/default/namespace/re-export binding, custom hook 반환.
미지원: 다른 React 버전, 직접 internal/UMD subpath, spread 첫 인자, bind/call/apply,
React의 다른 API 및 렌더 간 함수 identity/의존성 값 비교. spread/간접 호출을 모델에서
해석하지 못할 때 경고하며 원본 구현 분석은 유지한다. JSX prop 전달 자체를 이벤트 실행으로
기록하지 않는다. library 전체 요약으로 바꾸면 다른 API를 잃을 수 있어 이 단계에서는 채택하지 않았다.

`diagnostics.libraryModels`에는 모델 ID, 적용 모듈/버전, argument 0의 반환 관계,
실제 적용 call 위치 및 implementationAnalyzed를 기록한다. 이 기록은 callback 호출 edge가 아니다.
근거: [React useCallback 공식 문서](https://react.dev/reference/react/useCallback)와
설치된 18.3.1 구현. 공식 문서는 callback을 호출하지 않고 반환함을 명시한다.

RED: renderer 없이 hook만 있는 fixture에서 새 요구 4개 실패, 음성 대조 12개 통과.
GREEN: 모델 on/off 18개 검증 통과. aliases/default/namespace/re-export/custom hook의
반환 호출 연결 4개가 off에서는 없고 on에서는 생겼다. 등록만 한 callback incoming=0,
동명 사용자 함수/다른 package/미지원 버전 오적용=0, 선택 cross-callback 오연결=0.
flow 및 upstream analysis unit와 함께 50개 성공 (01의 Map 알려진 실패 2개 포함).
TypeScript 빌드 및 diff check 통과.

실제 React+ReactDOM fixture도 기본/no-external 모두 기대 2/2와 unrelated incoming=0 유지.
11 modules / 1,988 functions / errors=0 / warnings=221.
모델 on 관측은 3,863ms/367MB 및 3,735ms/378MB로 비용 절감의 근거는 없다.
[선택 결과](../baseline/react-model-20260929.json), 원시 실행은
`tmp/flow-react-model-20260929`에 보존했다. 다음은 03 Map 키 slice.
