"use strict";
// Enhance the shared offline renderer; its report evidence, selection and filtering remain the source of truth.
document.body.dataset.layout = "network";
const mapHeader = document.querySelector("header"), mapDetails = document.querySelector("aside");
const filesHeading = document.createElement("h2"); filesHeading.textContent = "Files";
mapHeader.append(filesHeading, byId("files"));
const coverageToggle = document.createElement("details"), coverageHeading = document.createElement("summary");
coverageHeading.textContent = "Coverage and limitations"; coverageToggle.append(coverageHeading, byId("coverage"));mapHeader.append(coverageToggle);
mapDetails.querySelectorAll("h3").forEach(heading => heading.remove());
const graphFiles = report.files, indices = new Map(graphFiles.map((file, i) => [file.path, i]));
const points = graphFiles.map((file, i) => ({file, x: Math.cos(i * 2.39996) * 25 * Math.sqrt(i + 1), y: Math.sin(i * 2.39996) * 25 * Math.sqrt(i + 1)}));
const links = report.edges.filter(edge => edge.source !== edge.target).map(edge => [indices.get(edge.source), indices.get(edge.target)]);
// Bounded deterministic force relaxation. Re-layout is not tied to filters or selection.
for (let step = 0; step < 70; step++) {
    const forces = points.map(point => [-point.x * .002, -point.y * .002]);
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
        const dx = points[i].x - points[j].x, dy = points[i].y - points[j].y, distance = dx * dx + dy * dy + 4;
        if (distance > 160000) continue;
        const force = 500 / distance;
        forces[i][0] += dx * force; forces[i][1] += dy * force;
        forces[j][0] -= dx * force; forces[j][1] -= dy * force;
    }
    for (const [a, b] of links) {
        const dx = points[b].x - points[a].x, dy = points[b].y - points[a].y;
        const distance = Math.hypot(dx, dy) || 1, force = (distance - 85) / distance * .025;
        forces[a][0] += dx * force; forces[a][1] += dy * force;
        forces[b][0] -= dx * force; forces[b][1] -= dy * force;
    }
    for (let i = 0; i < points.length; i++) {
        points[i].x += Math.max(-12, Math.min(12, forces[i][0]));
        points[i].y += Math.max(-12, Math.min(12, forces[i][1]));
    }
}
for (const point of points) positions.set(point.file.path, [point.x, point.y]);
folderLabels.clear();
for (const folder of folders) {
    const group = points.filter(point => point.file.folder === folder);
    folderLabels.set(folder, [group.reduce((sum, p) => sum + p.x, 0) / group.length, Math.min(...group.map(p => p.y)) - 20]);
}
const minX = Math.min(0, ...points.map(p => p.x)) - 60, minY = Math.min(0, ...points.map(p => p.y)) - 60;
overview.splice(0, 4, minX, minY, Math.max(500, Math.max(0, ...points.map(p => p.x)) - minX + 60), Math.max(350, Math.max(0, ...points.map(p => p.y)) - minY + 60));
view = [...overview];
const sharedDraw = draw;
draw = function() {
    sharedDraw();
    mapDetails.hidden = !selected;
    for (const line of scene.querySelectorAll("line")) {
        if ((line.dataset.cycle === "true" && byId("cycles").checked) || (line.dataset.crossArea === "true" && byId("crossings").checked)) continue;
        line.style.stroke = line.dataset.kind === "call" ? "#349dde" : "#ac78e5";
    }
};
let draggedFile;
const panStart = svg.onpointerdown, panMove = svg.onpointermove, panEnd = svg.onpointerup;
svg.onpointerdown = event => {
    const file = event.target.closest('[role="button"]')?.getAttribute("aria-label");
    if (!files.has(file)) {panStart(event);return;}
    draggedFile = file;svg.setPointerCapture(event.pointerId);event.preventDefault();
};
svg.onpointermove = event => {
    if (!draggedFile) {panMove(event);return;}
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const local = point.matrixTransform(svg.getScreenCTM().inverse());
    positions.set(draggedFile, [local.x, local.y]);draw();
};
svg.onpointerup = svg.onpointercancel = event => {
    if (draggedFile) {const file = draggedFile;draggedFile = undefined;select(files.get(file));}
    else panEnd(event);
};
draw();camera();
const selectionNotice=document.createElement("p");selectionNotice.id="selectionNotice";mapHeader.prepend(selectionNotice);
window.jellyView={
    capture(){return {snapshot:report.snapshot,selected,selectedFunction:selectedFunction?.id,expanded:[...expanded],view:[...view],positions:[...positions]};},
    restore(state){
        if(Array.isArray(state.view)&&state.view.length===4&&state.view.every(Number.isFinite)&&state.view[2]>0&&state.view[3]>0)view=[...state.view];
        for(const [file, point] of state.positions||[])if(files.has(file)&&Array.isArray(point)&&point.length===2&&point.every(Number.isFinite))positions.set(file,[...point]);
        expanded=new Set((state.expanded||[]).filter(file=>files.has(file)));
        selected=files.has(state.selected)?state.selected:undefined;
        selectedFunction=state.snapshot===report.snapshot?functions.get(state.selectedFunction):undefined;
        if(state.selected&&!selected)selectionNotice.textContent="Selected file no longer exists in this result: "+state.selected;
        for(const folder of folders){const members=report.files.filter(file=>file.folder===folder).map(file=>positions.get(file.path));folderLabels.set(folder,[members.reduce((sum,p)=>sum+p[0],0)/members.length,Math.min(...members.map(p=>p[1]))-20]);}
        draw();camera();
    }
};
