# 오프라인 보고서 CLI

Node >=22, 설치된 jelly-flow 의존성과 빌드가 필요하다. skill 폴더 전체를 소비 프로젝트의 skill 위치에 복사하고 JELLY_FLOW_HOME에 analyzer checkout 위치를 설정한다.

설정 예시(경로는 소비 프로젝트에 맞게 작성):

```json
{
  "root": "/absolute/project",
  "areas": [
    {"name": "app", "entries": ["src/main.ts"], "roots": ["src"]}
  ],
  "selection": "all",
  "timeoutSeconds": 90,
  "heapMB": 4096
}
```

- entries는 분석을 시작하는 실제 파일이다. roots는 전체 앱 inventory를 구성하는 폴더/파일이다. 미도달 파일도 inventory에 남는다. 공유 파일은 여러 영역에 속할 수 있다.
- selection은 all 또는 ["src/a.ts", "src/b.ts"]다. 부분 보고서도 원본 snapshot의 지표와 순환 근거를 유지하고 잘린 이웃을 명시한다.
- 출력과 설정은 .jelly-flow 안이나 프로젝트 외부에 둔다. 생성 파일이 다음 입력 identity를 바꾸지 않게 한다.
- 공개 산출물 입력 경계: node <analyzer>/lib/report/main.js <report-input.json> <report.html>.
- 실제 분석부터 수행: node <analyzer>/lib/report/project-main.js <config.json> <report.html>.
- 복사한 skill의 launcher: node <skill>/scripts/report.cjs <config.json> <report.html>.
- stdout JSON의 status는 generated 또는 reused. generated의 analysis는 completed 또는 partial. exit 1이면 실패 진단을 표시한다. partial/손상 cache는 재사용하지 않는다.
- HTML 한 파일만 이동해도 동작한다. 옆의 manifest JSON은 재사용 검증용이며 HTML 열기에 필요하지 않다.
- 재사용은 source/config bytes, installed dependency source/config bytes와 lockfiles, analyzer build/resources/revision, Node, 영역·선택·budgets identity와 HTML digest가 일치할 때만 허용한다. 외부 구현은 분석하지 않는다. 의존성 symlink는 실제 대상과 내용을 검증하고 순환·중복을 제거한다. source symlink는 명시적으로 실패한다.
- 테스트·외부 구현은 기본 제외하며 경로 이름으로 IPC를 생성하지 않는다. import resolver가 찾지 못한 alias/external import는 unresolved로 보존한다.
- 부분 결과, 경고, 미분석 inventory는 HTML의 Coverage and limitations에서 확인한다. 앱 전체 coverage와 관계의 의미적 완전성은 다르다.

검증 명령은 analyzer checkout에서 실행한다:

```text
node node_modules/typescript/bin/tsc --build tsconfig-build.json
node node_modules/jest/bin/jest.js tests/output/offline-report.test.ts tests/output/report-project.test.ts tests/output/offline-browser.test.ts --runInBand
```

브라우저 테스트는 REPORT_BROWSER의 실행 파일 또는 설치된 Chrome/Chromium을 사용한다. 생성 HTML을 file URL로 열고 offline 모드에서 확인한다.
