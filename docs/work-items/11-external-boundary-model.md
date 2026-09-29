# 11 — 외부 구현 없는 경계 모델

상태: 계획.

- React 18.3.1의 public entry를 metadata로 식별해 useCallback 반환 관계를 모델링한다.
- 모델 설치를 외부 소스 AST 분석과 분리한다. 외부 구현을 분석했다고 표시하지 않는다.
- 다른 외부 API는 기존 미해결 처리를 유지하고 지원 범위를 명시한다.
- alias/default/namespace/re-export, 등록 시 실행 금지, 타 패키지/버전 음성 대조 검증 후 커밋한다.
