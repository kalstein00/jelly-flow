# 12 — 앱 코드 renderer 검증

상태: 계획.

- 기존 DART snapshot, Node 24.20.0, old-space 4096MiB, 90초 분석/120초 외부 제한 유지.
- 앱 코드 범위로 변경했음을 명시한다. 외부 구현 포함 모드의 OOM 해결로 주장하지 않는다.
- 실제 hook 및 renderer의 closeViewInstance 호출/내부 호출 확인.
- renderer 3회 정상 완료, 외부 구현 파일 0, 오류/timeout/미처리 상태 확인.
- 기존 회귀 테스트와 새 범위/모델 테스트, 재현 문서/측정 결과를 기록하고 커밋한다.
