/**
 * Keyed live collection: upsert / patch / remove / reset, notifications batched into ONE commit per animation frame
 * (capped at --ul-live-max-fps). Structure listeners (keys added / removed / reset) and per-key listeners, so a table
 * re-renders only the rows that changed and never the whole table for one message.
 */
import * as React from 'react';
import type { LiveSource } from './liveSource.ts';

export type LiveOp<R> = { op: 'upsert'; value: R } | { op: 'patch'; key: string; value: Partial<R> } | { op: 'remove'; key: string } | { op: 'reset'; values: R[] };
export interface LiveCommit { inserted: string[]; updated: string[]; removed: string[]; reset: boolean; version: number }
export interface LiveStore<R> {
  get(key: string): R | undefined;
  keys(): string[];
  values(): R[];
  readonly size: number;
  readonly version: number;
  upsert(value: R): void;
  patch(key: string, value: Partial<R>): void;
  remove(key: string): void;
  reset(values: R[]): void;
  apply(op: LiveOp<R> | LiveOp<R>[]): void;
  /** Every commit (structure + values). */
  subscribe(fn: (c: LiveCommit) => void): () => void;
  /** One key's value changed (or it was removed). */
  subscribeKey(key: string, fn: () => void): () => void;
  /** Stop committing (ops are still applied to the data; listeners are told once on resume). */
  pause(): void;
  resume(): void;
  readonly paused: boolean;
  /** Synchronous commit (tests). */
  flush(): void;
}
export interface LiveStoreOptions<R> {
  key: (r: R) => string;
  /** patch merge (default shallow). */
  merge?: (prev: R, next: Partial<R>) => R;
  /** Commits per second cap. Default --ul-live-max-fps. */
  maxRate?: number;
}

export function createLiveStore<R>(o: LiveStoreOptions<R>): LiveStore<R> {
  const map = new Map<string, R>(); let order: string[] = [];
  const subs = new Set<(c: LiveCommit) => void>(), keySubs = new Map<string, Set<() => void>>();
  const merge = o.merge ?? ((a: R, b: Partial<R>) => ({ ...a, ...b }));
  const fps = o.maxRate ?? (parseFloat(typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--ul-live-max-fps') : '') || 60);
  let ins = new Set<string>(), upd = new Set<string>(), rem = new Set<string>(), wasReset = false, version = 0, raf = 0, last = 0, paused = false, orderDirty = false;
  const commit = () => {
    raf = 0;
    if (paused) return;
    const now = performance.now(), gap = 1000 / fps;
    if (now - last < gap - 1) { raf = requestAnimationFrame(commit); return; }
    last = now;
    if (orderDirty) { order = [...map.keys()]; orderDirty = false; }
    if (!ins.size && !upd.size && !rem.size && !wasReset) return;
    const c: LiveCommit = { inserted: [...ins], updated: [...upd].filter((k) => !ins.has(k)), removed: [...rem], reset: wasReset, version: ++version };
    const touched = new Set([...upd, ...rem, ...ins]);
    ins = new Set(); upd = new Set(); rem = new Set(); wasReset = false;
    touched.forEach((k) => keySubs.get(k)?.forEach((f) => f()));
    subs.forEach((f) => f(c));
  };
  const kick = () => { if (!raf && !paused) raf = requestAnimationFrame(commit); };
  const api: LiveStore<R> = {
    get: (k) => map.get(k),
    keys: () => { if (orderDirty) { order = [...map.keys()]; orderDirty = false; } return order; },
    values: () => api.keys().map((k) => map.get(k)!),
    get size() { return map.size; },
    get version() { return version; },
    upsert(v) { const k = o.key(v); if (map.has(k)) { map.set(k, v); if (!ins.has(k)) upd.add(k); } else { map.set(k, v); orderDirty = true; if (rem.has(k)) { rem.delete(k); upd.add(k); } else ins.add(k); } kick(); },
    patch(k, v) { const p = map.get(k); if (!p) return; map.set(k, merge(p, v)); if (!ins.has(k)) upd.add(k); kick(); },
    remove(k) { if (!map.delete(k)) return; orderDirty = true; if (ins.has(k)) ins.delete(k); else { upd.delete(k); rem.add(k); } kick(); },
    reset(values) { const old = [...map.keys()]; map.clear(); values.forEach((v) => map.set(o.key(v), v)); orderDirty = true; wasReset = true; old.forEach((k) => keySubs.has(k) && upd.add(k)); ins = new Set(); rem = new Set(); kick(); },
    apply(op) {
      for (const x of Array.isArray(op) ? op : [op]) {
        if (x.op === 'upsert') api.upsert(x.value); else if (x.op === 'patch') api.patch(x.key, x.value); else if (x.op === 'remove') api.remove(x.key); else if (x.op === 'reset') api.reset(x.values);
      }
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    subscribeKey(k, fn) { let s = keySubs.get(k); if (!s) keySubs.set(k, (s = new Set())); s.add(fn); return () => { s!.delete(fn); if (!s!.size) keySubs.delete(k); }; },
    pause() { paused = true; cancelAnimationFrame(raf); raf = 0; },
    resume() { if (!paused) return; paused = false; kick(); },
    get paused() { return paused; },
    flush() { cancelAnimationFrame(raf); last = 0; commit(); },
  };
  return api;
}

/** Default message → op mapping: `{ op, ... }` objects pass through; anything else is an upsert of the message itself. */
const toOps = <R,>(m: unknown): LiveOp<R>[] => {
  if (Array.isArray(m)) return m.flatMap((x) => toOps<R>(x));
  if (m && typeof m === 'object' && 'op' in (m as object)) return [m as LiveOp<R>];
  return [{ op: 'upsert', value: m as R }];
};

/** Keyed store fed by a live source. The store is stable for the component's life; the source is started / stopped with it. */
export function useLiveStore<R, M = unknown>(source: LiveSource<M> | null, o: LiveStoreOptions<R> & { toOps?: (m: M) => LiveOp<R> | LiveOp<R>[]; initial?: R[]; autoStart?: boolean }): LiveStore<R> {
  const ref = React.useRef<LiveStore<R> | null>(null);
  if (!ref.current) { ref.current = createLiveStore<R>(o); if (o.initial) { o.initial.forEach((v) => ref.current!.upsert(v)); ref.current.flush(); } }
  const store = ref.current;
  const map = React.useRef(o.toOps); map.current = o.toOps;
  React.useEffect(() => {
    if (!source) return;
    const off = source.subscribe((batch) => { for (const m of batch) store.apply(map.current ? map.current(m) : toOps<R>(m)); });
    if (o.autoStart !== false) source.start();
    return () => { off(); if (o.autoStart !== false) source.stop(); };
  }, [source]);
  return store;
}
/** Re-renders on structure changes only (insert / remove / reset). */
export function useLiveKeys<R>(store: LiveStore<R>): string[] {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => store.subscribe((c) => { if (c.inserted.length || c.removed.length || c.reset) force(); }), [store]);
  return store.keys();
}
/** One row; re-renders only when that key changes. */
export function useLiveRow<R>(store: LiveStore<R>, key: string): R | undefined {
  const [, force] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => store.subscribeKey(key, force), [store, key]);
  return store.get(key);
}
/** Any derived value; re-renders only when `eq` says it changed. */
export function useLiveSelector<R, T>(store: LiveStore<R>, select: (s: LiveStore<R>) => T, eq: (a: T, b: T) => boolean = Object.is): T {
  const sel = React.useRef(select); sel.current = select;
  const [v, setV] = React.useState(() => select(store));
  const cur = React.useRef(v); cur.current = v;
  React.useEffect(() => store.subscribe(() => { const n = sel.current(store); if (!eq(cur.current, n)) { cur.current = n; setV(() => n); } }), [store]);
  return v;
}
/** Live status of a source (re-renders on status changes). */
export function useLiveStatus(source: LiveSource | null): { status: string; info?: { attempt?: number; retryIn?: number } } {
  const [s, setS] = React.useState<{ status: string; info?: { attempt?: number; retryIn?: number } }>({ status: source?.status ?? 'offline' });
  React.useEffect(() => { if (!source) return; setS({ status: source.status }); return source.onStatus((status, info) => setS({ status: source.paused ? 'paused' : status, info })); }, [source]);
  return s;
}
