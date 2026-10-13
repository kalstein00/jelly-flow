"use strict";
(() => {
    const calls = report.edges.filter(edge => edge.kind === "call" && edge.source !== edge.target);
    const outgoing = new Map(report.files.map(file => [file.path, new Set()]));
    for (const edge of calls) outgoing.get(edge.source).add(edge.target);
    function section(id, title) {
        const details = document.createElement("details"), summary = document.createElement("summary"), list = document.createElement("div");
        details.open = true;summary.textContent = title;list.id = id;list.className = "candidates";
        details.append(summary, list);mapHeader.insertBefore(details, coverageToggle);return list;
    }
    const concentration = section("concentration", "Connection concentration"), cycleList = section("cycleList", "Cycles by relation");
    const status = document.createElement("p");status.id="candidateStatus";mapHeader.insertBefore(status, coverageToggle);
    const cycles = [];
    for (const kind of ["call", "import"]) {
        const edges = report.edges.filter(edge => edge.kind === kind && edge.cycle);
        const neighbors = new Map();
        for (const edge of edges) for (const [a,b] of [[edge.source,edge.target],[edge.target,edge.source]]) {
            if (!neighbors.has(a)) neighbors.set(a, new Set());neighbors.get(a).add(b);
        }
        const visited = new Set();
        for (const start of neighbors.keys()) {
            if (visited.has(start)) continue;
            const members = new Set(), stack = [start];
            while (stack.length) {
                const file=stack.pop();if(visited.has(file))continue;
                visited.add(file);members.add(file);stack.push(...neighbors.get(file));
            }
            cycles.push({kind,members,edges:edges.filter(edge=>members.has(edge.source))});
        }
    }
    let selectedCycle;
    const metric = (file, count) => file.metricStatus === "known" ? String(count) : count ? "≥"+count : "unknown";
    function update() {
        const visible = new Set([...byId("files").querySelectorAll("button")].map(item=>item.textContent));
        concentration.replaceChildren();cycleList.replaceChildren();
        for (const file of [...report.files].sort((a,b)=>b.callers-a.callers || a.path.localeCompare(b.path))) {
            if (!visible.has(file.path)) continue;
            button(concentration, `${file.path} · in ${metric(file,file.callers)} · out ${metric(file,outgoing.get(file.path).size)}`,()=>{
                selectedCycle=undefined;select(file);
            });
        }
        for (const cycle of cycles) {
            button(cycleList, `${cycle.kind==="call"?"Possible calls":"Imports"} · ${cycle.members.size} files · ${cycle.edges.length} links`,()=>{
                selectedCycle=cycle;byId(cycle.kind==="call"?"calls":"imports").checked=true;byId("cycles").checked=true;
                const first=[...cycle.members].find(file=>visible.has(file));
                if (first) select(files.get(first)); else draw();
            });
        }
        if (!cycles.length) cycleList.textContent="No cycles found in this result.";
        const hidden=selectedCycle?[...selectedCycle.members].filter(file=>!visible.has(file)).length:0;
        status.textContent="Counts use the original snapshot. In/out are distinct external caller/callee files, not defect scores."+(hidden?` ${hidden} cycle files hidden by filters.`:"");
        if (selectedCycle && byId("cycles").checked) for (const line of scene.querySelectorAll("line")) {
            if (line.dataset.kind===selectedCycle.kind && line.dataset.cycle==="true" && selectedCycle.members.has(line.dataset.source) && selectedCycle.members.has(line.dataset.target)) {
                line.style.stroke="#f2c36c";line.style.strokeOpacity="1";
            } else line.style.strokeOpacity=".08";
        }
    }
    const mapDraw=draw;draw=function(){mapDraw();update();};draw();
})();
