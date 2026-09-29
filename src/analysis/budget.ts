import {getHeapStatistics} from "v8";
import {options} from "../options";

export class MemoryBudgetException extends Error {
    constructor(readonly phase: string, readonly heapMB: number) {
        super(`Heap budget reached during ${phase} (${heapMB.toFixed(1)} MiB)`);
    }
}

/** Cooperative guard; cannot interrupt an individual large allocation. */
export class MemoryBudget {
    private last = -Infinity;

    check(phase: string, force = false, reserveMB = 0) {
        if (options.maxHeapMb === undefined)
            return;
        const now = performance.now();
        if (!force && now - this.last < 50)
            return;
        this.last = now;
        const heapMB = getHeapStatistics().used_heap_size / 1048576;
        if (heapMB >= options.maxHeapMb + reserveMB)
            throw new MemoryBudgetException(phase, heapMB);
    }
}
