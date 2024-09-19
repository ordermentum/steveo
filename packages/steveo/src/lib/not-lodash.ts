/**
 * Equivalent to _.bind
 */
export function bind(fn: Function, ctx: object, ...boundArgs: unknown[]) {
  return fn.bind(ctx, ...boundArgs);
}

/**
 * Equivalent to _.take
 */
export function take<T>(arr: Array<T>, qty = 1) {
  return [...arr].splice(0, qty);
}
