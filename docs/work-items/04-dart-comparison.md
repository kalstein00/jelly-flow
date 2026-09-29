# 04 — DART 실제 호출부와 비용 비교

상태: 대기. 선행 조건: 01 기준 확보 및 02/03의 검증 가능한 변경.

## 고정 조건

- source HEAD: `e6628e840ed5d9c27f3cb99023a93f6ef979dc5b`
- 평가 checkout: `C:/Users/hj0712.jo/.codex/worktrees/jelly-evaluation/dev-branch`
- hook: `log-viewer-app/src/renderer/src/app/useWorkspaceAggregate.ts`
- renderer: `log-viewer-app/src/renderer/src/main.tsx`
- React/ReactDOM 18.3.1. dependency realpath가 basedir 내부인지 확인.
- Node old-space 4096MB / Jelly timeout 90초 / 외부 deadline 120초.
- approximate interpretation/동적 실행 비활성.

## 작업

- [ ] 재실행 시 HEAD, 미커밋 source, lock/dependency 버전 및 fixture 해시 확인.
- [ ] 동일 entry/범위/옵션에서 npm 기준, fork 기준, 개선 fork 비교.
- [ ] hook부터 실행하고 closeViewInstance 내부 호출과 실제 호출부 incoming 확인.
- [ ] renderer 예산 내 실행, exit/timeout/aborted/unprocessed/graph 생성 여부 기록.
- [ ] 경고, 모델 적용/제외 API, 미지원 callback, 선택 음성 대조군 비교.
- [ ] 분석 시간/메모리 정의와 wall time 구분. OS peak RSS로 오표기하지 않기.

## 성공/중단 기준

실제 callback 호출자 연결 개선과 알려진 오연결 비증가를 확인해야 한다.
OOM/timeout 결과는 실패 또는 partial로 남긴다. 단위 테스트 통과를 DART 성공으로
대체하지 않는다. 해결되지 않으면 다음 조사 대상을 기록하고 heap만 늘리지 않는다.

## 결과와 다음 시작점

미실행. 이전 renderer는 4GB OOM, hook callback incoming은 0이었다. 원인은 미확정.
