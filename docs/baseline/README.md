# 평가 자료 구분

`handoff-20260929.md`, `evaluation-20260929.md`, `results-20260929.json`은 이전
DART 평가에서 복사한 원본 자료다. 문서의 원래 상대 링크는 DART 평가 worktree
기준이며 현재 저장소에서는 해석되지 않을 수 있다. 기록 보존을 위해 내용을 수정하지 않았다.

현재 저장소의 실행 방법은 [평가 도구 README](../../tools/flow-evaluation/README.md),
작업 상태는 [01 작업 기록](../work-items/01-baseline.md)을 사용한다.

`reproduction-20260929.json`은 현재 fork와 npm 0.13.0의 새 실행 결과 및 원본
fixture의 SHA-256 비교를 담는다. 원래 평가와 별도이며 모델 개선 결과가 아니다.
`reference-package-lock.json`은 비교에 사용한 기존 npm Jelly 설치의 lockfile 사본이다.

후속 결과:

- `react-model-20260929.json`: 02의 실제 React fixture.
- `map-keys-20260929.json`: 03의 기본 연결과 Map 음성 대조.
- `dart-comparison-20260929.json`: 04의 npm/fork 기준/개선 hook 및 renderer 6회 실행.
- `final-controls-20260929.json`: 두 모델을 함께 켠 최종 fixture 검사.
- `evidence-v1/`: 05 계약에 맞춘 실제 결과 예제 6개. renderer 실패는 null 관계로 표시.
