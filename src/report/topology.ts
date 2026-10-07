import {ReportEdge, ReportModel} from "./report";

/** Iterative strongly connected components avoid recursion limits on large maps. */
export function annotateTopology(files: ReportModel["files"], edges: ReportEdge[]): void {
    const areas = new Map(files.map(f => [f.path, new Set(f.areas)]));
    for (const edge of edges) {
        const a = areas.get(edge.source)!, b = areas.get(edge.target)!;
        edge.crossArea = edge.source !== edge.target && a.size > 0 && b.size > 0 &&
            (a.size !== b.size || [...a].some(area => !b.has(area)));
        edge.cycle = false;
    }
    for (const kind of ["call", "import"]) {
        const forward = new Map<string, string[]>(), reverse = new Map<string, string[]>();
        for (const file of files) { forward.set(file.path, []); reverse.set(file.path, []); }
        const selected = edges.filter(e => e.kind === kind && e.source !== e.target);
        for (const edge of selected) { forward.get(edge.source)!.push(edge.target); reverse.get(edge.target)!.push(edge.source); }
        const visited = new Set<string>(), order: string[] = [];
        for (const file of files) {
            if (visited.has(file.path)) continue;
            const stack: Array<[string, boolean]> = [[file.path, false]];
            while (stack.length) {
                const [node, done] = stack.pop()!;
                if (done) { order.push(node); continue; }
                if (visited.has(node)) continue;
                visited.add(node); stack.push([node, true]);
                for (const next of forward.get(node)!) if (!visited.has(next)) stack.push([next, false]);
            }
        }
        const component = new Map<string, number>();
        let id = 0;
        for (const start of order.reverse()) {
            if (component.has(start)) continue;
            const stack = [start]; id++;
            while (stack.length) {
                const node = stack.pop()!;
                if (component.has(node)) continue;
                component.set(node, id);
                for (const next of reverse.get(node)!) if (!component.has(next)) stack.push(next);
            }
        }
        for (const edge of selected) edge.cycle = component.get(edge.source) === component.get(edge.target);
    }
}
