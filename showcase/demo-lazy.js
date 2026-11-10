// Showcase helper: lazy-mount a demo section when it comes near the viewport; `active` = on screen and the tab is visible.
// Live demos start only while active and stop when hidden (no timers, sockets or rAF loops off screen).
(function () {
  function define() {
    const React = window.React, h = React.createElement;
    function Lazy({ minHeight = 240, render, children, label }) {
      const ref = React.useRef(null), [seen, setSeen] = React.useState(false), [on, setOn] = React.useState(false);
      React.useEffect(() => {
        const el = ref.current; let vis = false;
        const upd = () => setOn(vis && !document.hidden);
        const io = new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis) setSeen(true); upd(); }, { rootMargin: '200px 0px' });
        io.observe(el); document.addEventListener('visibilitychange', upd);
        return () => { io.disconnect(); document.removeEventListener('visibilitychange', upd); };
      }, []);
      return h('div', { ref, 'data-lazy': label, 'data-active': on ? '' : undefined, style: { minWidth: 0, minHeight: seen ? undefined : minHeight } },
        seen ? (render ? render(on) : children) : null);
    }
    window.ULDemos = Object.assign(window.ULDemos || {}, { Lazy });
  }
  if (window.React) define(); else window.addEventListener('ul:ready', define, { once: true });
})();
