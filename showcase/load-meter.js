// Load meter for test pages: time to first script, UL ready, fixtures mounted; long tasks (PerformanceObserver, buffered).
(function () {
  if (window.__loadMeter) return;
  const t0 = performance.now(), marks = { script: Math.round(t0) }, lt = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) lt.push({ at: Math.round(e.startTime), d: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* unsupported */ }
  window.addEventListener('ul:ready', () => { marks.ul = Math.round(performance.now()); }, { once: true });
  window.__loadMeter = {
    mark(k) { if (!(k in marks)) marks[k] = Math.round(performance.now()); },
    report() {
      const tot = lt.reduce((a, e) => a + e.d, 0), max = lt.reduce((a, e) => Math.max(a, e.d), 0);
      return { marks: { ...marks }, longTasks: lt.length, longTaskMs: tot, longestMs: max };
    },
    text() { const r = this.report(); return Object.entries(r.marks).map(([k, v]) => k + ' ' + v + 'ms').join(' · ') + ` · long tasks ${r.longTasks} (${r.longTaskMs}ms, max ${r.longestMs}ms)`; },
  };
})();
