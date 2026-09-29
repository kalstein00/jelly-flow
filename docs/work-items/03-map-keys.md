# 03 — 상수 Map 키 정밀도

상태: 대기. 02와 독립적인 변경 묶음으로 관리하되 기록 순서는 유지한다.

## 목적

`save`/`remove` 상수 키의 서로 다른 callback이 섞이는 두 오연결을 제거한다.
기존 올바른 두 연결은 반드시 유지한다.

## 작업

- [ ] 01의 두 알려진 실패를 실제 RED로 실행.
- [ ] 최소 literal key 구분과 알 수 없는 키의 보수적인 fallback 설계.
- [ ] 미지 키 read/write, 복수 write, Map 재할당/alias, 생성자 iterable 검증.
- [ ] keys/values/entries/forEach의 기존 가능한 callback 관계 유지.
- [ ] delete/clear 및 flow-insensitive 한계 명시; 값을 지웠다고 과도하게 제거하지 않기.
- [ ] 두 실패를 일반 통과 테스트로 전환하고 관련 upstream Map 테스트 실행.

## 완료 기준

정상 연결 2개 유지, 오연결 2개 제거, 미지 키에서 가능한 연결 누락 없음.
모든 동적 Map 동작을 지원한다고 주장하지 않는다.

## 결과와 다음 시작점

미실행. `ecmascript.ts` 및 `nativehelpers.ts`가 같은 값 저장소를 사용하는 경로부터 확인.
