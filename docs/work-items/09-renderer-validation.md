# 09 — 동일 범위 renderer 재검증과 완료 판정

상태: 검증 완료 — A 달성, B/C 미달. 전체 renderer OOM 해결은 완료하지 못했다.

## 최종 renderer 결과

| 실행 | wall ms | analysis ms | sampled heap MiB | 결과 |
|---|---:|---:|---:|---|
| 메모리 예산 옵션 없음 | 94,583 | 미생성 | 미생성 | OOM, graph/diagnostics 없음 |
| 3,072MiB 예산 1 | 52,754 | 50,129 | 3,110 | partial, 정상 프로세스 종료 |
| 3,072MiB 예산 2 | 50,849 | 48,349 | 3,112 | partial, 정상 프로세스 종료 |
| 3,072MiB 예산 3 | 50,695 | 48,124 | 3,111 | partial, 정상 프로세스 종료 |

세 bounded 실행 모두 graph/diagnostics 저장, finalization skipped, 통계 not-computed,
memoryLimitReached=true, scope 밖 파일 0. Wall 중앙값 50,849ms.
1,782 modules / 34,592 functions 및 분석된 파일 목록이 동일하고, 빌드/입력도 동일하다.
오류는 각각 46건, 미처리 token은 167,000 / 173,373 / 160,975개다.
선택 closeViewInstance target은 세 번 모두 미해결이다. 관계가 없다는 증거가 아니다.

[실행 옵션·해시·선택 결과 요약](../baseline/renderer-memory-validation-20260929.json).
07의 메모리/시간 체크는 협력적이므로 설정값과 표본 heap 사이에 overshoot가 있다.
부분 종료 시점은 GC 타이밍에 영향을 받으며 세 partial graph가 같다고 주장하지 않는다.
이번 결과는 **A만 달성**했다. B/C 달성이나 전체 메모리 절감률·속도 개선을 주장하지 않는다.

## 구현 및 정확성 검증

- 06 `42a94e6`: crash 후에도 남는 메모리 계측.
- 07 `9545c24`: 협력적 heap 예산, 중단 상태, null 통계, 원자적 graph 출력.
- 08a `b95844b`: 소비한 listener queue 참조 해제와 bounded queue 복사 제거.
- 08b `9cf6641`: singleton listener 중복 방지 저장.
- 최종 검토 보완: finalization 진입 전에도 diagnostics를 저장하고, 완료 실행은
  optional reporter가 갱신한 진단을 마지막에 다시 저장한다. Graph 중간 쓰기 실패와
  예기치 않은 finalization 실패에서도 진단/기존 graph 보존을 검사했다.
- **flow + unit 252개, 관련 micro 40개 = 292개 통과**. 나머지 micro 558개와
  전체 dynamic/integration 테스트는 미실행. Build, 전체 TypeScript noEmit 통과.
- React / React no-external / Map 음성 대조 fixture 전체 graph는 05 완료 결과와
  timestamp 제외 동일. 실제 DART hook 전체 graph도 06 control과 동일.
- 최종 hook: 1,130 modules, 5,553 functions, 오류 0, 483행 → 430행 target 1개.
  16,325ms wall / 14,726ms analysis / sampled heap 1,024MiB. 기존 내부 호출 유지.
- 전체 renderer의 기존 완료 graph는 없으므로 전체 graph 동등성은 입증하지 못했다.

최종 원시 결과는 `tmp/flow-memory-final-v2-20260929`에 보존한다. 이전 최종 후보
`tmp/flow-memory-final-20260929`는 코드 검토 보완 전 실행이며 최종 비용 표에서 제외한다.
각 최종 실행은 `buildSha256`으로 main.js뿐 아니라 모든 compiled JS의 동일성을 확인한다.

## 고정 조건

- DART snapshot `e6628e840ed5d9c27f3cb99023a93f6ef979dc5b`, 동일 main.tsx entry와 dependency realpaths.
- Node 24.20.0, React/ReactDOM 18.3.1, 같은 lock/실제 설치 범위.
- Node old-space 4096MB, 분석 제한 90초, 외부 deadline 120초.
- 비교 기준은 01~05 종료 commit `5df974c`. 모델 옵션을 동일하게 고정.
- 임시 진단 설정/강제 GC/heap snapshot을 끈 실행을 최종 비용 비교에 사용.

## 판정 수준

| 수준 | 요구 사항 | 보고 표현 |
|---|---|---|
| A | 시간·메모리 예산 중단 후 crash 없이 종료, 진단 보존, 생략/미해결 표시 | 중단 경로 개선; 전체 분석 미완료 |
| B | 같은 전체 범위에서 graph/diagnostics 정상 생성, timeout/aborted/남은 token/기타 limit 없음 | 4GB 조건의 renderer 분석 완료 |
| C | B를 독립 프로세스 3회에서 유지, 선택 정확성/음성 대조군과 성능 회귀 기준 통과 | 검증된 OOM 개선; 그래프 완전성은 여전히 미입증 |

최소 목표는 A, 주요 목표는 C다. A만 달성하면 OOM 과제를 모두 해결했다고 표시하지 않는다.
4GB는 old-space 설정이지 RSS 제한이 아니다. heapUsed/heapTotal/RSS 표본 최고값과
wall time/analysis time을 구분해 기록한다. 여유 메모리 목표는 06 측정 후 정하며 보장치로 쓰지 않는다.

## 검증 작업

- [x] 기존 278개 관련 테스트 및 변경에 추가된 예산/회귀 테스트.
- [x] hook의 실제 483행 → 430행 연결과 기존 내부 호출, 선택 금지 연결 유지.
- [x] React no-external 음성 대조, Map 정상 연결 유지/오연결 0.
- [x] main.tsx 선택 target 확인: 세 partial 결과에서 미해결, 정상 완료 관계로 채택하지 않음.
- [x] 비용만 바꾼 수정은 정상 완료하는 fixture/hook의 전체 그래프 동등성 확인.
- [x] 최종 renderer 3회 비교, source/entry/의존성/옵션/분석 모듈 목록 차이 기록.
- [x] 이전 renderer는 완료 그래프가 없었으므로 전체 그래프 동등성 증명 불가함을 명시.
- [x] 개별 실행 원본과 새 요약/한계/지원 범위를 보존하고 단계별 문서·커밋 정리.

source 범위를 줄였거나 정확성 검사를 약화하면 B/C로 채택하지 않는다. 4GB에서 일부만
가능하다면 bounded 모드로 명시하고, architecture-evidence production 통합은 별도 결정한다.

## 지원 범위와 다음 설계

`--max-heap-mb 3072`는 Node old-space 4096MiB 아래에 분석 중단 여유를 둔다.
별도 graph 출력 allowance는 256MiB/10초다. 단일 대형 할당/GC를 선점하지 못하므로
어떤 입력에서도 OOM을 막는 보장은 아니다. 옵션 미설정 시 메모리 중단은 적용하지 않는다.

이번 범위에서 두 저장 구조 후보를 검증했지만 전파 상태 자체의 증가가 남았다.
계측에서는 **약 208만 constraint vars / 207만 token memberships**까지 커졌고,
전파 전 모듈 처리만으로도 약 2.6GiB heap을 사용했다.
다음 조사는 constraint 종류·생성 위치별 retained heap을 축소 재현에서 측정하고,
ECharts/AG Grid의 필요한 API와 callback 지원 계약을 먼저 정하는 단계다.
그 근거 없이 라이브러리를 제외하거나 def-use/narrowing을 끄지 않았다.

재현 명령 (출력 경로는 매번 새 디렉터리 사용):

```powershell
node tools/flow-evaluation/run-dart.cjs lib/main.js tmp/new-memory-run C:/Users/hj0712.jo/.codex/worktrees/jelly-evaluation/dev-branch renderer --react-callback-model --map-keys --heap-budget=3072
```

일반 CLI에서는 `node --max-old-space-size=4096 lib/main.js --max-heap-mb 3072 ...`로
동일 메모리 중단 정책을 지정한다. 이 설정은 분석 완료를 보장하는 옵션이 아니다.
