# 06 — renderer OOM 원인 측정 계획

상태: 계획 확정, 구현/새 분석 실행 전 (2026-09-29).
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

- [ ] 선택 옵션으로 phase/module 경계와 propagation checkpoint에 NDJSON 계측 추가.
- [ ] parse/CFG/def-use/AST traversal/propagation/escape patching/finalization/statistics/
  graph serialization을 구분하고 시작·종료 이벤트를 기록.
- [ ] elapsed, heapUsed/heapTotal/RSS/external, vars/tokens/subsets/listeners/worklist,
  functions/call edges, getter index/property reads의 크기를 기록.
- [ ] O(1) 카운터와 제한된 빈도의 메모리 표본을 사용. 전체 상태를 매번 순회·문자열화하지 않기.
- [ ] 종료 때만 저장하지 않고 증분 저장. 동기식 CPU 작업 중 timer만으로는 계측하지 않기.
- [ ] 계측 off/on hook 비교로 overhead 확인; 목표 추가 시간 5% 내, 넘으면 표본 빈도 조정.
- [ ] renderer 1회 계측 후 필요할 때만 1회 재현해 증가 구간/주요 보유 구조를 좁힘.
- [ ] heap snapshot이 필요하면 축소 재현이나 충분한 여유가 있는 이른 checkpoint에서만 확보.

현재 Jelly `maxMemoryUsage`는 몇몇 지점의 heapUsed 최댓값이며 프로세스 peak RSS가 아니다.
새 측정도 sampled maximum과 실제 OS peak를 구분한다. 강제 GC를 켠 진단 실행은
일반 비용 비교와 분리한다. heap snapshot은 추가 메모리를 요구하므로 OOM 직전 덤프를
기본 전략으로 삼지 않는다. [Node 메모리 계측 문서](https://nodejs.org/docs/latest-v24.x/api/process.html#processmemoryusage),
[공식 heap snapshot 주의사항](https://github.com/nodejs/node/blob/main/doc/api/v8.md).

## 검증과 완료 조건

계측 off/on의 완료 fixture 그래프가 동일해야 한다. OOM이어도 마지막 phase/카운터가
파일에 남아야 한다. 모듈별 메모리 증분은 GC/공유 상태 영향을 받으므로 retained-size
소유권으로 단정하지 않는다. 상위 원인 후보 1~2개와 다음 실험을 근거와 함께 기록하면 완료.
다음 시작점은 [07](07-bounded-finalization.md)이며, 이 문서 작성 시 계측은 미구현이다.
