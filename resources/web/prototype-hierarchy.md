# THROWAWAY — DART hierarchy UI experiment

## Follow-up: a single review card (2026-10-13)

The user found even the layered graph too difficult to follow. The next question is whether one grounded review card helps decide an action without reading hundreds of nodes. Open `/?variant=D` on the same prototype server. This extends the existing comparison; it is not another set of graph layouts.

The manually curated candidate is `index.ts` ↔ `workspaceMenu.ts`. The stored report has two Possible calls edges and only the forward Imports edge. Reading the current source confirms that the startup file passes a shutdown callback into `installWorkspaceMenu`, and the menu calls that parameter on Quit. This explains the return call edge without a reverse import. The card recommends **deferring refactoring of this pair** rather than treating mutual file-level reachability as a defect. It does not dismiss the rest of the large SCC or claim runtime safety.

Source checks: `index.ts:1,381–383`, `workspaceMenu.ts:4–6,12–14`, and `workspaceMenu.test.ts:38–57`. The test already describes invoking the injected shutdown function on Quit; it was read, not executed. Source HEAD was `06ba4000436b8ae82086ec6c909f793d4061bb50`; the working tree was clean at inspection. The state panel records the two inspected SHA-256 file digests. The curated claim is gated to the inspected report snapshot; later source changes are not automatically verified.

D shows the suggested verdict, a two-file diagram, three source-backed observations, a concrete follow-up question, and contracts to preserve if a change is made. The user can record a temporary choice and copy the evidence (or select fallback text). Raw snapshot/edge evidence is collapsed. The full graph is available as an optional drilldown. The card explicitly labels its manually written interpretation; no automatic candidate selection or source reasoning engine was implemented. No DART source was changed or embedded in the repository.

Updated provisional direction: start from review questions and evidence cards, and use A/B/C only as supporting exploration. User feedback on D is pending; no production promotion or ADR change has occurred.

Manual D verification: the card rendered in the narrow in-app browser; temporary decision selection updated the copied evidence; the clipboard contents were read back and matched; optional drilldown opened `workspaceMenu.ts` in C; reloading D reset the temporary decision. No browser errors/warnings were observed. Screenshot: `tmp/hierarchy-prototype/D-review-card.jpg`. A selectable text fallback is provided when clipboard access fails or takes more than 1.5 seconds; this fallback was not separately forced during the manual check.

Question: does a collapsed structural overview plus a directional file layout make the existing DART analysis easier to read than the free-layout file cloud?

This is the UI branch of the `prototype` skill. Three structurally different variants share the existing explorer's header, project/area context, relation selector and read-only report data. The `/` route on a separate development server swaps rendering with `?variant=A|B|C`. It does not change the production server or regenerate the analysis. No variant has been accepted by the user yet; none is production code.

## Run

Keep the existing local web analysis server running with a completed DART result, then:

```text
npm run prototype:hierarchy
```

Defaults: analysis server `http://127.0.0.1:55704`, prototype `http://127.0.0.1:55705`. Override the source server with `npm run prototype:hierarchy -- http://127.0.0.1:<port>` and optionally append a saved project ID. Set `PROTOTYPE_PORT` if the prototype port is occupied. The runner rejects production mode and non-local sources. Ctrl+C stops it.

On startup, the runner GETs the project list and its displayed (otherwise latest completed) verified model. The snapshot stays in server memory. There are no mutation routes or target-source writes. No DART model, source code or screenshots are committed here.

## Compare

- A: `/?variant=A` — collapsed application cards; expand into path-owned groups, inspect aggregated file-pair links, enter an analysis area, expand real folders. Path ownership is exclusive (longest matching root, then path fallback). Analysis membership can overlap; shared files explain why the main area count differs from its path-owned group count.
- B: `/?variant=B` — defaults to `log-viewer-app/main`. SCCs collapse file-level cycles. A topological longest-path rank puts every remaining component edge left to right. Horizontal/vertical scrolling, zoom, file search and a selected file's one-hop neighborhood allow inspection. Search/neighborhood retains entire cycle components and explicitly says so. Unconnected files are in a separate status-labelled shelf, never silently discarded. File-internal edges do not determine this file-level hierarchy.
- C: `/?variant=C` — entry-selected reading desk, one-hop incoming/outgoing lists, a real folder tree, and one shortest confirmed path from the configured entry. No inferred IPC/event links or execution ordering.

The floating bottom bar and left/right arrow keys cycle variants; arrows in input/textarea/select/contenteditable fields do not switch. Variant, scope, relation and selected file are URL state. Other exploration state is transient. The expandable state panel and console show snapshot identity and all relevant displayed state on every render.

## Observation, 2026-10-13

Source: user's completed snapshot `875baee997009c264d9637eb45b49f0701dc1accc7fb294b36a956a4458fc875`, created `2026-10-13T07:34:11.431Z`.

- Inventory: 864 files; analyzed 788; unanalyzed 76. Path containment produces two applications and nine display groups across seven analysis areas.
- `log-viewer-app/main` analysis membership contains 329 files and 812 distinct inter-file Possible calls pairs. Of these files, 236 share the same main folder. Folder hierarchy alone cannot solve the density.
- Possible calls: 278 connected files collapse into 158 components over 17 ranks; five nontrivial SCCs include a **116-file component** containing the entry. Another 51 files have no inter-file call edge in this scope and are displayed separately. An SCC is mutual reachability at file granularity, not proof of recursive execution or a defect.
- Imports: 321 connected files, 317 components, three nontrivial SCCs; eight files displayed separately. Relation choice materially changes the structure, so the two graphs must remain separate.
- The full B layout still needs substantial scrolling. Condensing the 116-file component reveals an important structural fact but also hides its interior; forcing it into a simple tree would misrepresent the data.

**Provisional design verdict:** A is useful for choosing a scope. B makes static dependency direction and cycles explicit, but cannot serve as the only reading surface. C makes the interior of a large cycle and long filenames practical to inspect. Recommend combining A's overview, B's structural context, and C's file-level drilldown after user evaluation. This is a recommendation, not an accepted production decision.

This experiment revisits ADR 0001's free-layout default because the actual 864-file result was unreadable as an overview. It does not amend the accepted ADR or promote a winner yet.

## Manual browser verification

Used the actual snapshot, not synthetic graph data. Checked a narrow in-app panel and a 1500×960 desktop breakpoint; corrected narrow-panel overflow. Exercised application expansion, area entry, folder summary, B cycle members, file search and full-layer reset, C file traversal, Imports switching, URL variant switching, keyboard arrows and input exclusion. No browser warning/error logs were observed. Node syntax checks passed. Per the prototype skill, no automated tests or production hardening were added.

Local screenshots: `tmp/hierarchy-prototype/A-overview.jpg`, `B-layers.jpg`, `B-focus.jpg`, `C-focus.jpg`. These are excluded from Git and contain local project details. Source is retained on `codex/prototype-hierarchy`; context is linked from implementation issue #9. Main keeps the existing implementation until a direction is accepted and implemented properly.
