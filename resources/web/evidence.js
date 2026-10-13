"use strict";
(() => {
    const copy = document.createElement("button"), status = document.createElement("p"), preview = document.createElement("textarea");
    copy.textContent = "Copy review evidence";status.id = "evidenceStatus";status.setAttribute("role", "status");
    preview.setAttribute("aria-label", "Review evidence");preview.readOnly = true;preview.hidden = true;
    mapDetails.append(copy, status, preview);
    function evidence() {
        if (!selected) return "";
        const file = files.get(selected);
        const lines = ["Jelly Flow — review evidence", "Project: " + (report.provenance?.root || "Not recorded"),
            "Analyzed: " + report.created, "Snapshot: " + report.snapshot,
            "Run status: " + (report.runs.every(run => run.status === "completed") ? "completed" : "partial"),
            "Areas: " + report.runs.map(run => run.area + "=" + run.status).join(", "),
            `Coverage: ${report.coverage.analyzed}/${report.coverage.inventory}; ${report.coverage.unanalyzed} unanalyzed`,
            "Scope: " + JSON.stringify(report.selection), "Selected file: " + file.path + " (" + file.status + ")"];
        if (selectedFunction) lines.push("Function: " + selectedFunction.name, "Location: " + selectedFunction.location);
        lines.push("Snapshot relationships (not limited by visual filters):");
        for (const edge of report.edges) {
            if (edge.source !== selected && edge.target !== selected) continue;
            const pairs = selectedFunction ? edge.pairs.filter(pair => pair.includes(selectedFunction.id)) : edge.pairs;
            if (edge.kind === "call" && selectedFunction && !pairs.length) continue;
            lines.push(`${edge.kind === "call" ? "Possible calls" : "Imports"}: ${edge.source} → ${edge.target}${edge.cycle ? " [cycle]" : ""}`);
            for (const [a, b] of pairs) lines.push(`  ${functions.get(a)?.name || a} at ${a} → ${functions.get(b)?.name || b} at ${b}`);
            for (const site of edge.sites) lines.push("  " + (edge.kind === "call" ? "File-level call location: " : "Import location: ") + site);
        }
        lines.push("Possible calls are static possibilities, not observed execution. High connectivity is a review candidate, not a defect.", ...report.limitations);
        return lines.join("\n");
    }
    copy.onclick = async () => {
        preview.value = evidence();preview.hidden = false;
        try {
            await Promise.race([navigator.clipboard.writeText(preview.value), new Promise((_, reject) => setTimeout(() => reject(new Error("Clipboard permission pending")), 1500))]);
            status.textContent = "Copied review evidence.";
        } catch {status.textContent = "Copy unavailable. Select the review evidence below.";preview.focus();preview.select();}
    };
    const evidenceDraw = draw;
    draw = function() {evidenceDraw();status.textContent = "";preview.hidden = true;preview.value = evidence();};
})();
