# 06 — renderer OOM 원인 측정 계획

상태: 구현 및 원인 후보 측정 완료 (2026-09-29).
선행 기준: `5df974c`, [04 비교 결과](04-dart-comparison.md).
실행 순서: **06 측정 → 07 중단 경로 → 08 메모리 절감 → 09 재검증**, 단계별 커밋.

## 목표와 현재 판단

개선할 구체적인 후보는 있다. 다만 4GB에서 전체 renderer를 완료할 수 있는지는
메모리 소유 구조를 측정한 후 판단한다. 정상 완료와 진단을 보존한 부분 종료를
별개 목표로 관리하며, 부분 종료만 성공해도 OOM 문제가 전부 해결됐다고 하지 않는다.

기존 세 renderer 실행은 모두 OOM이었다. 추가로 로그를 확인한 결과:

| 실행 | timeout 메시지 | 이후 결과 |
|---|---|---|
| npm | analysis.log:3575 | :3581 heap OOM |
| fork 기준 | 해당 메시지 없음 | :2774 heap OOM |
| 개선 | analysis.log:2769 | :2776 heap OOM |

경로는 `tmp/flow-dart-20260929/<npm|baseline|improved>/renderer/analysis.log`.
개선 실행의 마지막 GC는 약 4,062.5MB → 4,025.6MB로 기록돼, 해당 시점 GC만으로
큰 여유를 확보하지 못했다. 정확한 retained object 소유자는 아직 모른다.

`analyzer.ts`는 timeout 메시지 뒤에도 `finalizeCallEdges`, diagnostics 갱신,
도달성/호출 통계 계산을 실행한다. `finalization.ts`는 중단된 실행의 edge 수집과
getter/property-read 인덱스를 추가 생성한다. 따라서 **후처리 추가 할당**은 우선
조사할 가설이다. OOM의 정확한 함수/라인을 입증한 것은 아니다.
마지막 경고에 ECharts가 많다는 사실은 메모리 원인/현재 실행 모듈을 증명하지 않는다.

## 작업

### 실행 결과

- `--memory-trace <새 파일>`: 동기 NDJSON 기록, 단계 경계 및 전파 1초 샘플,
  상수 시간 collection 크기만 수집. 정상/예외 경로에서 파일 descriptor를 닫는다.
- 초기 open/close-per-record 구현은 I/O 간섭으로 renderer가 1,570개 모듈에서
  timeout되었다. 원인 비교에서 제외하고 descriptor 재사용으로 교체했다.
- 최종 계측 renderer는 1,782개 모듈 처리 후 전파 시작 시 heap 2,629MiB,
  82.97초에 4,084MiB, 약 90초 wall time에 OOM. finalization 도달 전이다.
- 종료 직전 listener 배열 1,921,578개 중 1,712,900개가 처리 완료였지만
  배열에 유지됐다. **08 첫 후보는 처리 완료 queue 참조 해제**다.
- 모듈 처리 구간 heap 증가: ECharts 886MiB, AG Grid 560MiB. GC가 개입하는
  구간 차이이며 retained-size 소유권 증명은 아니다. AST/def-use는 함부로 버리지 않는다.
- **07은 heap budget checkpoint와 중단 후 finalization/statistics 생략**을 먼저 구현한다.
- 원시 결과: `tmp/flow-memory-20260929/{profile,profile-fd,control}`.
  요약: [renderer memory profile](../baseline/renderer-memory-profile-20260929.json).
- 단위 검증: trace on/off fixture graph 동일, 단계 기록 파싱, 기존 파일 덮어쓰기 거부.
- DART hook on/off 전체 graph는 timestamp 제외 동일. 분석 시간 13,727 → 14,042ms
  (+2.3%, 단일 쌍 측정), wall 15,285 → 15,641ms. 목표 5% 이내지만 통계적 보장은 아니다.

- [x] 선택 옵션으로 phase/module 경계와 propagation checkpoint에 NDJSON 계측 추가.
- [x] parse/CFG/def-use/AST traversal/propagation/escape patching/finalization/statistics/
  graph serialization의 주요 경계 기록.
- [x] elapsed, heapUsed/heapTotal/RSS/external, vars/tokens/subsets/listeners/worklist,
  functions/call edges/property reads 크기 기록.
- [x] O(1) 카운터와 제한된 빈도의 메모리 표본 사용.
- [x] 동기식 작업 중에도 증분 저장.
- [x] 계측 off/on hook 비교: 관측 추가 시간 2.3%.
- [x] renderer 초기 1회와 I/O 수정 후 1회로 전파 단계 실패 확인.
- Getter 임시 인덱스 크기와 heap snapshot은 미수집: 실패가 finalization 진입 전이며,
  두 저장 구조 후보를 선정할 수 있어 이번 조사에서는 필요하지 않았다.

현재 Jelly `maxMemoryUsage`는 몇몇 지점의 heapUsed 최댓값이며 프로세스 peak RSS가 아니다.
새 측정도 sampled maximum과 실제 OS peak를 구분한다. 강제 GC를 켠 진단 실행은
일반 비용 비교와 분리한다. heap snapshot은 추가 메모리를 요구하므로 OOM 직전 덤프를
기본 전략으로 삼지 않는다. [Node 메모리 계측 문서](https://nodejs.org/docs/latest-v24.x/api/process.html#processmemoryusage),
[공식 heap snapshot 주의사항](https://github.com/nodejs/node/blob/main/doc/api/v8.md).

## 검증과 완료 조건

계측 off/on의 완료 fixture 그래프가 동일해야 한다. OOM이어도 마지막 phase/카운터가
파일에 남아야 한다. 모듈별 메모리 증분은 GC/공유 상태 영향을 받으므로 retained-size
소유권으로 단정하지 않는다. 상위 원인 후보 1~2개와 다음 실험을 근거와 함께 기록하면 완료.
후속 구현/검증은 [07](07-bounded-finalization.md)과 [09](09-renderer-validation.md)에 기록했다.
