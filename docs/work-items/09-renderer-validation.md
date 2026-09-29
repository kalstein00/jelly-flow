# 09 — 동일 범위 renderer 재검증과 완료 판정

상태: 계획. 선행: 07/08의 검증된 변경.

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

- [ ] 기존 278개 관련 테스트 및 변경에 추가된 예산/회귀 테스트.
- [ ] hook의 실제 483행 → 430행 연결과 기존 내부 호출, 선택 금지 연결 유지.
- [ ] React no-external 음성 대조, Map 정상 연결 유지/오연결 0.
- [ ] main.tsx에서 동일 closeViewInstance 연결과 선택 target 목록 확인; 없는 관계를 0으로 채우지 않기.
- [ ] 비용만 바꾼 수정은 정상 완료하는 fixture/hook의 전체 그래프 동등성 확인.
- [ ] 최종 renderer 3회 비교, source/entry/의존성/옵션/분석 모듈 목록 차이 기록.
- [ ] 이전 renderer는 완료 그래프가 없었으므로 전체 그래프 동등성 증명 불가함을 명시.
- [ ] 개별 실행 원본과 새 요약/한계/지원 범위를 보존하고 단계별 문서·커밋 정리.

source 범위를 줄였거나 정확성 검사를 약화하면 B/C로 채택하지 않는다. 4GB에서 일부만
가능하다면 bounded 모드로 명시하고, architecture-evidence production 통합은 별도 결정한다.
