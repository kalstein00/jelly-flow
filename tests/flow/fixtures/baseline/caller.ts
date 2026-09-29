import { leaf as renamed, A, B } from './leaf';
import { forwarded } from './barrel';
export function direct() { return renamed(); }
export function viaBarrel() { return forwarded(); }
export function methods() { return new A().run() + new B().run(); }
function invoke(fn: () => number) { return fn(); }
export function viaCallback() { return invoke(renamed); }
function useCallback<T extends Function>(fn:T):T { return fn; }
export const wrapped = useCallback(() => renamed());
export function callWrapped() { return wrapped(); }
const handlers = new Map<string, () => number>();
export function register() { handlers.set('save', renamed); }
export function dispatch() { return handlers.get('save')?.(); }
