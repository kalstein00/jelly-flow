# Issue tracker: GitHub

스펙과 티켓은 kalstein00/jelly-flow의 GitHub Issues에서 관리한다.
gh 명령에는 --repo kalstein00/jelly-flow를 지정한다.

- 발행: gh issue create. 여러 줄 본문은 임시 UTF-8 파일과 --body-file을 사용한다.
- 조회: gh issue view <number> --json number,title,body,labels,comments
- 목록: gh issue list에 작업에 맞는 --state, --label 필터를 적용한다.
- 수정·댓글·종료: gh issue edit, comment, close를 사용한다.
- 하위 이슈와 선행 의존성은 GitHub의 native 링크로 기록한다.
  CLI가 지원하지 않으면 gh api를 사용하고, 기능을 사용할 수 없으면
  본문에 Part of #<parent>와 Blocked by: #<number>를 기록한다.
- 기존 docs/work-items/ 기록은 유지한다.
  해당 작업을 이어갈 때는 docs/work-items/README.md의 관리 규칙을 따른다.

**PRs as a request surface: no.**
