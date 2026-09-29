type Chunk<T> = {items: Array<T | undefined>, offset: number, next?: Chunk<T>};

/** FIFO with bounded backing arrays; consumed values and chunks are released immediately. */
export class WorkQueue<T> {
    private head: Chunk<T> = {items: [], offset: 0};
    private tail = this.head;
    private count = 0;

    get length() { return this.count; }

    set length(value: number) {
        if (value !== 0) throw new Error("WorkQueue only supports clearing its length");
        this.head = this.tail = {items: [], offset: 0};
        this.count = 0;
    }

    push(value: T) {
        if (this.tail.items.length === 1024) {
            this.tail.next = {items: [], offset: 0};
            this.tail = this.tail.next;
        }
        this.tail.items.push(value);
        this.count++;
    }

    shift(): T | undefined {
        if (this.count === 0) return undefined;
        const value = this.head.items[this.head.offset];
        this.head.items[this.head.offset++] = undefined;
        this.count--;
        if (this.head.offset === this.head.items.length && this.head.next)
            this.head = this.head.next;
        if (this.count === 0) this.length = 0;
        return value;
    }
}
