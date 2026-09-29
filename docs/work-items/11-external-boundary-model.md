# 11 — 외부 구현 없는 경계 모델

상태: 구현/회귀 검증 완료.

- React 18.3.1의 public entry를 metadata로 식별해 useCallback 반환 관계를 모델링한다.
- 모델 설치를 외부 소스 AST 분석과 분리한다. 외부 구현을 분석했다고 표시하지 않는다.
- 다른 외부 API는 기존 미해결 처리를 유지하고 지원 범위를 명시한다.
- alias/default/namespace/re-export, 등록 시 실행 금지, 타 패키지/버전 음성 대조 검증 후 커밋한다.

앱 모드는 React 모델을 자동 적용한다. 기존 전체 분석에서 `--react-callback-model`은
여전히 opt-in/additive다. `implementationAnalyzed=false` 및 excludedModules 목록으로
외부 구현 제외를 명시한다. 미지원 React named/namespace export는 unknown으로 남긴다.
모델은 React public 18.3.1의 useCallback만 지원하며 useMemo/useEffect의 반환/실행
의미, 동적 export 열거, 외부 export-star의 완전성, JSX/event 등록 관계는 보장하지 않는다.
외부 호출에 전달된 callback의 기존 보수적 may-call 처리는 실제 이벤트 실행의 증거가 아니다.

Flow + unit 275개 통과. 첫 실제 renderer 실행은 530개 앱 모듈/6,663개 함수,
약 12초 wall / sampled heap 725MiB에서 전파 완료, 미처리 token 0, 선택 callback 연결 성공.
다만 CSS 45건/JSON 1건 import 해석 오류로 partial이다. 12에서 데이터 리소스 구분을 보완한다.
