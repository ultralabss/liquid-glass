/**
 * Live data layer: transport-agnostic sources. The design system ships NO server URL, token or product backend.
 * The app supplies the transport target and the auth (getAuth callback / protocol or first-message strategy it controls).
 * Rules: wss only (ws:// only on localhost, dev warning), no credentials in URLs, optional schema validation, per-message
 * size limit, rate limiter with backpressure (drop | coalesce per stream), dedupe + out-of-order guard, reconnect with
 * exponential backoff + full jitter, heartbeat timeout, resume-token hook, pause / tab-hidden buffering with a cap.
 * Messages are data: render untrusted strings as text (React does), never as HTML.
 */
import { isDev } from '../components/shared/dev.ts';

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'stale' | 'offline' | 'paused' | 'error';
export interface TransportHandlers { open(): void; message(data: unknown): void; close(info?: { code?: number; reason?: string; fatal?: boolean }): void; error(e: unknown): void }
export interface TransportContext { auth: unknown; resumeToken: string | null; attempt: number }
export interface TransportConn { send?(data: unknown): void; close(): void }
export interface Transport { kind: string; connect(h: TransportHandlers, ctx: TransportContext): TransportConn }

export interface RateLimit { /** Messages per second per stream. */ max: number; /** drop: discard over the limit; coalesce: keep the latest per key and deliver it in the next slot. */ policy?: 'drop' | 'coalesce'; key?: (m: unknown) => string }
export interface LiveSourceOptions<M = unknown> {
  transport: Transport;
  /** Raw frame → message(s). Default: JSON.parse for strings, identity otherwise. Throw / return undefined to reject. */
  parse?: (raw: unknown) => M | M[] | undefined;
  /** Optional validation: a predicate, or a zod-like { safeParse }. Rejected messages are counted and dropped. */
  schema?: ((m: unknown) => boolean) | { safeParse(m: unknown): { success: boolean } };
  reconnect?: { base?: number; max?: number; retries?: number } | false;
  heartbeat?: { interval?: number; timeout?: number; ping?: () => unknown; isPong?: (m: M) => boolean } | false;
  /** frame (default): one delivery per animation frame; or a fixed interval in ms. */
  batch?: 'frame' | number;
  maxMessageBytes?: number;
  rateLimit?: RateLimit;
  /** Dedupe by id (LRU window) and drop out-of-order messages by per-key sequence. */
  idOf?: (m: M) => string | undefined;
  seqOf?: (m: M) => { key: string; seq: number } | undefined;
  /** Auth supplied by the app (never put it in the URL). Called before every (re)connect; its result goes to the transport. */
  getAuth?: () => unknown | Promise<unknown>;
  /** Resume after reconnect: the app keeps the token (e.g. last event id) and decides what it means. */
  resume?: { get(): string | null; onMessage?(m: M): void };
  /** Buffer while paused / hidden; oldest dropped beyond the cap. */
  bufferCap?: number;
  pauseWhenHidden?: boolean;
  staleAfter?: number;
}
export interface LiveStats { received: number; delivered: number; dropped: number; coalesced: number; duplicates: number; outOfOrder: number; rejected: number; oversized: number; reconnects: number; buffered: number; bufferMax: number }
export interface LiveSource<M = unknown> {
  subscribe(fn: (batch: M[]) => void): () => void;
  onStatus(fn: (s: LiveStatus, info?: { attempt?: number; retryIn?: number; error?: unknown }) => void): () => void;
  readonly status: LiveStatus;
  readonly stats: LiveStats;
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  readonly paused: boolean;
  send(data: unknown): void;
  /** Drop the connection and reconnect now (resets backoff). */
  reconnectNow(): void;
}

const root = () => (typeof document === 'undefined' ? null : getComputedStyle(document.documentElement));
const tok = (k: string, f: number) => { const v = parseFloat(root()?.getPropertyValue(k) ?? ''); return Number.isFinite(v) ? v : f; };
const SECRET = /^(token|access_token|id_token|auth|authorization|jwt|key|api_?key|apikey|password|secret|session|sig|signature)$/i;
const isLocal = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost');

/** Refuses credentials in the URL and insecure schemes outside localhost. */
export function checkLiveUrl(url: string, secure: 'ws' | 'http', allowInsecure = false): URL {
  const u = new URL(url, typeof location !== 'undefined' ? location.href : undefined);
  for (const k of u.searchParams.keys()) if (SECRET.test(k)) throw new Error(`live: credentials in the URL ("${k}") are not allowed; supply auth through getAuth`);
  if (u.username || u.password) throw new Error('live: credentials in the URL are not allowed');
  const insecure = secure === 'ws' ? u.protocol === 'ws:' : u.protocol === 'http:';
  if (insecure && !isLocal(u.hostname)) {
    if (isDev()) console.warn(`[UL live] insecure ${u.protocol}// outside localhost: ${u.host}. Use ${secure === 'ws' ? 'wss' : 'https'}.`);
    if (!allowInsecure) throw new Error(`live: ${u.protocol}// is only allowed on localhost`);
  }
  return u;
}

/* ---------------- transports ---------------- */
export interface WebSocketTransportOptions {
  /** How the app's auth reaches the server: as a subprotocol value, or as the first message after open. Default first-message. */
  authStrategy?: 'first-message' | 'protocol' | 'none';
  allowInsecure?: boolean;
}
export function websocket(url: string, protocols?: string | string[], o: WebSocketTransportOptions = {}): Transport {
  const u = checkLiveUrl(url, 'ws', o.allowInsecure);
  return {
    kind: 'websocket',
    connect(h, ctx) {
      const strat = o.authStrategy ?? 'first-message';
      const prot = ([] as string[]).concat(protocols ?? []);
      if (strat === 'protocol' && typeof ctx.auth === 'string') prot.push(ctx.auth);
      const ws = new WebSocket(u.href, prot.length ? prot : undefined);
      ws.onopen = () => {
        if (strat === 'first-message' && ctx.auth != null) ws.send(typeof ctx.auth === 'string' ? ctx.auth : JSON.stringify(ctx.auth));
        h.open();
      };
      ws.onmessage = (e) => h.message(e.data);
      ws.onerror = (e) => h.error(e);
      ws.onclose = (e) => h.close({ code: e.code, reason: e.reason, fatal: e.code === 1008 || e.code === 4401 || e.code === 4403 });
      return { send: (d) => ws.readyState === 1 && ws.send(typeof d === 'string' ? d : JSON.stringify(d)), close: () => { ws.onclose = null; ws.close(1000); } };
    },
  };
}
/** Server-sent events. Auth only through cookies (withCredentials): EventSource cannot set headers, and URLs never carry tokens. */
export function sse(url: string, o: { withCredentials?: boolean; events?: string[]; allowInsecure?: boolean } = {}): Transport {
  const u = checkLiveUrl(url, 'http', o.allowInsecure);
  return {
    kind: 'sse',
    connect(h, ctx) {
      const href = new URL(u.href); if (ctx.resumeToken) href.searchParams.set('lastEventId', ctx.resumeToken);
      const es = new EventSource(href.href, { withCredentials: o.withCredentials ?? true });
      es.onopen = () => h.open();
      const on = (e: MessageEvent) => h.message(e.data);
      es.onmessage = on; (o.events ?? []).forEach((n) => es.addEventListener(n, on as EventListener));
      es.onerror = () => { if (es.readyState === 2) h.close({}); else h.error(new Error('sse error')); };
      return { close: () => es.close() };
    },
  };
}
/** Polling: fn returns the new messages since the last call (the app decides how). */
export function polling(fn: (ctx: TransportContext) => Promise<unknown[]>, interval = 2000): Transport {
  return {
    kind: 'polling',
    connect(h, ctx) {
      let dead = false, t = 0;
      const tick = async () => {
        if (dead) return;
        try { const list = await fn(ctx); if (dead) return; list.forEach((m) => h.message(m)); } catch (e) { h.error(e); }
        if (!dead) t = window.setTimeout(tick, interval);
      };
      queueMicrotask(() => { if (!dead) { h.open(); tick(); } });
      return { close: () => { dead = true; clearTimeout(t); } };
    },
  };
}

/* ---------------- mock socket (showcase / tests) ---------------- */
export interface MockOptions {
  /** Messages per second. */
  rate?: number;
  /** ms of latency (+ random jitter). */
  latency?: number; jitter?: number;
  /** 0..1 probabilities. */
  drops?: number; duplicates?: number; reorder?: number;
  /** Generates message number `seq`. */
  generate: (seq: number) => unknown;
  /** Stop answering (simulated dead connection, no close event): heartbeat test. */
  silent?: boolean;
  /** Fail the first n connects (backoff test). */
  failConnects?: number;
}
export interface MockControls { set(o: Partial<MockOptions>): void; burst(n: number): void; disconnect(code?: number): void; readonly options: MockOptions; readonly connects: number; readonly sent: number; inject(raw: unknown): void }
export function mock(opts: MockOptions): Transport & { controls: MockControls } {
  const o: MockOptions = { rate: 5, latency: 0, jitter: 0, drops: 0, duplicates: 0, reorder: 0, ...opts };
  let h: TransportHandlers | null = null, timer = 0, seq = 0, connects = 0, sent = 0, alive = false;
  const out = (m: unknown) => {
    if (!alive || !h || o.silent) return;
    if (Math.random() < (o.drops ?? 0)) return;
    const raw = typeof m === 'string' ? m : JSON.stringify(m);
    const d = (o.latency ?? 0) + Math.random() * (o.jitter ?? 0) + (Math.random() < (o.reorder ?? 0) ? 40 + Math.random() * 80 : 0);
    const send = () => { if (alive && h) { sent++; h.message(raw); } };
    if (d > 0) setTimeout(send, d); else send();
    if (Math.random() < (o.duplicates ?? 0)) setTimeout(send, d + 5);
  };
  const loop = () => {
    clearTimeout(timer);
    if (!alive) return;
    const r = Math.max(0, o.rate ?? 0);
    if (r === 0) { timer = window.setTimeout(loop, 250); return; }
    const every = 1000 / r, n = every < 4 ? Math.round(4 / every) : 1; // high rates: several per tick
    for (let i = 0; i < n; i++) out(o.generate(++seq));
    timer = window.setTimeout(loop, Math.max(4, every * n));
  };
  const controls: MockControls = {
    set(p) { Object.assign(o, p); if (alive) loop(); },
    burst(n) { for (let i = 0; i < n; i++) out(o.generate(++seq)); },
    disconnect(code = 1006) { if (!alive) return; alive = false; clearTimeout(timer); const hh = h; h = null; hh?.close({ code, reason: 'mock disconnect' }); },
    inject(raw) { if (alive && h) h.message(raw); },
    get options() { return o; }, get connects() { return connects; }, get sent() { return sent; },
  };
  return {
    kind: 'mock', controls,
    connect(handlers) {
      connects++;
      h = handlers;
      const fail = (o.failConnects ?? 0) > 0;
      setTimeout(() => {
        if (h !== handlers) return;
        if (fail) { o.failConnects!--; h = null; handlers.close({ code: 1006, reason: 'mock refused' }); return; }
        alive = true; handlers.open(); loop();
      }, 30 + (o.latency ?? 0));
      return { send: () => {}, close: () => { if (h === handlers) { alive = false; clearTimeout(timer); h = null; } } };
    },
  };
}

/* ---------------- source ---------------- */
export function createLiveSource<M = unknown>(o: LiveSourceOptions<M>): LiveSource<M> {
  const subs = new Set<(b: M[]) => void>(), statusSubs = new Set<(s: LiveStatus, i?: { attempt?: number; retryIn?: number; error?: unknown }) => void>();
  const stats: LiveStats = { received: 0, delivered: 0, dropped: 0, coalesced: 0, duplicates: 0, outOfOrder: 0, rejected: 0, oversized: 0, reconnects: 0, buffered: 0, bufferMax: 0 };
  const rc = o.reconnect === false ? null : { base: o.reconnect?.base ?? tok('--ul-live-backoff-base', 500), max: o.reconnect?.max ?? tok('--ul-live-backoff-max', 30000), retries: o.reconnect?.retries ?? Infinity };
  const hb = o.heartbeat === false ? null : { interval: o.heartbeat?.interval ?? tok('--ul-live-heartbeat', 15000), timeout: o.heartbeat?.timeout ?? tok('--ul-live-heartbeat-timeout', 5000), ping: o.heartbeat?.ping, isPong: o.heartbeat?.isPong };
  const maxBytes = o.maxMessageBytes ?? tok('--ul-live-message-max', 65536), cap = o.bufferCap ?? tok('--ul-live-buffer-cap', 5000), staleAfter = o.staleAfter ?? tok('--ul-live-stale-after', 10000);
  let status: LiveStatus = 'offline', conn: TransportConn | null = null, attempt = 0, running = false, userPaused = false, hidden = false;
  let retryT = 0, hbT = 0, pingT = 0, staleT = 0, lastMsg = 0, flushRaf = 0, flushT = 0;
  const queue: M[] = []; // waiting for the next frame (or while paused / hidden)
  const seen = new Map<string, true>(), lastSeq = new Map<string, number>();
  // token bucket for the rate limiter
  let tokens = o.rateLimit?.max ?? Infinity, refill = performance.now();
  const coalesced = new Map<string, M>();
  const set = (s: LiveStatus, i?: { attempt?: number; retryIn?: number; error?: unknown }) => { if (s === status && !i) return; status = s; statusSubs.forEach((f) => f(s, i)); };
  const effective = (): LiveStatus => (userPaused ? 'paused' : status);
  const valid = (m: unknown) => { const s = o.schema; if (!s) return true; try { return typeof s === 'function' ? s(m) : s.safeParse(m).success; } catch { return false; } };
  const push = (m: M) => {
    queue.push(m);
    if (queue.length > cap) { queue.splice(0, queue.length - cap); stats.dropped++; }
    stats.buffered = queue.length; stats.bufferMax = Math.max(stats.bufferMax, queue.length);
  };
  const flush = () => {
    flushRaf = 0; flushT = 0;
    if (userPaused || hidden) return;
    if (coalesced.size) { coalesced.forEach((m) => queue.push(m)); coalesced.clear(); }
    if (!queue.length) return;
    const batch = queue.splice(0, queue.length);
    stats.buffered = 0; stats.delivered += batch.length;
    subs.forEach((f) => f(batch));
  };
  const schedule = () => {
    if (userPaused || hidden || flushRaf || flushT) return;
    if (o.batch == null || o.batch === 'frame') flushRaf = requestAnimationFrame(flush); else flushT = window.setTimeout(flush, o.batch);
  };
  const accept = (m: M) => {
    const id = o.idOf?.(m);
    if (id != null) { if (seen.has(id)) { stats.duplicates++; return; } seen.set(id, true); if (seen.size > 4096) seen.delete(seen.keys().next().value as string); }
    const sq = o.seqOf?.(m);
    if (sq) { const prev = lastSeq.get(sq.key); if (prev != null && sq.seq <= prev) { stats.outOfOrder++; return; } lastSeq.set(sq.key, sq.seq); }
    if (hb?.isPong?.(m)) return;
    o.resume?.onMessage?.(m);
    const rl = o.rateLimit;
    if (rl) {
      const now = performance.now(); tokens = Math.min(rl.max, tokens + ((now - refill) / 1000) * rl.max); refill = now;
      if (tokens < 1) {
        if (rl.policy === 'coalesce' && rl.key) { coalesced.set(rl.key(m), m); stats.coalesced++; schedule(); } else stats.dropped++;
        return;
      }
      tokens -= 1;
    }
    push(m); schedule();
  };
  const onRaw = (raw: unknown) => {
    stats.received++; lastMsg = performance.now(); armHeartbeat(); armStale();
    if (status === 'stale' || status === 'connecting' || status === 'reconnecting') set('live');
    if (typeof raw === 'string' && raw.length > maxBytes / 4 && new TextEncoder().encode(raw).length > maxBytes) { stats.oversized++; return; }
    let parsed: M | M[] | undefined;
    try { parsed = o.parse ? o.parse(raw) : (typeof raw === 'string' ? JSON.parse(raw) : raw) as M; } catch { stats.rejected++; return; }
    if (parsed === undefined) { stats.rejected++; return; }
    for (const m of Array.isArray(parsed) ? parsed : [parsed]) { if (!valid(m)) { stats.rejected++; if (isDev()) console.warn('[UL live] schema rejected a message'); continue; } accept(m); }
  };
  const armStale = () => { clearTimeout(staleT); if (!running) return; staleT = window.setTimeout(() => { if (status === 'live') set('stale'); }, staleAfter); };
  const armHeartbeat = () => {
    if (!hb) return;
    clearTimeout(hbT); clearTimeout(pingT);
    pingT = window.setTimeout(() => { if (hb.ping) conn?.send?.(hb.ping()); }, hb.interval);
    hbT = window.setTimeout(() => { if (performance.now() - lastMsg >= hb.interval + hb.timeout - 5) { conn?.close(); conn = null; retry(new Error('heartbeat timeout')); } }, hb.interval + hb.timeout);
  };
  const retry = (error?: unknown) => {
    clearTimeout(hbT); clearTimeout(pingT); clearTimeout(staleT);
    if (!running) return;
    if (!rc) { set('error', { error }); return; }
    if (attempt >= rc.retries) { set('error', { error, attempt }); return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { set('offline'); return; } // 'online' event reconnects
    const exp = Math.min(rc.max, rc.base * 2 ** attempt), wait = Math.round(Math.random() * exp); // full jitter
    attempt++; stats.reconnects++;
    set('reconnecting', { attempt, retryIn: wait, error });
    clearTimeout(retryT); retryT = window.setTimeout(connect, wait);
  };
  const connect = async () => {
    if (!running) return;
    set(attempt ? 'reconnecting' : 'connecting', attempt ? { attempt } : undefined);
    let auth: unknown = null;
    try { auth = o.getAuth ? await o.getAuth() : null; } catch (e) { set('error', { error: e }); return; }
    if (!running) return;
    const myConn = { current: null as TransportConn | null };
    myConn.current = conn = o.transport.connect({
      open: () => { if (conn !== myConn.current) return; attempt = 0; lastMsg = performance.now(); set('live'); armHeartbeat(); armStale(); },
      message: (d) => { if (conn === myConn.current) onRaw(d); },
      error: () => { /* close follows */ },
      close: (info) => { if (conn !== myConn.current) return; conn = null; if (info?.fatal) { set('error', { error: info }); return; } retry(info); },
    }, { auth, resumeToken: o.resume?.get() ?? null, attempt });
  };
  const onVis = () => { const h = document.hidden; if (h === hidden) return; hidden = h; if (!hidden) schedule(); };
  const onOnline = () => { if (running && status === 'offline') { attempt = 0; connect(); } };
  const onOffline = () => { if (running) { conn?.close(); conn = null; set('offline'); } };
  const api: LiveSource<M> = {
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    onStatus(fn) { statusSubs.add(fn); return () => statusSubs.delete(fn); },
    get status() { return effective(); },
    get stats() { return stats; },
    get paused() { return userPaused; },
    start() {
      if (running) return; running = true; attempt = 0;
      if (o.pauseWhenHidden !== false && typeof document !== 'undefined') { hidden = document.hidden; document.addEventListener('visibilitychange', onVis); }
      addEventListener('online', onOnline); addEventListener('offline', onOffline);
      connect();
    },
    stop() {
      running = false; clearTimeout(retryT); clearTimeout(hbT); clearTimeout(pingT); clearTimeout(staleT); cancelAnimationFrame(flushRaf); clearTimeout(flushT); flushRaf = flushT = 0;
      conn?.close(); conn = null; document.removeEventListener('visibilitychange', onVis); removeEventListener('online', onOnline); removeEventListener('offline', onOffline);
      set('offline');
    },
    pause() { if (userPaused) return; userPaused = true; statusSubs.forEach((f) => f('paused')); },
    resume() { if (!userPaused) return; userPaused = false; statusSubs.forEach((f) => f(status)); schedule(); },
    send(d) { conn?.send?.(d); },
    reconnectNow() { conn?.close(); conn = null; attempt = 0; clearTimeout(retryT); if (running) connect(); },
  };
  return api;
}
