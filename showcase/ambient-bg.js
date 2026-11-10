// <ul-ambient-bg animate="true|false"> — the showcase's animated backdrop (blobs, grid, stripes, rings, wordmark, noise).
// Showcase-only, not part of the library. Animates transform only, blobs drawn on a half-size layer scaled 2×.
// Pauses (animation-play-state) when: the tab is hidden, the page scrolls fast, no input for --ul-perf-ambient-idle ms,
// more than --ul-perf-ambient-max-glass glass surfaces are visible, or prefers-reduced-motion. Reason in data-paused.
(function () {
  if (customElements.get('ul-ambient-bg')) return;
  const CSS = `
  :host{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none;background:var(--ul-color-graphite);contain:strict}
  .blobs{position:absolute;left:0;top:0;width:50%;height:50%;transform:scale(2);transform-origin:0 0;will-change:transform}
  .blob{position:absolute;border-radius:50%;will-change:transform}
  .a{width:29vmax;height:29vmax;left:48%;top:-18%;background:radial-gradient(closest-side,rgb(var(--ul-color-ice-rgb)/.7),rgb(var(--ul-color-ice-rgb)/0));animation:dA 28s ease-in-out infinite alternate}
  .b{width:25vmax;height:25vmax;left:-14%;top:36%;background:radial-gradient(closest-side,rgb(var(--ul-color-violet-rgb)/.7),rgb(var(--ul-color-violet-rgb)/0));animation:dB 34s ease-in-out infinite alternate}
  .c{width:22vmax;height:22vmax;left:38%;top:58%;background:radial-gradient(closest-side,rgb(var(--ul-color-steel-2-rgb)/.7),rgb(var(--ul-color-steel-2-rgb)/0));animation:dC 30s ease-in-out infinite alternate}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgb(var(--ul-color-white-rgb)/.1) 1px,transparent 1px),linear-gradient(90deg,rgb(var(--ul-color-white-rgb)/.1) 1px,transparent 1px);background-size:56px 56px}
  .stripes{position:absolute;left:-10%;width:140%;top:54%;height:110px;transform:rotate(-8deg);background-image:repeating-linear-gradient(90deg,rgb(var(--ul-color-white-rgb)/.6) 0 3px,transparent 3px 18px);animation:sl 18s linear infinite alternate;will-change:transform}
  .r1{position:absolute;right:6vw;top:18vh;width:200px;height:200px;border-radius:50%;border:10px solid var(--ul-color-ice)}
  .r2{position:absolute;right:24vw;top:58vh;width:120px;height:120px;border-radius:50%;border:6px solid var(--ul-color-silver-hi)}
  .word{position:absolute;left:-2vw;bottom:-5vw;font:800 23vw/1 var(--ul-font-sans,system-ui);letter-spacing:-.04em;color:transparent;-webkit-text-stroke:2px rgb(var(--ul-color-white-rgb)/.5);white-space:nowrap}
  .noise{position:absolute;inset:0;opacity:.1;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
  :host(:not([animate="true"])) .blob,:host(:not([animate="true"])) .stripes{animation:none}
  :host([data-paused]) .blob,:host([data-paused]) .stripes{animation-play-state:paused}
  @keyframes dA{to{transform:translate(-8vw,7vh) scale(1.25)}}
  @keyframes dB{from{transform:scale(1.1)}to{transform:translate(10vw,-5vh) scale(.9)}}
  @keyframes dC{from{transform:scale(.9)}to{transform:translate(-6vw,-8vh) scale(1.2)}}
  @keyframes sl{from{transform:rotate(-8deg) translateX(0)}to{transform:rotate(-8deg) translateX(-180px)}}`;
  const num = (k, f) => { const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(k)); return Number.isFinite(v) ? v : f; };
  class AmbientBg extends HTMLElement {
    static get observedAttributes() { return ['animate']; }
    connectedCallback() {
      if (!this.shadowRoot) {
        const r = this.attachShadow({ mode: 'open' });
        r.innerHTML = `<style>${CSS}</style><div class="blobs"><div class="blob a"></div><div class="blob b"></div><div class="blob c"></div></div><div class="grid"></div><div class="stripes"></div><div class="r1"></div><div class="r2"></div><div class="word">ULTRALABS</div><div class="noise"></div>`;
        this.setAttribute('aria-hidden', 'true');
      }
      this.lastInput = performance.now(); this.lastY = scrollY; this.lastT = performance.now(); this.fast = 0;
      this.onInput = () => { this.lastInput = performance.now(); this.check(); };
      this.onScroll = () => {
        const t = performance.now(), v = Math.abs(scrollY - this.lastY) / Math.max(1, t - this.lastT);
        this.lastY = scrollY; this.lastT = t; this.lastInput = t;
        if (v > 1.5) this.fast = t + 250; // > 1.5 px/ms: pause until scrolling slows
        this.check();
      };
      this.onVis = () => this.check();
      for (const e of ['pointermove', 'pointerdown', 'keydown', 'wheel']) addEventListener(e, this.onInput, { passive: true });
      addEventListener('scroll', this.onScroll, { passive: true, capture: true });
      document.addEventListener('visibilitychange', this.onVis);
      this.timer = setInterval(() => this.check(), 500);
      this.check();
    }
    disconnectedCallback() {
      for (const e of ['pointermove', 'pointerdown', 'keydown', 'wheel']) removeEventListener(e, this.onInput);
      removeEventListener('scroll', this.onScroll, { capture: true });
      document.removeEventListener('visibilitychange', this.onVis);
      clearInterval(this.timer);
    }
    attributeChangedCallback() { if (this.isConnected) this.check(); }
    check() {
      if (this.getAttribute('animate') !== 'true') { this.removeAttribute('data-paused'); return; }
      const t = performance.now(), g = window.UL && window.UL.getGlassStats ? window.UL.getGlassStats() : null;
      const reason = document.hidden ? 'hidden'
        : matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced-motion'
        : t < this.fast ? 'fast-scroll'
        : t - this.lastInput > num('--ul-perf-ambient-idle', 3000) ? 'idle'
        : g && g.visible > num('--ul-perf-ambient-max-glass', 12) ? 'glass-count'
        : '';
      if (reason) this.setAttribute('data-paused', reason); else this.removeAttribute('data-paused');
    }
  }
  customElements.define('ul-ambient-bg', AmbientBg);
})();
