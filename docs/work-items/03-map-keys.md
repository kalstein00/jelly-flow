# 03 — 상수 Map 키 정밀도

상태: 완료 (2026-09-29). `--map-keys` opt-in으로 독립 구현/검증.

## 목적

`save`/`remove` 상수 키의 서로 다른 callback이 섞이는 두 오연결을 제거한다.
기존 올바른 두 연결은 반드시 유지한다.

## 작업

- [x] 01의 두 알려진 실패를 실제 RED로 실행.
- [x] 최소 literal key 구분과 알 수 없는 키의 보수적인 fallback 설계.
- [x] 미지 키 read/write, 복수 write, Map 재할당/alias, 생성자 iterable 검증.
- [x] keys/values/entries/forEach의 기존 가능한 callback 관계 유지.
- [x] delete/clear 및 flow-insensitive 한계 명시; 값을 지웠다고 과도하게 제거하지 않기.
- [x] 두 실패를 일반 통과 테스트로 전환하고 관련 upstream Map 테스트 실행.

## 완료 기준

정상 연결 2개 유지, 오연결 2개 제거, 미지 키에서 가능한 연결 누락 없음.
모든 동적 Map 동작을 지원한다고 주장하지 않는다.

## 결과와 다음 시작점

`--map-keys` (기본 off)는 문자열/숫자/boolean/null literal과 음수 숫자 키의 값 저장소를
나눈다. 숫자 1과 문자열 '1'은 다르게, -0과 0은 같게 취급한다. const 변수, 계산식,
bigint, symbol, 객체 키는 미지 키로 처리한다. 새 `%MAP_UNKNOWN_VALUES`는 모든 상수 키
읽기에 합류하며, 미지 키 읽기와 반복자는 기존 `%MAP_VALUES` 전체 값을 읽는다.
일반 iterator 생성자 입력도 키를 잃지 않도록 unknown 저장소로 보수적으로 합친다.

동일 키 복수 write는 합쳐진다. Map 객체 alias는 같은 저장소를 공유하며, `set` 반환값도
원래 Map을 가리켜 chaining을 지원한다. `--spread`와 함께 사용할 때 순서 불명 인자의
가능한 함수 값을 unknown 저장소에 보존한다. 객체 키 정밀도, constructor pair별 키
구분, delete/clear의 시간 순서/강한 갱신은 지원하지 않는다. delete/clear 이후에도
이전 값이 남을 수 있다. WeakMap은 변경하지 않았다. solver 상태/의미론 변경 없음.

RED: 이전 두 `.failing`을 일반 테스트로 바꾸고 새 경계 사례를 실행해 총 8개 실패 확인.
GREEN: flow 기준 13개와 Map 경계 82개 (cycle elimination on/off) 모두 통과.
추가 upstream unit + React 134개, 관련 micro 40개 통과. TypeScript 빌드 통과.
원래 두 음성 assertion은 약화하지 않았고 이제 일반 회귀 테스트다.

CLI 재현: Map 정상 2개 유지/오연결 2개 제거/unrelated incoming=0, 최소 fixture 8/8 유지.
[선택 결과](../baseline/map-keys-20260929.json), 원시 실행은 `tmp/flow-map-keys-20260929`.
다음은 04의 npm 원본 / fork 기준 SHA / 개선 fork DART 비교다.
