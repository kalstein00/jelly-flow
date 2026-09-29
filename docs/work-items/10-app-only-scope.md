# 10 — 앱 소스 범위

상태: 구현/단위 검증 완료. 사용자 요청에 따라 전체 의존성 분석에서 앱 코드 분석으로 목표를 변경한다.

- `--app-only <root>`로 명시한 디렉터리 안의 도달 가능한 앱 소스를 분석한다.
- node_modules 및 root 밖 구현은 제외한다. 외부 패키지 해석용 metadata는 읽는다.
- 앱 내부의 상대 import, alias, 공통 모듈은 유지한다. 외부 함수를 미해결 대상으로 취급한다.
- 기존 전체 분석 모드는 유지하고, scope 정보는 diagnostics/graph에 기록한다.
- 범위 경계/로컬 import/외부 제외 테스트 후 별도 커밋한다.

다음: 11에서 외부 구현을 읽지 않는 React 반환 모델, 12에서 실제 renderer 4GB 반복 검증.

검증: 범위 테스트 4개와 TypeScript build 통과. 로컬/공통 소스 호출 유지,
node_modules와 유사 이름의 sibling 디렉터리 제외, 외부 entry 거부, graph scope 표시 확인.
