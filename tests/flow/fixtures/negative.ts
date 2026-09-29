function save() { return 1; }
function remove() { return 2; }
const handlers = new Map<string, () => number>();
handlers.set('save', save);
handlers.set('remove', remove);
export function saveOnly() { return handlers.get('save')!(); }
export function removeOnly() { return handlers.get('remove')!(); }
export function neverCalled() { return 3; }
saveOnly();
removeOnly();
