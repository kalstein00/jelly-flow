function first() { return 1; }
function second() { return 2; }
function unknown() { return 3; }
function third() { return 4; }
const map = new Map();
map.set('save', first);
map.set('save', second);
map.set('remove', third);
export function overwrite() { map.get('save')(); }
export function unknownRead(key) { map.get(key)(); }
export function unknownWrite(key) { map.set(key, unknown); }
export function knownAfterUnknown() { map.get('remove')(); }
const alias = map;
export function viaAlias() { alias.get('save')(); }
export function afterDelete() { map.delete('save'); map.get('save')(); }
export function afterClear() { map.clear(); map.get('remove')(); }
export function values() { for (const fn of map.values()) fn(); }
export function entries() { for (const [key, fn] of map.entries()) fn(); }
export function each() { map.forEach(fn => fn()); }

const constructed = new Map([['save', first], ['remove', second]]);
export function constructorRead() { constructed.get('save')(); }
const copied = new Map(map);
export function copiedRead() { copied.get('save')(); }
const chained = new Map().set('save', first).set('remove', second);
export function chainedRead() { chained.get('save')(); }
const typed = new Map();
typed.set('1', first);
typed.set(1, second);
export function stringKey() { typed.get('1')(); }
export function numberKey() { typed.get(1)(); }
const objectKey = {};
typed.set(objectKey, third);
export function objectRead() { typed.get(objectKey)(); }
let reassigned = new Map();
reassigned.set('save', first);
reassigned = new Map();
reassigned.set('save', second);
export function reassignedRead() { reassigned.get('save')(); }

const spread = new Map();
spread.set(...['save', first]);
spread.set('remove', second);
export function spreadRead() { spread.get('save')(); }

const primitives = new Map();
primitives.set(false, first);
primitives.set(null, second);
primitives.set(-0, third);
export function booleanKey() { primitives.get(false)(); }
export function nullKey() { primitives.get(null)(); }
export function zeroKey() { primitives.get(0)(); }
const keyFunctions = new Map();
keyFunctions.set(first, second);
export function keys() { for (const fn of keyFunctions.keys()) fn(); }
export function defaultIterator() { for (const [key, fn] of keyFunctions) fn(); }
