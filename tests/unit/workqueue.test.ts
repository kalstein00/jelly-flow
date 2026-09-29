import {WorkQueue} from "../../src/misc/workqueue";
import Solver from "../../src/analysis/solver";
import {resetOptions} from "../../src/options";

test("FIFO order survives chunk boundaries and enqueues during consumption", () => {
    const q = new WorkQueue<number>();
    for (let i = 0; i < 3000; i++) q.push(i);
    for (let i = 0; i < 2000; i++) expect(q.shift()).toBe(i);
    for (let i = 3000; i < 5000; i++) q.push(i);
    expect(q.length).toBe(3000);
    for (let i = 2000; i < 5000; i++) expect(q.shift()).toBe(i);
    expect(q.shift()).toBeUndefined();
    q.push(7);
    q.length = 0;
    q.push(8);
    expect(q.shift()).toBe(8);
});

test("bounded listeners added during a wave wait behind that wave and non-bounded work", async () => {
    resetOptions();
    const solver = new Solver(), f = solver.fragmentState, seen: string[] = [];
    f.postponedListenerCalls2.push([() => {
        seen.push("A");
        f.postponedListenerCalls2.push([() => { seen.push("C"); }, undefined]);
        f.postponedListenerCalls.push([() => { seen.push("U"); }, undefined]);
    }, undefined]);
    f.postponedListenerCalls2.push([() => { seen.push("B"); }, undefined]);
    await solver.propagate("Testing");
    expect(seen).toEqual(["A", "B", "U", "C"]);
    expect(f.postponedListenerCalls.length + f.postponedListenerCalls2.length).toBe(0);
});
