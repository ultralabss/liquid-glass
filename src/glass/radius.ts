/** Concentric radius for a surface nested inside another: inner = outer − padding. */
export function concentric(outer: string, padding: string): string {
  return `max(0px, calc(${outer} - ${padding}))`;
}
