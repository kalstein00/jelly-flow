"use strict";
const report = /*REPORT_DATA*/null;
const byId = id => document.getElementById(id);
const svg = byId("map"), scene = byId("scene"), ns = "http://www.w3.org/2000/svg";
const palette = ["#7ba8e0", "#7fc8a9", "#c998da", "#e0b57b", "#df8d9a", "#86c6d9"];
const files = new Map(report.files.map(f => [f.path, f]));
const functions = new Map(report.files.flatMap(f => f.functions).map(f => [f.id, f]));
const folders = [...new Set(report.files.map(f => f.folder))].sort();
const positions = new Map();
let view = [0, 0, 1200, 800], drag, selected, selectedFunction, expanded = new Set(), depth = 1;
let layoutY = 55;
for (const folder of folders) {
    const members = report.files.filter(f => f.folder === folder);
    members.forEach((f, i) => positions.set(f.path, [80 + (i % 8) * 140, layoutY + Math.floor(i / 8) * 95]));
    layoutY += Math.ceil(members.length / 8) * 95 + 45;
}
function camera() { svg.setAttribute("viewBox", view.join(" ")); }
byId("zoomIn").onclick = () => { view[2] *= .8; view[3] *= .8; camera(); };
byId("zoomOut").onclick = () => { view[2] *= 1.25; view[3] *= 1.25; camera(); };
byId("reset").onclick = () => { view = [0, 0, 1200, Math.max(800, layoutY)]; camera(); };
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
        file.path, "Status: " + file.status, "Distinct caller files: " + file.callers,
        "Folder: " + file.folder, "Areas: " + file.areas.join(", "),
        "Metrics use the original snapshot, independent of filters.",
        selectedFunction ? "Function: " + selectedFunction.name + "\nLocation: " + selectedFunction.location : "",
        hidden ? hidden + " connections have hidden neighbors (partial display)." : "",
        ...related.map(e => (e.kind === "call" ? "Possible calls" : "Imports") + ": " + e.source + " → " + e.target +
            " · " + e.count + (e.kind === "call" ? " distinct function pairs" : " import sites") + "\n" + e.sites.join("\n")),
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
for (const id of ["area", "calls", "imports"]) byId(id).onchange = draw;
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
        if (member) scene.append(element("text", {x: 20, y: positions.get(member.path)[1] - 28, opacity: .6}, folder));
    }
    function line(a, b, edge, emphasized) {
        scene.append(element("line", {x1: a[0], y1: a[1], x2: b[0], y2: b[1], "data-kind": edge.kind,
            "stroke-dasharray": edge.kind === "import" ? "5 4" : "none", "stroke-width": edge.kind === "call" ? 1 + Math.log2(1 + edge.count) : 1,
            "marker-end": "url(#arrow)", style: "stroke-opacity:" + (emphasized ? ".95" : selected ? ".12" : ".35")}));
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
        const circle = element("circle", {cx: x, cy: y, r: fun ? 4 : 7 + Math.log2(1 + file.callers) * 3,
            fill: palette[folders.indexOf(file.folder) % palette.length],
            "stroke-dasharray": file.status === "unanalyzed" ? "3 2" : "none",
            opacity: !selected || neighbors.has(file.path) ? 1 : .35});
        const text = element("text", {x: x + 14, y: y - 8, visibility: selected === file.path ? "visible" : "hidden"}, label);
        group.append(circle, element("title", {}, label + " · " + file.status), text);
        group.onclick = () => select(file, fun);
        group.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(file, fun); } };
        group.onmouseenter = group.onfocus = () => text.setAttribute("visibility", "visible");
        group.onmouseleave = group.onblur = () => text.setAttribute("visibility", selected === file.path ? "visible" : "hidden");
        scene.append(group);
    }
    for (const file of visible) {
        node(file, positions.get(file.path));
        button(byId("files"), file.path, () => { select(file); const [x,y] = positions.get(file.path); view = [x-250,y-200,600,450]; camera(); }).title = file.status;
        if (expanded.has(file.path)) for (const fun of file.functions) node(file, functionPositions.get(fun.id), fun);
    }
    byId("status").textContent = visible.length + " / " + report.files.length + " files · " + connections + " visible directed connections" +
        (visible.length < report.files.length ? " · Partial display" : "") + (selected ? " · " + depth + "-step neighbors highlighted" : "");
    details(shown);
}
byId("coverage").textContent = JSON.stringify({snapshot: report.snapshot, created: report.created, selection: report.selection, runs: report.runs, limitations: report.limitations}, null, 2);
draw(); camera();
