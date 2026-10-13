# 로컬 웹 구조 탐색

jelly-flow 저장소에서 Node.js 22 이상과 의존성을 준비한 뒤 실행한다.

```text
npm ci
npm run web
```

터미널의 `Jelly Flow: http://127.0.0.1:...` 주소를 브라우저에서 연다. 기본 포트는 사용 가능한 임의 포트다. `Ctrl+C`로 서버와 진행 중 분석을 종료한다. 외부 공유나 자동 시작 서비스는 제공하지 않는다.

## 프로젝트 등록과 탐색

1. **Project folder**에 대상 프로젝트의 절대경로를 입력하고 **Suggest settings**를 누른다.
2. 근거와 경고를 읽고 **Analysis areas (JSON)**의 실행 영역 이름, 프로젝트 상대 진입점 `entries`, 소스 범위 `roots`를 확인·수정한다. 제안만으로 분석은 시작되지 않는다.
3. **Save project**로 저장한 뒤 **Analyze**를 누른다. 저장한 프로젝트는 서버를 다시 시작한 뒤 왼쪽 목록에서 선택할 수 있다.
4. 파일 지도에서 검색, 영역·관계 필터, 확대·이동과 파일 노드 드래그를 사용한다. 파일이나 후보 목록 항목을 선택하면 상세 정보가 표시된다. **Expand functions**로 함수와 소스 위치를 확인한다.
5. **Copy review evidence**로 현재 선택의 경로·위치·관계·분석 시점·coverage를 복사한다. 복사가 거부되면 아래 텍스트를 직접 선택해 복사한다. 실제 수정은 대상 프로젝트에서 한다.
6. 수정 후 **Analyze**로 수동 재분석한다. 완료 결과로 전환할 때 남아 있는 파일 선택과 화면 위치를 유지한다. 삭제된 선택 파일은 알림으로 표시한다. 함수 identity는 snapshot이 바뀌면 이어 붙이지 않는다.

Possible calls는 정적 분석의 호출 가능성이다. 실행 여부·시간이나 성능 병목을 뜻하지 않는다. Imports와 별도로 표시하며, 기본 관계는 Possible calls다. 연결 집중 목록의 in/out은 서로 다른 외부 호출 파일 수다. 필터와 무관하게 원래 snapshot 기준을 유지하고 부분·미분석 수치를 알려준다. 순환도 관계별로 구분한다. 목록과 그래프의 밀집은 코드 검토의 출발점이며 결함 판정이 아니다.

## 설정 제안의 범위

설정 파일을 실행하지 않고 다음 근거를 읽는다.

- `package.json`의 `source`, `index.html`의 로컬 script source와 존재하는 `src/main`, `src/index` 등 관례적 진입점.
- npm workspace의 명시적 디렉터리와 한 단계 `/*` 패턴.
- Electron Vite의 main/preload/renderer 영역과 존재하는 관례적 소스. custom build input은 수동 확인 경고를 표시한다.
- `?modulePath`, `?worker` 및 `new Worker(new URL(...))`의 명시적 소스 참조.

동적 설정, 모든 프레임워크나 workspace 패턴을 완전히 해석하지 않는다. 문자열 내부 worker는 실행·분석하지 않는다. 미확정 진입점은 만들어내지 않으며 수동 JSON 편집을 제공한다. **Coverage and limitations**에서 실제 분석된 파일, 미분석 파일, 영역별 완료 상태와 진단을 확인한다. 실행의 completed는 모든 runtime 관계를 수집했다는 뜻이 아니다.

## 저장·재분석·부분 결과

설정과 결과의 기본 저장 위치는 사용자 홈의 `.jelly-flow/web`이다. `JELLY_FLOW_DATA_DIR`로 대상 프로젝트 밖의 다른 폴더를 지정하고 `JELLY_FLOW_PORT`로 포트를 지정할 수 있다. 대상 프로젝트에 도구용 설정이나 runtime dependency를 설치하지 않는다.

재분석 중에도 이전 지도를 탐색할 수 있다. 실패 또는 부분 완료는 새 상태와 진단을 표시하고 이전 지도를 유지한다. **Open partial result**로 부분 결과를 명시적으로 열고 **Show previous result**로 이전에 보던 결과에 돌아간다. 이전 결과도 부분 결과일 수 있고 이 선택은 재시작 후에도 보존된다. 첫 분석에서는 실패·부분 상태를 먼저 표시하며 빈 성공 지도를 만들지 않는다. 저장된 결과를 열 때도 산출물 무결성을 확인하고 손상됐으면 재분석을 안내한다.

결과는 표시된 분석 시점의 snapshot이다. 소스가 바뀌어도 재분석 전에는 실시간 최신 결과라고 주장하지 않는다. 소스·설정·의존성·분석기 bytes를 확인하고 산출물 digest까지 일치할 때만 완료 결과를 재사용한다. 입력 검증 자체에도 시간이 걸린다. 분석 도중 입력이 달라지면 결과를 발행하지 않는다.

## 기존 오프라인 HTML

기존 독립 HTML 생성은 그대로 사용할 수 있다.

```text
node .agents/skills/jelly-flow/scripts/report.cjs <project-config.json> <report.html>
```

생성된 HTML은 다른 폴더로 옮겨 서버 없이 열 수 있다. 설정 형식과 분석 옵션은 [기존 CLI 계약](../.agents/skills/jelly-flow/references/cli.md)을 따른다. 웹의 프로젝트 관리 화면은 오프라인 HTML에 포함되지 않는다.

## 검증 재현

```text
node node_modules/typescript/bin/tsc --build tsconfig-build.json
node node_modules/typescript/bin/tsc --noEmit --incremental false --composite false
node node_modules/jest/bin/jest.js tests/web/browser.test.ts --runInBand
node tools/web-browser-check.cjs <target-root> <evidence-directory-outside-target>
```

Chrome/Chromium을 사용한다. 자동 탐색되지 않으면 `REPORT_BROWSER`로 실행 파일 경로를 지정한다. 브라우저 검증 도구는 등록·제안·실제 분석·후보·근거 복사·동일 입력 재분석·이동한 HTML 오프라인 탐색을 수행하며 JSON, screenshot, 복사 근거를 증거 디렉터리에 저장한다. 실제 소스 변경·삭제·부분 결과·프로젝트 전환은 브라우저 테스트의 격리된 TS fixture에서 검증한다.
