"use strict";
const report = /*REPORT_DATA*/null;
const byId = id => document.getElementById(id);
const svg = byId("map"), scene = byId("scene"), ns = "http://www.w3.org/2000/svg";
const palette = ["#7ba8e0", "#7fc8a9", "#c998da", "#e0b57b", "#df8d9a", "#86c6d9"];
const files = new Map(report.files.map(f => [f.path, f]));
const functions = new Map(report.files.flatMap(f => f.functions).map(f => [f.id, f]));
const folders = [...new Set(report.files.map(f => f.folder))].sort();
const positions = new Map();
const folderLabels = new Map();
let view = [0, 0, 1200, 800], drag, selected, selectedFunction, expanded = new Set(), depth = 1;
let layoutX = 20, layoutY = 40, shelfHeight = 0, mapWidth = 0;
for (const folder of [...folders].sort((a,b)=>report.files.filter(f=>f.folder===b).length-report.files.filter(f=>f.folder===a).length)) {
    const members = report.files.filter(f => f.folder === folder);
    const columns = Math.min(18, Math.max(3, Math.ceil(Math.sqrt(members.length))));
    const width = columns * 36 + 40, height = Math.ceil(members.length / columns) * 36 + 70;
    if (layoutX + width > 1500) {layoutX=20;layoutY+=shelfHeight;shelfHeight=0;}
    folderLabels.set(folder,[layoutX,layoutY]);
    members.forEach((f, i) => positions.set(f.path, [layoutX+20+(i%columns)*36,layoutY+30+Math.floor(i/columns)*36]));
    mapWidth=Math.max(mapWidth,layoutX+width);layoutX+=width;shelfHeight=Math.max(shelfHeight,height);
}
const overview=[0,0,Math.max(500,mapWidth),Math.max(350,layoutY+shelfHeight)];
view=[...overview];
function camera() { svg.setAttribute("viewBox", view.join(" ")); }
byId("zoomIn").onclick = () => { view[2] *= .8; view[3] *= .8; camera(); };
byId("zoomOut").onclick = () => { view[2] *= 1.25; view[3] *= 1.25; camera(); };
byId("reset").onclick = () => { view = [...overview]; camera(); };
svg.onpointerdown = e => { if (e.target.closest('[role="button"]')) return; drag = [e.clientX, e.clientY, ...view]; svg.setPointerCapture(e.pointerId); };
svg.onpointermove = e => {
    if (drag) { view[0] = drag[2] - (e.clientX - drag[0]) * view[2] / svg.clientWidth; view[1] = drag[3] - (e.clientY - drag[1]) * view[3] / svg.clientHeight; camera(); }
};
svg.onpointerup = svg.onpointercancel = () => { drag = null; };
svg.onwheel = e => { e.preventDefault(); const scale = e.deltaY > 0 ? 1.1 : .9; view[2] *= scale; view[3] *= scale; camera(); };
function element(tag, attrs, text) {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
}
function button(parent, text, click) {
    const e = document.createElement("button"); e.textContent = text; e.onclick = click; parent.append(e); return e;
}
function relationEnabled(edge) { return edge.kind === "call" ? byId("calls").checked : byId("imports").checked; }
function radius(file) { return Math.min(14, 3 + Math.log2(1 + file.callers) * 1.5); }
function select(file, fun) {
    selected = file.path; selectedFunction = fun; depth = 1;
    byId("copyStatus").textContent = "";
    draw();
}
function details(visible) {
    byId("functions").replaceChildren();
    if (!selected) return;
    const file = files.get(selected);
    const related = report.edges.filter(e => e.source === selected || e.target === selected);
    const hidden = related.filter(e => relationEnabled(e) && (!visible.has(e.source) || !visible.has(e.target))).length;
    byId("details").textContent = [
        file.path, "Status: " + file.status, "Distinct caller files: " +
            (file.metricStatus === "unknown" ? "unknown" : file.callers + (file.metricStatus === "lower-bound" ? " (lower bound)" : "")),
        "Folder: " + file.folder, "Areas: " + file.areas.join(", "),
        "Metrics use the original snapshot, independent of filters.",
        selectedFunction ? "Function: " + selectedFunction.name + "\nLocation: " + selectedFunction.location : "",
        hidden ? hidden + " connections have hidden neighbors (partial display)." : "",
        ...related.map(e => (e.kind === "call" ? "Possible calls" : "Imports") + ": " + e.source + " → " + e.target +
            " · " + e.count + (e.kind === "call" ? " distinct function pairs" : " import sites") +
            (e.cycle ? " · Cycle" : "") + (e.crossArea ? " · Across areas (different memberships)" : "") + "\n" + e.sites.join("\n")),
        ...(report.imports || []).filter(i => i.source === selected && !i.target).map(i => "Unresolved/external import: " + i.specifier + " at " + i.location)
    ].filter(Boolean).join("\n");
    byId("path").value = file.path;
    byId("expand").disabled = false; byId("twoSteps").disabled = false; byId("copy").disabled = false;
    byId("expand").textContent = expanded.has(selected) ? "Collapse functions" : "Expand functions";
    if (expanded.has(selected)) {
        if (!file.functions.length) byId("functions").textContent = "No classified functions available.";
        for (const fun of file.functions) button(byId("functions"), fun.name, () => select(file, fun));
    }
}
byId("expand").onclick = () => { if (expanded.has(selected)) expanded.delete(selected); else expanded.add(selected); draw(); };
byId("twoSteps").onclick = () => { depth = 2; draw(); };
byId("copy").onclick = async () => {
    try {
        await Promise.race([navigator.clipboard.writeText(files.get(selected).path),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Clipboard permission pending")), 1500))]);
        byId("copyStatus").textContent = "Copied";
    }
    catch { byId("copyStatus").textContent = "Copy unavailable. Select the path text below."; byId("path").focus(); byId("path").select(); }
};
const areas = [...new Set([...report.files.flatMap(f => f.areas), ...report.runs.map(r => r.area)])].sort();
for (const area of areas) { const option = document.createElement("option"); option.value = area; option.textContent = area; byId("area").append(option); }
for (const id of ["area", "calls", "imports", "cycles", "crossings"]) byId(id).onchange = draw;
byId("search").oninput = draw;
if (!report.imports) { byId("imports").disabled = true; byId("imports").parentElement.append(" (unavailable)"); }
function draw() {
    scene.replaceChildren(); byId("files").replaceChildren();
    const query = byId("search").value.toLowerCase();
    const visible = report.files.filter(f => (!byId("area").value || f.areas.includes(byId("area").value)) &&
        (!query || f.path.toLowerCase().includes(query) || f.functions.some(fn => fn.name.toLowerCase().includes(query))));
    const shown = new Set(visible.map(f => f.path)), neighbors = new Set(selected ? [selected] : []);
    for (let step = 0; step < depth; step++) {
        const previous = new Set(neighbors);
        for (const edge of report.edges.filter(relationEnabled)) {
            if (previous.has(edge.source)) neighbors.add(edge.target);
            if (previous.has(edge.target)) neighbors.add(edge.source);
        }
    }
    const functionPositions = new Map();
    for (const file of visible) if (expanded.has(file.path)) {
        const [x, y] = positions.get(file.path);
        file.functions.forEach((fn, i) => functionPositions.set(fn.id, [x + 25 + (i % 5) * 32, y + 25 + Math.floor(i / 5) * 30]));
    }
    for (const folder of folders) {
        const member = visible.find(f => f.folder === folder);
        if (member) {const [x,y]=folderLabels.get(folder);scene.append(element("text", {x,y,opacity:.7},folder));}
    }
    function line(a, b, edge, emphasized) {
        const highlighted = (byId("cycles").checked && edge.cycle) || (byId("crossings").checked && edge.crossArea);
        const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
        if (!length) return;
        const ux=dx/length,uy=dy/length;
        const startRadius=a===positions.get(edge.source)?radius(files.get(edge.source)):3;
        const endRadius=b===positions.get(edge.target)?radius(files.get(edge.target)):3;
        // End arrows outside node strokes; reciprocal edges take opposite parallel lanes.
        scene.append(element("line", {x1: a[0]+ux*(startRadius+2)-uy*2, y1:a[1]+uy*(startRadius+2)+ux*2,
            x2:b[0]-ux*(endRadius+2)-uy*2,y2:b[1]-uy*(endRadius+2)+ux*2,"data-kind": edge.kind,
            "stroke-dasharray": edge.kind === "import" ? "5 4" : "none", "stroke-width": edge.kind === "call" ? 1 + Math.log2(1 + edge.count) : 1,
            "data-cycle": !!edge.cycle, "data-cross-area": !!edge.crossArea,
            "marker-end": "url(#arrow)", style: "stroke:" + (highlighted ? "#ffd58a" : "#6d829f") +
                ";stroke-opacity:" + (emphasized || highlighted ? ".85" : selected ? ".06" : ".13")}));
    }
    let connections = 0;
    for (const edge of report.edges) {
        if (!shown.has(edge.source) || !shown.has(edge.target) || !relationEnabled(edge)) continue;
        const emphasized = selected && neighbors.has(edge.source) && neighbors.has(edge.target);
        if (edge.source !== edge.target) { line(positions.get(edge.source), positions.get(edge.target), edge, emphasized); connections++; }
        if (edge.kind === "call" && (expanded.has(edge.source) || expanded.has(edge.target))) {
            for (const [a, b] of edge.pairs) {
                const start = functionPositions.get(a) || positions.get(edge.source);
                const end = functionPositions.get(b) || positions.get(edge.target);
                if (start !== end) line(start, end, edge, true);
            }
        }
    }
    function node(file, position, fun) {
        const [x, y] = position, label = fun ? fun.name : file.path;
        const group = element("g", {role: "button", tabindex: 0, "aria-label": label});
        const circle = element("circle", {cx: x, cy: y, r: fun ? 3 : radius(file),
            fill: palette[folders.indexOf(file.folder) % palette.length],
            "stroke-dasharray": file.status === "unanalyzed" ? "3 2" : "none",
            opacity: !selected || neighbors.has(file.path) ? 1 : .35});
        const isSelected = fun ? selectedFunction?.id === fun.id : selected === file.path;
        const text = element("text", {x: x + 14, y: y - 8, visibility: isSelected ? "visible" : "hidden"}, label);
        group.append(circle, element("title", {}, label + " · " + file.status), text);
        group.onclick = () => select(file, fun);
        group.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(file, fun); } };
        group.onmouseenter = group.onfocus = () => text.setAttribute("visibility", "visible");
        group.onmouseleave = group.onblur = () => text.setAttribute("visibility", isSelected ? "visible" : "hidden");
        scene.append(group);
    }
    for (const file of visible) {
        node(file, positions.get(file.path));
        button(byId("files"), file.path, () => { select(file); const [x,y] = positions.get(file.path); view = [x-250,y-200,600,450]; camera(); }).title = file.status;
        if (expanded.has(file.path)) for (const fun of file.functions) node(file, functionPositions.get(fun.id), fun);
    }
    byId("status").textContent = visible.length + " / " + report.files.length + " files · " + connections + " visible directed connections" +
        " · Snapshot analyzed: " + report.coverage.analyzed + "/" + report.coverage.inventory + "; unanalyzed: " + report.coverage.unanalyzed +
        (visible.length < report.files.length ? " · Partial display" : "") + (selected ? " · " + depth + "-step neighbors highlighted" : "") +
        (byId("cycles").checked ? " · Cycles: " + report.edges.filter(e=>e.cycle && relationEnabled(e)).length : "") +
        (byId("crossings").checked ? " · Across areas: " + report.edges.filter(e=>e.crossArea && relationEnabled(e)).length : "");
    details(shown);
}
byId("coverage").textContent = JSON.stringify({snapshot: report.snapshot, created: report.created, selection: report.selection,
    provenance: report.provenance, coverage: report.coverage, runs: report.runs, limitations: report.limitations}, null, 2);
draw(); camera();
