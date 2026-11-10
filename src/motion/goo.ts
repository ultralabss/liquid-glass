const SVG_NS = 'http://www.w3.org/2000/svg';
export const GOO_FILTER_ID = 'ul-goo';

/** Shared gooey filter (blur + alpha threshold). Applied only to non-glass helper layers, never to glass or its ancestors. */
export function ensureGooFilter(): string {
  if (typeof document === 'undefined' || document.getElementById(GOO_FILTER_ID)) return GOO_FILTER_ID;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-ul-goo-defs', '');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
  svg.innerHTML =
    `<defs><filter id="${GOO_FILTER_ID}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    '<feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b"/>' +
    '<feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" result="g"/>' +
    '<feComposite in="SourceGraphic" in2="g" operator="atop"/>' +
    '</filter></defs>';
  document.body.appendChild(svg);
  return GOO_FILTER_ID;
}
