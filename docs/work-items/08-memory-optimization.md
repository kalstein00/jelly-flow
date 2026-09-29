# 08 — 측정된 병목의 메모리 절감

상태: 두 후보 구현/검증 완료, 전체 renderer OOM은 미해결. 선행: 06/07.

## 채택한 첫 후보: listener queue 수명

06에서 약 192만 항목 중 171만 항목이 이미 처리됐는데도 배열이 참조했다.
`WorkQueue`는 1,024개씩 저장하고 소비한 값/묶음을 즉시 해제한다. FIFO 순서와
non-bounded listener 처리 중 enqueue를 유지한다. Bounded listener는 queue를
분리하여 새 항목을 다음 round로 보내므로 `Array.from` 전체 복사가 필요 없다.
처리한 항목과 token 중복 방지 집합은 별개다. 중복 방지 의미는 바꾸지 않았다.

검증: chunk 경계 및 도중 enqueue FIFO, 기존 flow/unit 회귀 248개 통과.
Bounded A/B 처리 중 추가된 non-bounded U가 다음 bounded C보다 먼저 실행되는
순서도 별도로 검사한다. 결과 판단은 아래 실행 기록으로 갱신한다.

- Queue 변경 후 hook 전체 graph는 06 control과 timestamp 제외 동일하다.
- Renderer 계측에서 1,738,200회 처리 후 queue에는 미처리 183,378개만 남았다.
  그러나 heap 약 4,012MiB에 도달했고 95,172ms wall에 여전히 OOM이었다.
  처리된 참조 해제는 확인했으나 총 메모리 절감률/속도 개선을 주장하지 않는다.
- 원시 결과: `tmp/flow-memory-20260929/queue`. 다음 후보는 token listener의
  중복 방지 Set에서 singleton 비율을 측정한 뒤 제한적인 저장 방식 변경을 검토한다.

## 두 번째 후보: singleton listener 중복 방지 저장

`dedup-before/renderer`를 3,072MiB 예산+계측으로 실행한 결과 중단 시
208,345개 중복 방지 Set 중 141,110개(67.7%)가 singleton이었다. 기존 util의
hybrid set을 적용해 첫 token은 직접 참조하고, 다른 token이 들어올 때만 Set을 만든다.
Listener ID와 token identity에 따른 중복 방지는 그대로 유지한다.
비율 측정은 profile 사용 시 diagnostics 갱신 지점에서만 수행한다.

- 두 번째 후보까지 적용한 flow/unit 251개 통과. bounded/non-bounded listener의
  변수 간·회차 간 중복 방지를 별도 검증했다.
- `dedup-after/renderer`는 97,344ms wall에 OOM. 마지막 표본 heap 4,022MiB,
  약 208만 constraint vars, 207만 tokens, 66만 dedup entries.
- 두 후보 모두 의미를 보존하는 저장 개선이지만 전체 renderer를 4GB에 맞추지는
  못했다. 이 지점에서 예정된 두 후보 조사를 끝내고 09의 반복 종료/정확성 검증으로
  넘어간다. 라이브러리 제외나 heap 증설을 성공으로 대체하지 않는다.

## 우선순위와 채택 조건

한 번에 한 후보만 변경하고 개별 커밋한다. 06의 근거가 없는 후보는 구현하지 않는다.

| 우선순위 | 후보 | 확인할 조건 |
|---|---|---|
| 1 | finalization/통계/출력의 임시 배열·중복 Set/Map 제거, 순회/청크 처리 | 해당 단계에서 큰 추가 할당이 관측됨 |
| 2 | getter/property-read 인덱스와 캐시의 중복·수명 개선 | 인덱스 보유량이 주요 원인이고 의미론을 보존할 수 있음 |
| 3 | def-use/AST 보조 데이터 또는 처리된 queue/listener 참조 수명 단축 | 재사용되는 시점과 소유자를 확인하고 안전한 해제를 입증 |
| 4 | 토큰·제약·listener 저장 구조의 제한된 중복 제거 | 높은 중복률이 측정되고 canonicalization/redirect 불변식을 유지 |
| 조건부 | 특정 library의 API 요약 | 그 library 비용이 지배적이며 필요한 API 경계를 재현 가능 |

이미 graph 출력은 파일에 점진적으로 쓰므로 단순히 “streaming으로 바꾸자”로 끝내지 않는다.
`analysisstatereporter.ts` 등의 전체 collection 복사와 materialization이 실제로 차지하는
비중을 측정한다. AST나 def-use를 모듈 처리 직후 버려도 된다고 가정하지 않는다.

## 원인 분리를 위한 제한 실험

`--no-def-use`, `--no-narrow`, `--eager-propagation`, `--no-patch-escaping` 중
06의 가설과 관련된 1~2개만 비교한다. 옵션을 끄면 precision/edge 수가 변할 수 있으므로
비용 감소만으로 최종 기본 설정에 채택하지 않는다. 전체 조합 탐색은 하지 않는다.

dependency 제외, `--max-indirections`/`--max-waves`, entry 축소는 진단·bounded 모드의
실험일 수 있으나 **원래 범위의 OOM 해결 근거가 아니다**. source/entry/import 범위는 최종
비교에서 유지한다. 자동 heap 증설, solver 전체 재작성, 단순 병렬화는 초기 범위 밖이다.

library 요약이 필요해지면 별도의 지원 계약/음성 대조/미지원 표시를 먼저 설계한다.
ECharts나 React를 이름만 보고 제외하지 않는다. 현재 React 모델은 additive이므로
library 구현 비용을 제거하지 않는다. 넓은 요약이 필요하면 범위를 다시 계획한다.

## 검증과 완료 조건

동일 entry/옵션에서 정상 완료하는 fixture 및 hook의 canonical call-edge 집합,
선택 실제 callback, Map 음성 대조군을 비교한다. 성능만 바꾸는 수정은 가능한 전체
완료 그래프가 동일해야 한다. upstream solver/cycle-elimination 회귀 검증도 유지한다.

renderer가 여전히 실패하면 더 이른 동일 checkpoint의 상태량/메모리로 개선량을
비교하되 정상 완료라고 보고하지 않는다. 주요 두 후보에도 개선이 없으면 무제한 수정 대신
한계와 다음 설계안을 기록한다. 통합 판정은 [09](09-renderer-validation.md)에서 수행한다.
